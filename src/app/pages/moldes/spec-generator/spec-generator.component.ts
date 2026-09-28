import { Component, OnInit, OnChanges, OnDestroy, SimpleChanges, Input, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { MoldService } from '../../../services/mold.service';
import { AuthService } from '../../../services/auth.service';
import { ComponentItem, OpmMaterial, ZONE_TYPE_OPTIONS } from './spec-generator.models';

export { ComponentItem, OpmMaterial };

@Component({
  selector: 'app-spec-generator',
  templateUrl: './spec-generator.component.html',
  styleUrls: ['./spec-generator.component.css']
})
export class SpecGeneratorComponent implements OnInit, OnChanges, OnDestroy {
  // Embedded mode (for use inside Solicitud form)
  @Input() embedded = false;
  @Input() context: 'comercial' | 'muestras' | 'molde' = 'comercial';
  @Input() itemIndex?: number;
  @Input() externalMoldId: number | null = null;
  @Input() technicalSpecId: number | null = null;
  @Input() initialComponents: ComponentItem[] | null = null;
  @Input() itemData: any = null;
  @Input() solicitudData: any = null;
  @Output() onSpecSaved = new EventEmitter<number>();
  @Output() onComponentsChange = new EventEmitter<ComponentItem[]>();

  moldId!: number;
  mold: any = null;
  mode: 'opm' | 'ficha' = 'opm';
  opmReference = '';
  generalDescription = '';
  clientGeneralDescription = '';
  activeView: 'front' | 'back' = 'front';
  activeTab: 'molde' | 'formulario' = 'molde';

  // Data
  components: ComponentItem[] = [];
  availableComponents: any[] = [];
  selectedPartIndex: number | null = null;
  selectedPartType: 'general' | 'component' | null = null;

  // Zonas Anatómicas y Catálogo
  globalGarmentParts: any[] = [];
  detectedZone: any = null;
  zoneSuggestedParts: any[] = [];
  selectedZone: any = null;
  zoneTypeOptions = ZONE_TYPE_OPTIONS;

  // Dynamic Pin / Popover
  dynamicPinPosition: { x: number; y: number } | null = null;
  showAddModal = false;
  addModalType: 'general' | 'component' = 'general';
  editingPart: any = null;
  popoverPosition: { x: number; y: number } | null = null;

  // Inline editing / adding
  inlineAdding = false;
  inlineAddingType: 'general' | 'component' = 'general';
  inlineEditingIndex: number | null = null;
  inlineEditName = '';
  inlineEditType: 'tela' | 'insumo' | 'parte' = 'parte';
  addSearchQuery = '';
  addItemType: 'tela' | 'insumo' | 'parte' = 'parte';
  showAddSuggestions = false;

  // Spec Editor Modal
  showSpecEditor = false;
  specEditorIndex: number | null = null;
  specEditorComponent: ComponentItem | null = null;
  specEditorClientSpec = '';
  specEditorTechnicalSpec = '';
  targetMaterialType: 'client' | 'technical' = 'technical';

  // Inventory Modal
  showInventoryModal = false;
  inventoryFromSpecEditor = false;
  inventoryFilterType: 'todos' | 'tela' | 'insumo' = 'todos';
  allInventory: any[] = [];
  inventoryLoaded = false;

  // Manual Modal
  showManualModal = false;
  manualModalIndex: number | null = null;
  manualText = '';
  manualColor = '';

  // Text View
  showSuggestions = false;
  suggestionType: 'component' | 'siesa' = 'component';
  suggestionQuery = '';
  textContent = '';

  // States
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  private autoSaveInterval: any;

  constructor(
    private moldService: MoldService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  // ==================== COMPUTED ====================

  get modeLabel(): string { return this.mode === 'ficha' ? 'Ficha Técnica' : 'OPM'; }
  get hasBackView(): boolean { 
    return !!this.mold?.back_image_signed_url || !!this.getFallbackBackImage(); 
  }
  get activeImage(): string {
    if (!this.mold) return '';
    if (this.activeView === 'back') {
      return this.mold.back_image_signed_url || this.mold.back_image_url || this.getFallbackBackImage() || this.mold.image_signed_url || this.mold.image_url || '';
    }
    return this.mold.image_signed_url || this.mold.image_url || this.getFallbackFrontImage() || '';
  }

  getFallbackFrontImage(): string | null {
    if (!this.mold) return null;
    const name = (this.mold.name || '').toLowerCase();
    if (name.includes('camisa')) return 'assets/garments/camisa_front.png';
    if (name.includes('chaqueta')) return 'assets/garments/chaqueta_front.png';
    if (name.includes('pantalon') || name.includes('pantalón')) return 'assets/garments/pantalon_front.png';
    if (name.includes('overol')) return 'assets/garments/overol_front.png';
    if (name.includes('polo')) return 'assets/garments/polo_front.png';
    if (name.includes('buzo')) return 'assets/garments/buzo_front.png';
    if (name.includes('camiseta')) return 'assets/garments/camiseta_front.png';
    if (name.includes('chaleco')) return 'assets/garments/chaleco_front.png';
    if (name.includes('delantal')) return 'assets/garments/delantal_front.png';
    if (name.includes('gorra')) return 'assets/garments/gorra_front.png';
    return null;
  }

  getFallbackBackImage(): string | null {
    if (!this.mold) return null;
    const name = (this.mold.name || '').toLowerCase();
    if (name.includes('camisa')) return 'assets/garments/camisa_back.png';
    if (name.includes('chaqueta')) return 'assets/garments/chaqueta_back.png';
    if (name.includes('pantalon') || name.includes('pantalón')) return 'assets/garments/pantalon_back.png';
    if (name.includes('overol')) return 'assets/garments/overol_back.png';
    if (name.includes('polo')) return 'assets/garments/polo_back.png';
    if (name.includes('buzo')) return 'assets/garments/buzo_back.png';
    if (name.includes('camiseta')) return 'assets/garments/camiseta_back.png';
    if (name.includes('chaleco')) return 'assets/garments/chaleco_back.png';
    if (name.includes('delantal')) return 'assets/garments/delantal_back.png';
    if (name.includes('gorra')) return 'assets/garments/gorra_back.png';
    return null;
  }

  get positionedComponents(): ComponentItem[] {
    return this.components.filter(c => c.position_x !== null && c.view === this.activeView);
  }
  get generalComponents(): ComponentItem[] {
    return this.components.filter(c => c.position_x === null);
  }
  get materialComponents(): ComponentItem[] {
    return this.components.filter(c => c.item_type === 'tela' || c.item_type === 'insumo');
  }
  get mandatoryParts(): ComponentItem[] {
    return this.components.filter(c => c.item_type === 'parte' && c.is_mandatory !== false);
  }
  get filteredMandatoryParts(): ComponentItem[] {
    return this.mandatoryParts;
  }
  get optionalParts(): ComponentItem[] {
    return this.components.filter(c => c.item_type === 'parte' && c.is_mandatory === false);
  }
  get filteredOptionalParts(): ComponentItem[] {
    return this.optionalParts;
  }

  /**
   * Groups mandatory parts by garment_part_id (or by name if no garment_part_id).
   * Returns an array of groups, each being an array of ComponentItems that share
   * the same logical "garment part". This prevents counting e.g. two pocket variants
   * as two separate mandatory items.
   */
  get uniqueMandatoryGroups(): ComponentItem[][] {
    const groups = new Map<string, ComponentItem[]>();
    for (const part of this.mandatoryParts) {
      const key = part.garment_part_id
        ? `gp_${part.garment_part_id}`
        : `name_${part.name.toLowerCase().trim()}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(part);
    }
    return Array.from(groups.values());
  }

  get allMandatoryConfigured(): boolean {
    const groups = this.uniqueMandatoryGroups;
    if (groups.length === 0) return true;
    // A group is configured if at least ONE of its parts is complete
    return groups.every(group => group.some(p => this.isComponentComplete(p)));
  }

  get mandatoryConfiguredCount(): number {
    return this.uniqueMandatoryGroups.filter(
      group => group.some(p => this.isComponentComplete(p))
    ).length;
  }

  get mandatoryTotalCount(): number {
    return this.uniqueMandatoryGroups.length;
  }

  get uniqueLogicalZones(): any[] {
    const zones = this.mold?.zones || [];
    const seen = new Map<string, any>();
    for (const z of zones) {
      const key = (z.zone_type || z.name || `z_${z.id}`).toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, z);
      }
    }
    return Array.from(seen.values());
  }

  get totalZonesCount(): number {
    return this.uniqueLogicalZones.length;
  }

  get configuredLogicalZonesCount(): number {
    const logicalZones = this.uniqueLogicalZones;
    if (logicalZones.length === 0) return 0;
    return logicalZones.filter(z => {
      const zType = (z.zone_type || '').toLowerCase().trim();
      const zName = (z.name || '').toLowerCase().trim();
      const zoneId = Number(z.id);
      return this.components.some(c => {
        if (c.item_type !== 'parte' || !this.isComponentComplete(c)) return false;
        if (c.mold_zone_id && Number(c.mold_zone_id) === zoneId) return true;
        if (c._all_zone_ids?.some((zid: any) => Number(zid) === zoneId)) return true;
        if (c.zone_name && zName && c.zone_name.toLowerCase().trim() === zName) return true;
        const cZoneType = (c.zone_type || '').toLowerCase().trim();
        if (zType && cZoneType && zType === cZoneType) return true;
        const cName = (c.name || '').toLowerCase().trim();
        return !!(zType && (cName.includes(zType) || zType.includes(cName)));
      });
    }).length;
  }

  get configuredPartsCount(): number {
    return this.totalConfiguredPartsCount;
  }

  get totalConfiguredPartsCount(): number {
    return this.components.filter(c => c.item_type === 'parte' && this.isComponentComplete(c)).length;
  }

  get activeZones(): any[] {
    return (this.mold?.zones || []).filter((z: any) => (z.view || 'front') === this.activeView);
  }
  get sortedActiveZones(): any[] {
    return [...this.activeZones].sort((a, b) => this.getZoneArea(b) - this.getZoneArea(a));
  }

  get draftStorageKey(): string {
    const mId = this.moldId || this.externalMoldId || 'unknown';
    const itemSuffix = this.itemIndex !== undefined 
      ? `_item_${this.itemIndex}` 
      : (this.itemData?.id ? `_item_${this.itemData.id}` : (this.itemData?.item_cfip ? `_item_${this.itemData.item_cfip}` : ''));
    return `saint_spec_draft_${this.context}_mold_${mId}${itemSuffix}`;
  }
  get totalGarmentSamTime(): number {
    let total = 0;
    if (this.mold?.global_operations) {
      total += this.mold.global_operations.reduce((acc: number, op: any) => acc + (parseFloat(op.execution_time) || 0), 0);
    }
    this.components.forEach(c => { if (c.total_time) total += parseFloat(c.total_time as any) || 0; });
    return total;
  }

  get filteredAddSuggestions(): any[] {
    const q = this.addSearchQuery.toLowerCase().trim();
    if (!q) return this.availableComponents.slice(0, 50);
    return this.availableComponents.filter(comp =>
      (comp.display_name || '').toLowerCase().includes(q) || (comp.name || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }

  // Helpers Bound
  getRealComponentIndexBound = (part: ComponentItem): number => this.components.indexOf(part);
  getAssignedGeneralsBound = (): number => this.generalComponents.filter(g => g.material_exception !== null || g.client_material_exception !== null).length;
  getSpecCountBound = (): number => this.components.filter(c => this.isComponentComplete(c)).length;

  isComponentComplete(part: ComponentItem): boolean {
    if (!part) return false;
    const hasSpec = !!(part.client_spec?.trim()) || !!(part.technical_spec?.trim()) || !!(part.selected_type_name?.trim()) || !!part.selected_type_id;
    const hasMat = !!part.material_exception || !!(part as any).inventory_reference || !!(part as any).inventory_description;
    return hasSpec || hasMat;
  }

  getSpecCount(): number { return this.getSpecCountBound(); }
  getAssignedGenerals(): number { return this.getAssignedGeneralsBound(); }

  // ==================== LIFECYCLE ====================

  ngOnInit(): void {
    this.loadGarmentPartsCatalog();

    if (this.embedded) {
      this.mode = 'opm';
      if (this.externalMoldId) {
        this.moldId = this.externalMoldId;
        this.initializeComponentsFromInput();
        this.loadMold();
      }
    } else {
      this.mode = this.route.snapshot.data['mode'] || 'opm';
      const idParam = this.route.snapshot.paramMap.get('id');
      if (idParam) {
        this.moldId = parseInt(idParam, 10);
        this.loadMold();
      }
    }

    this.startAutoSave();
  }

  ngOnDestroy(): void {
    this.saveDraft();
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.embedded) return;
    if (changes['technicalSpecId']?.currentValue) {
      this.technicalSpecId = changes['technicalSpecId'].currentValue;
    }
    if (changes['externalMoldId'] || changes['technicalSpecId']) {
      if (this.externalMoldId) {
        this.moldId = this.externalMoldId;
        this.initializeComponentsFromInput();
        this.loadMold();
      } else {
        this.mold = null;
        this.components = [];
      }
    }
  }

  initializeComponentsFromInput(): void {
    this.clientGeneralDescription =
      this.itemData?.technical_spec?.description ||
      this.itemData?.technical_spec?.general_description ||
      this.itemData?.draftGeneralDescription ||
      this.itemData?.descripcion_general ||
      this.itemData?.especificaciones ||
      this.solicitudData?.observaciones || '';

    if (this.context === 'comercial') {
      if (!this.generalDescription) this.generalDescription = this.clientGeneralDescription;
    } else {
      if (this.itemData?.technical_spec?.technical_description) {
        this.generalDescription = this.itemData.technical_spec.technical_description;
      }
    }
  }

  public notifyChanges(): void {
    this.saveDraft();
    if (this.embedded) this.onComponentsChange.emit(this.components);
  }

  saveDraft(): void {
    if (this.embedded) return; // In embedded mode, drafts are managed by parent form
    if (!this.moldId && !this.externalMoldId) return;
    if (!this.components || this.components.length === 0) return;
    try {
      const draft = {
        timestamp: Date.now(),
        moldId: this.moldId || this.externalMoldId,
        technicalSpecId: this.technicalSpecId,
        generalDescription: this.generalDescription,
        clientGeneralDescription: this.clientGeneralDescription,
        opmReference: this.opmReference,
        activeView: this.activeView,
        components: this.components
      };
      localStorage.setItem(this.draftStorageKey, JSON.stringify(draft));
    } catch (e) {
      console.warn('Error saving spec draft to localStorage', e);
    }
  }

  getDraft(): any | null {
    if (this.embedded) return null; // In embedded mode, always rely on parent form inputs
    try {
      const raw = localStorage.getItem(this.draftStorageKey);
      if (!raw) return null;
      const draft = JSON.parse(raw);
      // Valid for 7 days
      const age = Date.now() - (draft.timestamp || 0);
      if (age > 7 * 24 * 60 * 60 * 1000) {
        this.clearDraft();
        return null;
      }
      return draft;
    } catch (e) {
      return null;
    }
  }

  clearDraft(): void {
    try {
      localStorage.removeItem(this.draftStorageKey);
    } catch (e) {}
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.saveDraft();
    }, 10000);
    window.addEventListener('beforeunload', () => this.saveDraft());
  }

  // ==================== DATA LOADING ====================

  loadGarmentPartsCatalog(): void {
    this.moldService.getGarmentParts(undefined, true).subscribe({
      next: (res: any) => this.globalGarmentParts = res.data || []
    });
  }

  loadMold(): void {
    this.loading = true;
    this.moldService.getMold(this.moldId).subscribe({
      next: (res: any) => {
        this.mold = res.data;
        if (this.mold?.zones) {
          this.mold.zones = this.mold.zones.map((z: any) => {
            let parsedPath = null;
            if (Array.isArray(z.path_data)) {
              parsedPath = z.path_data;
            } else if (typeof z.path_data === 'string' && z.path_data.trim()) {
              try {
                let p = JSON.parse(z.path_data);
                if (typeof p === 'string') p = JSON.parse(p);
                if (Array.isArray(p)) parsedPath = p;
              } catch (e) {
                parsedPath = null;
              }
            }
            return {
              ...z,
              path_data: parsedPath
            };
          });
        }
        const moldParts = this.mold.parts || [];
        const draft = this.getDraft();

        if (this.technicalSpecId) {
          this.moldService.getTechnicalSpec(this.technicalSpecId).subscribe({
            next: (specRes: any) => {
              const spec = specRes?.data;
              if (spec) {
                this.opmReference = spec.reference || '';
                this.clientGeneralDescription = spec.description || spec.general_description || '';
                this.generalDescription = this.context === 'comercial' ? this.clientGeneralDescription : (spec.technical_description || spec.description || '');
                const rawParts = spec.parts?.length ? spec.parts : (this.initialComponents?.length ? this.initialComponents : (draft?.components || []));
                this.components = this.enrichAndConsolidateComponents(rawParts, moldParts);
              } else {
                const rawParts = this.initialComponents?.length ? this.initialComponents : (draft?.components || []);
                this.components = this.enrichAndConsolidateComponents(rawParts, moldParts);
              }
              if (this.mold?.id_product_category) this.loadAvailableComponents(this.mold.id_product_category);
              this.buildTextContent();
              this.loading = false;
              this.notifyChanges();
            },
            error: () => {
              const rawParts = this.initialComponents?.length ? this.initialComponents : (draft?.components || []);
              this.components = this.enrichAndConsolidateComponents(rawParts, moldParts);
              if (this.mold?.id_product_category) this.loadAvailableComponents(this.mold.id_product_category);
              this.buildTextContent();
              this.loading = false;
              this.notifyChanges();
            }
          });
        } else {
          const rawParts = (this.initialComponents && this.initialComponents.length > 0)
            ? this.initialComponents
            : (draft?.components && draft.components.length > 0 ? draft.components : []);

          if (draft && (!this.initialComponents || this.initialComponents.length === 0)) {
            if (draft.generalDescription && !this.generalDescription) {
              this.generalDescription = draft.generalDescription;
            }
            if (draft.opmReference && !this.opmReference) {
              this.opmReference = draft.opmReference;
            }
            if (draft.activeView) {
              this.activeView = draft.activeView;
            }
          }

          this.components = this.enrichAndConsolidateComponents(rawParts, moldParts);
          if (this.mold?.id_product_category) this.loadAvailableComponents(this.mold.id_product_category);
          this.buildTextContent();
          this.loading = false;
          this.notifyChanges();
        }
      },
      error: () => {
        this.errorMessage = 'Error al cargar el molde';
        this.loading = false;
      }
    });
  }

  getCanonicalOptionalParts(): any[] {
    const canonicalList = [
      {
        id: 9100,
        code: 'BRG_FIG',
        name: 'Bragueta y Figurado',
        icon: 'bi-layout-sidebar',
        description: 'Bragueta delantera con aletilla, aletillón, cremallera o botones.',
        types: [
          { id: 9101, name: 'Bragueta con Cremallera y Aletilla Sencilla', technical_description: 'Bragueta con cremallera de nylon / metálica y aletilla reforzada', total_time: 1.85, is_default: true },
          { id: 9102, name: 'Bragueta con Botones y Aletillón Completo', technical_description: 'Bragueta tradicional con botones ocultos y aletillón protector', total_time: 2.20 }
        ]
      },
      {
        id: 9200,
        code: 'REF_ALTA_VIS',
        name: 'Cintas Reflectivas de Alta Visibilidad',
        icon: 'bi-stars',
        description: 'Cintas reflectivas de 2.5cm y 5cm de alta visibilidad en torso, espalda, mangas o botas.',
        types: [
          { id: 9201, name: 'Reflectivo Tipo Chaleco (Torso Delantero y Espalda 5cm)', technical_description: 'Cinta reflectiva de 5cm cosida horizontalmente en contorno de pecho y espalda', total_time: 1.25, is_default: true },
          { id: 9202, name: 'Reflectivo Tipo Chaleco Doble (Doble Banda Torso)', technical_description: 'Dos bandas reflectivas horizontales paralelas en pecho y espalda', total_time: 1.90 },
          { id: 9203, name: 'Reflectivo Tipo Chaleco y Mangas (Brazos y Torso)', technical_description: 'Bandas reflectivas completas en contorno de torso y en ambas mangas', total_time: 2.10 },
          { id: 9204, name: 'Reflectivo en Botas (Contorno Piernas)', technical_description: 'Cintas reflectivas perimetrales de seguridad en la bota de ambas piernas', total_time: 1.00 }
        ]
      },
      {
        id: 9300,
        code: 'LOG_BOR',
        name: 'Logos, Bordados y Marquillas',
        icon: 'bi-gem',
        description: 'Bordados corporativos, termofijados, estampados y marquillas de identificación.',
        types: [
          { id: 9301, name: 'Bordado Pecho Izquierdo y Marquilla Cuello', technical_description: 'Logo corporativo bordado en delantero izquierdo y marquilla de talla/marca', total_time: 1.80, is_default: true },
          { id: 9302, name: 'Estampado DTF / Vinilo Textil Espalda y Pecho', technical_description: 'Estampado termotransferible en delantero y espalda', total_time: 1.40 },
          { id: 9303, name: 'Marquilla Tejida en Manga / Bota', technical_description: 'Marquilla corporativa sobrepuesta', total_time: 0.80 }
        ]
      },
      {
        id: 9400,
        code: 'VIV_CON',
        name: 'Vivos y Contrastes Decorativos',
        icon: 'bi-palette',
        description: 'Detalles en contraste de color en cuello, carteras, sangrías o costados.',
        types: [
          { id: 9401, name: 'Vivos en Contraste Cuello y Carteras', technical_description: 'Insertos de tela en color de contraste en solapa y carteras', total_time: 1.10, is_default: true },
          { id: 9402, name: 'Sesgo Doble Doblado en Bordes y Puños', technical_description: 'Sesgo sobrepuesto decorativo en perfiles', total_time: 1.30 }
        ]
      }
    ];

    return canonicalList.map(canon => {
      const dbMatch = (this.globalGarmentParts || []).find(gp =>
        (gp.code && gp.code.toUpperCase() === canon.code) ||
        (gp.name && gp.name.toLowerCase().trim() === canon.name.toLowerCase().trim())
      );
      if (dbMatch) {
        return {
          ...canon,
          ...dbMatch,
          types: (dbMatch.types && dbMatch.types.length > 0) ? dbMatch.types : canon.types
        };
      }
      return canon;
    });
  }

  private enrichAndConsolidateComponents(rawParts: any[], moldParts: any[]): ComponentItem[] {
    let sourceParts: any[] = [];
    if (rawParts && rawParts.length > 0) {
      sourceParts = [...rawParts];
      // Include any base mold parts that weren't in the saved parts list
      if (moldParts && moldParts.length > 0) {
        for (const mp of moldParts) {
          if (mp.is_mandatory === false) continue;
          const exists = sourceParts.some((rp: any) => {
            const rpMoldPartId = rp.mold_part_id || (rp.is_from_mold ? rp.id : null);
            if (rpMoldPartId && Number(rpMoldPartId) === Number(mp.id)) return true;
            const rpGpId = rp.garment_part_id || rp.garment_part?.id;
            if (rpGpId && mp.garment_part_id && Number(rpGpId) === Number(mp.garment_part_id)) return true;
            const rpName = (rp.name || rp.garment_part?.name || '').toLowerCase().trim();
            const mpName = (mp.name || mp.garment_part?.name || '').toLowerCase().trim();
            return rpName && mpName && (rpName === mpName || rpName.includes(mpName) || mpName.includes(rpName));
          });
          if (!exists) {
            sourceParts.push(mp);
          }
        }
      }
    } else {
      sourceParts = [...(moldParts || [])];
    }

    const enrichedList: ComponentItem[] = sourceParts.map((raw: any): ComponentItem => {
      const rawName = (raw.name || raw.garment_part?.name || '').toLowerCase().trim();
      const rawGpId = raw.garment_part_id || raw.garment_part?.id;
      const rawMoldPartId = raw.mold_part_id || (raw.is_from_mold ? raw.id : null);

      const matchedMoldPart = moldParts.find((mp: any) => {
        if (rawMoldPartId && Number(mp.id) === Number(rawMoldPartId)) return true;
        if (rawGpId && Number(mp.garment_part_id) === Number(rawGpId)) return true;
        const mpName = (mp.name || mp.garment_part?.name || '').toLowerCase().trim();
        if (rawName && mpName && (rawName === mpName || rawName.includes(mpName) || mpName.includes(rawName))) return true;
        return false;
      }) || (raw.is_from_mold ? raw : null);

      // Extract available types from mold part, garment part, or canonical optionals
      const matchedOptional = !matchedMoldPart ? ((this.globalGarmentParts || []).find((gp: any) => (gp.name || '').toLowerCase().trim() === rawName) || this.getCanonicalOptionalParts().find((c: any) => c.name.toLowerCase().trim() === rawName)) : null;
      const typesFromMp = matchedMoldPart?.types || matchedMoldPart?.garment_part?.types || matchedMoldPart?.garmentPart?.types || matchedOptional?.types || [];
      const rawTypes = raw.types || [];
      const allTypes = (typesFromMp.length > 0 ? typesFromMp : rawTypes).filter((t: any) => !t.is_disabled);

      let selectedTypeId: number | null = null;
      let selectedTypeName = '';
      let technicalSpec = raw.technical_spec || '';
      let clientSpec = raw.client_spec || '';
      let totalTime = Number(raw.estimated_time) || 0;

      const targetId = Number(raw.selected_type_id || raw.mold_part_type_id || 0);
      const targetName = (raw.selected_type_name || raw.part_type?.name || raw.partType?.name || raw.inventory_description || '').toLowerCase().trim();
      const targetTech = (raw.technical_spec || '').toLowerCase().trim();

      // Find matched variant
      let found = allTypes.find((t: any) => 
        (targetId && Number(t.id) === targetId) ||
        (targetName && (t.name || '').toLowerCase().trim() === targetName) ||
        (targetTech && (t.technical_description || '').toLowerCase().trim() === targetTech) ||
        (targetTech && (t.name || '').toLowerCase().trim() === targetTech)
      );

      if (!found && targetTech) {
        found = allTypes.find((t: any) => 
          (t.technical_description && targetTech.includes(t.technical_description.toLowerCase().trim())) ||
          (t.name && targetTech.includes(t.name.toLowerCase().trim()))
        );
      }

      if (found) {
        selectedTypeId = found.id;
        selectedTypeName = found.name;
        technicalSpec = raw.technical_spec || found.technical_description || '';
        totalTime = Number(raw.estimated_time) || Number(found.total_time) || 0;
      } else if (raw.selected_type_name || raw.technical_spec || targetId) {
        selectedTypeId = targetId || raw.selected_type_id || null;
        selectedTypeName = raw.selected_type_name || raw.part_type?.name || raw.inventory_description || '';
        technicalSpec = raw.technical_spec || '';
        totalTime = Number(raw.estimated_time || raw.total_time) || 0;
      }

      let zoneObj = matchedMoldPart?.zone || raw.zone;
      let zoneId = matchedMoldPart?.mold_zone_id || raw.mold_zone_id || null;
      let zoneName = zoneObj?.name || matchedMoldPart?.zone_name || raw.zone_name || raw.inventory_reference || '';
      let zoneType = zoneObj?.zone_type || matchedMoldPart?.zone_type || raw.zone_type || '';

      if (this.mold?.zones?.length) {
        const matchingZone = this.mold.zones.find((z: any) => {
          const zName = (z.name || '').toLowerCase().trim();
          const zType = (z.zone_type || '').toLowerCase().trim();
          const targetZName = (zoneName || '').toLowerCase().trim();
          if (zoneId && Number(z.id) === Number(zoneId)) return true;
          if (targetZName && (zName === targetZName || targetZName.includes(zName) || zName.includes(targetZName))) return true;
          if (targetZName && zType && (zType === targetZName || targetZName.includes(zType) || zType.includes(targetZName))) return true;
          if (zName && (rawName.includes(zName) || zName.includes(rawName))) return true;
          if (zType && (rawName.includes(zType) || zType.includes(rawName))) return true;
          return false;
        });
        if (matchingZone) {
          if (!zoneId) zoneId = matchingZone.id;
          if (!zoneName) zoneName = matchingZone.name;
          if (!zoneType) zoneType = matchingZone.zone_type;
        }
      }

      return {
        mold_part_id: matchedMoldPart?.id || rawMoldPartId || null,
        mold_zone_id: zoneId,
        zone_name: zoneName,
        zone_type: zoneType,
        garment_part_id: matchedMoldPart?.garment_part_id || rawGpId || null,
        name: matchedMoldPart?.garment_part?.name || matchedMoldPart?.name || raw.name || 'Componente',
        item_type: raw.item_type || matchedMoldPart?.item_type || 'parte',
        view: raw.view || matchedMoldPart?.view || 'front',
        position_x: raw.position_x ?? matchedMoldPart?.position_x ?? null,
        position_y: raw.position_y ?? matchedMoldPart?.position_y ?? null,
        width: raw.width ?? matchedMoldPart?.width ?? 22,
        height: raw.height ?? matchedMoldPart?.height ?? 18,
        is_mandatory: raw.is_mandatory !== undefined ? raw.is_mandatory : (matchedMoldPart ? matchedMoldPart.is_mandatory !== false : false),
        client_spec: clientSpec,
        technical_spec: technicalSpec,
        material_exception: raw.material_exception || raw.technical_material_exception || null,
        client_material_exception: raw.client_material_exception || null,
        is_from_mold: raw.is_from_mold !== undefined ? raw.is_from_mold : !!matchedMoldPart,
        is_expanded: false,
        types: allTypes,
        selected_type_id: selectedTypeId,
        selected_type_name: selectedTypeName,
        total_time: totalTime,
        icon: matchedMoldPart?.icon || matchedMoldPart?.garment_part?.icon || matchedOptional?.icon || raw.icon || 'bi-layers',
        exception_comment: raw.exception_comment || null
      };
    });

    // Consolidate duplicate parts (e.g. left & right sleeve)
    const consolidatedMap = new Map<string, ComponentItem>();
    for (const comp of enrichedList) {
      const cName = (comp.name || '').toLowerCase().trim();
      const key = comp.mold_part_id
        ? `mp_${comp.mold_part_id}`
        : `${cName}__${comp.mold_zone_id || comp.zone_name || 'no-zone'}__${comp.garment_part_id || 'no-gp'}`;

      if (consolidatedMap.has(key)) {
        const existing = consolidatedMap.get(key)!;
        if (!existing.exception_comment && comp.exception_comment) {
          existing.exception_comment = comp.exception_comment;
        }
        if (!existing._all_zone_ids) {
          existing._all_zone_ids = existing.mold_zone_id ? [existing.mold_zone_id] : [];
        }
        if (comp.mold_zone_id && !existing._all_zone_ids.includes(comp.mold_zone_id)) {
          existing._all_zone_ids.push(comp.mold_zone_id);
        }
        if (!existing._all_part_ids) {
          existing._all_part_ids = existing.mold_part_id ? [existing.mold_part_id] : [];
        }
        if (comp.mold_part_id && !existing._all_part_ids.includes(comp.mold_part_id)) {
          existing._all_part_ids.push(comp.mold_part_id);
        }
        if ((!existing.types || existing.types.length === 0) && comp.types?.length) {
          existing.types = comp.types;
        }
        if (!existing.selected_type_id && !existing.selected_type_name && (comp.selected_type_id || comp.selected_type_name)) {
          existing.selected_type_id = comp.selected_type_id;
          existing.selected_type_name = comp.selected_type_name;
          existing.technical_spec = comp.technical_spec;
          existing.total_time = comp.total_time;
        }
      } else {
        // If this is an unconfigured no-zone orphan, check if a configured version already exists in map
        const isConfigured = !!(comp.selected_type_id || comp.selected_type_name);
        if (isConfigured) {
          for (const [k, existing] of consolidatedMap.entries()) {
            const isOrphan = !existing.is_mandatory && !existing.is_from_mold && !existing.mold_zone_id && !existing.zone_name && !existing.selected_type_id && !existing.selected_type_name;
            if (isOrphan && (existing.name || '').toLowerCase().trim() === cName) {
              consolidatedMap.delete(k);
            }
          }
        } else {
          const isOrphan = !comp.is_mandatory && !comp.is_from_mold && !comp.mold_zone_id && !comp.zone_name;
          if (isOrphan) {
            const hasConfigured = Array.from(consolidatedMap.values()).some(
              existing => (existing.name || '').toLowerCase().trim() === cName && (existing.selected_type_id || existing.selected_type_name)
            );
            if (hasConfigured) continue;
          }
        }

        comp._all_zone_ids = comp.mold_zone_id ? [comp.mold_zone_id] : [];
        comp._all_part_ids = comp.mold_part_id ? [comp.mold_part_id] : [];
        consolidatedMap.set(key, comp);
      }
    }

    // Ensure all mandatory mold parts are present
    for (const mp of moldParts) {
      if (mp.is_mandatory === false) continue;
      const mpId = Number(mp.id);
      const mpGpId = mp.garment_part_id ? Number(mp.garment_part_id) : null;
      const mpName = (mp.garment_part?.name || mp.name || '').toLowerCase().trim();

      const alreadyExists = Array.from(consolidatedMap.values()).some(c => {
        if (c.mold_part_id && Number(c.mold_part_id) === mpId) return true;
        if (c._all_part_ids?.some((pid: any) => Number(pid) === mpId)) return true;
        if (mpGpId && c.garment_part_id && Number(c.garment_part_id) === mpGpId) return true;
        const cName = (c.name || '').toLowerCase().trim();
        return cName && mpName && (cName === mpName || cName.includes(mpName) || mpName.includes(cName));
      });

      if (!alreadyExists) {
        const types = (mp.types || mp.garment_part?.types || []).filter((t: any) => !t.is_disabled);
        const newComp: ComponentItem = {
          mold_part_id: mp.id,
          mold_zone_id: mp.mold_zone_id || null,
          _all_zone_ids: mp.mold_zone_id ? [mp.mold_zone_id] : [],
          _all_part_ids: mp.id ? [mp.id] : [],
          zone_name: mp.zone?.name || mp.zone_name || '',
          zone_type: mp.zone?.zone_type || '',
          garment_part_id: mp.garment_part_id || null,
          name: mp.garment_part?.name || mp.name || 'Componente',
          item_type: mp.item_type || 'parte',
          view: mp.view || 'front',
          position_x: mp.position_x,
          position_y: mp.position_y,
          width: mp.width || 22,
          height: mp.height || 18,
          is_mandatory: true,
          client_spec: '',
          technical_spec: '',
          material_exception: null,
          client_material_exception: null,
          is_from_mold: true,
          is_expanded: false,
          types: types,
          selected_type_id: null,
          selected_type_name: '',
          total_time: 0,
          icon: mp.icon || mp.garment_part?.icon || 'bi-layers',
          exception_comment: null
        };
        consolidatedMap.set(`mp_${mp.id}`, newComp);
      }
    }

    // Link all matching zones from the mold (both front and back views) to each consolidated component
    const moldZones = this.mold?.zones || [];
    for (const comp of consolidatedMap.values()) {
      if (!comp._all_zone_ids) {
        comp._all_zone_ids = comp.mold_zone_id ? [comp.mold_zone_id] : [];
      }
      const cName = (comp.name || '').toLowerCase().trim();
      const cZoneName = (comp.zone_name || '').toLowerCase().trim();
      const cZoneType = (comp.zone_type || '').toLowerCase().trim();

      for (const z of moldZones) {
        if (!z.id) continue;
        const zName = (z.name || '').toLowerCase().trim();
        const zType = (z.zone_type || '').toLowerCase().trim();

        const isDirectMatch = z.id === comp.mold_zone_id || comp._all_zone_ids.includes(z.id);
        const isTypeMatch = !!(zType && cZoneType && zType === cZoneType);
        const isZoneNameMatch = !!(zName && cZoneName && (zName === cZoneName || zName.includes(cZoneName) || cZoneName.includes(zName)));
        const isPartNameMatch = !!(zType && (cName.includes(zType) || zType.includes(cName)));

        if (isDirectMatch || isTypeMatch || isZoneNameMatch || isPartNameMatch) {
          if (!comp._all_zone_ids.includes(z.id)) {
            comp._all_zone_ids.push(z.id);
          }
        }
      }
    }

    return Array.from(consolidatedMap.values());
  }

  loadAvailableComponents(categoryId: number): void {
    this.moldService.getComponentsByCategory(categoryId).subscribe({
      next: (res: any) => this.availableComponents = res.data || []
    });
  }

  // ==================== ZONAS & VARIANTES ====================

  getZoneArea(zone: any): number {
    let pts = zone.path_data;
    if (typeof pts === 'string') { try { pts = JSON.parse(pts); } catch { pts = null; } }
    if (Array.isArray(pts) && pts.length >= 3) {
      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      return Math.abs(area) / 2;
    }
    return (parseFloat(zone.width) || 20) * (parseFloat(zone.height) || 20);
  }

  isPartInSelectedZone(part: ComponentItem): boolean {
    if (!this.selectedZone) return true;
    const selZoneId = Number(this.selectedZone.id);
    // Check direct mold_zone_id
    if (part.mold_zone_id && Number(part.mold_zone_id) === selZoneId) return true;
    // Check consolidated _all_zone_ids (multi-polygon siblings)
    if (part._all_zone_ids?.length) {
      if (part._all_zone_ids.some((zid: any) => Number(zid) === selZoneId)) return true;
    }
    // Match by zone name
    const szName = (this.selectedZone.name || '').toLowerCase().trim();
    const pzName = (part.zone_name || '').toLowerCase().trim();
    if (szName && pzName && (szName === pzName || szName.includes(pzName) || pzName.includes(szName))) return true;
    // Match by zone_type vs part zone_type
    const zType = (this.selectedZone.zone_type || '').toLowerCase().trim();
    const pZoneType = (part.zone_type || '').toLowerCase().trim();
    if (zType && pZoneType && zType === pZoneType) return true;
    // Match by zone_type vs part name
    const pName = (part.name || '').toLowerCase().trim();
    if (zType && (pName.includes(zType) || zType.includes(pName))) return true;
    if (szName && (pName.includes(szName) || szName.includes(pName))) return true;
    return false;
  }

  selectVariantForPart(part: ComponentItem, variant: any): void {
    if (!variant) {
      if (!part.is_mandatory && !part.is_from_mold) {
        const idx = this.components.indexOf(part);
        if (idx >= 0) {
          this.components.splice(idx, 1);
        }
      } else {
        part.selected_type_id = null;
        part.selected_type_name = '';
        part.technical_spec = '';
        part.total_time = 0;
        part.exception_comment = null;
      }
    } else {
      part.selected_type_id = Number(variant.id);
      part.selected_type_name = variant.name;
      part.technical_spec = variant.technical_description || '';
      part.total_time = Number(variant.total_time) || 0;
    }
    this.buildTextContent();
    this.notifyChanges();
  }

  onAddOptionalPartToZone(event: { zone: any; garmentPart: any; variant?: any }): void {
    const { zone, garmentPart, variant } = event;
    const chosenVariant = variant || (garmentPart.types || []).find((t: any) => t.is_default) || (garmentPart.types || [])[0];
    const newComp: ComponentItem = {
      mold_part_id: null,
      mold_zone_id: zone.id || null,
      _all_zone_ids: zone.id ? [zone.id] : [],
      zone_name: zone.name || '',
      zone_type: zone.zone_type || '',
      garment_part_id: garmentPart.id || null,
      name: garmentPart.name,
      item_type: garmentPart.item_type || 'parte',
      view: this.activeView,
      position_x: null,
      position_y: null,
      width: 22,
      height: 18,
      is_mandatory: false,
      client_spec: '',
      technical_spec: chosenVariant?.technical_description || '',
      material_exception: null,
      client_material_exception: null,
      is_from_mold: false,
      is_expanded: false,
      types: garmentPart.types || [],
      selected_type_id: chosenVariant?.id || null,
      selected_type_name: chosenVariant?.name || '',
      total_time: chosenVariant ? (Number(chosenVariant.total_time) || 0) : 0,
      icon: garmentPart.icon || 'bi-sliders',
      exception_comment: null
    };
    this.components.push(newComp);
    this.buildTextContent();
    this.notifyChanges();
  }

  updateComponentExceptionComment(part: ComponentItem, comment: string): void {
    part.exception_comment = comment && comment.trim() ? comment.trim() : null;
    this.saveDraft();
  }

  toggleOptionalPartInclusion(part: ComponentItem): void {
    if (part.selected_type_id || part.technical_spec) {
      part.selected_type_id = null;
      part.selected_type_name = '';
      part.technical_spec = '';
      part.total_time = 0;
      part.exception_comment = null;
    } else {
      const def = (part.types || []).find((t: any) => t.is_default) || (part.types || [])[0];
      if (def) this.selectVariantForPart(part, def);
      else part.selected_type_name = 'Incluido';
    }
    this.buildTextContent();
    this.notifyChanges();
  }

  onVariantSelected(comp: ComponentItem): void {
    if (!comp.types?.length) return;
    const sel = comp.types.find((t: any) => Number(t.id) === Number(comp.selected_type_id));
    if (sel) {
      comp.selected_type_name = sel.name;
      comp.technical_spec = sel.technical_description || '';
      comp.total_time = Number(sel.total_time) || 0;
      this.buildTextContent();
      this.notifyChanges();
    }
  }

  clearSelectedZone(): void { this.selectedZone = null; }
  toggleView(): void {
    if (this.hasBackView) this.activeView = this.activeView === 'front' ? 'back' : 'front';
  }

  // ==================== CANVAS & POPUP ====================

  onCanvasClick(event: MouseEvent): void {
    if (this.loading || !this.mold) return;
    const imgEl = document.querySelector('img.cursor-crosshair') as HTMLImageElement;
    if (!imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    const x = Math.round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)) * 100) / 100;
    const y = Math.round(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)) * 100) / 100;
    this.dynamicPinPosition = { x, y };

    this.popoverPosition = {
      x: Math.min(event.clientX, window.innerWidth - 300),
      y: Math.min(event.clientY, window.innerHeight - 260)
    };
    this.openAddModal('component');
  }

  onZoneClick(zone: any): void {
    this.selectedZone = (this.selectedZone === zone) ? null : zone;
  }

  startDragging(event: MouseEvent, index: number): void {
    event.stopPropagation();
    event.preventDefault();
    const imgEl = document.querySelector('img.cursor-crosshair') as HTMLImageElement;
    if (!imgEl) return;

    const onMove = (e: MouseEvent) => {
      const rect = imgEl.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      this.components[index].position_x = Math.round(x * 100) / 100;
      this.components[index].position_y = Math.round(y * 100) / 100;
      this.notifyChanges();
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  clearPinnedPart(): void { this.dynamicPinPosition = null; }

  // ==================== ADD / INLINE EDIT ====================

  openAddModal(type: 'general' | 'component'): void {
    this.addModalType = type;
    this.showAddModal = true;
  }

  confirmAdd(part?: { name: string; item_type: string }): void {
    const finalName = part ? part.name : this.addSearchQuery.trim();
    const finalType = (part ? part.item_type : this.addItemType) as any;
    if (!finalName) return;

    this.components.push({
      mold_part_id: null,
      name: finalName,
      item_type: finalType,
      view: this.activeView,
      position_x: this.dynamicPinPosition?.x || null,
      position_y: this.dynamicPinPosition?.y || null,
      is_mandatory: false,
      client_spec: '',
      technical_spec: '',
      material_exception: null,
      is_from_mold: false,
      is_expanded: false,
    });

    this.showAddModal = false;
    this.dynamicPinPosition = null;
    this.addSearchQuery = '';
    this.buildTextContent();
    this.notifyChanges();
  }

  addMaterialAsComponent(mat: { name: string; type: string }): void {
    if (!mat?.name?.trim()) return;
    const exists = this.components.some(c =>
      c && (c.item_type === 'tela' || c.item_type === 'insumo') &&
      (c.name || '').toLowerCase().trim() === mat.name.toLowerCase().trim()
    );
    if (!exists) {
      this.components.push({
        mold_part_id: null,
        name: mat.name.trim(),
        item_type: (mat.type === 'tela' ? 'tela' : 'insumo') as any,
        view: this.activeView,
        position_x: null,
        position_y: null,
        is_mandatory: false,
        client_spec: '',
        technical_spec: '',
        material_exception: null,
        is_from_mold: false,
        is_expanded: false,
      });
      this.buildTextContent();
      this.notifyChanges();
    }
  }

  selectZoneSuggestedPart(part: any): void {
    const def = (part.types || []).find((t: any) => t.is_default) || (part.types || [])[0];
    this.components.push({
      mold_part_id: null,
      name: part.name,
      item_type: 'parte',
      view: this.activeView,
      position_x: this.dynamicPinPosition?.x || null,
      position_y: this.dynamicPinPosition?.y || null,
      width: 22,
      height: 18,
      is_mandatory: false,
      client_spec: '',
      technical_spec: def?.technical_description || '',
      material_exception: null,
      is_from_mold: false,
      is_expanded: false,
      types: part.types || [],
      selected_type_id: def?.id || null,
      selected_type_name: def?.name || '',
      total_time: def ? (Number(def.total_time) || 0) : 0,
      icon: part.icon || 'bi-layers'
    });
    this.showAddModal = false;
    this.dynamicPinPosition = null;
    this.buildTextContent();
    this.notifyChanges();
  }

  selectAddSuggestion(comp: any): void {
    this.addSearchQuery = comp.display_name || comp.name;
    this.addItemType = comp.item_type || 'parte';
    this.showAddSuggestions = false;
  }

  startInlineEdit(index: number): void {
    this.inlineEditingIndex = index;
    this.inlineEditName = this.components[index].name;
    this.inlineEditType = this.components[index].item_type;
  }

  saveInlineEdit(): void {
    if (this.inlineEditingIndex !== null && this.inlineEditName.trim()) {
      this.components[this.inlineEditingIndex].name = this.inlineEditName.trim();
      this.components[this.inlineEditingIndex].item_type = this.inlineEditType;
      this.inlineEditingIndex = null;
      this.buildTextContent();
      this.notifyChanges();
    }
  }

  cancelInlineEdit(): void { this.inlineEditingIndex = null; }

  startInlineAdd(type: 'general' | 'component'): void {
    this.inlineAdding = true;
    this.inlineAddingType = type;
    this.addSearchQuery = '';
  }

  confirmInlineAdd(): void {
    if (!this.addSearchQuery.trim()) {
      this.inlineAdding = false;
      return;
    }
    this.components.push({
      mold_part_id: null,
      name: this.addSearchQuery.trim(),
      item_type: this.addItemType,
      view: this.activeView,
      position_x: null,
      position_y: null,
      is_mandatory: false,
      client_spec: '',
      technical_spec: '',
      material_exception: null,
      is_from_mold: false,
      is_expanded: false,
    });
    this.inlineAdding = false;
    this.buildTextContent();
    this.notifyChanges();
  }

  removeComponent(item: ComponentItem): void {
    if (item.is_from_mold) return;
    const idx = this.components.indexOf(item);
    if (idx >= 0) {
      this.components.splice(idx, 1);
      this.buildTextContent();
      this.notifyChanges();
    }
  }

  // ==================== SPEC EDITOR & MATERIAL MODALS ====================

  openSpecEditor(realIndex: number): void {
    this.specEditorIndex = realIndex;
    this.specEditorComponent = this.components[realIndex];
    this.specEditorClientSpec = this.specEditorComponent.client_spec || '';
    this.specEditorTechnicalSpec = this.specEditorComponent.technical_spec || '';
    this.targetMaterialType = this.context === 'comercial' ? 'client' : 'technical';
    this.showSpecEditor = true;
  }

  saveSpecEditor(data: { clientSpec: string; technicalSpec: string }): void {
    if (this.specEditorIndex === null) return;
    const c = this.components[this.specEditorIndex];
    c.client_spec = data.clientSpec;
    c.technical_spec = data.technicalSpec;
    this.closeSpecEditor();
    this.buildTextContent();
    this.notifyChanges();
  }

  closeSpecEditor(): void {
    this.showSpecEditor = false;
    this.specEditorIndex = null;
    this.specEditorComponent = null;
  }

  specAddExceptionSiesa(): void {
    if (this.specEditorIndex === null) return;
    this.targetMaterialType = 'technical';
    this.inventoryFromSpecEditor = true;
    this.showSpecEditor = false;
    this.openSiesaForComponent(this.specEditorIndex);
  }

  specAddExceptionManual(): void {
    if (this.specEditorIndex === null) return;
    this.targetMaterialType = 'technical';
    this.openManualForComponent(this.specEditorIndex);
  }

  specRemoveException(): void {
    if (this.specEditorIndex !== null) this.components[this.specEditorIndex].material_exception = null;
  }

  specAddClientExceptionSiesa(): void {
    if (this.specEditorIndex === null) return;
    this.targetMaterialType = 'client';
    this.inventoryFromSpecEditor = true;
    this.showSpecEditor = false;
    this.openSiesaForComponent(this.specEditorIndex);
  }

  specAddClientExceptionManual(): void {
    if (this.specEditorIndex === null) return;
    this.targetMaterialType = 'client';
    this.openManualForComponent(this.specEditorIndex);
  }

  specRemoveClientException(): void {
    if (this.specEditorIndex !== null) this.components[this.specEditorIndex].client_material_exception = null;
  }

  openSiesaForComponent(i: number): void {
    this.selectedPartIndex = i;
    if (!this.inventoryFromSpecEditor) {
      this.targetMaterialType = this.context === 'comercial' ? 'client' : 'technical';
    }
    this.inventoryFilterType = this.components[i].item_type === 'tela' ? 'tela' : 'insumo';
    this.showInventoryModal = true;
  }

  handleInventorySelect(item: any): void {
    if (this.selectedPartIndex === null) return;
    const mat: OpmMaterial = {
      id_item: item.id_item || item.referencia || '',
      referencia: item.referencia || '',
      descripcion: item.descripcion || '',
      id_color: item.id_color || '',
      color: item.color || '',
      id_talla: item.id_talla || '',
      talla: item.talla || '',
      costo_unitario: item.costo_unitario || 0,
      existencias: item.existencias || 0,
      is_fabric: (item.referencia || '').startsWith('1110'),
      assignment_source: 'siesa',
    };
    if (this.targetMaterialType === 'client') {
      this.components[this.selectedPartIndex].client_material_exception = mat;
    } else {
      this.components[this.selectedPartIndex].material_exception = mat;
    }
    const wasFromSpec = this.inventoryFromSpecEditor;
    this.closeModal();
    if (wasFromSpec) this.showSpecEditor = true;
    this.buildTextContent();
    this.notifyChanges();
  }

  closeModal(): void {
    this.showInventoryModal = false;
    this.selectedPartIndex = null;
    this.inventoryFromSpecEditor = false;
  }

  openManualForComponent(i: number): void {
    this.manualModalIndex = i;
    if (!this.inventoryFromSpecEditor) {
      this.targetMaterialType = this.context === 'comercial' ? 'client' : 'technical';
    }
    const mat = this.targetMaterialType === 'client'
      ? this.components[i].client_material_exception
      : this.components[i].material_exception;
    this.manualText = mat?.descripcion || '';
    this.manualColor = mat?.color || '';
    this.showManualModal = true;
  }

  handleManualConfirm(data: { text: string; color: string }): void {
    if (this.manualModalIndex === null) return;
    const mat: OpmMaterial = {
      id_item: '', referencia: '', descripcion: data.text,
      id_color: '', color: data.color, costo_unitario: 0, existencias: 0,
      is_fabric: false, assignment_source: 'manual',
    };
    if (this.targetMaterialType === 'client') {
      this.components[this.manualModalIndex].client_material_exception = mat;
    } else {
      this.components[this.manualModalIndex].material_exception = mat;
    }
    this.closeManualModal();
    this.buildTextContent();
    this.notifyChanges();
  }

  closeManualModal(): void {
    this.showManualModal = false;
    this.manualModalIndex = null;
  }

  onClearMaterialException(i: number): void {
    if (this.context === 'comercial') this.components[i].client_material_exception = null;
    else this.components[i].material_exception = null;
    this.buildTextContent();
    this.notifyChanges();
  }

  // ==================== TEXT VIEW ====================

  buildTextContent(): void {
    const lines: string[] = [];
    lines.push('=== ELEMENTOS GENERALES ===');
    this.generalComponents.forEach(g => {
      lines.push(`${g.name}:`);
      lines.push(g.material_exception ? `  ${g.material_exception.descripcion}` : '  ');
    });
    lines.push('');
    lines.push('=== COMPONENTES POSICIONADOS ===');
    this.positionedComponents.forEach(c => {
      lines.push(`${c.name}:`);
      if (this.mode === 'opm') lines.push(`  Especificación: ${c.client_spec}`);
      else {
        lines.push(`  Cliente: ${c.client_spec}`);
        lines.push(`  Técnica: ${c.technical_spec}`);
      }
      if (c.exception_comment) lines.push(`  Nota/Excepción: ${c.exception_comment}`);
      if (c.material_exception) lines.push(`  Excepción: ${c.material_exception.descripcion}`);
    });
    this.textContent = lines.join('\n');
  }

  onTextKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.suggestionType = 'component';
      this.showSuggestions = true;
    }
  }

  onTextInput(): void {
    this.showSuggestions = false;
  }

  selectTextSuggestion(item: any): void {
    this.textContent += `\n${item.label || item.descripcion}`;
    this.showSuggestions = false;
  }

  dismissSuggestions(): void { this.showSuggestions = false; }

  // ==================== SAVE SPEC ====================

  saveSpec(): Observable<number | null> {
    if (!this.moldId) return of(null);
    this.saving = true;
    const user = this.authService.user;
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';

    const configuredComponents = this.components.filter(c =>
      !!c.selected_type_id ||
      !!c.selected_type_name ||
      (typeof c.technical_spec === 'string' && c.technical_spec.trim().length > 0) ||
      (typeof c.client_spec === 'string' && c.client_spec.trim().length > 0) ||
      (typeof c.exception_comment === 'string' && c.exception_comment.trim().length > 0) ||
      !!c.material_exception ||
      !!c.client_material_exception
    );

    const payload = {
      mold_id: this.moldId,
      reference: this.opmReference || null,
      description: this.context === 'comercial' ? (this.generalDescription || this.clientGeneralDescription || null) : (this.clientGeneralDescription || null),
      technical_description: this.context !== 'comercial' ? (this.generalDescription || null) : null,
      user_created: userName || null,
      parts: configuredComponents.map(c => {
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
        } else if ((c as any).inventory_reference || (c as any).inventory_description) {
          invRef = (c as any).inventory_reference || invRef;
          invDesc = (c as any).inventory_description || invDesc;
        }

        return {
          mold_part_id: c.mold_part_id || null,
          mold_part_type_id: c.selected_type_id || (c as any).mold_part_type_id || null,
          selected_type_name: c.selected_type_name || null,
          name: c.name || 'Componente',
          zone_name: c.zone_name || null,
          item_type: c.item_type || 'parte',
          view: c.view || 'front',
          position_x: c.position_x ?? null,
          position_y: c.position_y ?? null,
          client_spec: c.client_spec || null,
          technical_spec: c.technical_spec || null,
          estimated_time: c.total_time || (c as any).estimated_time || 0,
          exception_comment: c.exception_comment || null,
          material_exception: c.material_exception,
          client_material_exception: c.client_material_exception,
          is_from_mold: c.is_from_mold,
          inventory_reference: invRef,
          inventory_description: invDesc,
        };
      }),
    };

    const request$ = this.technicalSpecId
      ? this.moldService.updateTechnicalSpec(this.technicalSpecId, payload)
      : this.moldService.createTechnicalSpec(payload);

    return request$.pipe(
      tap((res: any) => {
        this.saving = false;
        if (res && res.success !== false) {
          if (res.data?.id) this.technicalSpecId = res.data.id;
          this.clearDraft();
          this.successMessage = `${this.modeLabel} guardada exitosamente`;
        } else {
          this.errorMessage = res?.message || 'Error al guardar la especificación';
        }
      }),
      map((res: any) => (res && res.success !== false ? (res.data?.id || this.technicalSpecId || null) : null)),
      catchError((err) => {
        this.saving = false;
        this.errorMessage = err?.error?.message || err?.message || 'Error al guardar en el servidor';
        return of(null);
      })
    );
  }

  save(): void {
    this.saveSpec().subscribe({
      next: (specId) => { 
        if (specId) {
          this.clearDraft();
          this.onSpecSaved.emit(specId);
        }
      },
      error: () => this.saving = false
    });
  }

  goBack(): void { this.router.navigate(['/moldes']); }
}
