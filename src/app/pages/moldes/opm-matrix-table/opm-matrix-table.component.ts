import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MoldService } from '../../../services/mold.service';
import Swal from 'sweetalert2';
import { CANONICAL_OPTIONAL_PARTS, OptionalPart, OptionalPartType } from '../../comerciales/modals/canonical-optional-parts';

export type AnatomicalFamily = 'SUPERIOR' | 'INFERIOR' | 'COMPLETA' | 'GENERAL' | 'SIN_MOLDE';

export interface ItemArchivo {
  nombre: string;
  url: string;
  temporary_url?: string;
  tipo: string;
  tamano?: number;
}

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
  ref_siesa_item_rowid: number | null;
  ref_siesa_referencia: string;
  ref_siesa_descripcion: string;
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
  draftComponents?: any[];
  observaciones?: string;
  archivos?: ItemArchivo[];
  archivos_urls?: string[];
  imagenReferenciaUrl?: string;
  requiere_costeo?: boolean;
  requiere_muestra?: boolean;
  siesa_opm_consecutivo?: string | null;
}

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
  selector: 'app-opm-matrix-table',
  templateUrl: './opm-matrix-table.component.html',
  styleUrls: ['./opm-matrix-table.component.css']
})
export class OpmMatrixTableComponent implements OnInit, OnDestroy, OnChanges {
  @Input() mode: 'solicitud' | 'moldes' = 'moldes';
  @Input() items: LocalItem[] = [];
  @Output() itemsChange = new EventEmitter<LocalItem[]>();

  @Input() allMolds: any[] = [];
  @Input() categories: any[] = [];
  @Input() clienteId: number | null = null;
  @Input() isSaving: boolean = false;
  @Input() isEditMode: boolean = false;
  @Input() requiereCosteo: boolean = false;
  @Input() requiereMuestra: boolean = false;

  @Input() preloadedMoldId: number | null = null;
  @Output() onBackToLibreria = new EventEmitter<void>();
  @Output() onBackToGeneral = new EventEmitter<void>();
  @Output() onSaveSolicitud = new EventEmitter<void>();

  private readonly STORAGE_KEY = 'saint_moldes_opm_matrix_draft';
  private autoSaveTimer: any = null;

  cachedMoldsMap: { [id: number]: any } = {};

  isLoading = false;
  isLoadingMolds = false;

  // Filtros y ordenamiento
  selectedFamilyFilter: 'TODAS' | AnatomicalFamily = 'TODAS';
  anatomicalSortOrder: 'family' | 'qty' = 'family';
  _cachedAnatomicalGroups: AnatomicalGroup[] = [];

  // Nuevo item inline
  showNewItemForm = false;
  newItemDesc = '';
  newItemRef = '';

  // Buscador de Siesa
  showItemSearch = false;

  // Edición inline de descripción y referencia
  editingItemIndex: number | null = null;
  editDescTemp = '';
  editRefTemp = '';

  // Modal Flotante de Variantes de Zona
  showZoneVariantsModal = false;
  activeZoneItemIndex: number | null = null;
  activeZoneCol: AnatomicalColumn | null = null;
  activeZoneTitle = '';
  activeZoneSubtitle = '';
  activeZoneDisplayParts: any[] = [];
  activePartInModal: any = null;
  zoneModalStep: 'select-part' | 'select-variant' | 'select-optional' | 'select-optional-variant' = 'select-part';
  isLoadingZoneParts = false;
  activeZoneAnchoredParts: any[] = [];

  // Modal de Figurín OPM (2D Stepper)
  showFigurinModal = false;
  activeFigurinItem: LocalItem | null = null;
  activeFigurinItemIndex: number | null = null;

  // Modal Rápido de Tallas
  showTallasQuickModal = false;
  activeTallasItemIndex: number | null = null;
  tallasLetra: string[] = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
  tallasNumericas: string[] = ['28', '30', '32', '34', '36', '38', '40', '42'];

  // Modal Selector de Molde Base
  showMoldSelectorModal = false;
  moldSelectorItemIndex: number | null = null;
  selectedModalCategoryId: number | null = null;

  // Modal de Notas & Archivos por Prenda
  showItemNotesModal = false;
  activeNotesItemIndex: number | null = null;

  // Guardando OPM global en modo moldes
  isSavingGlobalOpm = false;

  constructor(
    private moldService: MoldService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.mode === 'solicitud') {
      if (!this.allMolds || this.allMolds.length === 0) {
        this.loadAllMolds();
      } else {
        this.allMolds.forEach(m => this.cachedMoldsMap[m.id] = m);
      }
      if (!this.categories || this.categories.length === 0) {
        this.loadCategories();
      }
      this.rebuildAnatomicalGroups();
    } else {
      this.loadCategories();
      this.loadAllMolds(() => {
        this.restoreFromLocalStorage();
        const routeMoldId = this.route.snapshot.params['id'] || this.route.snapshot.queryParams['moldId'];
        const targetId = this.preloadedMoldId || (routeMoldId ? Number(routeMoldId) : null);
        if (targetId) {
          this.addMoldById(targetId);
        }
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      this.rebuildAnatomicalGroups();
    }
    if (changes['allMolds'] && this.allMolds) {
      this.allMolds.forEach(m => this.cachedMoldsMap[m.id] = m);
      this.rebuildAnatomicalGroups();
    }
    if (changes['categories'] && this.categories) {
      this.rebuildAnatomicalGroups();
    }
  }

  handleBack(): void {
    this.onBackToLibreria.emit();
    this.router.navigate(['/moldes']);
  }

  ngOnDestroy(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
  }

  // ==================== CARGA DE DATOS ====================

  loadCategories(): void {
    this.moldService.getCategories().subscribe({
      next: (res: any) => {
        if (res?.success && res?.data) {
          this.categories = res.data;
        }
      },
      error: (err) => console.error('Error cargando categorías:', err)
    });
  }

  loadAllMolds(callback?: () => void): void {
    this.isLoadingMolds = true;
    this.moldService.getMolds().subscribe({
      next: (res: any) => {
        this.isLoadingMolds = false;
        if (res?.success && res?.data) {
          this.allMolds = res.data;
          this.allMolds.forEach(m => {
            this.cachedMoldsMap[m.id] = m;
          });
        }
        if (callback) callback();
        this.rebuildAnatomicalGroups();
      },
      error: () => {
        this.isLoadingMolds = false;
        if (callback) callback();
      }
    });
  }

  // ==================== PERSISTENCIA Y SINCRONIZACIÓN ====================

  saveData(): void {
    if (this.mode === 'solicitud') {
      this.itemsChange.emit(this.items);
    } else {
      this.saveToLocalStorage();
    }
  }

  saveToLocalStorage(): void {
    if (this.mode === 'solicitud') return;
    try {
      const payload = {
        items: this.items,
        selectedFamilyFilter: this.selectedFamilyFilter,
        anatomicalSortOrder: this.anatomicalSortOrder
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('No se pudo guardar borrador en localStorage', e);
    }
  }

  restoreFromLocalStorage(): void {
    if (this.mode === 'solicitud') return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        this.items = parsed.items;
        if (parsed.selectedFamilyFilter) this.selectedFamilyFilter = parsed.selectedFamilyFilter;
        if (parsed.anatomicalSortOrder) this.anatomicalSortOrder = parsed.anatomicalSortOrder;
        this.rebuildAnatomicalGroups();
      }
    } catch (e) {
      console.warn('No se pudo restaurar borrador de localStorage', e);
    }
  }

  clearDraft(): void {
    Swal.fire({
      title: '¿Limpiar tabla?',
      text: 'Se eliminarán todas las prendas configuradas en este borrador.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed) {
        this.items = [];
        this.saveData();
        this.rebuildAnatomicalGroups();
      }
    });
  }

  // ==================== AGREGAR ÍTEMS ====================

  addMoldItem(mold: any): void {
    const newItem: LocalItem = {
      descripcion: mold.name,
      item_cliente: '',
      siesa_item_rowid: null,
      siesa_item_ext_rowid: null,
      siesa_referencia: '',
      cantidad_muestra: 1,
      tallas: [{ talla: 'M', cantidad: 1 }],
      isNew: true,
      isExpanded: false,
      ref_siesa_item_rowid: null,
      ref_siesa_referencia: '',
      ref_siesa_descripcion: '',
      categoryId: mold.category_id || null,
      categoryName: mold.category?.name || '',
      moldId: mold.id,
      moldName: mold.name,
      technicalSpecId: null,
      totalSamTime: 0,
      specExpanded: false,
      availableMolds: [],
      draftComponents: [],
      observaciones: '',
      archivos: [],
      requiere_costeo: this.requiereCosteo,
      requiere_muestra: this.requiereMuestra,
    };

    this.items.push(newItem);
    this.saveData();
    this.rebuildAnatomicalGroups();
  }

  addMoldById(moldId: number): void {
    const mold = this.allMolds.find(m => m.id === moldId) || this.cachedMoldsMap[moldId];
    if (mold) {
      this.addMoldItem(mold);
    } else {
      this.moldService.getMold(moldId).subscribe({
        next: (res: any) => {
          if (res?.success && res?.data) {
            this.addMoldItem(res.data);
          }
        }
      });
    }
  }

  addNewItem(): void {
    if (!this.newItemDesc.trim()) return;

    const newItem: LocalItem = {
      descripcion: this.newItemDesc.trim(),
      item_cliente: this.newItemRef.trim(),
      siesa_item_rowid: null,
      siesa_item_ext_rowid: null,
      siesa_referencia: '',
      cantidad_muestra: 1,
      tallas: [{ talla: 'M', cantidad: 1 }],
      isNew: true,
      isExpanded: false,
      ref_siesa_item_rowid: null,
      ref_siesa_referencia: '',
      ref_siesa_descripcion: '',
      categoryId: null,
      categoryName: '',
      moldId: null,
      moldName: '',
      technicalSpecId: null,
      totalSamTime: 0,
      specExpanded: false,
      availableMolds: [],
      draftComponents: [],
      observaciones: '',
      archivos: [],
      requiere_costeo: this.requiereCosteo,
      requiere_muestra: this.requiereMuestra,
    };

    this.items.push(newItem);
    this.newItemDesc = '';
    this.newItemRef = '';
    this.showNewItemForm = false;
    this.saveData();
    this.rebuildAnatomicalGroups();
  }

  addItemFromSiesa(siesaItem: any): void {
    const defaultCat = this.categories.length > 0 ? this.categories[0] : null;
    const newItem: LocalItem = {
      descripcion: siesaItem.descripcion || siesaItem.f120_descripcion || 'Ítem desde Siesa',
      item_cliente: siesaItem.referencia || siesaItem.f120_id || '',
      siesa_item_rowid: siesaItem.rowid || siesaItem.f120_rowid || null,
      siesa_item_ext_rowid: siesaItem.rowid_item_ext || null,
      siesa_referencia: siesaItem.referencia || siesaItem.f120_id || '',
      cantidad_muestra: 1,
      tallas: [],
      isNew: false,
      isExpanded: true,
      ref_siesa_item_rowid: siesaItem.rowid || siesaItem.f120_rowid || null,
      ref_siesa_referencia: siesaItem.referencia || siesaItem.f120_id || '',
      ref_siesa_descripcion: siesaItem.descripcion || siesaItem.f120_descripcion || '',
      categoryId: defaultCat?.id || null,
      categoryName: defaultCat?.name || '',
      moldId: null,
      moldName: '',
      technicalSpecId: null,
      specExpanded: false,
      availableMolds: [],
      draftComponents: [],
      observaciones: '',
      archivos: [],
      requiere_costeo: this.requiereCosteo,
      requiere_muestra: this.requiereMuestra,
    };

    this.items.push(newItem);
    this.showItemSearch = false;
    this.saveData();
    this.rebuildAnatomicalGroups();
  }

  toggleItemCosteo(item: LocalItem, event?: Event): void {
    if (event) event.stopPropagation();
    item.requiere_costeo = !item.requiere_costeo;
    this.saveData();
  }

  toggleAllCosteo(state: boolean, event?: Event): void {
    if (event) event.stopPropagation();
    this.items.forEach(it => it.requiere_costeo = state);
    this.saveData();
  }

  duplicateItem(index: number): void {
    const orig = this.items[index];
    if (!orig) return;

    const cloned: LocalItem = JSON.parse(JSON.stringify(orig));
    cloned.technicalSpecId = null;
    cloned.opmReference = undefined;
    cloned.descripcion = cloned.descripcion + ' (Copia)';

    this.items.splice(index + 1, 0, cloned);
    this.saveData();
    this.rebuildAnatomicalGroups();
  }

  removeItem(index: number): void {
    Swal.fire({
      title: '¿Eliminar prenda?',
      text: `Se quitará "${this.items[index]?.descripcion || 'esta prenda'}" de la lista.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.items.splice(index, 1);
        this.saveData();
        this.rebuildAnatomicalGroups();
      }
    });
  }

  // ==================== EDICIÓN INLINE ====================

  startEditItem(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingItemIndex = index;
    this.editDescTemp = this.items[index].descripcion || '';
    this.editRefTemp = this.items[index].item_cliente || this.items[index].siesa_referencia || '';
  }

  saveEditItem(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.items[index] && this.editDescTemp.trim()) {
      this.items[index].descripcion = this.editDescTemp.trim();
      this.items[index].item_cliente = this.editRefTemp.trim();
      this.editingItemIndex = null;
      this.saveData();
      this.rebuildAnatomicalGroups();
    }
  }

  cancelEditItem(event?: Event): void {
    if (event) event.stopPropagation();
    this.editingItemIndex = null;
  }

  // ==================== SELECTOR DE MOLDE ====================

  openMoldSelector(index: number): void {
    this.moldSelectorItemIndex = index;
    this.selectedModalCategoryId = this.items[index]?.categoryId || null;
    this.showMoldSelectorModal = true;
  }

  closeMoldSelector(): void {
    this.showMoldSelectorModal = false;
    this.moldSelectorItemIndex = null;
  }

  onMoldSelected(mold: any): void {
    if (this.moldSelectorItemIndex === null) return;
    const item = this.items[this.moldSelectorItemIndex];
    if (!item) return;

    item.moldId = mold.id;
    item.moldName = mold.name;
    item.categoryId = mold.category_id || item.categoryId;
    item.categoryName = mold.category?.name || item.categoryName;
    item.technicalSpecId = null;
    item.opmReference = undefined;

    this.cachedMoldsMap[mold.id] = mold;
    item.draftComponents = [];

    this.closeMoldSelector();
    this.saveData();
    this.rebuildAnatomicalGroups();
  }

  // ==================== FIGURÍN OPM ====================

  openFigurinModal(index: number): void {
    const item = this.items[index];
    if (!item) return;

    if (!item.moldId) {
      this.openMoldSelector(index);
      return;
    }

    this.activeFigurinItemIndex = index;
    this.activeFigurinItem = { ...item };
    this.showFigurinModal = true;
  }

  closeFigurinModal(): void {
    this.showFigurinModal = false;
    this.activeFigurinItemIndex = null;
    this.activeFigurinItem = null;
    this.saveData();
    this.rebuildAnatomicalGroups();
  }

  onItemOpmSavedFromModal(event: any): void {
    if (this.activeFigurinItemIndex !== null) {
      const item = this.items[this.activeFigurinItemIndex];
      if (item) {
        item.technicalSpecId = event.technicalSpecId;
        item.opmReference = event.reference;
        item.totalSamTime = event.samTime;
        if (event.tallas && Array.isArray(event.tallas) && event.tallas.length > 0) {
          item.tallas = event.tallas;
        }
      }
      this.saveData();
      this.rebuildAnatomicalGroups();
    }
  }

  openMoldSelectorFromModal(): void {
    if (this.activeFigurinItemIndex !== null) {
      this.openMoldSelector(this.activeFigurinItemIndex);
    }
  }

  clearMoldFromModal(): void {
    if (this.activeFigurinItemIndex !== null) {
      const item = this.items[this.activeFigurinItemIndex];
      if (item) {
        item.moldId = null;
        item.moldName = '';
        item.technicalSpecId = null;
        item.draftComponents = [];
      }
      this.closeFigurinModal();
      this.saveData();
      this.rebuildAnatomicalGroups();
    }
  }

  // ==================== TALLAS RÁPIDAS ====================

  openTallasQuickModal(index: number): void {
    if (this.mode === 'solicitud' && !this.requiereMuestra) {
      Swal.fire({
        icon: 'info',
        title: 'Muestra Física no solicitada',
        text: 'Para asignar tallas y cantidades a confeccionar, active la casilla "Requiere Muestra Física" en la sección de datos generales de la solicitud.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }
    this.activeTallasItemIndex = index;
    this.showTallasQuickModal = true;
  }

  closeTallasQuickModal(): void {
    this.showTallasQuickModal = false;
    this.activeTallasItemIndex = null;
    this.saveData();
  }

  addSpecificTalla(item: LocalItem, talla: string): void {
    if (!item.tallas) item.tallas = [];
    const exists = item.tallas.find(t => t.talla === talla);
    if (!exists) {
      item.tallas.push({ talla, cantidad: 1 });
      this.saveData();
    }
  }

  removeTalla(item: LocalItem, ti: number): void {
    if (item.tallas && item.tallas[ti]) {
      item.tallas.splice(ti, 1);
      this.saveData();
    }
  }

  // ==================== NOTAS Y ARCHIVOS ====================

  openItemNotesModal(index: number): void {
    this.activeNotesItemIndex = index;
    this.showItemNotesModal = true;
  }

  closeItemNotesModal(): void {
    this.showItemNotesModal = false;
    this.activeNotesItemIndex = null;
    this.saveData();
  }

  // ==================== MODAL DE ZONAS & VARIANTES ====================

  openZoneVariantsModal(itemIndex: number, col: AnatomicalColumn): void {
    const item = this.items[itemIndex];
    if (!item) return;

    if (!item.moldId) {
      Swal.fire({
        title: 'Prenda sin molde',
        text: 'Primero debes asignar un molde base a esta prenda para configurar sus partes anatómicas.',
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Seleccionar Molde',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (result.isConfirmed) {
          this.openMoldSelector(itemIndex);
        }
      });
      return;
    }

    this.activeZoneItemIndex = itemIndex;
    this.activeZoneCol = col;
    this.activeZoneTitle = col.label;
    this.activeZoneSubtitle = `Configura ${col.label.toLowerCase()} para "${item.descripcion}"`;

    this.refreshActiveZoneAnchoredParts(item, col);

    if (!item.draftComponents) {
      item.draftComponents = [];
    }

    const mold = this.cachedMoldsMap[item.moldId];
    if (mold && mold.parts) {
      const matchedParts = mold.parts.filter((p: any) => {
        const region = (p.anatomical_region || p.family || '').toLowerCase();
        const pName = (p.name || '').toLowerCase();
        return col.keywords.some(k => region.includes(k) || pName.includes(k));
      });

      this.activeZoneDisplayParts = this.getDisplayPartsForZone(matchedParts);

      if (this.activeZoneDisplayParts.length > 1) {
        this.zoneModalStep = 'select-part';
        this.activePartInModal = null;
      } else if (this.activeZoneDisplayParts.length === 1) {
        this.zoneModalStep = 'select-variant';
        this.activePartInModal = this.activeZoneDisplayParts[0];
      } else {
        this.zoneModalStep = 'select-optional';
        this.activePartInModal = null;
      }

      this.showZoneVariantsModal = true;
    } else {
      this.isLoadingZoneParts = true;
      this.showZoneVariantsModal = true;
      this.moldService.getMold(item.moldId).subscribe({
        next: (res: any) => {
          this.isLoadingZoneParts = false;
          if (res?.success && res?.data) {
            const loadedMold = res.data;
            this.cachedMoldsMap[item.moldId!] = loadedMold;
            const matchedParts = (loadedMold.parts || []).filter((p: any) => {
              const region = (p.anatomical_region || p.family || '').toLowerCase();
              const pName = (p.name || '').toLowerCase();
              return col.keywords.some(k => region.includes(k) || pName.includes(k));
            });

            this.activeZoneDisplayParts = this.getDisplayPartsForZone(matchedParts);

            if (this.activeZoneDisplayParts.length > 1) {
              this.zoneModalStep = 'select-part';
              this.activePartInModal = null;
            } else if (this.activeZoneDisplayParts.length === 1) {
              this.zoneModalStep = 'select-variant';
              this.activePartInModal = this.activeZoneDisplayParts[0];
            } else {
              this.zoneModalStep = 'select-optional';
              this.activePartInModal = null;
            }
          }
        },
        error: () => {
          this.isLoadingZoneParts = false;
        }
      });
    }
  }

  closeZoneVariantsModal(): void {
    this.showZoneVariantsModal = false;
    this.activeZoneItemIndex = null;
    this.activeZoneCol = null;
    this.activePartInModal = null;
    this.zoneModalStep = 'select-part';
    this.saveData();
    this.rebuildAnatomicalGroups();
  }

  refreshActiveZoneAnchoredParts(item: LocalItem, col: AnatomicalColumn): void {
    if (!item.draftComponents) {
      this.activeZoneAnchoredParts = [];
      return;
    }

    this.activeZoneAnchoredParts = item.draftComponents.filter((c: any) => {
      if (c.item_type !== 'parte_general') return false;
      if (c.zone_name === col.key) return true;
      const cName = (c.name || '').toLowerCase();
      return col.keywords && col.keywords.some(k => cName.includes(k));
    });
  }

  getItemZoneOptionalCount(item: LocalItem, col: AnatomicalColumn): number {
    if (!item.draftComponents) return 0;
    return item.draftComponents.filter((c: any) => {
      if (c.item_type !== 'parte_general') return false;
      if (c.zone_name === col.key) return true;
      const cName = (c.name || '').toLowerCase();
      return col.keywords && col.keywords.some(k => cName.includes(k));
    }).length;
  }

  addOptionalFromZoneModal(): void {
    this.zoneModalStep = 'select-optional';
  }

  removeAnchoredPartFromZoneModal(gp: any): void {
    if (this.activeZoneItemIndex === null || !this.activeZoneCol) return;
    const item = this.items[this.activeZoneItemIndex];
    if (!item || !item.draftComponents) return;

    item.draftComponents = item.draftComponents.filter((c: any) => {
      if (c === gp) return false;
      if (gp.item_type === 'parte_general' && c.item_type === 'parte_general' &&
          (c.name || '').toLowerCase().trim() === (gp.name || '').toLowerCase().trim()) {
        return false;
      }
      return true;
    });

    this.refreshActiveZoneAnchoredParts(item, this.activeZoneCol);
    this.saveData();
  }

  selectOptionalVariantFromZoneModal(event: { part: any; type: any }): void {
    if (this.activeZoneItemIndex === null || !this.activeZoneCol) return;
    const item = this.items[this.activeZoneItemIndex];
    if (!item) return;

    if (!item.draftComponents) item.draftComponents = [];

    const partName = (event.part.name || '').toLowerCase().trim();
    item.draftComponents = item.draftComponents.filter((c: any) =>
      !(c.item_type === 'parte_general' && (c.name || '').toLowerCase().trim() === partName)
    );

    item.draftComponents.push({
      mold_part_id: null,
      mold_part_type_id: null,
      selected_type_name: event.type.name,
      name: event.part.name,
      zone_name: this.activeZoneCol.key,
      item_type: 'parte_general',
      technical_spec: event.type.technical_description || event.type.name,
      client_spec: null,
      estimated_time: event.type.total_time || 0,
      position_x: null,
      position_y: null
    });

    this.refreshActiveZoneAnchoredParts(item, this.activeZoneCol);
    this.saveData();
  }

  choosePartInZoneModal(part: any): void {
    this.activePartInModal = part;
    this.zoneModalStep = 'select-variant';
  }

  backToZonePartsList(): void {
    this.activePartInModal = null;
    this.zoneModalStep = this.activeZoneDisplayParts.length > 1 ? 'select-part' : 'select-optional';
  }

  getDisplayPartsForZone(parts: any[]): any[] {
    if (!parts || parts.length === 0) return [];
    const result: any[] = [];
    const seenNames = new Set<string>();

    for (const p of parts) {
      const canonicalKey = (p.name || '').toLowerCase().trim();
      if (!seenNames.has(canonicalKey)) {
        seenNames.add(canonicalKey);
        result.push(p);
      }
    }
    return result;
  }

  selectVariantForPart(part: any, type: any): void {
    if (this.activeZoneItemIndex === null || !this.activeZoneCol) return;
    const item = this.items[this.activeZoneItemIndex];
    if (!item) return;

    if (!item.draftComponents) item.draftComponents = [];

    const compObj: any = {
      mold_part_id: part.id,
      mold_part_type_id: type.id,
      selected_type_name: type.name,
      name: part.name,
      zone_name: this.activeZoneCol.key,
      item_type: 'parte_molde',
      technical_spec: type.technical_description || '',
      client_spec: null,
      estimated_time: type.estimated_time || type.total_time || 0,
      position_x: null,
      position_y: null
    };

    const existingIdx = item.draftComponents.findIndex((c: any) =>
      c.mold_part_id === part.id ||
      (c.item_type === 'parte_molde' && (c.name || '').toLowerCase().trim() === (part.name || '').toLowerCase().trim())
    );

    if (existingIdx >= 0) {
      item.draftComponents[existingIdx] = compObj;
    } else {
      item.draftComponents.push(compObj);
    }

    this.saveData();
  }

  unselectVariantForPart(part: any): void {
    if (this.activeZoneItemIndex === null) return;
    const item = this.items[this.activeZoneItemIndex];
    if (!item || !item.draftComponents) return;

    item.draftComponents = item.draftComponents.filter((c: any) =>
      !(c.mold_part_id === part.id ||
        (c.item_type === 'parte_molde' && (c.name || '').toLowerCase().trim() === (part.name || '').toLowerCase().trim()))
    );

    this.saveData();
  }

  // ==================== LÓGICA ANATÓMICA Y GRUPOS ====================

  getAnatomicalFamilyForItem(item: LocalItem): AnatomicalFamily {
    if (!item.moldId) {
      return 'SIN_MOLDE';
    }

    const mold = this.cachedMoldsMap[item.moldId];
    if (mold) {
      const catName = ((mold.category && mold.category.name) || mold.category_name || item.categoryName || '').toUpperCase();
      const mName = (mold.name || '').toUpperCase();
      const combined = `${catName} ${mName}`;

      if (combined.includes('OVEROL') || combined.includes('ENTERIZO') || combined.includes('BATA')) return 'COMPLETA';
      if (combined.includes('PANTALON') || combined.includes('JEAN') || combined.includes('BERMUDA') || combined.includes('FALDA') || combined.includes('SHORT')) return 'INFERIOR';
      if (combined.includes('CAMISA') || combined.includes('CAMISETA') || combined.includes('POLO') || combined.includes('CHALECO') || combined.includes('CHAQUETA') || combined.includes('BLUSA')) return 'SUPERIOR';
    }

    const desc = (item.descripcion || '').toUpperCase();
    if (desc.includes('OVEROL') || desc.includes('ENTERIZO') || desc.includes('BATA')) return 'COMPLETA';
    if (desc.includes('PANTALON') || desc.includes('JEAN') || desc.includes('BERMUDA') || desc.includes('FALDA') || desc.includes('SHORT')) return 'INFERIOR';
    if (desc.includes('CAMISA') || desc.includes('CAMISETA') || desc.includes('POLO') || desc.includes('CHALECO') || desc.includes('CHAQUETA') || desc.includes('BLUSA')) return 'SUPERIOR';

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

    if (item.draftComponents && item.draftComponents.length > 0) {
      const configuredMatch = item.draftComponents.find((c: any) => {
        if (c.zone_name === col.key) return !!c.selected_type_name;
        if (col.keywords && col.keywords.some(k => (c.name || '').toLowerCase().includes(k))) return !!c.selected_type_name;
        return false;
      });
      if (configuredMatch) {
        return { name: configuredMatch.selected_type_name, isConfigured: true, samTime: configuredMatch.estimated_time };
      }

      const anyMatch = item.draftComponents.find((c: any) => {
        if (c.zone_name === col.key) return true;
        if (col.keywords && col.keywords.some(k => (c.name || '').toLowerCase().includes(k))) return true;
        return false;
      });
      if (anyMatch) {
        return { name: anyMatch.selected_type_name || anyMatch.name || 'Personalizado', isConfigured: !!anyMatch.selected_type_name, samTime: anyMatch.estimated_time };
      }
    }

    if (item.moldId) {
      const mold = this.cachedMoldsMap[item.moldId] || this.allMolds.find(m => m.id === item.moldId);
      if (mold && mold.parts && mold.parts.length > 0) {
        const hasPartInMold = mold.parts.some((p: any) => {
          const region = (p.anatomical_region || p.family || '').toLowerCase();
          const pName = (p.name || '').toLowerCase();
          return col.keywords.some(k => region.includes(k) || pName.includes(k));
        });
        if (!hasPartInMold) {
          return { name: '—', isConfigured: false, notApplicable: true };
        }
      }
    }

    return { name: 'Por definir', isConfigured: false };
  }

  isZoneColConfigured(item: LocalItem, col: AnatomicalColumn): boolean {
    const sel = this.getItemZoneSelectionForColumn(item, col);
    return sel.isConfigured && !sel.notApplicable;
  }

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
    if (!item.moldId) {
      return 'bg-amber-50/20 hover:bg-amber-50/40 border-l-2 border-l-amber-400';
    }
    const status = this.getItemCompletionStatus(item, groupColumns).status;
    if (status === 'completo') {
      return 'bg-emerald-50/15 hover:bg-emerald-50/30 border-l-2 border-l-emerald-500';
    }
    if (status === 'parcial') {
      return 'bg-amber-50/25 hover:bg-amber-50/45 border-l-2 border-l-amber-500';
    }
    return 'hover:bg-slate-50/80 border-l-2 border-l-transparent';
  }

  getZonePillClassForCol(item: LocalItem, col: AnatomicalColumn, groupColumns?: AnatomicalColumn[]): string {
    const sel = this.getItemZoneSelectionForColumn(item, col);
    if (sel.notApplicable) {
      return 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60';
    }
    if (sel.isConfigured) {
      return 'bg-emerald-50/80 text-emerald-900 border-emerald-300 hover:bg-emerald-100/90 hover:border-emerald-400 font-medium';
    }
    if (groupColumns) {
      const compStatus = this.getItemCompletionStatus(item, groupColumns);
      if (compStatus.status === 'parcial') {
        return 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-bold';
      }
    }
    return 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:border-slate-300';
  }

  get anatomicalGroups(): AnatomicalGroup[] {
    return this._cachedAnatomicalGroups;
  }

  rebuildAnatomicalGroups(): void {
    const baseCandidatesByFamily: { [key in AnatomicalFamily]: { title: string; subtitle: string; icon: string; badgeClass: string; borderClass: string; columns: AnatomicalColumn[] } } = {
      SUPERIOR: {
        title: 'Prendas Superiores (Torso)',
        subtitle: 'Camisas, polos, chaquetas, chalecos, batas superiores',
        icon: 'bi-person-badge',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        borderClass: 'border-indigo-100',
        columns: [
          { key: 'cuello', label: 'Cuello / Solapa', tooltip: 'Tipo de cuello, tirilla, solapa o escote', keywords: ['cuell', 'solap', 'escote', 'tirilla'] },
          { key: 'pechera', label: 'Pechera / Delantero', tooltip: 'Pechera, botonadura, tapas y cruce frontal', keywords: ['pecher', 'botonadur', 'delanter', 'cruc'] },
          { key: 'mangas', label: 'Mangas & Puños', tooltip: 'Manga corta, larga, puños y charreteras', keywords: ['mang', 'puñ', 'sisa'] },
          { key: 'espalda', label: 'Espalda & Almilla', tooltip: 'Almilla, fuelles, canesú y pinzas traseras', keywords: ['espald', 'almill', 'canes'] },
          { key: 'cintura', label: 'Cintura & Ruedo', tooltip: 'Ruedo inferior, fajón, aberturas laterales', keywords: ['rued', 'cintur', 'fajon', 'abertur'] }
        ]
      },
      INFERIOR: {
        title: 'Prendas Inferiores (Piernas)',
        subtitle: 'Pantalones, jeans, bermudas, faldas, shorts',
        icon: 'bi-columns',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        borderClass: 'border-emerald-100',
        columns: [
          { key: 'pretina', label: 'Pretina & Pasadores', tooltip: 'Pretina elástica, pasadores, botón y cierre', keywords: ['pretin', 'pasador', 'fajon'] },
          { key: 'tiro', label: 'Tiro & Cremallera', tooltip: 'Tiro delantero, trasero, gavilán y cierre', keywords: ['tiro', 'cremaller', 'gavilan', 'braguet'] },
          { key: 'bolsillos_del', label: 'Bolsillos Delanteros', tooltip: 'Bolsillo relojero, sesgado, parche, curvo', keywords: ['bolsillo del', 'delanter', 'relojer', 'sesgad'] },
          { key: 'bolsillos_tra', label: 'Bolsillos Traseros', tooltip: 'Bolsillo ojal, parche trasero, tapa trasera', keywords: ['bolsillo tra', 'traser', 'ojal'] },
          { key: 'bota', label: 'Bota & Ruedo', tooltip: 'Ancho de bota, dobladillo, puño elástico bota', keywords: ['bota', 'rued', 'dobladill'] }
        ]
      },
      COMPLETA: {
        title: 'Prendas Enterizas (Cuerpo Completo)',
        subtitle: 'Overoles industriales, enterizos, trajes de protección',
        icon: 'bi-shield-shaded',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        borderClass: 'border-purple-100',
        columns: [
          { key: 'cuello', label: 'Cuello & Capota', tooltip: 'Cuello camisero, chino, nerú o capota integrada', keywords: ['cuell', 'capot'] },
          { key: 'cierre_frontal', label: 'Cierre Frontal', tooltip: 'Cremallera doble vía, solapa con velcro o broches', keywords: ['cierr', 'cremaller', 'solap', 'pecher'] },
          { key: 'mangas', label: 'Mangas & Puños', tooltip: 'Mangas, puño elástico o con broche', keywords: ['mang', 'puñ'] },
          { key: 'cintura', label: 'Cintura / Ajuste', tooltip: 'Elástico en espalda, pasadores o cinturón', keywords: ['cintur', 'elastic', 'ajust'] },
          { key: 'piernas_bota', label: 'Piernas & Bota', tooltip: 'Bolsillos cargo, rodilleras, bota con cierre/elástico', keywords: ['piern', 'bota', 'cargo', 'rodiller'] }
        ]
      },
      GENERAL: {
        title: 'Otras Prendas & Accesorios',
        subtitle: 'Gorras, delantales, chalecos tácticos y dotación general',
        icon: 'bi-grid-fill',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        borderClass: 'border-slate-200',
        columns: [
          { key: 'estructura', label: 'Estructura Principal', tooltip: 'Cuerpo o estructura base de la prenda', keywords: ['cuerp', 'estructur', 'delanter', 'frente'] },
          { key: 'ajustes', label: 'Ajustes & Cierres', tooltip: 'Broches, elásticos, cremalleras o correas', keywords: ['ajust', 'cierr', 'correa', 'broch'] },
          { key: 'bolsillos', label: 'Bolsillos & Compartimentos', tooltip: 'Bolsillos utilitarios o de parche', keywords: ['bolsill', 'compart'] },
          { key: 'terminaciones', label: 'Terminaciones & Vivos', tooltip: 'Ribetes, sesgos, reflectivos, vivos', keywords: ['termin', 'sesg', 'ribet', 'reflect'] }
        ]
      },
      SIN_MOLDE: {
        title: 'Prendas Sin Molde Base Asignado',
        subtitle: 'Asigna un molde para configurar automáticamente sus zonas anatómicas',
        icon: 'bi-exclamation-triangle-fill',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
        borderClass: 'border-amber-200',
        columns: []
      }
    };

    const indexedItems = this.items.map((it, originalIndex) => ({ item: it, originalIndex }));
    const groupsMap = new Map<AnatomicalFamily, { item: LocalItem; originalIndex: number }[]>();
    (['SUPERIOR', 'INFERIOR', 'COMPLETA', 'GENERAL', 'SIN_MOLDE'] as AnatomicalFamily[]).forEach(k => groupsMap.set(k, []));

    indexedItems.forEach(ri => {
      const family = this.getAnatomicalFamilyForItem(ri.item);
      groupsMap.get(family)?.push(ri);
    });

    const result: AnatomicalGroup[] = [];

    (['SUPERIOR', 'INFERIOR', 'COMPLETA', 'GENERAL', 'SIN_MOLDE'] as AnatomicalFamily[]).forEach(fam => {
      let gItems = groupsMap.get(fam) || [];
      if (this.selectedFamilyFilter !== 'TODAS' && this.selectedFamilyFilter !== fam) {
        return;
      }
      if (gItems.length === 0) return;

      if (this.anatomicalSortOrder === 'qty') {
        gItems = [...gItems].sort((a, b) => this.getItemTotal(b.item) - this.getItemTotal(a.item));
      }

      const totalUds = gItems.reduce((acc, x) => acc + this.getItemTotal(x.item), 0);
      const baseInfo = baseCandidatesByFamily[fam];

      let dynamicCols: AnatomicalColumn[] = [];
      if (fam !== 'SIN_MOLDE') {
        dynamicCols = baseInfo.columns.filter(col => {
          return gItems.some(entry => {
            const sel = this.getItemZoneSelectionForColumn(entry.item, col);
            return !sel.notApplicable;
          });
        });

        if (dynamicCols.length === 0) {
          dynamicCols = baseInfo.columns;
        }
      }

      result.push({
        id: fam,
        title: baseInfo.title,
        subtitle: baseInfo.subtitle,
        icon: baseInfo.icon,
        badgeClass: baseInfo.badgeClass,
        borderClass: baseInfo.borderClass,
        columns: dynamicCols,
        items: gItems,
        totalUds,
        totalSam: 0
      });
    });

    this._cachedAnatomicalGroups = result;
  }

  getItemThumbnail(item: LocalItem): string {
    if (!item) return '';
    if (item.imagenReferenciaUrl) return item.imagenReferenciaUrl;
    if (item.moldId) {
      const mold = this.cachedMoldsMap[item.moldId] || this.allMolds.find(m => m.id === item.moldId);
      if (mold) {
        if (mold.image_signed_url) return mold.image_signed_url;
        if (mold.front_image_signed_url) return mold.front_image_signed_url;
        if (mold.front_image_url) return mold.front_image_url;
        if (mold.photo_url) return mold.photo_url;
      }
    }
    if (item.categoryId) {
      const cat = this.categories.find(c => c.id === item.categoryId);
      if (cat?.image_signed_url) return cat.image_signed_url;
    }
    return '';
  }

  getItemTotal(item: LocalItem): number {
    if (!item || !item.tallas) return 0;
    return item.tallas.reduce((ts, t) => ts + (Number(t.cantidad) || 0), 0);
  }

  get totalPrendas(): number {
    return this.items.length;
  }

  get totalUnidades(): number {
    return this.items.reduce((acc, it) => acc + this.getItemTotal(it), 0);
  }

  trackByGroupId(index: number, group: AnatomicalGroup): string {
    return group.id;
  }

  trackByItemOriginalIndex(index: number, entry: { item: LocalItem; originalIndex: number }): number {
    return entry.originalIndex;
  }

  // ==================== GENERAR TODAS LAS OPMS (MODO MOLDES) ====================

  async generarTodasLasOpms(): Promise<void> {
    if (this.items.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin prendas',
        text: 'Agrega al menos una prenda antes de generar OPMs.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    const sinMolde = this.items.filter(it => !it.moldId);
    if (sinMolde.length > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan moldes por vincular',
        text: `Hay ${sinMolde.length} prenda(s) sin molde base asignado. Asígnales un molde antes de continuar.`,
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    this.isSavingGlobalOpm = true;
    let exitosas = 0;
    const errores: string[] = [];

    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      try {
        const payload = {
          mold_id: it.moldId,
          description: `OPM - ${it.descripcion || 'Prenda'}`,
          technical_description: `Molde: ${it.moldName}.`,
          parts: it.draftComponents || []
        };

        const res: any = it.technicalSpecId
          ? await this.moldService.updateTechnicalSpec(it.technicalSpecId, payload).toPromise()
          : await this.moldService.createTechnicalSpec(payload).toPromise();

        if (res?.success && res?.data) {
          it.technicalSpecId = res.data.id;
          it.opmReference = res.data.reference;
          exitosas++;
        }
      } catch (err: any) {
        console.error(`Error guardando OPM para prenda #${i + 1}:`, err);
        errores.push(it.descripcion || `Prenda #${i + 1}`);
      }
    }

    this.isSavingGlobalOpm = false;
    this.saveData();
    this.rebuildAnatomicalGroups();

    if (exitosas > 0) {
      Swal.fire({
        icon: 'success',
        title: '¡OPMs Procesadas!',
        html: `Se han registrado exitosamente <strong>${exitosas}</strong> Ficha(s) Técnica(s) / OPM.<br>` +
              (errores.length > 0 ? `<br><small class="text-danger">Hubo errores en: ${errores.join(', ')}</small>` : ''),
        confirmButtonColor: '#2563eb'
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error al generar OPMs',
        text: 'No se pudo guardar ninguna especificación técnica. Revisa la consola o intenta más tarde.',
        confirmButtonColor: '#ef4444'
      });
    }
  }
}
