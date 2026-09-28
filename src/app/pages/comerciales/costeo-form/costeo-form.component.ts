import { Component, OnInit, OnDestroy, ViewChildren, QueryList } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, Solicitud, SolicitudItem, SolicitudItemTalla } from '../../../services/comercial.service';
import { MoldService } from '../../../services/mold.service';
import { AuthService } from '../../../services/auth.service';
import { SpecGeneratorComponent } from '../../moldes/spec-generator/spec-generator.component';

import Swal from 'sweetalert2';

interface LocalItem {
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
  specExpanded: boolean;
  availableMolds: any[];
  activeTab?: 'tallas' | 'molde';
  draftComponents?: any[]; // Store in-progress OPM components
}

@Component({
  selector: 'app-costeo-form',
  templateUrl: './costeo-form.component.html',
  styleUrls: ['./costeo-form.component.css']
})
export class CosteoFormComponent implements OnInit, OnDestroy {
  @ViewChildren(SpecGeneratorComponent) specGenerators!: QueryList<SpecGeneratorComponent>;

  private autoSaveInterval: any;
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
  moldSearchQuery = '';
  allMolds: any[] = [];
  isLoadingMolds = false;

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
    this.restoreFromLocalStorage();
    this.startAutoSave();
  }

  ngOnDestroy(): void {
    this.saveToLocalStorage();
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
    this.items.push({
      descripcion: item.f120_descripcion || item.descripcion || '',
      item_cliente: '',
      siesa_item_rowid: item.f120_rowid || item.rowid_item || null,
      siesa_item_ext_rowid: item.f121_rowid || item.rowid_item_ext || null,
      siesa_referencia: item.f120_referencia || item.referencia || '',
      cantidad_muestra: 0,
      tallas: item.talla ? [{
        talla: this.cleanTalla(item.talla),
        cantidad: 0,
        siesa_item_ext_rowid: item.f121_rowid || item.rowid_item_ext
      }] : [],
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
    });
    this.showItemSearch = false;
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
    }
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
    this.moldSearchQuery = '';
    this.showMoldSelectorModal = true;
    this.loadAllMolds();
  }

  closeMoldSelector(): void {
    this.showMoldSelectorModal = false;
    this.moldSelectorItemIndex = null;
    this.moldSearchQuery = '';
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
    item.availableMolds = this.allMolds.filter(m => m.mold_category_id === item.categoryId);
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
    item.availableMolds = [];
    this.saveToLocalStorage();
  }

  get filteredModalMolds(): any[] {
    let list = this.allMolds;
    if (this.selectedModalCategoryId) {
      list = list.filter(m => (m.mold_category_id || m.id_product_category || m.category_id) === this.selectedModalCategoryId);
    }
    if (this.moldSearchQuery.trim()) {
      const q = this.moldSearchQuery.toLowerCase().trim();
      list = list.filter(m => 
        (m.name && m.name.toLowerCase().includes(q)) || 
        (m.code && m.code.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    }
    return list;
  }

  getMoldPreviewImage(mold: any): string {
    if (mold.image_signed_url) return mold.image_signed_url;
    if (mold.front_image_signed_url) return mold.front_image_signed_url;
    if (mold.front_image_url) return mold.front_image_url;
    const cat = this.categories.find(c => c.id === (mold.mold_category_id || mold.id_product_category || mold.category_id));
    return cat?.image_signed_url || '';
  }

  getCategoryMoldCount(catId: number): number {
    return this.allMolds.filter(m => (m.mold_category_id || m.id_product_category || m.category_id) === catId).length;
  }

  suggestCategoryForItem(index: number): void {
    const item = this.items[index];
    if (!item || !item.descripcion) return;
    this.moldService.suggestCategory(item.descripcion).subscribe({
      next: (res: any) => {
        if (res.data) {
          item.categoryId = res.data.id;
          item.categoryName = res.data.name;
          this.loadMoldsForItem(index);
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
    item.availableMolds = [];
    this.loadMoldsForItem(index);
  }

  loadMoldsForItem(index: number): void {
    const item = this.items[index];
    if (!item.categoryId) return;
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
      this.saveToLocalStorage();
    }, 15000);

    // Also save on page unload (browser close, navigate away)
    window.addEventListener('beforeunload', () => this.saveToLocalStorage());
  }

  private saveToLocalStorage(): void {
    if (this.isEditMode) return;
    if (!this.hasMeaningfulData()) return; // Never overwrite localStorage with an empty form!

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
      items: this.items,
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
    return talla.replace(/^\/+/, '').trim();
  }
}
