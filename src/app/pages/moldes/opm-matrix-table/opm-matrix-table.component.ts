import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MoldService } from '../../../services/mold.service';
import Swal from 'sweetalert2';
import { CANONICAL_OPTIONAL_PARTS, OptionalPart, OptionalPartType } from '../../comerciales/modals/canonical-optional-parts';

export type AnatomicalFamily = 'SUPERIOR' | 'INFERIOR' | 'COMPLETA' | 'GENERAL' | 'SIN_MOLDE';

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
  zoneObservations?: { [zoneKey: string]: string };
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
export class OpmMatrixTableComponent implements OnInit, OnDestroy {
  @Input() preloadedMoldId: number | null = null;
  @Output() onBackToLibreria = new EventEmitter<void>();

  private readonly STORAGE_KEY = 'saint_moldes_opm_matrix_draft';
  private autoSaveTimer: any = null;

  items: LocalItem[] = [];
  allMolds: any[] = [];
  categories: any[] = [];
  cachedMoldsMap: { [id: number]: any } = {};

  isLoading = false;
  isLoadingMolds = false;

  // Filtros y ordenamiento
  selectedFamilyFilter: 'TODAS' | AnatomicalFamily = 'TODAS';
  anatomicalSortOrder: 'family' | 'qty' | 'sam' = 'family';
  _cachedAnatomicalGroups: AnatomicalGroup[] = [];

  // Nuevo item inline
  showNewItemForm = false;
  newItemDesc = '';
  newItemRef = '';

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
  activeZoneObservation = '';
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

  // Guardando OPM global
  isSavingGlobalOpm = false;

  constructor(
    private moldService: MoldService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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

  // ==================== PERSISTENCIA LOCAL STORAGE ====================

  saveToLocalStorage(): void {
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
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
        this.items = parsed.items;
        this.selectedFamilyFilter = parsed.selectedFamilyFilter || 'TODAS';
        this.anatomicalSortOrder = parsed.anatomicalSortOrder || 'family';
        this.rebuildAnatomicalGroups();
      }
    } catch (e) {
      console.warn('Error restaurando borrador de OPM', e);
    }
  }

  clearDraft(): void {
    Swal.fire({
      title: '¿Limpiar tabla de prendas?',
      text: 'Se eliminarán las prendas en borrador de esta tabla.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then(res => {
      if (res.isConfirmed) {
        this.items = [];
        localStorage.removeItem(this.STORAGE_KEY);
        this.rebuildAnatomicalGroups();
      }
    });
  }

  // ==================== GESTIÓN DE ÍTEMS / PRENDAS ====================

  public addMoldItem(mold: any): void {
    if (!mold) return;
    this.cachedMoldsMap[mold.id] = mold;

    // Verificar si ya existe este molde o agregar uno nuevo
    const newItem: LocalItem = {
      descripcion: mold.name || 'Nueva Prenda',
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
      categoryId: mold.mold_category_id || mold.id_product_category || null,
      categoryName: mold.category?.name || '',
      moldId: mold.id,
      moldName: mold.name,
      technicalSpecId: null,
      totalSamTime: 0,
      specExpanded: false,
      availableMolds: [mold],
      draftComponents: []
    };

    this.items.push(newItem);
    this.recalculateItemSam(newItem);
    this.rebuildAnatomicalGroups();
    this.saveToLocalStorage();

    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
    });
    Toast.fire({
      icon: 'success',
      title: `Molde "${mold.name}" agregado a la lista de OPMs`
    });
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
      draftComponents: []
    };

    this.items.push(newItem);
    this.newItemDesc = '';
    this.newItemRef = '';
    this.showNewItemForm = false;
    this.rebuildAnatomicalGroups();
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
    this.rebuildAnatomicalGroups();
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
      title: 'Prenda duplicada'
    });
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
    this.rebuildAnatomicalGroups();
    this.saveToLocalStorage();
  }

  getItemTotal(item: LocalItem): number {
    if (!item?.tallas) return 0;
    return item.tallas.reduce((acc, t) => acc + (parseInt(t.cantidad as any, 10) || 0), 0);
  }

  get totalPrendas(): number {
    return this.items.length;
  }

  get totalUnidades(): number {
    return this.items.reduce((acc, it) => acc + this.getItemTotal(it), 0);
  }

  get totalSam(): number {
    return this.items.reduce((acc, it) => acc + (it.totalSamTime || 0), 0);
  }

  // ==================== EDICIÓN INLINE ====================

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

  // ==================== FAMILIAS & MATRIZ ANATÓMICA ====================

  getAnatomicalFamilyForItem(item: LocalItem): AnatomicalFamily {
    if (!item || !item.moldId) return 'SIN_MOLDE';

    const mold = this.allMolds.find(m => m.id === item.moldId) || this.cachedMoldsMap[item.moldId];
    const moldCat = (mold?.category?.name || item.categoryName || '').toUpperCase();
    const moldName = (mold?.name || item.moldName || '').toUpperCase();
    const moldText = `${moldCat} ${moldName}`;

    if (moldText.includes('OVEROL') || moldText.includes('ENTERIZO') || moldText.includes('MAMELUCO') || moldText.includes('TRAJE')) {
      return 'COMPLETA';
    }
    if (moldText.includes('PANTALON') || moldText.includes('PANTALÓN') || moldText.includes('BERMUDA') ||
        moldText.includes('JEAN') || moldText.includes('FALDA') || moldText.includes('SHORT') || moldText.includes('JOGGER')) {
      return 'INFERIOR';
    }
    if (moldText.includes('CAMISA') || moldText.includes('POLO') || moldText.includes('CHAQUETA') ||
        moldText.includes('CHALECO') || moldText.includes('BLUSA') || moldText.includes('CAMISETA') ||
        moldText.includes('CAMIBUSO') || moldText.includes('SUETER') || moldText.includes('CHOMPA')) {
      return 'SUPERIOR';
    }

    const catId = mold?.mold_category_id || mold?.category_id || mold?.id_product_category || item.categoryId;
    if (catId === 1 || catId === 3) return 'SUPERIOR';
    if (catId === 4) return 'INFERIOR';
    if (catId === 2) return 'COMPLETA';

    return 'SUPERIOR';
  }

  getFamilyItemCount(family: 'TODAS' | AnatomicalFamily): number {
    if (family === 'TODAS') return this.items.length;
    return this.items.filter(it => this.getAnatomicalFamilyForItem(it) === family).length;
  }

  getTotalFilteredItems(): number {
    return this.anatomicalGroups.reduce((acc, g) => acc + g.items.length, 0);
  }

  get anatomicalGroups(): AnatomicalGroup[] {
    return this._cachedAnatomicalGroups;
  }

  rebuildAnatomicalGroups(): void {
    const rawItems = this.items.map((item, originalIndex) => ({ item, originalIndex }));

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
        subtitle: 'Prendas en especificación libre con molde',
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

          dynamicCols = cfg.columns.filter(col => {
            return allPartsInGroup.some(p => {
              const text = `${p.name || ''} ${p.zone_name || ''} ${p.zone_type || ''} ${p.code || ''}`.toLowerCase();
              return col.keywords.some(k => text.includes(k.toLowerCase()));
            });
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

  getItemZoneSelectionForColumn(item: LocalItem, col: AnatomicalColumn): { name: string; isConfigured: boolean; samTime?: number; notApplicable?: boolean } {
    if (!item) return { name: 'Por definir', isConfigured: false };

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

    if (item.moldId) {
      const mold = this.cachedMoldsMap[item.moldId] || this.allMolds.find(m => m.id === item.moldId);
      if (mold && mold.parts && mold.parts.length > 0) {
        const hasPart = mold.parts.some((p: any) => {
          const text = `${p.name || ''} ${p.zone_name || ''} ${p.zone_type || ''} ${p.code || ''}`.toLowerCase();
          return col.keywords.some(k => text.includes(k.toLowerCase()));
        });
        if (!hasPart) {
          return { name: 'No aplica', isConfigured: false, notApplicable: true };
        }
      }
    }

    return { name: 'Por definir', isConfigured: false };
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
      return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold hover:bg-emerald-100 hover:border-emerald-400 shadow-2xs';
    }

    if (groupColumns && groupColumns.length > 0) {
      const s = this.getItemCompletionStatus(item, groupColumns);
      if (s.status === 'parcial') {
        return 'bg-amber-50 text-amber-900 border-amber-300 font-bold hover:bg-amber-100 hover:border-amber-400 ring-1 ring-amber-300/80 shadow-2xs';
      }
    }

    return 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50 shadow-2xs';
  }

  getItemThumbnail(item: LocalItem): string | null {
    if (!item?.moldId) return null;
    const mold = this.cachedMoldsMap[item.moldId] || this.allMolds.find(m => m.id === item.moldId);
    if (!mold) return null;
    return mold.image_signed_url || mold.front_image_signed_url || mold.front_image_url || null;
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

  trackByGroupId(index: number, group: AnatomicalGroup): string {
    return group.id;
  }

  trackByItemOriginalIndex(index: number, entry: { item: LocalItem; originalIndex: number }): number {
    return entry.originalIndex;
  }

  // ==================== MODAL DE VARIANTES DE ZONA ====================

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

    this.activeZoneObservation = (item.zoneObservations && item.zoneObservations[col.key]) || '';
    this.refreshActiveZoneAnchoredParts(item, col);

    if (!item.draftComponents) {
      item.draftComponents = [];
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
    this.showZoneVariantsModal = false;
    this.activeZoneItemIndex = null;
    this.activeZoneCol = null;
    this.activeZoneDisplayParts = [];
    this.activePartInModal = null;
    this.zoneModalStep = 'select-part';
    this.activeZoneObservation = '';
    this.activeZoneAnchoredParts = [];
    this.saveToLocalStorage();
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

  choosePartInZoneModal(part: any): void {
    this.activePartInModal = part;
    this.zoneModalStep = 'select-variant';
  }

  backToZonePartsList(): void {
    this.activePartInModal = null;
    this.zoneModalStep = 'select-part';
  }

  selectVariantForPart(part: any, type: any): void {
    if (this.activeZoneItemIndex === null) return;
    const item = this.items[this.activeZoneItemIndex];
    if (!item) return;

    if (!item.draftComponents) item.draftComponents = [];

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
        item.draftComponents![existingIdx] = compObj;
      } else {
        item.draftComponents!.push(compObj);
      }
    });

    this.recalculateItemSam(item);
    this.saveToLocalStorage();
    this.closeZoneVariantsModal();
    this.rebuildAnatomicalGroups();
  }

  unselectVariantForPart(part: any): void {
    if (this.activeZoneItemIndex === null) return;
    const item = this.items[this.activeZoneItemIndex];
    if (!item || !item.draftComponents) return;

    const pids = [part.id, ...(part.siblingPartIds || [])];
    item.draftComponents = item.draftComponents.filter((c: any) => !pids.includes(Number(c.mold_part_id)));

    this.recalculateItemSam(item);
    this.saveToLocalStorage();
    this.rebuildAnatomicalGroups();
  }

  updateActiveZoneObservation(obs: string): void {
    this.activeZoneObservation = obs;
    if (this.activeZoneItemIndex === null || !this.activeZoneCol) return;
    const item = this.items[this.activeZoneItemIndex];
    if (!item) return;

    if (!item.zoneObservations) item.zoneObservations = {};
    item.zoneObservations[this.activeZoneCol.key] = obs;

    if (item.draftComponents) {
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
      zone_name: this.activeZoneCol!.key,
      item_type: 'parte_general',
      technical_spec: event.type.technical_description || event.type.name,
      client_spec: '',
      estimated_time: event.type.total_time || 0,
      position_x: null,
      position_y: null
    });

    this.recalculateItemSam(item);
    this.refreshActiveZoneAnchoredParts(item, this.activeZoneCol!);
    this.saveToLocalStorage();
  }

  recalculateItemSam(item: LocalItem): void {
    if (!item.draftComponents || item.draftComponents.length === 0) {
      item.totalSamTime = 0;
      return;
    }
    const total = item.draftComponents.reduce((acc: number, c: any) => acc + (Number(c.estimated_time) || 0), 0);
    item.totalSamTime = Math.round(total * 100) / 100;
  }

  // ==================== MODAL FIGURÍN OPM (2D STEPPER) ====================

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
    this.saveToLocalStorage();
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
      this.saveToLocalStorage();
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
        item.draftComponents = [];
        item.totalSamTime = 0;
      }
      this.closeFigurinModal();
    }
  }

  // ==================== MODAL RÁPIDO DE TALLAS ====================

  openTallasQuickModal(index: number): void {
    this.activeTallasItemIndex = index;
    this.showTallasQuickModal = true;
  }

  closeTallasQuickModal(): void {
    this.showTallasQuickModal = false;
    this.activeTallasItemIndex = null;
    this.saveToLocalStorage();
    this.rebuildAnatomicalGroups();
  }

  addSpecificTalla(item: LocalItem, talla: string): void {
    if (!item.tallas) item.tallas = [];
    const existing = item.tallas.find(t => t.talla === talla);
    if (!existing) {
      item.tallas.push({ talla, cantidad: 1 });
    }
    this.saveToLocalStorage();
    this.rebuildAnatomicalGroups();
  }

  removeTalla(item: LocalItem, index: number): void {
    if (item.tallas && item.tallas.length > index) {
      item.tallas.splice(index, 1);
    }
    this.saveToLocalStorage();
    this.rebuildAnatomicalGroups();
  }

  // ==================== MODAL SELECTOR DE MOLDE ====================

  openMoldSelector(index: number): void {
    this.moldSelectorItemIndex = index;
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
    item.categoryId = mold.mold_category_id || mold.id_product_category || null;
    item.categoryName = mold.category?.name || '';
    item.draftComponents = [];
    item.technicalSpecId = null;
    this.cachedMoldsMap[mold.id] = mold;

    if (this.activeFigurinItemIndex === this.moldSelectorItemIndex) {
      this.activeFigurinItem = { ...item };
    }

    this.recalculateItemSam(item);
    this.rebuildAnatomicalGroups();
    this.saveToLocalStorage();
    this.closeMoldSelector();
  }

  // ==================== GENERACIÓN FINAL DE OPMS ====================

  async generarTodasLasOpms(): Promise<void> {
    if (this.items.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin prendas',
        text: 'Agrega al menos una prenda antes de generar OPMs.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    // Validar que todas tengan molde
    const sinMolde = this.items.filter(it => !it.moldId);
    if (sinMolde.length > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan moldes por vincular',
        text: `Hay ${sinMolde.length} prenda(s) sin molde base asignado. Asígnales un molde antes de continuar.`,
        confirmButtonColor: '#4f46e5'
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
          technical_description: `Molde: ${it.moldName}. SAM: ${it.totalSamTime || 0} min.`,
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
    this.saveToLocalStorage();
    this.rebuildAnatomicalGroups();

    if (exitosas > 0) {
      Swal.fire({
        icon: 'success',
        title: '¡OPMs Procesadas!',
        html: `Se han registrado exitosamente <strong>${exitosas}</strong> Ficha(s) Técnica(s) / OPM.<br>` +
              (errores.length > 0 ? `<br><small class="text-danger">Hubo errores en: ${errores.join(', ')}</small>` : ''),
        confirmButtonColor: '#4f46e5'
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error al procesar OPMs',
        text: 'No se pudo guardar ninguna OPM en el sistema.',
        confirmButtonColor: '#ef4444'
      });
    }
  }
}
