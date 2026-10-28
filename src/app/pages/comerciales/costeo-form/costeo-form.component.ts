import { Component, OnInit, OnDestroy, ViewChildren, QueryList } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, Solicitud, SolicitudItem, SolicitudItemTalla } from '../../../services/comercial.service';
import { MoldService } from '../../../services/mold.service';
import { AuthService } from '../../../services/auth.service';
import { SpecGeneratorComponent } from '../../moldes/spec-generator/spec-generator.component';
import { CANONICAL_OPTIONAL_PARTS } from '../modals/canonical-optional-parts';

import Swal from 'sweetalert2';

export interface LocalItem {
  descripcion: string;
  item_cliente: string;
  siesa_item_rowid: number | null;
  siesa_item_ext_rowid: number | null;
  siesa_referencia: string;
  cantidad_muestra: number;
  tallas: { talla: string; cantidad: number; siesa_item_ext_rowid?: number | null }[];
  isNew: boolean;
  isExpanded: boolean;
  // Ítem de referencia (opcional, para ítems nuevos basados en uno existente)
  ref_siesa_item_rowid: number | null;
  ref_siesa_referencia: string;
  ref_siesa_descripcion: string;
  // Per-item mold config
  categoryId: number | null;
  categoryName: string;
  moldId: number | null;
  moldName: string;
  technicalSpecId: number | null;
  opmReference?: string;
  totalSamTime?: number;
  specExpanded: boolean;
  availableMolds: any[];
  activeTab?: 'tallas' | 'molde';
  draftComponents?: any[]; // Store in-progress OPM components
  zoneObservations?: { [zoneKey: string]: string };
  availableExtensions?: { talla: string; rawTalla?: string; siesa_item_ext_rowid?: number | null; color?: string }[];
}

export type AnatomicalFamily = 'SUPERIOR' | 'INFERIOR' | 'COMPLETA' | 'GENERAL' | 'SIN_MOLDE';

export interface AnatomicalColumn {
  key: string;
  label: string;
  tooltip: string;
  keywords: string[];
}

export interface AnatomicalGroup {
  id: AnatomicalFamily;
  title: string;
  subtitle: string;
  icon: string;
  badgeClass: string;
  borderClass: string;
  columns: AnatomicalColumn[];
  items: { item: LocalItem; originalIndex: number }[];
  totalUds: number;
  totalSam: number;
}

@Component({
  selector: 'app-costeo-form',
  templateUrl: './costeo-form.component.html',
  styleUrls: ['./costeo-form.component.css']
})
export class CosteoFormComponent implements OnInit, OnDestroy {
  @ViewChildren(SpecGeneratorComponent) specGenerators!: QueryList<SpecGeneratorComponent>;

  private autoSaveInterval: any;
  private saveDebounceTimer: any = null;
  private readonly STORAGE_KEY = 'saint_solicitud_draft';

  isEditMode = false;
  solicitudId: number | null = null;
  isSaving = false;
  isLoading = false;

  // Client info
  clienteId: number | null = null;
  clienteNombre = '';
  clienteNit = '';

  // Form fields
  requiereCosteo = false;
  requiereMuestra = false;
  fechaEntregaCotizacion = '';
  fechaEntregaMuestra = '';
  tipoDespacho: 'INTERNACIONAL' | 'NACIONAL' | 'LOCAL' = 'LOCAL';
  materialEmpaque = '';
  tipoEmpaque = '';
  observaciones = '';
  cantidadPorEntrega = 0;
  entregasAnual = 1;
  imagenReferenciaUrl = '';

  // Tallas predefinidas
  tallasNumericas: string[] = ['28', '30', '32', '34', '36', '38', '40', '42', '44', '46'];
  tallasLetra: string[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

  // Items
  items: LocalItem[] = [];

  // Mold Categories
  categories: any[] = [];

  // Modals
  showItemSearch = false;
  showMoldSelectorModal = false;
  moldSelectorItemIndex: number | null = null;
  selectedModalCategoryId: number | null = null;
  allMolds: any[] = [];
  isLoadingMolds = false;

  // Modal de Figurín & OPM
  showFigurinModal = false;
  activeFigurinItemIndex: number | null = null;
  activeFigurinItem: LocalItem | null = null;

  // Modal Rápido de Tallas
  showTallasQuickModal = false;
  activeTallasItemIndex: number | null = null;

  // Edición Inline de Descripción y Referencia
  editingItemIndex: number | null = null;
  editDescTemp = '';
  editRefTemp = '';

  // Modal Flotante de Variantes de Zona (Directo desde la tabla)
  showZoneVariantsModal = false;
  activeZoneItemIndex: number | null = null;
  activeZoneCol: AnatomicalColumn | null = null;
  activeZoneTitle = '';
  activeZoneSubtitle = '';
  activeZoneDisplayParts: any[] = [];
  activePartInModal: any = null;
  zoneModalStep: 'select-part' | 'select-variant' | 'select-optional' | 'select-optional-variant' = 'select-part';
  isLoadingZoneParts = false;
  activeZoneObservation = '';
  activeZoneAnchoredParts: any[] = [];
  private cachedMoldsMap: { [moldId: number]: any } = {};

  // Filtros y ordenamiento por regiones anatómicas
  selectedFamilyFilter: 'TODAS' | AnatomicalFamily = 'TODAS';
  anatomicalSortOrder: 'family' | 'qty' | 'sam' = 'family';
  _cachedAnatomicalGroups: AnatomicalGroup[] = [];

  // New item inline
  showNewItemForm = false;
  newItemDesc = '';
  newItemRef = '';

  // Reference item search (for new items)
  refSearchQuery = '';
  refSearchResults: any[] = [];
  refSearchingIndex: number | null = null;
  isSearchingRef = false;

  // Cliente selection
  clientes: any[] = [];
  busquedaCliente = '';
  showClienteSelect = false;

  // Active section
  activeSection = 0;
  sections = [
    { label: '1. Datos Generales & Empaque', icon: 'bi-file-earmark-text', desc: 'Cliente, entregas, empaque y despacho' },
    { label: '2. Ítems, Tallas & Moldes (OPM)', icon: 'bi-box-seam', desc: 'Ítems, desglose de tallas y moldes OPM' },
  ];

  constructor(
    private comercialService: ComercialService,
    private moldService: MoldService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const clienteIdParam = this.route.snapshot.paramMap.get('clienteId');

    if (idParam && idParam !== 'nuevo') {
      this.solicitudId = parseInt(idParam, 10);
      this.isEditMode = true;
      this.loadSolicitud();
    } else if (clienteIdParam) {
      this.clienteId = parseInt(clienteIdParam, 10);
      this.clienteNombre = this.route.snapshot.queryParamMap.get('nombre') || '';
      this.clienteNit = this.route.snapshot.queryParamMap.get('nit') || '';

      // Pre-load item if provided
      const preItemJson = this.route.snapshot.queryParamMap.get('pre_item');
      if (preItemJson) {
        try {
          const preItem = JSON.parse(preItemJson);
          this.addItemFromSiesa(preItem);
          this.activeSection = 1;
        } catch (e) {
          console.error('Error parsing pre-loaded item', e);
        }
      }
    }

    this.loadCategories();
    this.loadAllMolds();
    this.restoreFromLocalStorage();
    this.rebuildAnatomicalGroups();
    this.startAutoSave();
  }

  ngOnDestroy(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    this.saveToLocalStorage(true);
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
  }

  buscarClientes(): void {
    if (this.busquedaCliente.length < 3) {
      this.clientes = [];
      return;
    }

    this.comercialService.buscarClientes(this.busquedaCliente).subscribe({
      next: (res) => {
        this.clientes = res.data || [];
      },
      error: () => {}
    });
  }

  seleccionarCliente(cliente: any): void {
    this.clienteId = cliente.id;
    this.clienteNombre = cliente.razon_social;
    this.clienteNit = cliente.nit;
    this.showClienteSelect = false;
    this.busquedaCliente = '';
    this.clientes = [];
  }

  cambiarCliente(): void {
    this.showClienteSelect = true;
    setTimeout(() => {
      const input = document.getElementById('clienteSearchInput');
      if (input) input.focus();
    }, 100);
  }

  loadSolicitud(): void {
    if (!this.solicitudId) return;
    this.isLoading = true;
    this.comercialService.detalleSolicitud(this.solicitudId).subscribe({
      next: (res) => {
        const s = res.data;

        // Guard: prevent editing if solicitud is not in BORRADOR
        if (this.isEditMode && s.estado && s.estado !== 'BORRADOR') {
          Swal.fire({
            title: 'No se puede editar',
            text: 'Esta solicitud ya fue enviada y no se puede editar directamente. Para editarla, primero cámbiala a estado Borrador desde la vista de detalle.',
            icon: 'warning',
            confirmButtonText: 'Ir al detalle',
            confirmButtonColor: '#2563EB',
          }).then(() => {
            this.router.navigate(['/comerciales/solicitud', this.solicitudId]);
          });
          this.isLoading = false;
          return;
        }

        this.clienteId = s.cliente_id;
        this.clienteNombre = s.cliente_nombre;
        this.clienteNit = s.cliente_nit || '';
        this.fechaEntregaCotizacion = this.formatDateForInput(s.fecha_entrega_cotizacion);
        this.fechaEntregaMuestra = this.formatDateForInput(s.fecha_entrega_muestra);
        this.requiereCosteo = Boolean(s.requiere_costeo) || !!this.fechaEntregaCotizacion;
        this.requiereMuestra = Boolean(s.requiere_muestra) || !!this.fechaEntregaMuestra;
        this.tipoDespacho = s.tipo_despacho || 'LOCAL';
        this.materialEmpaque = s.material_empaque || '';
        this.tipoEmpaque = s.tipo_empaque || '';
        this.observaciones = s.observaciones || '';
        this.cantidadPorEntrega = s.cantidad_por_entrega || 0;
        this.entregasAnual = s.entregas_anual || 1;
        this.imagenReferenciaUrl = s.imagen_referencia_url || '';

        this.items = (s.items || []).map((it: any) => {
          const moldObj = it.mold || it.technical_spec?.mold || null;
          const moldId = it.mold_id || moldObj?.id || null;
          const specId = it.technical_spec_id || it.technical_spec?.id || null;
          const categoryId = moldObj?.mold_category_id || moldObj?.id_product_category || moldObj?.category_id || null;
          const categoryName = moldObj?.category?.name || '';
          const moldName = moldObj?.name || '';

          return {
            descripcion: it.descripcion,
            item_cliente: it.item_cliente || '',
            siesa_item_rowid: it.siesa_item_rowid,
            siesa_item_ext_rowid: it.siesa_item_ext_rowid,
            siesa_referencia: it.siesa_referencia || '',
            cantidad_muestra: it.cantidad_muestra || 0,
            tallas: (it.tallas || []).map((t: any) => ({ talla: this.cleanTalla(t.talla), cantidad: t.cantidad })),
            isNew: !it.siesa_item_rowid,
            isExpanded: false,
            ref_siesa_item_rowid: it.ref_siesa_item_rowid || null,
            ref_siesa_referencia: it.ref_siesa_referencia || '',
            ref_siesa_descripcion: it.ref_siesa_descripcion || '',
            categoryId: categoryId,
            categoryName: categoryName,
            moldId: moldId,
            moldName: moldName,
            technicalSpecId: specId,
            specExpanded: false,
            availableMolds: [],
          };
        });

        this.isLoading = false;
        this.restoreMoldInfoForItems();
        this.rebuildAnatomicalGroups();
      },
      error: () => {
        Swal.fire('Error', 'No se pudo cargar la solicitud', 'error');
        this.isLoading = false;
      }
    });
  }

  loadCategories(): void {
    this.moldService.getCategories().subscribe({
      next: (res: any) => {
        this.categories = res.data || [];
        this.restoreMoldInfoForItems();
      },
      error: () => {}
    });
  }

  restoreMoldInfoForItems(): void {
    if (!this.items || this.items.length === 0) return;
    this.items.forEach((item, index) => {
      if (item.moldId) {
        if (!item.categoryId) {
          this.moldService.getMold(item.moldId).subscribe({
            next: (res: any) => {
              if (res.data) {
                const mold = res.data;
                item.moldName = mold.name;
                item.categoryId = mold.mold_category_id || mold.id_product_category || mold.category_id || null;
                if (item.categoryId) {
                  this.loadMoldsForItem(index);
                }
              }
            },
            error: () => {}
          });
        } else {
          this.loadMoldsForItem(index);
        }
      }
    });
  }

  // ==================== ITEMS ====================

  addItemFromSiesa(item: any): void {
    // 1. Desglose inicial de tallas seleccionadas
    let tallas: { talla: string; cantidad: number; siesa_item_ext_rowid?: number | null }[] = [];

    if (item.extensiones && Array.isArray(item.extensiones)) {
      const seleccionadas = item.extensiones.filter((e: any) => e.seleccionada !== false);
      const fuente = seleccionadas.length > 0 ? seleccionadas : item.extensiones;
      tallas = fuente.map((e: any) => ({
        talla: this.cleanTalla(e.talla),
        cantidad: 0,
        siesa_item_ext_rowid: e.siesa_item_ext_rowid || e.f121_rowid || null
      }));
    } else if (item.talla) {
      tallas = [{
        talla: this.cleanTalla(item.talla),
        cantidad: 0,
        siesa_item_ext_rowid: item.f121_rowid || item.rowid_item_ext || null
      }];
    }

    // 2. Guardar extensiones completas para activar/desactivar tallas con un clic (sanitizadas y deduplicadas)
    const rawExts = item.todasExtensiones || item.extensiones || [];
    const seenTallas = new Set<string>();
    const availableExtensions: any[] = [];
    for (const e of rawExts) {
      const cleanT = this.cleanTalla(e.talla);
      if (cleanT && !seenTallas.has(cleanT)) {
        seenTallas.add(cleanT);
        availableExtensions.push({
          talla: cleanT,
          rawTalla: e.rawTalla || e.talla,
          siesa_item_ext_rowid: e.siesa_item_ext_rowid || e.f121_rowid || null,
          color: e.color
        });
      }
    }

    this.items.push({
      descripcion: item.f120_descripcion || item.descripcion || '',
      item_cliente: '',
      siesa_item_rowid: item.f120_rowid || item.rowid_item || null,
      siesa_item_ext_rowid: item.f121_rowid || item.rowid_item_ext || null,
      siesa_referencia: item.f120_referencia || item.referencia || '',
      cantidad_muestra: 0,
      tallas: tallas,
      isNew: false,
      isExpanded: true,
      ref_siesa_item_rowid: null,
      ref_siesa_referencia: '',
      ref_siesa_descripcion: '',
      categoryId: null,
      categoryName: '',
      moldId: null,
      moldName: '',
      technicalSpecId: null,
      specExpanded: false,
      availableMolds: [],
      activeTab: 'tallas',
      availableExtensions: availableExtensions.length > 0 ? availableExtensions : undefined
    });
    this.showItemSearch = false;
    this.rebuildAnatomicalGroups();
    this.saveToLocalStorage();
    // Auto-suggest category for new item
    this.suggestCategoryForItem(this.items.length - 1);
  }

  addNewItem(): void {
    if (!this.newItemDesc.trim()) return;
    this.items.push({
      descripcion: this.newItemDesc.trim(),
      item_cliente: this.newItemRef.trim(),
      siesa_item_rowid: null,
      siesa_item_ext_rowid: null,
      siesa_referencia: '',
      cantidad_muestra: 0,
      tallas: [],
      isNew: true,
      isExpanded: true,
      ref_siesa_item_rowid: null,
      ref_siesa_referencia: '',
      ref_siesa_descripcion: '',
      categoryId: null,
      categoryName: '',
      moldId: null,
      moldName: '',
      technicalSpecId: null,
      specExpanded: false,
      availableMolds: [],
      activeTab: 'tallas',
    });
    this.newItemDesc = '';
    this.newItemRef = '';
    this.showNewItemForm = false;
    this.rebuildAnatomicalGroups();
    this.saveToLocalStorage();
    this.suggestCategoryForItem(this.items.length - 1);
  }

  // ==================== REFERENCE ITEM ====================

  openRefSearch(index: number): void {
    this.refSearchingIndex = index;
    this.refSearchQuery = '';
    this.refSearchResults = [];
  }

  searchRefItems(): void {
    if (this.refSearchQuery.length < 2) {
      this.refSearchResults = [];
      return;
    }
    this.isSearchingRef = true;
    this.comercialService.buscarItemsGlobal(this.refSearchQuery).subscribe({
      next: (res) => {
        this.refSearchResults = res.data || [];
        this.isSearchingRef = false;
      },
      error: () => {
        this.refSearchResults = [];
        this.isSearchingRef = false;
      }
    });
  }

  selectRefItem(refItem: any): void {
    if (this.refSearchingIndex === null) return;
    const item = this.items[this.refSearchingIndex];
    if (item) {
      item.ref_siesa_item_rowid = refItem.f120_rowid;
      item.ref_siesa_referencia = refItem.f120_referencia || refItem.f120_id || '';
      item.ref_siesa_descripcion = refItem.f120_descripcion || refItem.f120_descripcion_corta || '';
    }
    this.closeRefSearch();
  }

  clearRefItem(item: LocalItem): void {
    item.ref_siesa_item_rowid = null;
    item.ref_siesa_referencia = '';
    item.ref_siesa_descripcion = '';
  }

  closeRefSearch(): void {
    this.refSearchingIndex = null;
    this.refSearchQuery = '';
    this.refSearchResults = [];
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
    this.rebuildAnatomicalGroups();
    this.saveToLocalStorage();
  }

  addTalla(item: LocalItem): void {
    if (item.siesa_item_rowid && !item.isNew) {
      this.comercialService.extensionesItem(item.siesa_item_rowid).subscribe({
        next: (res) => {
          const extensiones = res.data || [];
          if (extensiones.length > 0) {
            const tallasExistentes = item.tallas.map(t => t.siesa_item_ext_rowid);
            const disponibles = extensiones.filter(ext => !tallasExistentes.includes(ext.rowid_item_ext));

            if (disponibles.length === 0) {
              Swal.fire('Información', 'Ya se han agregado todas las tallas disponibles para esta referencia.', 'info');
              return;
            }

            const inputOptions: any = {};
            disponibles.forEach(ext => {
              const cleanedName = this.cleanTalla(ext.talla);
              inputOptions[ext.rowid_item_ext] = `${cleanedName} ${ext.color ? '(' + ext.color + ')' : ''}`;
            });

            Swal.fire({
              title: 'Seleccionar Talla de Siesa',
              input: 'select',
              inputOptions: inputOptions,
              inputPlaceholder: 'Seleccione una talla...',
              showCancelButton: true,
              confirmButtonText: 'Agregar',
              cancelButtonText: 'Cancelar'
            }).then((result) => {
              if (result.isConfirmed && result.value) {
                const extSeleccionada = disponibles.find(ext => ext.rowid_item_ext == result.value);
                if (extSeleccionada) {
                  item.tallas.push({
                    talla: this.cleanTalla(extSeleccionada.talla),
                    cantidad: 0,
                    siesa_item_ext_rowid: extSeleccionada.rowid_item_ext
                  });
                }
              }
            });
          } else {
            this.pushDefaultTalla(item);
          }
        },
        error: () => {
          this.pushDefaultTalla(item);
        }
      });
    } else {
      this.pushDefaultTalla(item);
    }
  }

  private pushDefaultTalla(item: LocalItem): void {
    const tallasDisponibles = [...this.tallasLetra, ...this.tallasNumericas];
    const yaAgregadas = (item.tallas || []).map(t => t.talla);
    const sugerida = tallasDisponibles.find(t => !yaAgregadas.includes(t)) || 'M';
    item.tallas.push({ talla: sugerida, cantidad: 0 });
  }

  addSpecificTalla(item: LocalItem, talla: string): void {
    if (!item.tallas) item.tallas = [];
    const exists = item.tallas.find(t => t.talla === talla);
    if (!exists) {
      item.tallas.push({ talla, cantidad: 0 });
      this.sortItemTallas(item);
    }
  }

  sortItemTallas(item: LocalItem): void {
    if (!item.tallas || item.tallas.length <= 1) return;
    const order = [
      '2XS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL',
      '4', '6', '8', '10', '12', '14', '16', '18', '20',
      '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50'
    ];
    item.tallas.sort((a, b) => {
      const idxA = order.indexOf((a.talla || '').toUpperCase().trim());
      const idxB = order.indexOf((b.talla || '').toUpperCase().trim());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (a.talla || '').localeCompare(b.talla || '', undefined, { numeric: true });
    });
  }

  removeTalla(item: LocalItem, ti: number): void {
    item.tallas.splice(ti, 1);
  }

  toggleItem(item: LocalItem): void {
    item.isExpanded = !item.isExpanded;
  }

  // ==================== PER-ITEM MOLD MODAL SELECTOR ====================

  loadAllMolds(): void {
    if (this.allMolds.length > 0) return;
    this.isLoadingMolds = true;
    this.moldService.getMolds().subscribe({
      next: (res: any) => {
        this.allMolds = res.data || [];
        this.isLoadingMolds = false;
        if (Array.isArray(this.allMolds)) {
          this.allMolds.forEach(m => {
            this.cachedMoldsMap[m.id] = m;
          });
        }
        this.rebuildAnatomicalGroups();
      },
      error: () => {
        this.isLoadingMolds = false;
      }
    });
  }

  openMoldSelector(index: number): void {
    this.moldSelectorItemIndex = index;
    const item = this.items[index];
    this.selectedModalCategoryId = item?.categoryId || null;
    this.showMoldSelectorModal = true;
    this.loadAllMolds();
  }

  closeMoldSelector(): void {
    this.showMoldSelectorModal = false;
    this.moldSelectorItemIndex = null;
  }

  selectMoldFromModal(mold: any): void {
    if (this.moldSelectorItemIndex === null) return;
    const item = this.items[this.moldSelectorItemIndex];
    item.categoryId = mold.mold_category_id || mold.id_product_category || mold.category_id || this.selectedModalCategoryId;
    const cat = this.categories.find(c => c.id === item.categoryId);
    item.categoryName = cat?.name || mold.category?.name || '';
    item.moldId = mold.id;
    item.moldName = mold.name;
    item.technicalSpecId = null; // Reset spec when changing mold
    item.opmReference = undefined;
    item.totalSamTime = 0;
    item.draftComponents = undefined;
    item.availableMolds = this.allMolds.filter(m => (m.mold_category_id || m.id_product_category || m.category_id) === item.categoryId);
    // Clonar para forzar cambio de referencia y disparar inputs en componentes hijos
    this.items[this.moldSelectorItemIndex] = { ...item };
    if (this.activeFigurinItemIndex === this.moldSelectorItemIndex) {
      this.activeFigurinItem = { ...item };
    }
    this.rebuildAnatomicalGroups();
    this.saveToLocalStorage();
    this.closeMoldSelector();
  }

  clearMoldForItem(index: number): void {
    const item = this.items[index];
    if (!item) return;
    item.moldId = null;
    item.moldName = '';
    item.categoryId = null;
    item.categoryName = '';
    item.technicalSpecId = null;
    item.opmReference = undefined;
    item.totalSamTime = 0;
    item.draftComponents = undefined;
    item.availableMolds = [];
    this.items[index] = { ...item };
    if (this.activeFigurinItemIndex === index) {
      this.activeFigurinItem = { ...item };
    }
    this.rebuildAnatomicalGroups();
    this.saveToLocalStorage();
  }



  suggestCategoryForItem(index: number): void {
    const item = this.items[index];
    if (!item || !item.descripcion) return;

    const descUpper = item.descripcion.toUpperCase();

    // 1. Detección heurística instantánea en memoria (0ms)
    if (this.categories && this.categories.length > 0) {
      const matchedCat = this.categories.find(cat => {
        const catName = (cat.name || '').toUpperCase().trim();
        return catName.length >= 3 && descUpper.includes(catName);
      });

      if (matchedCat) {
        item.categoryId = matchedCat.id;
        item.categoryName = matchedCat.name;
        this.loadMoldsForItem(index);
        this.rebuildAnatomicalGroups();
        this.saveToLocalStorage();
        return;
      }
    }

    // 2. Si no hubo coincidencia local, consultar sugerencia a la API en segundo plano
    this.moldService.suggestCategory(item.descripcion).subscribe({
      next: (res: any) => {
        if (res.data) {
          item.categoryId = res.data.id;
          item.categoryName = res.data.name;
          this.loadMoldsForItem(index);
          this.rebuildAnatomicalGroups();
          this.saveToLocalStorage();
        }
      },
      error: () => {}
    });
  }

  onCategoryChange(index: number, categoryId: number): void {
    const item = this.items[index];
    item.categoryId = categoryId;
    const cat = this.categories.find(c => c.id === categoryId);
    item.categoryName = cat?.name || '';
    item.moldId = null;
    item.moldName = '';
    item.technicalSpecId = null;
    item.draftComponents = undefined;
    item.availableMolds = [];
    this.loadMoldsForItem(index);
    this.rebuildAnatomicalGroups();
    this.saveToLocalStorage();
  }

  loadMoldsForItem(index: number): void {
    const item = this.items[index];
    if (!item || !item.categoryId) return;

    // Si ya tenemos moldes en memoria global, filtrar inmediatamente sin petición de red
    if (this.allMolds && this.allMolds.length > 0) {
      item.availableMolds = this.allMolds.filter((m: any) =>
        (m.mold_category_id || m.id_product_category || m.category_id) === item.categoryId
      );
      return;
    }

    this.moldService.getMoldsByCategory(item.categoryId).subscribe({
      next: (res: any) => {
        item.availableMolds = res.data || [];
      },
      error: () => { item.availableMolds = []; }
    });
  }

  selectMoldForItem(index: number, moldId: number): void {
    const item = this.items[index];
    item.moldId = moldId;
    const m = (item.availableMolds || []).find((x: any) => x.id === moldId) || this.allMolds.find((x: any) => x.id === moldId);
    item.moldName = m?.name || '';
    item.technicalSpecId = null; // Reset spec when changing mold
    item.draftComponents = undefined;
    this.items[index] = { ...item };
    this.rebuildAnatomicalGroups();
    this.saveToLocalStorage();
  }

  toggleSpecForItem(index: number): void {
    // Close all other spec generators, open this one
    this.items.forEach((it, i) => {
      if (i !== index) it.specExpanded = false;
    });
    this.items[index].specExpanded = !this.items[index].specExpanded;
  }

  onItemComponentsChange(index: number, components: any[]): void {
    if (this.items[index]) {
      this.items[index].draftComponents = components;
      this.saveToLocalStorage();
    }
  }

  onItemOpmSaved(index: number, event: any): void {
    const item = this.items[index];
    if (!item) return;
    item.technicalSpecId = event.technicalSpecId;
    item.opmReference = event.reference;
    item.totalSamTime = event.samTime;
    if (event.tallas && Array.isArray(event.tallas) && event.tallas.length > 0) {
      item.tallas = event.tallas;
    }
    this.saveToLocalStorage();
  }

  goToItemMold(item: any, index: number): void {
    if (!item) return;
    item.isExpanded = true;
    setTimeout(() => {
      const el = document.getElementById(`mold-container-${index}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
  }

  isTallaInItem(item: LocalItem, talla: string): boolean {
    if (!item.tallas) return false;
    const cleanTarget = this.cleanTalla(talla);
    return item.tallas.some(t => this.cleanTalla(t.talla) === cleanTarget);
  }

  toggleSiesaTalla(item: LocalItem, ext: { talla: string; siesa_item_ext_rowid?: number | null }): void {
    if (!item.tallas) item.tallas = [];
    const cleanTarget = this.cleanTalla(ext.talla);
    const idx = item.tallas.findIndex(t => this.cleanTalla(t.talla) === cleanTarget);
    if (idx >= 0) {
      item.tallas.splice(idx, 1);
    } else {
      item.tallas.push({
        talla: cleanTarget,
        cantidad: 0,
        siesa_item_ext_rowid: ext.siesa_item_ext_rowid
      });
    }
    this.saveToLocalStorage();
  }

  onItemSpecSaved(index: number, specId: number): void {
    this.items[index].technicalSpecId = specId;
    this.items[index].draftComponents = undefined; // Limpiar borrador ya que se guardó
    this.saveToLocalStorage();
    Swal.fire({
      title: 'OPM Guardada',
      text: `Especificación del ítem "${this.items[index].descripcion}" vinculada`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false,
    });
  }

  copySpecFromItem(sourceIndex: number, targetIndex: number): void {
    const source = this.items[sourceIndex];
    const target = this.items[targetIndex];
    target.categoryId = source.categoryId;
    target.categoryName = source.categoryName;
    target.moldId = source.moldId;
    target.moldName = source.moldName;
    target.availableMolds = source.availableMolds ? [...source.availableMolds] : [];
    target.draftComponents = source.draftComponents ? JSON.parse(JSON.stringify(source.draftComponents)) : undefined;
    target.technicalSpecId = null;
    this.saveToLocalStorage();
    Swal.fire({
      title: 'Configuración copiada',
      text: `Se copió la configuración de molde de "${source.descripcion}"`,
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
    });
  }

  getItemsWithMold(): { index: number; item: LocalItem }[] {
    return this.items
      .map((item, index) => ({ index, item }))
      .filter(x => x.item.moldId !== null);
  }

  // ==================== OPM MATRIX TABLE & MODAL CONTROLLERS ====================

  getItemThumbnail(item: LocalItem): string {
    if (!item) return '';
    if (item.moldId) {
      const mold = this.allMolds.find(m => m.id === item.moldId);
      if (mold) {
        if (mold.image_signed_url) return mold.image_signed_url;
        if (mold.front_image_signed_url) return mold.front_image_signed_url;
        if (mold.front_image_url) return mold.front_image_url;
      }
    }
    if (item.categoryId) {
      const cat = this.categories.find(c => c.id === item.categoryId);
      if (cat?.image_signed_url) return cat.image_signed_url;
    }
    return '';
  }

  getAnatomicalFamilyForItem(item: LocalItem): AnatomicalFamily {
    if (!item) return 'SIN_MOLDE';

    // Agrupación basada estrictamente en el MOLDE, NO en el nombre/descripción.
    // Si la prenda no tiene molde asignado aún, pertenece a 'SIN_MOLDE'.
    if (!item.moldId) {
      return 'SIN_MOLDE';
    }

    const mold = this.allMolds.find(m => m.id === item.moldId);
    const moldCat = (mold?.category?.name || item.categoryName || '').toUpperCase();
    const moldName = (mold?.name || item.moldName || '').toUpperCase();
    const moldText = `${moldCat} ${moldName}`;

    // Overoles / enterizos / trajes completos
    if (moldText.includes('OVEROL') || moldText.includes('ENTERIZO') || moldText.includes('MAMELUCO') || moldText.includes('TRAJE')) {
      return 'COMPLETA';
    }

    // Inferiores (Pantalones, bermudas, jeans, faldas, shorts, joggers)
    if (moldText.includes('PANTALON') || moldText.includes('PANTALÓN') || moldText.includes('BERMUDA') || 
        moldText.includes('JEAN') || moldText.includes('FALDA') || moldText.includes('SHORT') || moldText.includes('JOGGER')) {
      return 'INFERIOR';
    }

    // Superiores (Camisas, polos, chaquetas, chalecos, blusas, camisetas, buzos)
    if (moldText.includes('CAMISA') || moldText.includes('POLO') || moldText.includes('CHAQUETA') || 
        moldText.includes('CHALECO') || moldText.includes('BLUSA') || moldText.includes('CAMISETA') || 
        moldText.includes('CAMIBUSO') || moldText.includes('SUETER') || moldText.includes('CHOMPA')) {
      return 'SUPERIOR';
    }

    const catId = item.categoryId || mold?.mold_category_id || mold?.id_product_category || mold?.category_id;
    if (catId === 1 || catId === 3) return 'SUPERIOR';
    if (catId === 4) return 'INFERIOR';
    if (catId === 2) return 'COMPLETA';

    return 'GENERAL';
  }

  getFamilyItemCount(family: 'TODAS' | AnatomicalFamily): number {
    if (family === 'TODAS') return this.items.length;
    return this.items.filter(it => this.getAnatomicalFamilyForItem(it) === family).length;
  }

  getTotalFilteredItems(): number {
    return this.anatomicalGroups.reduce((acc, g) => acc + g.items.length, 0);
  }

  getItemZoneSelectionForColumn(item: LocalItem, col: AnatomicalColumn): { name: string; isConfigured: boolean; samTime?: number; notApplicable?: boolean } {
    if (!item) return { name: 'Por definir', isConfigured: false };

    // 1. Check in item.draftComponents PRIMERO (para reflejar cambios inmediatos desde la tabla o el modal)
    if (item.draftComponents && item.draftComponents.length > 0) {
      const dMatch = item.draftComponents.find((p: any) => {
        if (p.item_type === 'material') return false;
        const text = `${p.zone_name || ''} ${p.name || ''}`.toLowerCase();
        return col.keywords.some(k => text.includes(k.toLowerCase()));
      });
      if (dMatch) {
        if (dMatch.selected_type_name) {
          return { name: dMatch.selected_type_name, isConfigured: true, samTime: dMatch.estimated_time };
        } else {
          return { name: 'Por definir', isConfigured: false };
        }
      }
    }

    // 2. Check in item.technical_spec?.parts
    const parts = (item as any).technical_spec?.parts || (item as any).technicalSpecParts || [];
    if (parts.length > 0) {
      const match = parts.find((p: any) => {
        if (p.item_type === 'material') return false;
        const text = `${p.zone_name || ''} ${p.name || ''}`.toLowerCase();
        return col.keywords.some(k => text.includes(k.toLowerCase()));
      });
      if (match && match.selected_type_name) {
        return { name: match.selected_type_name, isConfigured: true, samTime: match.estimated_time };
      }
    }

    // 3. If item has a mold, check if mold has parts matching these keywords
    if (item.moldId) {
      const mold = this.cachedMoldsMap[item.moldId] || this.allMolds.find(m => m.id === item.moldId);
      if (mold && mold.parts && mold.parts.length > 0) {
        const hasPartInMold = mold.parts.some((p: any) => {
          const text = `${p.name || ''} ${p.zone_name || ''} ${p.zone_type || ''}`.toLowerCase();
          return col.keywords.some(k => text.includes(k.toLowerCase()));
        });
        if (!hasPartInMold) {
          return { name: 'N/A', isConfigured: false, notApplicable: true };
        }
      }
    }

    return { name: 'Por definir', isConfigured: false };
  }

  isZoneColConfigured(item: LocalItem, col: AnatomicalColumn): boolean {
    return this.getItemZoneSelectionForColumn(item, col).isConfigured;
  }

  /**
   * Determina el estado de avance de configuración anatómica de la prenda:
   * - sin_empezar: 0 zonas configuradas (neutro sin color)
   * - parcial: al menos 1 zona configurada pero faltan otras (amarillo, recalca lo faltante)
   * - completo: 100% de las zonas aplicables configuradas (verde muy clarito)
   */
  getItemCompletionStatus(item: LocalItem, groupColumns: AnatomicalColumn[]): { totalApplicable: number; configured: number; status: 'sin_empezar' | 'parcial' | 'completo' } {
    if (!item || !groupColumns || groupColumns.length === 0 || !item.moldId) {
      return { totalApplicable: 0, configured: 0, status: 'sin_empezar' };
    }

    let totalApplicable = 0;
    let configured = 0;

    for (const col of groupColumns) {
      const sel = this.getItemZoneSelectionForColumn(item, col);
      if (!sel.notApplicable) {
        totalApplicable++;
        if (sel.isConfigured) {
          configured++;
        }
      }
    }

    if (totalApplicable === 0 || configured === 0) {
      return { totalApplicable, configured, status: 'sin_empezar' };
    }
    if (configured >= totalApplicable) {
      return { totalApplicable, configured, status: 'completo' };
    }
    return { totalApplicable, configured, status: 'parcial' };
  }

  getItemRowClass(item: LocalItem, groupColumns: AnatomicalColumn[]): string {
    const s = this.getItemCompletionStatus(item, groupColumns);
    if (s.status === 'parcial') {
      return 'bg-amber-50/20 hover:bg-amber-50/35 border-l-4 border-l-amber-400 transition-colors';
    }
    if (s.status === 'completo') {
      return 'bg-emerald-50/20 hover:bg-emerald-50/35 border-l-4 border-l-emerald-400 transition-colors';
    }
    return 'bg-white hover:bg-slate-50/70 border-l-4 border-l-transparent transition-colors';
  }

  getZonePillClassForCol(item: LocalItem, col: AnatomicalColumn, groupColumns?: AnatomicalColumn[]): string {
    const sel = this.getItemZoneSelectionForColumn(item, col);
    if (sel.notApplicable) {
      return 'bg-slate-50/60 text-slate-300 border-dashed border-slate-200 cursor-not-allowed';
    }
    if (sel.isConfigured) {
      // En verde muy clarito lo completo
      return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold hover:bg-emerald-100 hover:border-emerald-400 shadow-2xs';
    }

    // Si la prenda está parcialmente llena, recalcar lo faltante en amarillo
    if (groupColumns && groupColumns.length > 0) {
      const s = this.getItemCompletionStatus(item, groupColumns);
      if (s.status === 'parcial') {
        return 'bg-amber-50 text-amber-900 border-amber-300 font-bold hover:bg-amber-100 hover:border-amber-400 ring-1 ring-amber-300/80 shadow-2xs';
      }
    }

    // Sin empezar: sin color, fondo blanco y texto tenue limpio
    return 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50 shadow-2xs';
  }

  get anatomicalGroups(): AnatomicalGroup[] {
    return this._cachedAnatomicalGroups;
  }

  rebuildAnatomicalGroups(): void {
    const rawItems = this.items.map((item, originalIndex) => ({ item, originalIndex }));
    
    // Columnas candidatas por familia anatómica
    const baseCandidatesByFamily: { [key in AnatomicalFamily]: { title: string; subtitle: string; icon: string; badgeClass: string; borderClass: string; columns: AnatomicalColumn[] } } = {
      SUPERIOR: {
        title: 'Prendas Superiores (Torso)',
        subtitle: 'Camisas, Polos, Chaquetas, Chalecos, Blusas y Camibusos',
        icon: 'bi-person-badge',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        borderClass: 'border-slate-200',
        columns: [
          { key: 'cuello', label: 'Cuello / Solapa', tooltip: 'Tipo de cuello, solapa o capota', keywords: ['cuel', 'solap', 'collar', 'capot', 'capuch'] },
          { key: 'pecho', label: 'Pechera / Delantero', tooltip: 'Cartera, botones y bolsillos frontales', keywords: ['pech', 'delan', 'carter', 'bolsill', 'frente', 'boton', 'cierre'] },
          { key: 'manga', label: 'Mangas & Puños', tooltip: 'Largo de manga, puño y guardapolvo', keywords: ['mang', 'puñ', 'sleeve', 'mga'] },
          { key: 'espalda', label: 'Espalda & Almilla', tooltip: 'Almilla, pliegues y corte posterior', keywords: ['espal', 'almill', 'post', 'tras', 'esp'] },
          { key: 'cintura', label: 'Cintura & Ruedo', tooltip: 'Dobladillo inferior y pretina', keywords: ['cint', 'rued', 'faldon', 'dobl', 'pret'] },
          { key: 'tiro', label: 'Bragueta & Figurado', tooltip: 'Bragueta delantera o cierre figurado', keywords: ['braguet', 'figura'] },
        ]
      },
      INFERIOR: {
        title: 'Prendas Inferiores (Piernas)',
        subtitle: 'Pantalones, Bermudas, Jeans, Faldas y Shorts',
        icon: 'bi-columns-gap',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        borderClass: 'border-emerald-100',
        columns: [
          { key: 'pretina', label: 'Pretina & Pasadores', tooltip: 'Tipo de pretina, pasadores y botón principal', keywords: ['pret', 'pasador', 'cint'] },
          { key: 'tiro', label: 'Tiro & Bragueta', tooltip: 'Cierre de cremallera, botones o tiro delantero', keywords: ['braguet', 'tiro', 'cierre', 'cremallera', 'figura'] },
          { key: 'bolsillo_del', label: 'Bolsillos Laterales', tooltip: 'Bolsillos diagonales, relojera o parche delantero', keywords: ['bolsill', 'delan', 'later', 'relojer', 'boca'] },
          { key: 'bolsillo_tras', label: 'Bolsillos Traseros', tooltip: 'Bolsillos de ribete, ojal o parche posterior', keywords: ['tras', 'post', 'ribete', 'espal', 'parche'] },
          { key: 'bota', label: 'Bota & Ruedo', tooltip: 'Bota recta, entubada o dobladillo inferior', keywords: ['bota', 'rued', 'pierna', 'dobl'] },
        ]
      },
      COMPLETA: {
        title: 'Prendas de Cuerpo Completo',
        subtitle: 'Overoles, Enterizos, Mamelucos y Trajes',
        icon: 'bi-shield-shaded',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        borderClass: 'border-amber-100',
        columns: [
          { key: 'cuello', label: 'Cuello / Capota', tooltip: 'Cuello o capota de protección', keywords: ['cuel', 'capot', 'solap'] },
          { key: 'pecho', label: 'Pecho & Cierre', tooltip: 'Cierre principal de doble vía o solapa', keywords: ['pech', 'delan', 'cierre', 'cremallera'] },
          { key: 'manga', label: 'Mangas & Puños', tooltip: 'Mangas, puños elásticos o ajustables', keywords: ['mang', 'puñ'] },
          { key: 'cintura', label: 'Cintura & Elástico', tooltip: 'Ajuste elástico o cinturón en pretina', keywords: ['cint', 'pret', 'elast'] },
          { key: 'bota', label: 'Pierna & Bota', tooltip: 'Terminación de bota y refuerzos', keywords: ['bota', 'pierna', 'rued'] },
        ]
      },
      GENERAL: {
        title: 'Otras Prendas & Accesorios',
        subtitle: 'Prendas en especificación libre o accesorios con molde asignado',
        icon: 'bi-box-seam',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        borderClass: 'border-slate-100',
        columns: [
          { key: 'zona1', label: 'Zona Superior / Frente', tooltip: 'Zona principal delantera', keywords: ['cuel', 'pech', 'frente', 'base'] },
          { key: 'zona2', label: 'Mangas / Laterales', tooltip: 'Extremidades o laterales', keywords: ['manga', 'cint', 'corte'] },
          { key: 'zona3', label: 'Espalda / Trasero', tooltip: 'Espalda o cara posterior', keywords: ['espal', 'tras', 'post'] },
          { key: 'zona4', label: 'Terminación Inferior', tooltip: 'Ruedos, botas o pretina', keywords: ['rued', 'bota', 'pret'] },
        ]
      },
      SIN_MOLDE: {
        title: 'Prendas Pendientes de Molde',
        subtitle: 'Prendas sin molde base vinculado (haz clic en + Molde para definirlo)',
        icon: 'bi-exclamation-triangle-fill',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
        borderClass: 'border-amber-200',
        columns: []
      }
    };

    const groupsMap = new Map<AnatomicalFamily, { item: LocalItem; originalIndex: number }[]>();
    (['SUPERIOR', 'INFERIOR', 'COMPLETA', 'GENERAL', 'SIN_MOLDE'] as AnatomicalFamily[]).forEach(k => groupsMap.set(k, []));

    rawItems.forEach(ri => {
      const family = this.getAnatomicalFamilyForItem(ri.item);
      groupsMap.get(family)?.push(ri);
    });

    const result: AnatomicalGroup[] = [];

    (['SUPERIOR', 'INFERIOR', 'COMPLETA', 'GENERAL', 'SIN_MOLDE'] as AnatomicalFamily[]).forEach(fam => {
      let gItems = groupsMap.get(fam) || [];
      if (gItems.length === 0) return;

      if (this.selectedFamilyFilter !== 'TODAS' && this.selectedFamilyFilter !== fam) {
        return;
      }

      if (this.anatomicalSortOrder === 'qty') {
        gItems = [...gItems].sort((a, b) => this.getItemTotal(b.item) - this.getItemTotal(a.item));
      } else if (this.anatomicalSortOrder === 'sam') {
        gItems = [...gItems].sort((a, b) => (b.item.totalSamTime || 0) - (a.item.totalSamTime || 0));
      }

      const totalUds = gItems.reduce((acc, x) => acc + this.getItemTotal(x.item), 0);
      const totalSam = gItems.reduce((acc, x) => acc + (x.item.totalSamTime || 0), 0);
      const cfg = baseCandidatesByFamily[fam];

      // Determinar columnas dinámicamente según las partes reales de los moldes presentes en este grupo
      let dynamicCols: AnatomicalColumn[] = [];

      if (fam === 'SIN_MOLDE') {
        dynamicCols = [];
      } else {
        const moldsInGroup: any[] = [];
        gItems.forEach(entry => {
          if (entry.item.moldId) {
            const m = this.cachedMoldsMap[entry.item.moldId] || this.allMolds.find(x => x.id === entry.item.moldId);
            if (m && !moldsInGroup.some(existing => existing.id === m.id)) {
              moldsInGroup.push(m);
            }
          }
        });

        if (moldsInGroup.length === 0) {
          dynamicCols = cfg.columns;
        } else {
          const allPartsInGroup: any[] = moldsInGroup.flatMap(m => m.parts || []);

          // Filtrar columnas candidatas que al menos una parte en los moldes presentes tiene
          dynamicCols = cfg.columns.filter(col => {
            return allPartsInGroup.some(p => {
              const text = `${p.name || ''} ${p.zone_name || ''} ${p.zone_type || ''} ${p.code || ''}`.toLowerCase();
              return col.keywords.some(k => text.includes(k.toLowerCase()));
            });
          });

          // Agregar partes del molde no contempladas en las columnas estándar
          allPartsInGroup.forEach(p => {
            const text = `${p.name || ''} ${p.zone_name || ''} ${p.zone_type || ''} ${p.code || ''}`.toLowerCase();
            const isMatched = dynamicCols.some(col => col.keywords.some(k => text.includes(k.toLowerCase())));
            if (!isMatched) {
              const pName = p.name || 'Parte Especial';
              const colKey = 'custom_' + pName.toLowerCase().replace(/[^a-z0-9]/g, '_');
              if (!dynamicCols.some(c => c.key === colKey)) {
                dynamicCols.push({
                  key: colKey,
                  label: pName,
                  tooltip: 'Opción configurada en este molde: ' + pName,
                  keywords: [pName.toLowerCase().slice(0, 4), pName.toLowerCase()]
                });
              }
            }
          });

          if (dynamicCols.length === 0) {
            dynamicCols = cfg.columns;
          }
        }
      }

      result.push({
        id: fam,
        title: cfg.title,
        subtitle: cfg.subtitle,
        icon: cfg.icon,
        badgeClass: cfg.badgeClass,
        borderClass: cfg.borderClass,
        columns: dynamicCols,
        items: gItems,
        totalUds,
        totalSam
      });
    });

    this._cachedAnatomicalGroups = result;
  }

  openFigurinModal(index: number, targetZone?: string): void {
    const item = this.items[index];
    if (!item) return;

    if (!item.moldId) {
      this.openMoldSelector(index);
      return;
    }

    this.activeFigurinItemIndex = index;
    this.activeFigurinItem = item;
    this.showFigurinModal = true;
  }

  closeFigurinModal(): void {
    this.showFigurinModal = false;
    this.activeFigurinItemIndex = null;
    this.activeFigurinItem = null;
    this.saveToLocalStorage();
  }

  onItemOpmSavedFromModal(event: any): void {
    if (this.activeFigurinItemIndex !== null) {
      this.onItemOpmSaved(this.activeFigurinItemIndex, event);
      if (this.items[this.activeFigurinItemIndex]) {
        this.activeFigurinItem = { ...this.items[this.activeFigurinItemIndex] };
      }
    }
  }

  openMoldSelectorFromModal(): void {
    if (this.activeFigurinItemIndex !== null) {
      this.openMoldSelector(this.activeFigurinItemIndex);
    }
  }

  clearMoldFromModal(): void {
    if (this.activeFigurinItemIndex !== null) {
      this.clearMoldForItem(this.activeFigurinItemIndex);
      this.closeFigurinModal();
    }
  }

  openTallasQuickModal(index: number): void {
    this.activeTallasItemIndex = index;
    this.showTallasQuickModal = true;
  }

  closeTallasQuickModal(): void {
    this.showTallasQuickModal = false;
    this.activeTallasItemIndex = null;
    this.saveToLocalStorage();
  }

  duplicateItem(index: number): void {
    const original = this.items[index];
    if (!original) return;
    const cloned: LocalItem = JSON.parse(JSON.stringify(original));
    cloned.descripcion = `${original.descripcion} (Copia)`;
    cloned.technicalSpecId = null;
    cloned.opmReference = undefined;
    cloned.isExpanded = false;
    this.items.splice(index + 1, 0, cloned);
    this.saveToLocalStorage();
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1800,
      timerProgressBar: true
    });
    Toast.fire({
      icon: 'success',
      title: 'Prenda duplicada en la tabla'
    });
  }

  // ==================== INLINE EDITING: DESCRIPCIÓN & REFERENCIA ====================

  startEditItem(index: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.editingItemIndex = index;
    this.editDescTemp = this.items[index]?.descripcion || '';
    this.editRefTemp = this.items[index]?.item_cliente || '';
  }

  saveEditItem(index: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const item = this.items[index];
    if (item && this.editDescTemp.trim()) {
      item.descripcion = this.editDescTemp.trim();
      item.item_cliente = this.editRefTemp.trim();
      this.saveToLocalStorage();
      this.rebuildAnatomicalGroups();
    }
    this.editingItemIndex = null;
  }

  cancelEditItem(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.editingItemIndex = null;
  }

  trackByGroupId(index: number, group: AnatomicalGroup): string {
    return group.id;
  }

  trackByItemOriginalIndex(index: number, entry: { item: LocalItem; originalIndex: number }): number {
    return entry.originalIndex;
  }

  // ==================== SELECTOR FLOTANTE DE VARIANTES DE ZONA ====================

  openZoneVariantsModal(itemIndex: number, col: AnatomicalColumn): void {
    const item = this.items[itemIndex];
    if (!item) return;

    if (!item.moldId) {
      Swal.fire({
        title: 'Molde no seleccionado',
        text: 'Para elegir las variaciones de esta prenda, selecciona primero su molde base.',
        icon: 'info',
        confirmButtonText: 'Seleccionar Molde',
        confirmButtonColor: '#4f46e5',
        showCancelButton: true,
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.openMoldSelector(itemIndex);
        }
      });
      return;
    }

    this.activeZoneItemIndex = itemIndex;
    this.activeZoneCol = col;
    this.activeZoneTitle = col.label;
    this.activeZoneSubtitle = col.tooltip;
    this.activeZoneDisplayParts = [];
    this.activePartInModal = null;
    this.zoneModalStep = 'select-part';
    this.showZoneVariantsModal = true;
    this.isLoadingZoneParts = true;

    // Recuperar observación de la zona si existe
    this.activeZoneObservation = (item.zoneObservations && item.zoneObservations[col.key]) || '';
    if (!this.activeZoneObservation && item.draftComponents) {
      const match = item.draftComponents.find((c: any) => {
        const text = `${c.zone_name || ''} ${c.name || ''}`.toLowerCase();
        return col.keywords.some(k => text.includes(k.toLowerCase())) && c.client_spec;
      });
      if (match) {
        this.activeZoneObservation = match.client_spec;
        if (!item.zoneObservations) item.zoneObservations = {};
        item.zoneObservations[col.key] = match.client_spec;
      }
    }

    // Apliques anclados a esta zona
    this.refreshActiveZoneAnchoredParts(item, col);

    // Asegurar estructura de draftComponents en el ítem si no existe
    if (!item.draftComponents) {
      item.draftComponents = (item as any).technical_spec?.parts
        ? JSON.parse(JSON.stringify((item as any).technical_spec.parts))
        : [];
    }

    const processMoldParts = (moldData: any) => {
      this.isLoadingZoneParts = false;
      const allParts = moldData.parts || [];
      const matched = allParts.filter((p: any) => {
        const text = `${p.zone_name || ''} ${p.zone_type || ''} ${p.name || ''} ${p.code || ''}`.toLowerCase();
        return col.keywords.some(k => text.includes(k.toLowerCase()));
      });

      this.activeZoneDisplayParts = this.getDisplayPartsForZone(matched);

      if (this.activeZoneDisplayParts.length > 1) {
        this.zoneModalStep = 'select-part';
        this.activePartInModal = null;
      } else if (this.activeZoneDisplayParts.length === 1) {
        this.zoneModalStep = 'select-variant';
        this.activePartInModal = this.activeZoneDisplayParts[0];
      }
    };

    if (this.cachedMoldsMap[item.moldId]) {
      processMoldParts(this.cachedMoldsMap[item.moldId]);
    } else {
      this.moldService.getMold(item.moldId).subscribe({
        next: (res: any) => {
          if (res?.success && res?.data) {
            this.cachedMoldsMap[item.moldId!] = res.data;
            processMoldParts(res.data);
          } else {
            this.isLoadingZoneParts = false;
          }
        },
        error: () => {
          this.isLoadingZoneParts = false;
        }
      });
    }
  }

  closeZoneVariantsModal(): void {
    const item = this.activeZoneItemIndex !== null ? this.items[this.activeZoneItemIndex] : null;
    this.showZoneVariantsModal = false;
    this.activeZoneItemIndex = null;
    this.activeZoneCol = null;
    this.activeZoneDisplayParts = [];
    this.activePartInModal = null;
    this.zoneModalStep = 'select-part';
    this.activeZoneObservation = '';
    this.activeZoneAnchoredParts = [];
    this.saveToLocalStorage();

    if (item && item.technicalSpecId) {
      this.syncTechnicalSpecWithBackend(item);
    }
  }

  refreshActiveZoneAnchoredParts(item: LocalItem, col: AnatomicalColumn): void {
    if (!item.draftComponents) {
      this.activeZoneAnchoredParts = [];
      return;
    }
    const colKey = col.key.toLowerCase();
    const colLabel = col.label.toLowerCase();
    this.activeZoneAnchoredParts = item.draftComponents.filter((c: any) =>
      c.item_type === 'parte_general' && (
        (c.zone_name && c.zone_name.toLowerCase() === colKey) ||
        (c.zone_name && c.zone_name.toLowerCase() === colLabel)
      )
    ).map((c: any) => {
      const match = CANONICAL_OPTIONAL_PARTS.find(p => (p.name || '').toLowerCase().trim() === (c.name || '').toLowerCase().trim());
      const variantMatch = match?.types?.find(t => (t.name || '').toLowerCase().trim() === (c.selected_type_name || '').toLowerCase().trim());
      return {
        ...c,
        icon: c.icon || (match ? match.icon : 'bi-gem'),
        estimated_time: c.estimated_time !== undefined && c.estimated_time !== null && c.estimated_time !== 0
          ? c.estimated_time
          : (variantMatch?.total_time || 0)
      };
    });
  }

  getItemZoneOptionalCount(item: LocalItem, col: AnatomicalColumn): number {
    if (!item || !item.draftComponents || item.draftComponents.length === 0) return 0;
    const colKey = col.key.toLowerCase();
    const colLabel = col.label.toLowerCase();
    return item.draftComponents.filter((c: any) =>
      c.item_type === 'parte_general' && (
        (c.zone_name && c.zone_name.toLowerCase() === colKey) ||
        (c.zone_name && c.zone_name.toLowerCase() === colLabel)
      )
    ).length;
  }

  updateActiveZoneObservation(obs: string): void {
    this.activeZoneObservation = obs;
    if (this.activeZoneItemIndex === null || !this.activeZoneCol) return;
    const item = this.items[this.activeZoneItemIndex];
    if (!item) return;

    if (!item.zoneObservations) {
      item.zoneObservations = {};
    }
    item.zoneObservations[this.activeZoneCol.key] = obs;

    // Actualizar client_spec en draftComponents para partes que pertenezcan a esta zona
    if (item.draftComponents && item.draftComponents.length > 0) {
      const col = this.activeZoneCol;
      item.draftComponents.forEach((c: any) => {
        const text = `${c.zone_name || ''} ${c.name || ''}`.toLowerCase();
        if (col.keywords.some(k => text.includes(k.toLowerCase()))) {
          c.client_spec = obs;
        }
      });
    }

    this.saveToLocalStorage();
  }

  addOptionalFromZoneModal(): void {
    const itemIndex = this.activeZoneItemIndex;
    this.closeZoneVariantsModal();
    if (itemIndex !== null) {
      this.openFigurinModal(itemIndex);
    }
  }

  removeAnchoredPartFromZoneModal(gp: any): void {
    if (this.activeZoneItemIndex === null || !this.activeZoneCol) return;
    const item = this.items[this.activeZoneItemIndex];
    if (!item || !item.draftComponents) return;

    // Remover por referencia de objeto O por nombre+tipo
    item.draftComponents = item.draftComponents.filter((c: any) => {
      if (c === gp) return false;
      if (gp.item_type === 'parte_general' && c.item_type === 'parte_general' &&
          (c.name || '').toLowerCase().trim() === (gp.name || '').toLowerCase().trim()) {
        return false;
      }
      return true;
    });
    this.recalculateItemSam(item);
    this.refreshActiveZoneAnchoredParts(item, this.activeZoneCol);
    this.saveToLocalStorage();

    if (item.technicalSpecId) {
      this.syncTechnicalSpecWithBackend(item);
    }
  }

  selectOptionalVariantFromZoneModal(event: { part: any; type: any }): void {
    if (this.activeZoneItemIndex === null || !this.activeZoneCol) return;
    const item = this.items[this.activeZoneItemIndex];
    if (!item) return;

    if (!item.draftComponents) {
      item.draftComponents = [];
    }

    const partName = (event.part.name || '').toLowerCase().trim();

    // Remover entrada existente del mismo aplique si ya había
    item.draftComponents = item.draftComponents.filter((c: any) =>
      !(c.item_type === 'parte_general' && (c.name || '').toLowerCase().trim() === partName)
    );

    // Agregar nueva selección
    item.draftComponents.push({
      mold_part_id: null,
      mold_part_type_id: null,
      selected_type_name: event.type.name,
      name: event.part.name,
      zone_name: this.activeZoneCol!.key,
      item_type: 'parte_general',
      technical_spec: event.type.technical_description || event.type.name,
      client_spec: '',
      estimated_time: event.type.total_time || 0,
      position_x: null,
      position_y: null,
      inventory_reference: null,
      inventory_description: null
    });

    this.recalculateItemSam(item);
    this.refreshActiveZoneAnchoredParts(item, this.activeZoneCol!);
    this.saveToLocalStorage();

    if (item.technicalSpecId) {
      this.syncTechnicalSpecWithBackend(item);
    }
  }

  choosePartInZoneModal(part: any): void {
    this.activePartInModal = part;
    this.zoneModalStep = 'select-variant';
  }

  backToZonePartsList(): void {
    this.activePartInModal = null;
    this.zoneModalStep = 'select-part';
  }

  getDisplayPartsForZone(parts: any[]): any[] {
    if (!parts || parts.length === 0) return [];
    const unique: any[] = [];
    const seen = new Set<string>();

    for (const p of parts) {
      const cleanName = (p.name || '').toLowerCase().trim();
      if (!seen.has(cleanName)) {
        seen.add(cleanName);
        const siblings = parts.filter(x => (x.name || '').toLowerCase().trim() === cleanName);
        unique.push({
          ...p,
          isConsolidated: siblings.length > 1,
          siblingPartIds: siblings.map(s => s.id)
        });
      }
    }
    return unique;
  }

  selectVariantForPart(part: any, type: any): void {
    if (this.activeZoneItemIndex === null) return;
    const item = this.items[this.activeZoneItemIndex];
    if (!item) return;

    if (!item.draftComponents) {
      item.draftComponents = (item as any).technical_spec?.parts
        ? JSON.parse(JSON.stringify((item as any).technical_spec.parts))
        : [];
    }

    const pids = [part.id, ...(part.siblingPartIds || [])];
    pids.forEach(pid => {
      const existingIdx = item.draftComponents!.findIndex((c: any) => Number(c.mold_part_id) === Number(pid));
      const compObj = {
        mold_part_id: pid,
        mold_part_type_id: type.id,
        selected_type_name: type.name,
        name: part.name,
        zone_name: this.activeZoneTitle,
        item_type: 'parte',
        technical_spec: type.technical_description || type.name,
        client_spec: this.activeZoneObservation || '',
        estimated_time: Number(type.total_time || type.estimated_time) || 0,
        position_x: part.position_x || null,
        position_y: part.position_y || null
      };
      if (existingIdx >= 0) {
        // Preservar client_spec previo si activeZoneObservation está vacío
        if (!compObj.client_spec && item.draftComponents![existingIdx].client_spec) {
          compObj.client_spec = item.draftComponents![existingIdx].client_spec;
        }
        item.draftComponents![existingIdx] = compObj;
      } else {
        item.draftComponents!.push(compObj);
      }
    });

    this.recalculateItemSam(item);
    this.saveToLocalStorage();

    if (item.technicalSpecId) {
      this.syncTechnicalSpecWithBackend(item);
    }
  }

  unselectVariantForPart(part: any): void {
    if (this.activeZoneItemIndex === null) return;
    const item = this.items[this.activeZoneItemIndex];
    if (!item || !item.draftComponents) return;

    const pids = [part.id, ...(part.siblingPartIds || [])];
    item.draftComponents = item.draftComponents.filter((c: any) => !pids.includes(Number(c.mold_part_id)));

    this.recalculateItemSam(item);
    this.saveToLocalStorage();

    if (item.technicalSpecId) {
      this.syncTechnicalSpecWithBackend(item);
    }
  }



  recalculateItemSam(item: LocalItem): void {
    if (!item.draftComponents || item.draftComponents.length === 0) return;
    const total = item.draftComponents.reduce((acc: number, c: any) => acc + (Number(c.estimated_time) || 0), 0);
    item.totalSamTime = Math.round(total * 100) / 100;
  }

  syncTechnicalSpecWithBackend(item: LocalItem): void {
    if (!item.technicalSpecId || !item.moldId) return;
    const payload = {
      mold_id: item.moldId,
      description: `OPM Muestra - ${item.descripcion || item.item_cliente || item.moldName}`,
      technical_description: `Molde: ${item.moldName}. Tiempo SAM: ${item.totalSamTime || 0} min.`,
      parts: item.draftComponents || []
    };
    this.moldService.updateTechnicalSpec(item.technicalSpecId, payload).subscribe({
      next: () => {},
      error: (err) => console.error('Error sincronizando especificación en segundo plano', err)
    });
  }

  // ==================== AUTO-CALC ====================

  get cantidadAnual(): number {
    return this.cantidadPorEntrega * this.entregasAnual;
  }

  // ==================== SAVE ====================

  save(): void {
    if (!this.clienteId || !this.clienteNombre) {
      Swal.fire('Error', 'Debe seleccionar un cliente', 'error');
      return;
    }

    if (!this.requiereCosteo && !this.requiereMuestra) {
      Swal.fire('Atención', 'La solicitud debe requerir al menos costeo o muestra', 'warning');
      return;
    }

    if (this.items.length === 0) {
      Swal.fire('Atención', 'Debe agregar al menos un ítem a la solicitud', 'warning');
      return;
    }

    this.isSaving = true;
    this.processOpmAndSave();
  }

  private buildSpecPayload(item: LocalItem, components: any[], userName: string): any {
    const configuredComponents = (components || []).filter((c: any) =>
      !!c.selected_type_id ||
      !!c.selected_type_name ||
      (typeof c.technical_spec === 'string' && c.technical_spec.trim().length > 0) ||
      (typeof c.client_spec === 'string' && c.client_spec.trim().length > 0) ||
      (typeof c.exception_comment === 'string' && c.exception_comment.trim().length > 0) ||
      !!c.material_exception ||
      !!c.client_material_exception
    );

    return {
      mold_id: item.moldId,
      reference: item.siesa_referencia || null,
      description: item.descripcion || null,
      technical_description: null,
      user_created: userName || null,
      parts: configuredComponents.map((c: any) => {
        let invRef = c.zone_name || null;
        let invDesc = c.selected_type_name || null;
        const mat = c.material_exception || c.client_material_exception;
        if (mat) {
          const idItem = mat.id_item || mat.referencia || '';
          const idColor = mat.id_color || '';
          const idTalla = mat.id_talla || mat.talla || '';
          const codeParts = [idItem, idColor, idTalla].filter(x => !!x);
          invRef = codeParts.length > 0 ? codeParts.join('-') : (mat.referencia || invRef);
          invDesc = mat.color ? `${mat.descripcion} (${mat.color})` : (mat.descripcion || invDesc);
        } else if (c.inventory_reference || c.inventory_description) {
          invRef = c.inventory_reference || invRef;
          invDesc = c.inventory_description || invDesc;
        }

        return {
          mold_part_id: c.mold_part_id || null,
          mold_part_type_id: c.selected_type_id || c.mold_part_type_id || null,
          selected_type_name: c.selected_type_name || null,
          name: c.name || 'Componente',
          zone_name: c.zone_name || null,
          item_type: c.item_type || 'parte',
          view: c.view || 'front',
          position_x: c.position_x ?? null,
          position_y: c.position_y ?? null,
          client_spec: c.client_spec || null,
          technical_spec: c.technical_spec || null,
          estimated_time: c.total_time || c.estimated_time || 0,
          exception_comment: c.exception_comment || null,
          material_exception: c.material_exception || null,
          client_material_exception: c.client_material_exception || null,
          is_from_mold: c.is_from_mold !== undefined ? c.is_from_mold : true,
          inventory_reference: invRef,
          inventory_description: invDesc,
        };
      })
    };
  }

  private async processOpmAndSave(): Promise<void> {
    try {
      const user = this.authService.user;
      const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
      const generators = this.specGenerators ? this.specGenerators.toArray() : [];

      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        if (!item.moldId) continue;

        let specSavedId: number | null = null;

        // 1. Buscar generador OPM montado para el ítem i (por itemIndex, technicalSpecId o moldId)
        const gen = generators.find(g => g.itemIndex === i) || 
          (item.technicalSpecId ? generators.find(g => g.technicalSpecId === item.technicalSpecId) : null) ||
          generators.find(g => (g.externalMoldId === item.moldId || g.moldId === item.moldId));

        if (gen) {
          try {
            specSavedId = await gen.saveSpec().toPromise();
          } catch (genErr) {
            console.error(`Error guardando desde componente OPM del ítem ${i + 1}:`, genErr);
          }
        }

        // 2. Fallback si gen no existía o no devolvió un specSavedId válido
        if (!specSavedId) {
          let componentsToSave = item.draftComponents;

          if (!componentsToSave || componentsToSave.length === 0) {
            try {
              const moldRes: any = await this.moldService.getMold(item.moldId).toPromise();
              const moldParts = moldRes.data?.parts || [];
              componentsToSave = moldParts.map((p: any) => ({
                mold_part_id: p.id,
                mold_part_type_id: null,
                selected_type_name: '',
                name: p.garment_component?.display_name || p.name || 'Componente',
                item_type: p.item_type || 'parte',
                view: p.view || 'front',
                position_x: p.position_x,
                position_y: p.position_y,
                client_spec: '',
                technical_spec: '',
                estimated_time: 0,
                material_exception: null,
                client_material_exception: null,
                is_from_mold: true,
              }));
            } catch (err) {
              console.warn('No se pudieron obtener partes base del molde:', err);
              componentsToSave = [];
            }
          }

          const specPayload = this.buildSpecPayload(item, componentsToSave, userName);

          if (item.technicalSpecId) {
            try {
              const updateRes: any = await this.moldService.updateTechnicalSpec(item.technicalSpecId, specPayload).toPromise();
              if (updateRes && updateRes.success !== false) {
                specSavedId = item.technicalSpecId;
              }
            } catch (updErr) {
              console.error(`Error actualizando OPM para el ítem ${i + 1}:`, updErr);
              specSavedId = item.technicalSpecId; // Mantener id existente en caso de fallback
            }
          } else {
            try {
              const specRes: any = await this.moldService.createTechnicalSpec(specPayload).toPromise();
              if (specRes && specRes.data?.id) {
                specSavedId = specRes.data.id;
              }
            } catch (specErr) {
              console.error(`Error creando OPM para el ítem ${i + 1}:`, specErr);
            }
          }
        }

        if (specSavedId) {
          item.technicalSpecId = specSavedId;
          item.draftComponents = undefined;
        }
      }

      this.saveSolicitud();
    } catch (e) {
      this.isSaving = false;
      Swal.fire('Error', 'No se pudieron procesar las fichas OPM de la solicitud', 'error');
    }
  }

  private saveSolicitud(): void {
    const payload = {
      cliente_id: this.clienteId,
      cliente_nombre: this.clienteNombre,
      cliente_nit: this.clienteNit || null,
      requiere_costeo: this.requiereCosteo || !!this.fechaEntregaCotizacion,
      requiere_muestra: this.requiereMuestra || !!this.fechaEntregaMuestra,
      fecha_entrega_cotizacion: this.fechaEntregaCotizacion ? this.formatDateForInput(this.fechaEntregaCotizacion) : null,
      fecha_entrega_muestra: this.fechaEntregaMuestra ? this.formatDateForInput(this.fechaEntregaMuestra) : null,
      tipo_despacho: this.tipoDespacho,
      material_empaque: this.materialEmpaque || null,
      tipo_empaque: this.tipoEmpaque || null,
      observaciones: this.observaciones || null,
      cantidad_por_entrega: this.cantidadPorEntrega,
      entregas_anual: this.entregasAnual,
      imagen_referencia_url: this.imagenReferenciaUrl || null,
      items: this.items.map((it, idx) => ({
        descripcion: it.descripcion,
        item_cliente: it.item_cliente || null,
        siesa_item_rowid: it.siesa_item_rowid,
        siesa_item_ext_rowid: it.siesa_item_ext_rowid,
        siesa_referencia: it.siesa_referencia || null,
        cantidad_muestra: it.cantidad_muestra,
        ref_siesa_item_rowid: it.ref_siesa_item_rowid || null,
        ref_siesa_referencia: it.ref_siesa_referencia || null,
        ref_siesa_descripcion: it.ref_siesa_descripcion || null,
        mold_id: it.moldId || null,
        technical_spec_id: it.technicalSpecId || null,
        tallas: it.tallas.filter(t => t.talla.trim()),
      })),
      usuario_id: this.authService.user?.id || 0,
    };

    const action = this.isEditMode && this.solicitudId
      ? this.comercialService.actualizarSolicitud(this.solicitudId, payload)
      : this.comercialService.crearSolicitud(payload);

    action.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.clearLocalStorage(); // Clear draft on success
        Swal.fire({
          title: 'Éxito',
          text: this.isEditMode ? 'Solicitud actualizada' : `Solicitud ${res.data?.codigo} creada`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
        });
        setTimeout(() => {
          if (res.data?.id) {
            this.router.navigate(['/comerciales/solicitud', res.data.id]);
          } else {
            this.router.navigate(['/comerciales']);
          }
        }, 1500);
      },
      error: (err: any) => {
        this.isSaving = false;
        Swal.fire('Error', err.error?.message || 'Error al guardar', 'error');
      }
    });
  }

  // ==================== LOCAL STORAGE AUTO-SAVE ====================

  private hasMeaningfulData(): boolean {
    return !!(
      this.items.length > 0
      || this.requiereCosteo || this.requiereMuestra
      || (this.observaciones && this.observaciones.trim())
      || (this.materialEmpaque && this.materialEmpaque.trim())
    );
  }

  private startAutoSave(): void {
    // Auto-save every 15 seconds
    this.autoSaveInterval = setInterval(() => {
      this.saveToLocalStorage(true);
    }, 15000);

    // Also save on page unload (browser close, navigate away)
    window.addEventListener('beforeunload', () => this.saveToLocalStorage(true));
  }

  saveToLocalStorage(immediate: boolean = false): void {
    if (immediate) {
      if (this.saveDebounceTimer) {
        clearTimeout(this.saveDebounceTimer);
        this.saveDebounceTimer = null;
      }
      this.executeSaveToLocalStorage();
      return;
    }

    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.executeSaveToLocalStorage();
      this.saveDebounceTimer = null;
    }, 300);
  }

  private executeSaveToLocalStorage(): void {
    if (this.isEditMode) return;
    if (!this.hasMeaningfulData()) return; // Never overwrite localStorage with an empty form!

    // Sanitizar los items para localStorage evitando objetos crudos masivos o duplicados en memoria
    const sanitizedItems = (this.items || []).map(it => {
      const { availableMolds, ...rest } = it;
      return rest;
    });

    const draft = {
      timestamp: Date.now(),
      clienteId: this.clienteId,
      clienteNombre: this.clienteNombre,
      clienteNit: this.clienteNit,
      requiereCosteo: this.requiereCosteo,
      requiereMuestra: this.requiereMuestra,
      fechaEntregaCotizacion: this.fechaEntregaCotizacion,
      fechaEntregaMuestra: this.fechaEntregaMuestra,
      tipoDespacho: this.tipoDespacho,
      materialEmpaque: this.materialEmpaque,
      tipoEmpaque: this.tipoEmpaque,
      observaciones: this.observaciones,
      cantidadPorEntrega: this.cantidadPorEntrega,
      entregasAnual: this.entregasAnual,
      imagenReferenciaUrl: this.imagenReferenciaUrl,
      items: sanitizedItems,
      activeSection: this.activeSection,
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn('Error saving draft to localStorage', e);
    }
  }

  private restoreFromLocalStorage(): void {
    if (this.isEditMode) return; // Don't restore for edits

    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;

      const draft = JSON.parse(raw);

      // Only restore if less than 7 days old
      const age = Date.now() - (draft.timestamp || 0);
      if (age > 7 * 24 * 60 * 60 * 1000) {
        this.clearLocalStorage();
        return;
      }

      // Check if draft has meaningful content
      const hasData = (draft.items && draft.items.length > 0)
        || draft.requiereCosteo || draft.requiereMuestra
        || (draft.observaciones && draft.observaciones.trim())
        || (draft.materialEmpaque && draft.materialEmpaque.trim())
        || (draft.cantidadPorEntrega && draft.cantidadPorEntrega > 0);
      if (!hasData) {
        return;
      }

      // Ask user if they want to restore the draft or start fresh
      const draftClientName = draft.clienteNombre || 'sin cliente';
      Swal.fire({
        title: '¿Deseas restaurar el borrador anterior?',
        text: `Hay un borrador previo no guardado del cliente "${draftClientName}". ¿Deseas recuperarlo o comenzar una solicitud en blanco?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Restaurar borrador',
        cancelButtonText: 'Comenzar en blanco',
        confirmButtonColor: '#2563EB',
        cancelButtonColor: '#64748B',
      }).then((result) => {
        if (result.isConfirmed) {
          this.applyDraft(draft);
        } else {
          this.clearLocalStorage();
        }
      });
    } catch (e) {
      console.warn('Error restoring draft', e);
    }
  }

  private applyDraft(draft: any): void {
    // Always restore client from draft (overrides current route)
    if (draft.clienteId) {
      this.clienteId = draft.clienteId;
      this.clienteNombre = draft.clienteNombre || '';
      this.clienteNit = draft.clienteNit || '';
    }
    this.fechaEntregaCotizacion = this.formatDateForInput(draft.fechaEntregaCotizacion);
    this.fechaEntregaMuestra = this.formatDateForInput(draft.fechaEntregaMuestra);
    this.requiereCosteo = draft.requiereCosteo ?? (!!this.fechaEntregaCotizacion);
    this.requiereMuestra = draft.requiereMuestra ?? (!!this.fechaEntregaMuestra);
    this.tipoDespacho = draft.tipoDespacho || 'LOCAL';
    this.materialEmpaque = draft.materialEmpaque || '';
    this.tipoEmpaque = draft.tipoEmpaque || '';
    this.observaciones = draft.observaciones || '';
    this.cantidadPorEntrega = draft.cantidadPorEntrega || 0;
    this.entregasAnual = draft.entregasAnual || 1;
    this.imagenReferenciaUrl = draft.imagenReferenciaUrl || '';
    this.items = (draft.items || []).map((it: any) => ({
      ...it,
      tallas: (it.tallas || []).map((t: any) => ({
        ...t,
        talla: this.cleanTalla(t.talla)
      }))
    }));
    this.activeSection = draft.activeSection || 0;
    this.rebuildAnatomicalGroups();
  }

  private clearLocalStorage(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('saint_spec_draft_')) {
          toRemove.push(k);
        }
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }

  private formatDateForInput(dateStr: any): string {
    if (!dateStr) return '';
    if (dateStr instanceof Date) {
      if (isNaN(dateStr.getTime())) return '';
      const y = dateStr.getFullYear();
      const m = String(dateStr.getMonth() + 1).padStart(2, '0');
      const d = String(dateStr.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const str = String(dateStr).trim();
    if (!str) return '';

    // Match YYYY-MM-DD (including ISO timestamps like 2026-09-25T00:00:00.000Z)
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    // Match DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const d = dmyMatch[1].padStart(2, '0');
      const m = dmyMatch[2].padStart(2, '0');
      const y = dmyMatch[3];
      return `${y}-${m}-${d}`;
    }

    if (str.includes('T')) return str.split('T')[0];
    if (str.includes(' ')) return str.split(' ')[0];

    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {}
    return str;
  }

  goBack(): void {
    if (this.clienteId) {
      this.router.navigate(['/comerciales/cliente', this.clienteId], {
        queryParams: { nombre: this.clienteNombre, nit: this.clienteNit }
      });
    } else {
      this.router.navigate(['/comerciales']);
    }
  }

  get totalUnidades(): number {
    return this.items.reduce((sum, it) => {
      return sum + this.getItemTotal(it);
    }, 0);
  }

  get totalMuestras(): number {
    return this.items.reduce((sum, it) => sum + (it.cantidad_muestra || 0), 0);
  }

  getItemTotal(item: LocalItem): number {
    if (!item || !item.tallas) return 0;
    return item.tallas.reduce((ts, t) => ts + (Number(t.cantidad) || 0), 0);
  }

  get totalDiscrepancy(): number {
    return (this.cantidadPorEntrega || 0) - this.totalUnidades;
  }

  get hasTotalDiscrepancy(): boolean {
    return (this.cantidadPorEntrega || 0) > 0 && this.totalUnidades > 0 && this.totalDiscrepancy !== 0;
  }

  cleanTalla(talla: string | null | undefined): string {
    if (!talla) return '';
    const trimmed = talla.trim();
    const cleaned = trimmed.replace(/^\d+[\.\s\/\-]+/, '').replace(/^\/+/, '').trim();
    return cleaned || trimmed;
  }
}
