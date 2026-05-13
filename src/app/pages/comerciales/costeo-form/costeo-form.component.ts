import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, Solicitud, SolicitudItem, SolicitudItemTalla } from '../../../services/comercial.service';
import { MoldService } from '../../../services/mold.service';
import { AuthService } from '../../../services/auth.service';

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
}

@Component({
  selector: 'app-costeo-form',
  templateUrl: './costeo-form.component.html',
  styleUrls: ['./costeo-form.component.css']
})
export class CosteoFormComponent implements OnInit, OnDestroy {

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

  // Items
  items: LocalItem[] = [];

  // Mold Categories
  categories: any[] = [];

  // Modals
  showItemSearch = false;

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
    { label: 'Datos Generales', icon: 'bi-info-circle' },
    { label: 'Ítems', icon: 'bi-box-seam' },
    { label: 'Empaque & Proyección', icon: 'bi-truck' },
    { label: 'Moldes por Ítem', icon: 'bi-grid-3x3' },
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
        this.clienteId = s.cliente_id;
        this.clienteNombre = s.cliente_nombre;
        this.clienteNit = s.cliente_nit || '';
        this.requiereCosteo = s.requiere_costeo || false;
        this.requiereMuestra = s.requiere_muestra || false;
        this.fechaEntregaCotizacion = s.fecha_entrega_cotizacion || '';
        this.fechaEntregaMuestra = s.fecha_entrega_muestra || '';
        this.tipoDespacho = s.tipo_despacho || 'LOCAL';
        this.materialEmpaque = s.material_empaque || '';
        this.tipoEmpaque = s.tipo_empaque || '';
        this.observaciones = s.observaciones || '';
        this.cantidadPorEntrega = s.cantidad_por_entrega || 0;
        this.entregasAnual = s.entregas_anual || 1;
        this.imagenReferenciaUrl = s.imagen_referencia_url || '';

        this.items = (s.items || []).map((it: any) => ({
          descripcion: it.descripcion,
          item_cliente: it.item_cliente || '',
          siesa_item_rowid: it.siesa_item_rowid,
          siesa_item_ext_rowid: it.siesa_item_ext_rowid,
          siesa_referencia: it.siesa_referencia || '',
          cantidad_muestra: it.cantidad_muestra || 0,
          tallas: (it.tallas || []).map((t: any) => ({ talla: t.talla, cantidad: t.cantidad })),
          isNew: !it.siesa_item_rowid,
          isExpanded: false,
          ref_siesa_item_rowid: it.ref_siesa_item_rowid || null,
          ref_siesa_referencia: it.ref_siesa_referencia || '',
          ref_siesa_descripcion: it.ref_siesa_descripcion || '',
          categoryId: null,
          categoryName: '',
          moldId: it.mold_id || null,
          moldName: '',
          technicalSpecId: it.technical_spec_id || null,
          specExpanded: false,
          availableMolds: [],
        }));

        this.isLoading = false;
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
      },
      error: () => {}
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
        talla: item.talla,
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
              inputOptions[ext.rowid_item_ext] = `${ext.talla} ${ext.color ? '(' + ext.color + ')' : ''}`;
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
                    talla: extSeleccionada.talla,
                    cantidad: 0,
                    siesa_item_ext_rowid: extSeleccionada.rowid_item_ext
                  });
                }
              }
            });
          } else {
            item.tallas.push({ talla: '', cantidad: 0 });
          }
        },
        error: () => {
          item.tallas.push({ talla: '', cantidad: 0 });
        }
      });
    } else {
      item.tallas.push({ talla: '', cantidad: 0 });
    }
  }

  removeTalla(item: LocalItem, ti: number): void {
    item.tallas.splice(ti, 1);
  }

  toggleItem(item: LocalItem): void {
    item.isExpanded = !item.isExpanded;
  }

  // ==================== PER-ITEM MOLD ====================

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
    const m = item.availableMolds.find((x: any) => x.id === moldId);
    item.moldName = m?.name || '';
    item.technicalSpecId = null; // Reset spec when changing mold
  }

  clearMoldForItem(index: number): void {
    const item = this.items[index];
    item.moldId = null;
    item.moldName = '';
    item.technicalSpecId = null;
    item.specExpanded = false;
  }

  toggleSpecForItem(index: number): void {
    // Close all other spec generators, open this one
    this.items.forEach((it, i) => {
      if (i !== index) it.specExpanded = false;
    });
    this.items[index].specExpanded = !this.items[index].specExpanded;
  }

  onItemSpecSaved(index: number, specId: number): void {
    this.items[index].technicalSpecId = specId;
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
    target.availableMolds = [...source.availableMolds];
    // Note: technicalSpecId is NOT copied — each item needs its own spec save
    target.technicalSpecId = null;
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

    this.isSaving = true;
    this.saveSolicitud();
  }

  private saveSolicitud(): void {
    const payload = {
      cliente_id: this.clienteId,
      cliente_nombre: this.clienteNombre,
      cliente_nit: this.clienteNit || null,
      requiere_costeo: this.requiereCosteo,
      requiere_muestra: this.requiereMuestra,
      fecha_entrega_cotizacion: this.requiereCosteo ? (this.fechaEntregaCotizacion || null) : null,
      fecha_entrega_muestra: this.requiereMuestra ? (this.fechaEntregaMuestra || null) : null,
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

      // Only restore if less than 24 hours old
      const age = Date.now() - (draft.timestamp || 0);
      if (age > 24 * 60 * 60 * 1000) {
        this.clearLocalStorage();
        return;
      }

      // Only offer to restore if there's meaningful data
      const hasData = (draft.items && draft.items.length > 0)
        || draft.requiereCosteo || draft.requiereMuestra
        || (draft.observaciones && draft.observaciones.trim())
        || (draft.materialEmpaque && draft.materialEmpaque.trim());
      if (!hasData) {
        this.clearLocalStorage();
        return;
      }

      const draftClientName = draft.clienteNombre || 'sin cliente';

      Swal.fire({
        title: 'Borrador encontrado',
        text: `Hay una solicitud pendiente del cliente "${draftClientName}". ¿Desea restaurarla?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Restaurar',
        cancelButtonText: 'Descartar',
        confirmButtonColor: '#2563EB',
      }).then((result) => {
        if (result.isConfirmed) {
          this.applyDraft(draft);
        } else {
          this.clearLocalStorage();
        }
      });
    } catch (e) {
      console.warn('Error restoring draft', e);
      this.clearLocalStorage();
    }
  }

  private applyDraft(draft: any): void {
    // Always restore client from draft (overrides current route)
    if (draft.clienteId) {
      this.clienteId = draft.clienteId;
      this.clienteNombre = draft.clienteNombre || '';
      this.clienteNit = draft.clienteNit || '';
    }
    this.requiereCosteo = draft.requiereCosteo ?? false;
    this.requiereMuestra = draft.requiereMuestra ?? false;
    this.fechaEntregaCotizacion = draft.fechaEntregaCotizacion || '';
    this.fechaEntregaMuestra = draft.fechaEntregaMuestra || '';
    this.tipoDespacho = draft.tipoDespacho || 'LOCAL';
    this.materialEmpaque = draft.materialEmpaque || '';
    this.tipoEmpaque = draft.tipoEmpaque || '';
    this.observaciones = draft.observaciones || '';
    this.cantidadPorEntrega = draft.cantidadPorEntrega || 0;
    this.entregasAnual = draft.entregasAnual || 1;
    this.imagenReferenciaUrl = draft.imagenReferenciaUrl || '';
    this.items = draft.items || [];
    this.activeSection = draft.activeSection || 0;
  }

  private clearLocalStorage(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {}
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
      const tallasSum = it.tallas.reduce((ts, t) => ts + (t.cantidad || 0), 0);
      return sum + tallasSum;
    }, 0);
  }

  get totalMuestras(): number {
    return this.items.reduce((sum, it) => sum + (it.cantidad_muestra || 0), 0);
  }
}
