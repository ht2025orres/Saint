import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, HostListener, OnChanges, SimpleChanges } from '@angular/core';
import { ComponentItem, OpmMaterial } from '../../spec-generator.component';
import { MoldService, GenericMaterial } from '../../../../../services/mold.service';
import { SpecConsolidatedMaterial } from '../spec-tab-estructura/spec-tab-estructura.component';

@Component({
  selector: 'app-spec-tab-diseno',
  templateUrl: './spec-tab-diseno.component.html',
  styleUrls: ['./spec-tab-diseno.component.css']
})
export class SpecTabDisenoComponent implements OnChanges {
  @ViewChild('imageCanvas') imageCanvas!: ElementRef<HTMLDivElement>;
  @ViewChild('moldImage') moldImage!: ElementRef<HTMLImageElement>;

  constructor(private moldService: MoldService) {
    this.masterMaterials = this.moldService.getGenericMaterials();
  }

  @Input() mold: any = null;
  @Input() itemData: any = null;
  @Input() solicitudData: any = null;
  @Input() clientGeneralDescription = '';
  @Input() generalDescription = '';
  @Input() context: 'comercial' | 'muestras' | 'molde' = 'comercial';
  @Input() hasBackView = false;
  @Input() activeView: 'front' | 'back' = 'front';
  @Input() activeImage = '';
  @Input() embedded = false;

  @Input() selectedZone: any = null;
  @Input() filteredMandatoryParts: ComponentItem[] = [];
  @Input() allMandatoryConfigured = false;
  @Input() filteredOptionalParts: ComponentItem[] = [];
  @Input() materialComponents: ComponentItem[] = [];
  @Input() generalComponents: ComponentItem[] = [];
  @Input() allComponents: ComponentItem[] = [];
  @Input() positionedComponents: ComponentItem[] = [];
  @Input() sortedActiveZones: any[] = [];
  @Input() activeZones: any[] = [];
  @Input() zoneTypeOptions: any[] = [];

  // Dynamic pin / Popover
  @Input() dynamicPinPosition: { x: number; y: number } | null = null;
  @Input() showAddModal = false;
  @Input() popoverPosition: { x: number; y: number } | null = null;
  @Input() detectedZone: any = null;
  @Input() zoneSuggestedParts: any[] = [];
  @Input() addSearchQuery = '';
  @Input() addItemType: 'tela' | 'insumo' | 'parte' = 'parte';
  @Input() showAddSuggestions = false;
  @Input() filteredAddSuggestions: any[] = [];

  @Input() globalGarmentParts: any[] = [];

  @Output() generalDescriptionChange = new EventEmitter<string>();
  @Output() toggleView = new EventEmitter<void>();
  @Output() clearSelectedZone = new EventEmitter<void>();
  @Output() selectVariantForPart = new EventEmitter<{ part: ComponentItem; variant: any }>();
  @Output() exceptionCommentChange = new EventEmitter<{ part: ComponentItem; comment: string }>();
  @Output() addOptionalPartToZone = new EventEmitter<{ zone: any; garmentPart: any; variant?: any }>();
  @Output() toggleOptionalPartInclusion = new EventEmitter<ComponentItem>();
  @Output() openAddModal = new EventEmitter<'general' | 'component'>();
  @Output() openSpecEditor = new EventEmitter<number>();
  @Output() onClearMaterialException = new EventEmitter<number>();
  @Output() openSiesaForComponent = new EventEmitter<number>();
  @Output() openManualForComponent = new EventEmitter<number>();
  @Output() clearPinnedPart = new EventEmitter<void>();
  @Output() canvasClick = new EventEmitter<MouseEvent>();
  @Output() zoneClick = new EventEmitter<any>();
  @Output() startDragging = new EventEmitter<{ event: MouseEvent; index: number }>();
  @Output() variantSelected = new EventEmitter<ComponentItem>();
  @Output() closeAddModal = new EventEmitter<void>();
  @Output() selectZoneSuggestedPart = new EventEmitter<any>();
  @Output() selectAddSuggestion = new EventEmitter<any>();
  @Output() confirmAdd = new EventEmitter<void>();
  @Output() addSearchQueryChange = new EventEmitter<string>();
  @Output() addItemTypeChange = new EventEmitter<'tela' | 'insumo' | 'parte'>();
  @Output() addMaterialAsComponent = new EventEmitter<{ name: string; type: string }>();
  @Output() showAddSuggestionsChange = new EventEmitter<boolean>();
  @Output() getRealComponentIndexFn = new EventEmitter<ComponentItem>();

  @Input() getRealIndex!: (part: ComponentItem) => number;

  // Estado de navegación interna en Popover (Drill-down: Zona -> Parte -> Variantes)
  activeDrilldownPart: ComponentItem | null = null;
  expandedSidebarZoneKey: string | null = null; // Inicia colapsado; solo una zona abierta a la vez
  openDropdownPart: ComponentItem | null = null;
  openAddPartZoneKey: string | null = null;
  openAddOptionalZoneKey: string | null = null;
  optionalSearchQuery = '';
  activeConfigPart: ComponentItem | null = null;

  // Caché de zonas agrupadas para evitar recalculación continua en render
  zonesWithParts: { zone: any; parts: ComponentItem[]; allZoneIds: any[] }[] = [];

  // ─── Inline Material Picker State (Diseño tab) ───
  showMaterialPicker = false;
  materialPickerSearch = '';
  manualCustomName = '';
  materialPickerTab: 'all' | 'tela' | 'insumo' = 'all';
  extraMaterialType: 'tela' | 'insumo' = 'insumo';
  masterMaterials: GenericMaterial[] = [];

  // ─── Material SIESA/Manual Linking State (Diseño tab) ───
  materialComments: Map<string, string> = new Map();
  materialSiesaRefs: Map<string, any> = new Map();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedZone']) {
      this.activeDrilldownPart = null;
      // Sidebar expansion and figurin popover selection remain independent
    }
    this.updateZonesWithParts();
  }

  drilldownToPart(part: ComponentItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.activeDrilldownPart = part;
  }

  backToZoneParts(event?: Event): void {
    if (event) event.stopPropagation();
    this.activeDrilldownPart = null;
  }

  getZoneKey(zone: any): string {
    return (zone?.name || zone?.zone_type || String(zone?.id || '')).toLowerCase().trim();
  }

  isSidebarZoneExpanded(zoneIdentifier: any): boolean {
    const key = this.getZoneKey(zoneIdentifier);
    return this.expandedSidebarZoneKey === key;
  }

  toggleSidebarZone(zoneIdentifier: any, event?: Event): void {
    if (event) event.stopPropagation();
    const key = this.getZoneKey(zoneIdentifier);
    this.expandedSidebarZoneKey = this.expandedSidebarZoneKey === key ? null : key;
  }

  trackByZoneKey = (index: number, zp: any): string => {
    const z = zp?.zone;
    return (z?.name || z?.zone_type || String(z?.id || index)).toLowerCase().trim();
  };

  trackByPart = (index: number, part: ComponentItem): string => {
    return (part?.mold_part_id || part?.garment_part_id || index) + '_' + (part?.name || '') + '_' + (part?.mold_zone_id || '');
  };

  updateZonesWithParts(): void {
    this.zonesWithParts = this.computeZonesWithParts();
  }

  computeZonesWithParts(): { zone: any; parts: ComponentItem[]; allZoneIds: any[] }[] {
    const zones = this.activeZones || [];
    const grouped = new Map<string, { zone: any; parts: ComponentItem[]; allZoneIds: any[] }>();

    for (const zone of zones) {
      const key = this.getZoneKey(zone);
      const parts = this.getPartsForZone(zone);

      if (!grouped.has(key)) {
        grouped.set(key, {
          zone,
          parts: [...parts],
          allZoneIds: zone.id ? [zone.id] : []
        });
      } else {
        const existing = grouped.get(key)!;
        if (zone.id && !existing.allZoneIds.includes(zone.id)) {
          existing.allZoneIds.push(zone.id);
        }
        parts.forEach(p => {
          if (!existing.parts.includes(p)) {
            existing.parts.push(p);
          }
        });
      }
    }

    return Array.from(grouped.values());
  }

  getZonesWithParts(): { zone: any; parts: ComponentItem[]; allZoneIds: any[] }[] {
    return this.computeZonesWithParts();
  }

  getConfiguredPartsForZone(zp: { zone: any; parts: ComponentItem[] }): ComponentItem[] {
    return (zp.parts || []).filter(p => !!p.selected_type_id || !!p.selected_type_name || !!p.technical_spec);
  }

  getUnconfiguredPartsForZone(zp: { zone: any; parts: ComponentItem[] }): ComponentItem[] {
    return (zp.parts || []).filter(p => !p.selected_type_id && !p.selected_type_name && !p.technical_spec);
  }

  isAddPartDropdownOpen(zone: any): boolean {
    return this.openAddPartZoneKey === this.getZoneKey(zone);
  }

  toggleAddPartDropdown(zone: any, event?: Event): void {
    if (event) event.stopPropagation();
    const key = this.getZoneKey(zone);
    this.openAddPartZoneKey = this.openAddPartZoneKey === key ? null : key;
    this.openAddOptionalZoneKey = null;
  }

  selectedOptionalGarmentPart: any = null;

  toggleAddOptionalDropdown(zone: any, event?: Event): void {
    if (event) event.stopPropagation();
    const key = this.getZoneKey(zone);
    this.openAddOptionalZoneKey = this.openAddOptionalZoneKey === key ? null : key;
    this.openAddPartZoneKey = null;
    this.selectedOptionalGarmentPart = null;
    this.optionalSearchQuery = '';
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

  getAvailableOptionalPartsForZone(zone?: any): any[] {
    const canonical = this.getCanonicalOptionalParts();
    const query = (this.optionalSearchQuery || '').toLowerCase().trim();
    if (!query) return canonical;
    return canonical.filter(m =>
      m.name.toLowerCase().includes(query) ||
      (m.description || '').toLowerCase().includes(query) ||
      m.types?.some((t: any) => t.name?.toLowerCase().includes(query) || t.technical_description?.toLowerCase().includes(query))
    );
  }

  drilldownToOptionalPart(opt: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedOptionalGarmentPart = opt;
  }

  backToOptionalList(event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedOptionalGarmentPart = null;
  }

  selectOptionalPartVariantForZone(zone: any, garmentPart: any, variant: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.addOptionalPartToZone.emit({ zone, garmentPart, variant });
    this.openAddOptionalZoneKey = null;
    this.selectedOptionalGarmentPart = null;
    this.optionalSearchQuery = '';
    setTimeout(() => this.updateZonesWithParts(), 50);
  }

  selectOptionalPartForZone(zone: any, garmentPart: any, event?: Event): void {
    if (event) event.stopPropagation();
    if (garmentPart.types && garmentPart.types.length > 1) {
      this.drilldownToOptionalPart(garmentPart, event);
      return;
    }
    const def = (garmentPart.types || [])[0];
    this.selectOptionalPartVariantForZone(zone, garmentPart, def, event);
  }

  openPartForConfig(part: ComponentItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.openAddPartZoneKey = null;
    this.activeConfigPart = part;
    this.openDropdownPart = part;
  }

  getUnassignedParts(): ComponentItem[] {
    const list = this.filteredMandatoryParts || [];
    const zones = this.activeZones || [];
    return list.filter(part => {
      return !zones.some(z => this.getPartsForZone(z).includes(part));
    });
  }

  getConfiguredPartsCount(parts: ComponentItem[]): number {
    return (parts || []).filter(p => !!p.selected_type_id || !!p.selected_type_name || !!p.technical_spec).length;
  }

  getZoneStatusBadge(zp: { zone: any; parts: ComponentItem[] }): { label: string; class: string } {
    const count = this.getConfiguredPartsCount(zp.parts);
    if (count > 0) {
      return {
        label: count === 1 ? '✓ 1 Configurada' : `✓ ${count} Configuradas`,
        class: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
      };
    }
    return {
      label: 'Opcional',
      class: 'bg-slate-50 text-slate-500 border-slate-200 font-medium'
    };
  }

  getZoneIcon(zoneType?: string): string {
    return this.zoneTypeOptions.find(z => z.value === zoneType)?.icon || 'bi-bounding-box-circles';
  }

  getZoneColor(zoneType: string): string {
    return this.zoneTypeOptions.find(z => z.value === zoneType)?.color || '#64748b';
  }

  getZoneLabel(zoneType: string): string {
    return this.zoneTypeOptions.find(z => z.value === zoneType)?.label || zoneType;
  }

  getPartsForZone(zone: any): ComponentItem[] {
    const list = this.allComponents && this.allComponents.length > 0 ? this.allComponents : [...this.filteredMandatoryParts, ...this.filteredOptionalParts];
    if (!zone) return [];
    const zoneId = Number(zone.id);
    const zName = (zone.name || '').toLowerCase().trim();
    const zType = (zone.zone_type || '').toLowerCase().trim();
    return list.filter(p => {
      if (p.mold_zone_id && Number(p.mold_zone_id) === zoneId) return true;
      if (p._all_zone_ids?.some((zid: any) => Number(zid) === zoneId)) return true;
      if (p.zone_name && zName && p.zone_name.toLowerCase().trim() === zName) return true;
      const pZoneType = (p.zone_type || '').toLowerCase().trim();
      if (zType && pZoneType && zType === pZoneType) return true;
      const pName = (p.name || '').toLowerCase().trim();
      return !!(zType && (pName.includes(zType) || zType.includes(pName)));
    });
  }

  isZoneConfigured(zone: any): boolean {
    const parts = this.getPartsForZone(zone);
    if (parts.length === 0) return true;
    return parts.some(p => !!p.selected_type_id || !!p.selected_type_name || !!p.technical_spec);
  }

  onVariantSelectChange(part: ComponentItem, event: Event): void {
    const selectEl = event.target as HTMLSelectElement;
    const val = selectEl?.value;
    if (!val || val === '') {
      this.selectVariantForPart.emit({ part: part, variant: null });
    } else {
      const variant = (part.types || []).find((t: any) => String(t.id) === String(val));
      if (variant) {
        this.selectVariantForPart.emit({ part: part, variant: variant });
      }
    }
  }

  getPolygonPoints(points?: any): string {
    let pts = points;
    if (typeof pts === 'string') {
      try { pts = JSON.parse(pts); } catch (e) { pts = []; }
    }
    if (!Array.isArray(pts) || pts.length === 0) return '';
    return pts.map((p: any) => `${p.x},${p.y}`).join(' ');
  }

  getZoneCenter(zone: any): { x: number; y: number } {
    let pts = zone.path_data;
    if (typeof pts === 'string') {
      try { pts = JSON.parse(pts); } catch (e) { pts = null; }
    }
    if (Array.isArray(pts) && pts.length > 0) {
      const sumX = pts.reduce((acc: number, p: any) => acc + (p.x || 0), 0);
      const sumY = pts.reduce((acc: number, p: any) => acc + (p.y || 0), 0);
      return {
        x: Math.round((sumX / pts.length) * 100) / 100,
        y: Math.round((sumY / pts.length) * 100) / 100
      };
    }
    return {
      x: Math.round(((parseFloat(zone.position_x as any) || 0) + ((parseFloat(zone.width as any) || 20) / 2)) * 100) / 100,
      y: Math.round(((parseFloat(zone.position_y as any) || 0) + ((parseFloat(zone.height as any) || 20) / 2)) * 100) / 100
    };
  }

  isVariantSelected(part: ComponentItem, variant: any): boolean {
    if (part.selected_type_id != null && variant?.id != null) {
      return Number(part.selected_type_id) === Number(variant.id);
    }
    return part.selected_type_name === variant?.name;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Cerrar desplegables de variantes si se hace clic fuera
    if (!target.closest('.dropdown-part-wrapper')) {
      this.closeAllDropdowns();
    }
    // Cerrar popover del figurín si se hace clic fuera
    if (this.selectedZone &&
      !target.closest('.zone-popover-container') &&
      !target.closest('.zone-hotspot-pin') &&
      !target.closest('[class*="group/pin"]') &&
      !target.closest('polygon') &&
      !target.closest('rect')) {
      this.clearSelectedZone.emit();
      this.activeDrilldownPart = null;
    }
  }

  togglePartDropdown(part: ComponentItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.openDropdownPart = this.openDropdownPart === part ? null : part;
  }

  closeAllDropdowns(): void {
    this.openDropdownPart = null;
    this.openAddPartZoneKey = null;
    this.openAddOptionalZoneKey = null;
    this.activeConfigPart = null;
  }

  selectVariant(part: ComponentItem, variant: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectVariantForPart.emit({ part, variant });
    this.openDropdownPart = null;
    this.openAddPartZoneKey = null;
    this.openAddOptionalZoneKey = null;
    this.activeConfigPart = null;
    // Auto-cerrar el popover del figurín al seleccionar
    if (this.selectedZone) {
      this.clearSelectedZone.emit();
      this.activeDrilldownPart = null;
    }
    setTimeout(() => this.updateZonesWithParts(), 50);
  }

  unselectVariant(part: ComponentItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectVariantForPart.emit({ part, variant: null });
    this.openDropdownPart = null;
    this.openAddPartZoneKey = null;
    this.openAddOptionalZoneKey = null;
    this.activeConfigPart = null;
    // Auto-cerrar el popover del figurín al deseleccionar
    if (this.selectedZone) {
      this.clearSelectedZone.emit();
      this.activeDrilldownPart = null;
    }
    setTimeout(() => this.updateZonesWithParts(), 50);
  }

  getSelectedVariant(part: ComponentItem): any {
    if (!part.types?.length) return null;
    if (part.selected_type_id != null) {
      return part.types.find((t: any) => Number(t.id) === Number(part.selected_type_id));
    }
    if (part.selected_type_name) {
      return part.types.find((t: any) => t.name === part.selected_type_name);
    }
    return null;
  }

  getZonePopoverLeft(zone: any): number {
    const center = this.getZoneCenter(zone);
    return Math.min(65, Math.max(35, center.x));
  }

  getZonePopoverTop(zone: any): number {
    const center = this.getZoneCenter(zone);
    return Math.min(68, Math.max(22, center.y));
  }

  isPartIncluded(part: ComponentItem): boolean {
    if (part.is_mandatory) return true;
    return !!part.selected_type_id || !!part.selected_type_name || !!part.technical_spec;
  }

  editingExceptionParts = new Set<ComponentItem>();

  isExceptionInputVisible(part: ComponentItem): boolean {
    return !!part.exception_comment || this.editingExceptionParts.has(part);
  }

  toggleExceptionInput(part: ComponentItem, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.editingExceptionParts.has(part)) {
      this.editingExceptionParts.delete(part);
    } else {
      this.editingExceptionParts.add(part);
    }
  }

  onExceptionCommentInput(part: ComponentItem, comment: string): void {
    part.exception_comment = comment;
    this.exceptionCommentChange.emit({ part, comment });
  }

  clearExceptionComment(part: ComponentItem, event?: Event): void {
    if (event) event.stopPropagation();
    part.exception_comment = null;
    this.editingExceptionParts.delete(part);
    this.exceptionCommentChange.emit({ part, comment: '' });
  }

  getMaterialDisplayName(mat: any): string {
    if (!mat) return '';
    const desc = (mat.descripcion || mat.inventory_description || '').trim();
    const color = (mat.color || '').trim();
    if (color && !desc.toLowerCase().includes(color.toLowerCase())) {
      return `${desc} (${color})`;
    }
    return desc;
  }

  onDescChange(val: string): void {
    this.generalDescription = val;
    this.generalDescriptionChange.emit(val);
  }

  onAddQueryChange(val: string): void {
    this.addSearchQuery = val;
    this.addSearchQueryChange.emit(val);
  }

  onAddTypeChange(val: any): void {
    this.addItemType = val;
    this.addItemTypeChange.emit(val);
  }

  // ─── Materiales Consolidados desde Partes Seleccionadas ───
  get consolidatedMaterials(): SpecConsolidatedMaterial[] {
    const map = new Map<string, {
      name: string;
      type: 'tela' | 'insumo';
      sourceParts: Set<string>;
    }>();

    const addMaterialToMap = (materialName: string, partLabel: string, forceType?: 'tela' | 'insumo' | string) => {
      const rawOriginal = (materialName || '').trim();
      if (!rawOriginal) return;
      let raw = rawOriginal;
      if (rawOriginal.toLowerCase() === 'tela') raw = 'Tela Principal';
      if (rawOriginal.toLowerCase() === 'hilo') raw = 'Hilo de Confección';
      if (rawOriginal.toLowerCase() === 'botones' || rawOriginal.toLowerCase() === 'botón' || rawOriginal.toLowerCase() === 'boton') raw = 'Botones';
      if (rawOriginal.toLowerCase() === 'cremallera' || rawOriginal.toLowerCase() === 'cierre' || rawOriginal.toLowerCase() === 'zipper') raw = 'Cremallera / Cierre';
      if (rawOriginal.toLowerCase() === 'velcro' || rawOriginal.toLowerCase() === 'contacto') raw = 'Velcro / Contacto';
      if (rawOriginal.toLowerCase() === 'broches' || rawOriginal.toLowerCase() === 'broche') raw = 'Broches Metálicos';
      if (rawOriginal.toLowerCase() === 'elastico' || rawOriginal.toLowerCase() === 'elástico' || rawOriginal.toLowerCase() === 'resorte') raw = 'Elástico';
      if (rawOriginal.toLowerCase() === 'reflectivo' || rawOriginal.toLowerCase() === 'reflectiva' || rawOriginal.toLowerCase() === 'cinta reflectiva') raw = 'Cinta Reflectiva';
      if (rawOriginal.toLowerCase() === 'cordon' || rawOriginal.toLowerCase() === 'cordón') raw = 'Cordón de Ajuste';
      if (rawOriginal.toLowerCase() === 'ojaletes' || rawOriginal.toLowerCase() === 'ojalete') raw = 'Ojaletes Metálicos';
      if (rawOriginal.toLowerCase() === 'entretela' || rawOriginal.toLowerCase() === 'fusionado' || rawOriginal.toLowerCase() === 'fusionar') raw = 'Entretela Fusionable';
      if (rawOriginal.toLowerCase() === 'sesgo' || rawOriginal.toLowerCase() === 'vivo') raw = 'Sesgo / Vivo';
      if (rawOriginal.toLowerCase() === 'forro') raw = 'Tela Forro';
      if (rawOriginal.toLowerCase() === 'malla' || rawOriginal.toLowerCase() === 'mesh') raw = 'Malla Transpirable / Mesh';

      const key = raw.toLowerCase();
      const isTela = forceType ? (forceType === 'tela') : (key.includes('tela') || key.includes('forro') || key.includes('denim') || key.includes('dril') || key.includes('malla') || key.includes('mesh'));

      if (!map.has(key)) {
        map.set(key, {
          name: raw,
          type: isTela ? 'tela' : 'insumo',
          sourceParts: new Set<string>()
        });
      }
      map.get(key)!.sourceParts.add(partLabel);
    };

    // 1. Escanear SOLO partes configuradas
    const configuredParts = (this.allComponents || []).filter(c =>
      c && c.item_type === 'parte' && (!!c.selected_type_id || !!c.selected_type_name || !!c.technical_spec)
    );

    configuredParts.forEach((part) => {
      const partName = part.name || 'Parte';
      const types = part.types || [];

      let selectedVariant: any = null;
      if (part.selected_type_id) {
        selectedVariant = types.find((t: any) => Number(t.id) === Number(part.selected_type_id));
      }
      if (!selectedVariant && part.selected_type_name) {
        selectedVariant = types.find((t: any) => t.name === part.selected_type_name);
      }

      const partLabel = selectedVariant?.name ? `${partName} (${selectedVariant.name})` : partName;

      // Base materials for every garment part
      addMaterialToMap('Tela Principal', partLabel, 'tela');
      addMaterialToMap('Hilo de Confección', partLabel, 'insumo');

      // Check explicit materials configured on variant
      if (selectedVariant) {
        let mats: any[] = [];
        if (Array.isArray(selectedVariant.materials) && selectedVariant.materials.length > 0) {
          mats = selectedVariant.materials;
        } else if (typeof selectedVariant.materials === 'string' && selectedVariant.materials.trim()) {
          try {
            const parsed = JSON.parse(selectedVariant.materials);
            if (Array.isArray(parsed)) mats = parsed;
          } catch (e) { }
        }

        mats.forEach(m => {
          if (typeof m === 'string') addMaterialToMap(m, partLabel);
          else if (m && typeof m === 'object' && m.name) addMaterialToMap(m.name, partLabel, m.type);
        });
      }

      // Intelligent detection from text (part name, variant name, technical description, operations)
      const textCorpus = [
        part.name || '',
        part.client_spec || '',
        part.technical_spec || '',
        selectedVariant?.name || '',
        selectedVariant?.description || '',
        selectedVariant?.technical_description || '',
        ...(Array.isArray(selectedVariant?.operations) ? selectedVariant.operations.map((op: any) => `${op.name || ''} ${op.description || ''}`) : [])
      ].join(' ').toLowerCase();

      if (textCorpus.includes('cremallera') || textCorpus.includes('cierre') || textCorpus.includes('zipper')) {
        addMaterialToMap('Cremallera / Cierre', partLabel, 'insumo');
      }
      if (textCorpus.includes('botón') || textCorpus.includes('boton') || textCorpus.includes('botones') || textCorpus.includes('ojal') || textCorpus.includes('pechera')) {
        addMaterialToMap('Botones', partLabel, 'insumo');
      }
      if (textCorpus.includes('velcro') || textCorpus.includes('contacto') || textCorpus.includes('mágico') || textCorpus.includes('magico')) {
        addMaterialToMap('Velcro / Contacto', partLabel, 'insumo');
      }
      if (textCorpus.includes('broche') || textCorpus.includes('broches') || textCorpus.includes('presión') || textCorpus.includes('presion')) {
        addMaterialToMap('Broches Metálicos', partLabel, 'insumo');
      }
      if (textCorpus.includes('elástico') || textCorpus.includes('elastico') || textCorpus.includes('resorte') || textCorpus.includes('encauchado') || textCorpus.includes('encauchar')) {
        addMaterialToMap('Elástico', partLabel, 'insumo');
      }
      if (textCorpus.includes('reflectivo') || textCorpus.includes('reflectiva') || textCorpus.includes('reflejante') || textCorpus.includes('alta visibilidad')) {
        addMaterialToMap('Cinta Reflectiva', partLabel, 'insumo');
      }
      if (textCorpus.includes('cordón') || textCorpus.includes('cordon') || textCorpus.includes('reata') || textCorpus.includes('jareta')) {
        addMaterialToMap('Cordón de Ajuste', partLabel, 'insumo');
      }
      if (textCorpus.includes('ojalete') || textCorpus.includes('ojaletes') || textCorpus.includes('ojalillo')) {
        addMaterialToMap('Ojaletes Metálicos', partLabel, 'insumo');
      }
      if (textCorpus.includes('entretela') || textCorpus.includes('fusionado') || textCorpus.includes('fusionar') || textCorpus.includes('cuello') || textCorpus.includes('puño') || textCorpus.includes('puños')) {
        addMaterialToMap('Entretela Fusionable', partLabel, 'tela');
      }
      if (textCorpus.includes('sesgo') || textCorpus.includes('vivo') || textCorpus.includes('ribete')) {
        addMaterialToMap('Sesgo / Vivo', partLabel, 'insumo');
      }
      if (textCorpus.includes('forro') || textCorpus.includes('fondos') || textCorpus.includes('fondo bolsillo')) {
        addMaterialToMap('Tela Forro', partLabel, 'tela');
      }
      if (textCorpus.includes('malla') || textCorpus.includes('mesh') || textCorpus.includes('transpirable')) {
        addMaterialToMap('Malla Transpirable / Mesh', partLabel, 'tela');
      }
    });

    // 2. Incluir componentes de tipo tela o insumo agregados
    (this.allComponents || []).filter(c => c && (c.item_type === 'tela' || c.item_type === 'insumo')).forEach(mc => {
      addMaterialToMap(mc.name, mc.zone_name || 'General', mc.item_type as 'tela' | 'insumo');
    });

    return Array.from(map.values()).map(item => {
      const matchingComp = (this.allComponents || []).find(c =>
        c && (c.name || '').toLowerCase().trim() === item.name.toLowerCase().trim() &&
        (c.item_type === 'tela' || c.item_type === 'insumo')
      );
      const siesaException = matchingComp ? (this.context === 'comercial' ? matchingComp.client_material_exception || matchingComp.material_exception : matchingComp.material_exception) : null;
      const compComment = matchingComp ? (this.context === 'comercial' ? matchingComp.client_spec : matchingComp.technical_spec) || matchingComp.exception_comment : '';
      return {
        name: item.name,
        type: item.type,
        sourceParts: Array.from(item.sourceParts).sort(),
        comment: compComment || this.materialComments.get(item.name.toLowerCase()) || '',
        siesaRef: siesaException || this.materialSiesaRefs.get(item.name.toLowerCase()) || null,
        isExtra: false
      };
    });
  }

  trackByMaterialName = (index: number, mat: SpecConsolidatedMaterial): string => {
    return mat?.name || String(index);
  };

  // ─── Inline Material Picker (para agregar materiales adicionales directamente en diseño) ───

  get filteredPickerMaterials(): GenericMaterial[] {
    let list = this.masterMaterials || [];
    if (this.materialPickerTab !== 'all') {
      list = list.filter(m => m.type === this.materialPickerTab);
    }
    if (this.materialPickerSearch.trim()) {
      const q = this.materialPickerSearch.toLowerCase().trim();
      list = list.filter(m => m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q));
    }
    return list;
  }

  addPresetMaterial(preset: GenericMaterial): void {
    // Evitar duplicados en allComponents
    const alreadyExists = (this.allComponents || []).some(c =>
      c && (c.item_type === 'tela' || c.item_type === 'insumo') &&
      (c.name || '').toLowerCase().trim() === preset.name.toLowerCase().trim()
    );
    if (!alreadyExists) {
      // Emit through openAddModal to add as component via parent
      this.addMaterialAsComponent.emit({ name: preset.name, type: preset.type });
    }
    this.materialPickerSearch = '';
    this.showMaterialPicker = false;
  }

  addCustomMaterial(): void {
    const name = (this.manualCustomName?.trim() || this.materialPickerSearch?.trim());
    if (!name) return;
    this.addMaterialAsComponent.emit({ name, type: this.extraMaterialType });
    this.materialPickerSearch = '';
    this.manualCustomName = '';
    this.showMaterialPicker = false;
  }

  // ─── Material Actions (SIESA / Manual / Comment) ───

  updateMaterialComment(mat: SpecConsolidatedMaterial, comment: string): void {
    mat.comment = comment;
    this.materialComments.set(mat.name.toLowerCase(), comment);
    const comp = (this.allComponents || []).find(c =>
      c && (c.name || '').toLowerCase().trim() === mat.name.toLowerCase().trim() &&
      (c.item_type === 'tela' || c.item_type === 'insumo')
    );
    if (comp) {
      if (this.context === 'comercial') {
        comp.client_spec = comment;
      } else {
        comp.technical_spec = comment;
      }
      comp.exception_comment = comment;
    }
  }

  linkSiesaToMaterial(mat: SpecConsolidatedMaterial): void {
    let idx = (this.allComponents || []).findIndex(c =>
      c && (c.name || '').toLowerCase().trim() === mat.name.toLowerCase().trim() &&
      (c.item_type === 'tela' || c.item_type === 'insumo')
    );
    if (idx === -1) {
      this.allComponents.push({
        mold_part_id: null,
        name: mat.name.trim(),
        item_type: (mat.type === 'tela' ? 'tela' : 'insumo') as any,
        view: 'front',
        position_x: null,
        position_y: null,
        is_mandatory: false,
        client_spec: mat.comment || '',
        technical_spec: mat.comment || '',
        material_exception: null,
        client_material_exception: null,
        is_from_mold: false,
        is_expanded: false,
      });
      idx = this.allComponents.length - 1;
    }
    this.openSiesaForComponent.emit(idx);
  }

  linkManualToMaterial(mat: SpecConsolidatedMaterial): void {
    let idx = (this.allComponents || []).findIndex(c =>
      c && (c.name || '').toLowerCase().trim() === mat.name.toLowerCase().trim() &&
      (c.item_type === 'tela' || c.item_type === 'insumo')
    );
    if (idx === -1) {
      this.allComponents.push({
        mold_part_id: null,
        name: mat.name.trim(),
        item_type: (mat.type === 'tela' ? 'tela' : 'insumo') as any,
        view: 'front',
        position_x: null,
        position_y: null,
        is_mandatory: false,
        client_spec: mat.comment || '',
        technical_spec: mat.comment || '',
        material_exception: null,
        client_material_exception: null,
        is_from_mold: false,
        is_expanded: false,
      });
      idx = this.allComponents.length - 1;
    }
    this.openManualForComponent.emit(idx);
  }

  clearMaterialSiesa(mat: SpecConsolidatedMaterial): void {
    mat.siesaRef = null;
    this.materialSiesaRefs.delete(mat.name.toLowerCase());
    const idx = (this.allComponents || []).findIndex(c =>
      c && (c.name || '').toLowerCase().trim() === mat.name.toLowerCase().trim() &&
      (c.item_type === 'tela' || c.item_type === 'insumo')
    );
    if (idx >= 0) {
      this.allComponents[idx].material_exception = null;
      this.allComponents[idx].client_material_exception = null;
      this.onClearMaterialException.emit(idx);
    }
  }
}
