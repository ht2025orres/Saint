import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { MoldService, GenericMaterial } from '../../../services/mold.service';
import Swal from 'sweetalert2';

export interface ZoneConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  view: 'front' | 'back';
  zoneType: string;
  parts: any[];
  isCompleted: boolean;
}

@Component({
  selector: 'app-mold-opm-stepper',
  templateUrl: './mold-opm-stepper.component.html',
  styleUrls: ['./mold-opm-stepper.component.css']
})
export class MoldOpmStepperComponent implements OnInit, OnChanges {
  @Input() item: any;
  @Input() itemIndex: number = 0;
  @Output() onOpmSaved = new EventEmitter<any>();
  @Output() onChangeMold = new EventEmitter<void>();
  @Output() onRemoveMold = new EventEmitter<void>();

  loadingMold = false;
  mold: any = null;

  // === NAVEGACIÓN LIBRE POR ZONAS ===
  activeView: 'front' | 'back' = 'front';
  expandedZone: string | null = null; // Zona actualmente expandida (null = todas colapsadas)

  // Configuración de las zonas de diseño
  zones: ZoneConfig[] = [];

  // Almacenamiento de selecciones: [partId] -> mold_part_type
  selectedTypes: { [partId: number]: any } = {};

  // Observaciones por zona: [zoneId] -> string
  zoneObservations: { [zoneId: string]: string } = {};

  // Toggle opcional para diferenciar manga izquierda de manga derecha
  diferenciarMangas = false;

  // === PARTES GENERALES & APLIQUES OPCIONALES (Transversales) ===
  generalParts: any[] = [];
  selectedGeneralTypes: { [partId: number]: any } = {};
  showGeneralPartsModal = false;
  expandedGeneralPartIds = new Set<number>();
  generalPartsModalStep: 'select-part' | 'select-variant' = 'select-part';
  activeGeneralPartInModal: any = null;
  generalPartZoneAnchors: { [partId: number]: string } = {};
  originatingZoneId: string | null = null;

  // === MATERIALES Y EXTRAS OPCIONALES (CONGLOMERADO) ===
  availableMaterials: GenericMaterial[] = [];
  selectedExtras: { [materialId: string]: { active: boolean; notes: string } } = {};
  showManualExtras = false;
  materialNotes: { [matKey: string]: string } = {};

  // Vinculación opcional de materiales a SIESA (Bodega Insumos/Telas)
  materialSiesaBindings: {
    [matKey: string]: {
      id_item?: string;
      referencia: string;
      descripcion: string;
      color?: string;
      id_color?: string;
      existencias?: number;
      is_fabric?: boolean;
    }
  } = {};

  showInventorySearchModal = false;
  inventorySearchTargetMat: any = null;
  inventorySearchFilterType: 'todos' | 'tela' | 'insumo' = 'todos';

  activeSourceTooltip: string | null = null;

  // Estado OPM
  isSavingOpm = false;
  opmSuccess = false;
  generatedOpmCode = '';

  // Tallas disponibles
  tallasLetra: string[] = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
  tallasNumericas: string[] = ['28', '30', '32', '34', '36', '38', '40', '42'];
  selectedTallaToAdd: string = 'M';
  customTallaInput: string = '';

  // Visibilidad de modales flotantes independientes
  showExtrasSection = false;
  showFloatingZoneModal = false;
  showFloatingExtrasModal = false;
  activeFloatingZone: ZoneConfig | null = null;
  activePartInModal: any = null;
  modalStep: 'select-part' | 'select-variant' = 'select-part';

  constructor(private moldService: MoldService) {}

  ngOnInit(): void {
    const moldId = this.item?.moldId || this.item?.mold_id;
    if (moldId) {
      this.loadMoldData(moldId);
    }
    this.loadGenericMaterials();
    this.loadGeneralParts();
    this.recalculateConsolidatedMaterials();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item'] && !changes['item'].firstChange) {
      const prevMoldId = changes['item'].previousValue?.moldId || changes['item'].previousValue?.mold_id;
      const currentMoldId = this.item?.moldId || this.item?.mold_id;
      if (currentMoldId && currentMoldId !== prevMoldId) {
        this.loadMoldData(currentMoldId);
      }
    }
  }

  // ==================== CARGA DEL MOLDE ====================

  loadMoldData(moldId: number): void {
    this.loadingMold = true;
    this.moldService.getMold(moldId).subscribe({
      next: (res: any) => {
        this.loadingMold = false;
        if (res?.success && res?.data) {
          this.mold = res.data;
          this.buildDynamicZones();
          this.restoreExistingSelections();
          this.recalculateConsolidatedMaterials();
        }
      },
      error: (err: any) => {
        this.loadingMold = false;
        console.error('Error al cargar molde:', err);
      }
    });
  }

  /**
   * Carga los materiales genéricos del MoldService para la sección de Extras
   */
  loadGenericMaterials(): void {
    this.availableMaterials = this.moldService.getGenericMaterials();
    // Inicializar estado de cada material como desactivado
    this.availableMaterials.forEach(mat => {
      if (!this.selectedExtras[mat.id]) {
        this.selectedExtras[mat.id] = { active: false, notes: '' };
      }
    });
  }

  /**
   * Construye dinámicamente las zonas de diseño según las partes del molde.
   * Ya no es un stepper lineal, son zonas expandibles en cualquier orden.
   */
  buildDynamicZones(): void {
    if (!this.mold) return;

    const parts = this.mold.parts || [];

    const cuelloParts = parts.filter((p: any) => this.matchZone(p, 'cuello'));
    const pechoParts = parts.filter((p: any) => this.matchZone(p, 'pecho'));
    const mangaParts = parts.filter((p: any) => this.matchZone(p, 'manga'));
    const espaldaParts = parts.filter((p: any) => this.matchZone(p, 'espalda'));
    const pretinaParts = parts.filter((p: any) => this.matchZone(p, 'pretina'));

    this.zones = [
      {
        id: 'cuello',
        title: 'Cuello / Solapa',
        subtitle: 'Tipo de cuello y acabado',
        icon: 'bi-bullseye',
        view: 'front',
        zoneType: 'cuello',
        parts: cuelloParts,
        isCompleted: false
      },
      {
        id: 'pecho',
        title: 'Pechera y Delantero',
        subtitle: 'Cartera, botones y bolsillos',
        icon: 'bi-columns',
        view: 'front',
        zoneType: 'pecho',
        parts: pechoParts,
        isCompleted: false
      },
      {
        id: 'manga',
        title: 'Mangas y Puños',
        subtitle: 'Largo, puño y guardapolvo',
        icon: 'bi-layers',
        view: 'front',
        zoneType: 'manga',
        parts: mangaParts,
        isCompleted: false
      },
      {
        id: 'espalda',
        title: 'Espalda y Almilla',
        subtitle: 'Corte posterior y tablones',
        icon: 'bi-border-all',
        view: 'back',
        zoneType: 'espalda',
        parts: espaldaParts,
        isCompleted: false
      },
      {
        id: 'pretina',
        title: 'Cintura y Pretina',
        subtitle: 'Terminación inferior y botones',
        icon: 'bi-bounding-box-circles',
        view: 'front',
        zoneType: 'pretina',
        parts: pretinaParts,
        isCompleted: false
      }
    ];

    this.refreshZoneCompletion();
  }

  matchZone(partOrZone: any, zoneTarget: string): boolean {
    if (!partOrZone) return false;
    const name = (partOrZone.name || '').toLowerCase();
    const zoneName = (partOrZone.zone?.zone_type || partOrZone.zone?.name || partOrZone.zone_name || '').toLowerCase();
    const zoneType = (partOrZone.zone_type || '').toLowerCase();
    const code = (partOrZone.code || '').toLowerCase();

    const allText = `${name} ${zoneName} ${zoneType} ${code}`;

    if (zoneTarget === 'cuello') {
      return allText.includes('cuel') || allText.includes('solap') || allText.includes('collar') || allText.includes('cue');
    }
    if (zoneTarget === 'pecho') {
      return allText.includes('pech') || allText.includes('delan') || allText.includes('carter') || allText.includes('bolsill') ||
             allText.includes('frente') || allText.includes('botón') || allText.includes('boton') || allText.includes('cierre') ||
             allText.includes('car') || allText.includes('bol');
    }
    if (zoneTarget === 'manga') {
      return allText.includes('mang') || allText.includes('puñ') || allText.includes('sleeve') || allText.includes('mga');
    }
    if (zoneTarget === 'espalda') {
      return allText.includes('espal') || allText.includes('almill') || allText.includes('post') || allText.includes('tras') || allText.includes('esp');
    }
    if (zoneTarget === 'pretina') {
      return allText.includes('pret') || allText.includes('cint') || allText.includes('dobl') || allText.includes('rued') || allText.includes('bot') || allText.includes('prt');
    }
    return false;
  }

  /**
   * Consolida partes idénticas o gemelas (como manga izquierda y derecha) para que compartan selector.
   */
  getDisplayPartsForZone(zone: ZoneConfig): any[] {
    if (!zone || !zone.parts || zone.parts.length === 0) return [];

    // Si es manga y no se quieren diferenciar, agruparlas en un solo selector compartido
    if (zone.id === 'manga' && !this.diferenciarMangas) {
      const rep = { ...zone.parts[0], isConsolidated: true, siblingPartIds: zone.parts.map(p => p.id) };
      return [rep];
    }

    // Para cualquier otra zona (ej. cuello delantero/trasero o partes con el mismo nombre)
    const uniqueParts: any[] = [];
    const seenNames = new Set<string>();

    for (const part of zone.parts) {
      const cleanName = (part.name || '').toLowerCase().trim();
      if (!seenNames.has(cleanName)) {
        seenNames.add(cleanName);
        const siblings = zone.parts.filter(p => (p.name || '').toLowerCase().trim() === cleanName);
        uniqueParts.push({
          ...part,
          isConsolidated: siblings.length > 1,
          siblingPartIds: siblings.map(s => s.id)
        });
      }
    }

    return uniqueParts;
  }

  /**
   * Pines únicos en el figurín para evitar tener 2 pines de "MANGAS Y PUÑOS" en la misma vista.
   */
  get uniqueActiveZonesForPins(): any[] {
    const seen = new Map<string, any>();
    for (const zone of this.currentActiveZones) {
      const key = this.getZoneCanonicalKey(zone);
      if (!seen.has(key)) {
        seen.set(key, zone);
      }
    }
    return Array.from(seen.values());
  }

  getZoneCanonicalKey(zone: any): string {
    const allText = `${zone.zone_type || ''} ${zone.name || ''}`.toLowerCase();
    if (allText.includes('mang') || allText.includes('puñ')) return 'manga';
    if (allText.includes('cuel') || allText.includes('solap')) return 'cuello';
    if (allText.includes('pech') || allText.includes('delan') || allText.includes('carter')) return 'pecho';
    if (allText.includes('espal') || allText.includes('almill')) return 'espalda';
    if (allText.includes('pret') || allText.includes('cint')) return 'pretina';
    return zone.zone_type || zone.name || `z_${zone.id}`;
  }

  restoreExistingSelections(): void {
    if (this.item?.opmReference || this.item?.technicalSpecId) {
      this.generatedOpmCode = this.item.opmReference || `OPM-REG-${this.item.technicalSpecId}`;
      this.opmSuccess = true;
    }
  }

  // ==================== NAVEGACIÓN LIBRE POR ZONAS ====================

  /**
   * Abre el flotante pequeño para seleccionar variantes de una zona.
   * Si la zona tiene más de 1 parte, abre primero la lista de partes (Paso 1).
   * Si la zona tiene solo 1 parte, va directo a sus variantes (Paso 2).
   */
  openZoneModal(zoneId: string): void {
    const zone = this.zones.find(z => z.id === zoneId);
    if (!zone) return;
    this.activeFloatingZone = zone;
    this.expandedZone = zone.id;
    this.activeView = zone.view;

    const displayParts = this.getDisplayPartsForZone(zone);
    if (displayParts.length > 1) {
      // Tiene varias partes: Paso 1 (seleccionar qué parte configurar)
      this.modalStep = 'select-part';
      this.activePartInModal = null;
    } else {
      // Solo tiene 1 parte (o 0): entra directo a la variación
      this.modalStep = 'select-variant';
      this.activePartInModal = displayParts[0] || null;
    }

    this.showFloatingZoneModal = true;
  }

  choosePartToConfigure(part: any): void {
    this.activePartInModal = part;
    this.modalStep = 'select-variant';
  }

  backToPartsSelection(): void {
    this.activePartInModal = null;
    this.modalStep = 'select-part';
  }

  getZoneDisplayName(zone: any): string {
    const matched = this.zones.find(z => this.matchZone(zone, z.id));
    if (matched) return matched.title;
    const allText = `${zone.zone_type || ''} ${zone.name || ''}`.toLowerCase();
    if (allText.includes('mang')) return 'Mangas y Puños';
    if (allText.includes('pech') || allText.includes('delan')) return 'Pechera y Delantero';
    if (allText.includes('cuel') || allText.includes('solap')) return 'Cuello / Solapa';
    if (allText.includes('pret') || allText.includes('cint')) return 'Cintura y Pretina';
    if (allText.includes('espal')) return 'Espalda y Almilla';
    return zone.name || zone.zone_type || 'Zona';
  }

  getSelectedTypeForPart(part: any): any {
    if (!part) return null;
    if (this.selectedTypes[part.id]) return this.selectedTypes[part.id];
    if (part.siblingPartIds && Array.isArray(part.siblingPartIds)) {
      for (const pid of part.siblingPartIds) {
        if (this.selectedTypes[pid]) return this.selectedTypes[pid];
      }
    }
    return null;
  }

  closeZoneModal(): void {
    this.showFloatingZoneModal = false;
    this.activeFloatingZone = null;
    this.activePartInModal = null;
    this.modalStep = 'select-part';
    this.expandedZone = null;
  }

  isPartConfigured(part: any): boolean {
    if (!part) return false;
    if (this.selectedTypes[part.id]) return true;
    if (part.siblingPartIds && Array.isArray(part.siblingPartIds)) {
      return part.siblingPartIds.some((pid: number) => !!this.selectedTypes[pid]);
    }
    return false;
  }

  unselectTypeForPart(part: any): void {
    if (!part) return;
    if (part.siblingPartIds && Array.isArray(part.siblingPartIds)) {
      part.siblingPartIds.forEach((pid: number) => {
        delete this.selectedTypes[pid];
      });
    } else {
      delete this.selectedTypes[part.id];
    }
    this.refreshZoneCompletion();
    this.recalculateConsolidatedMaterials();
  }

  // ==================== PARTES GENERALES & APLIQUES OPCIONALES ====================

  loadGeneralParts(): void {
    const canonical = this.getCanonicalOptionalParts();
    this.moldService.getGarmentPartsByZone('general').subscribe({
      next: (res: any) => {
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          this.generalParts = canonical.map(canon => {
            const match = res.data.find((d: any) =>
              (d.code && d.code.toUpperCase() === canon.code) ||
              (d.name && d.name.toLowerCase().trim() === canon.name.toLowerCase().trim())
            );
            if (match) {
              return {
                ...canon,
                ...match,
                types: (match.types && match.types.length > 0) ? match.types : canon.types
              };
            }
            return canon;
          });
        } else {
          this.generalParts = canonical;
        }
        this.recalculateConsolidatedMaterials();
      },
      error: () => {
        this.generalParts = canonical;
        this.recalculateConsolidatedMaterials();
      }
    });
  }

  getCanonicalOptionalParts(): any[] {
    return [
      {
        id: 9100,
        code: 'BRG_FIG',
        name: 'Bragueta y Figurado',
        icon: 'bi-layout-sidebar',
        description: 'Bragueta delantera con aletilla, aletillón, cremallera o botones.',
        types: [
          { id: 9101, name: 'Bragueta con Cremallera y Aletilla Sencilla', technical_description: 'Bragueta con cremallera de nylon / metálica y aletilla reforzada', total_time: 1.85, is_default: true, materials: ['Cremallera / Cierre', 'Tela Principal', 'Hilo de Confección'] },
          { id: 9102, name: 'Bragueta con Botones y Aletillón Completo', technical_description: 'Bragueta tradicional con botones ocultos y aletillón protector', total_time: 2.20, materials: ['Botones', 'Tela Principal', 'Hilo de Confección'] }
        ]
      },
      {
        id: 9200,
        code: 'REF_ALTA_VIS',
        name: 'Cintas Reflectivas de Alta Visibilidad',
        icon: 'bi-stars',
        description: 'Cintas reflectivas de 2.5cm y 5cm de alta visibilidad en torso, espalda, mangas o botas.',
        types: [
          { id: 9201, name: 'Reflectivo Tipo Chaleco (Torso Delantero y Espalda 5cm)', technical_description: 'Cinta reflectiva de 5cm cosida horizontalmente en contorno de pecho y espalda', total_time: 1.25, is_default: true, materials: ['Cinta Reflectiva 5cm', 'Hilo de Confección'] },
          { id: 9202, name: 'Reflectivo Tipo Chaleco Doble (Doble Banda Torso)', technical_description: 'Dos bandas reflectivas horizontales paralelas en pecho y espalda', total_time: 1.90, materials: ['Cinta Reflectiva 5cm', 'Hilo de Confección'] },
          { id: 9203, name: 'Reflectivo Tipo Chaleco y Mangas (Brazos y Torso)', technical_description: 'Bandas reflectivas completas en contorno de torso y en ambas mangas', total_time: 2.10, materials: ['Cinta Reflectiva 2.5cm', 'Hilo de Confección'] },
          { id: 9204, name: 'Reflectivo en Botas (Contorno Piernas)', technical_description: 'Cintas reflectivas perimetrales de seguridad en la bota de ambas piernas', total_time: 1.00, materials: ['Cinta Reflectiva 2.5cm', 'Hilo de Confección'] }
        ]
      },
      {
        id: 9300,
        code: 'LOG_BOR',
        name: 'Logos, Bordados y Marquillas',
        icon: 'bi-gem',
        description: 'Bordados corporativos, termofijados, estampados y marquillas de identificación.',
        types: [
          { id: 9301, name: 'Bordado Pecho Izquierdo y Marquilla Cuello', technical_description: 'Logo corporativo bordado en delantero izquierdo y marquilla de talla/marca', total_time: 1.80, is_default: true, materials: ['Hilo de Bordado', 'Marquilla Tejida', 'Entretela Fusionable'] },
          { id: 9302, name: 'Estampado DTF / Vinilo Textil Espalda y Pecho', technical_description: 'Estampado termotransferible en delantero y espalda', total_time: 1.40, materials: ['Vinilo Textil / DTF'] },
          { id: 9303, name: 'Marquilla Tejida en Manga / Bota', technical_description: 'Marquilla corporativa sobrepuesta', total_time: 0.80, materials: ['Marquilla Tejida', 'Hilo de Confección'] }
        ]
      },
      {
        id: 9400,
        code: 'VIV_CON',
        name: 'Vivos y Contrastes Decorativos',
        icon: 'bi-palette',
        description: 'Detalles en contraste de color en cuello, carteras, sangrías o costados.',
        types: [
          { id: 9401, name: 'Vivos en Contraste Cuello y Carteras', technical_description: 'Insertos de tela en color de contraste en solapa y carteras', total_time: 1.10, is_default: true, materials: ['Tela Contraste', 'Hilo de Confección'] },
          { id: 9402, name: 'Sesgo Doble Doblado en Bordes y Puños', technical_description: 'Sesgo sobrepuesto decorativo en perfiles', total_time: 1.30, materials: ['Sesgo / Vivo', 'Hilo de Confección'] }
        ]
      }
    ];
  }

  openGeneralPartsModal(): void {
    this.generalPartsModalStep = 'select-part';
    this.activeGeneralPartInModal = null;
    this.showGeneralPartsModal = true;
  }

  closeGeneralPartsModal(): void {
    const returnToZoneId = this.originatingZoneId;
    this.showGeneralPartsModal = false;
    this.activeGeneralPartInModal = null;
    this.generalPartsModalStep = 'select-part';
    this.originatingZoneId = null;

    if (returnToZoneId) {
      this.openZoneModal(returnToZoneId);
    }
  }

  chooseGeneralPartToConfigure(part: any): void {
    this.activeGeneralPartInModal = part;
    this.generalPartsModalStep = 'select-variant';
    // Si se abrió desde una zona y aún no tiene anclaje asignado, anclar por defecto a esa zona
    if (this.originatingZoneId && !this.generalPartZoneAnchors[part.id]) {
      this.generalPartZoneAnchors[part.id] = this.originatingZoneId;
    }
  }

  backToGeneralPartsList(): void {
    this.activeGeneralPartInModal = null;
    this.generalPartsModalStep = 'select-part';
  }

  toggleGeneralPart(part: any): void {
    const key = part.id;
    if (this.expandedGeneralPartIds.has(key)) {
      this.expandedGeneralPartIds.delete(key);
    } else {
      this.expandedGeneralPartIds.add(key);
    }
  }

  isGeneralPartExpanded(part: any): boolean {
    return this.expandedGeneralPartIds.has(part.id);
  }

  selectGeneralVariant(part: any, variant: any): void {
    if (this.selectedGeneralTypes[part.id]?.id === variant.id) {
      delete this.selectedGeneralTypes[part.id];
    } else {
      this.selectedGeneralTypes[part.id] = variant;
      // Si se originó desde una zona, asegurar que quede anclada
      if (this.originatingZoneId && !this.generalPartZoneAnchors[part.id]) {
        this.generalPartZoneAnchors[part.id] = this.originatingZoneId;
      }
      // Si venía desde una zona, retornar a la zona modal; de lo contrario volver a la lista general
      setTimeout(() => {
        if (this.originatingZoneId) {
          this.closeGeneralPartsModal();
        } else {
          this.backToGeneralPartsList();
        }
      }, 300);
    }
    this.recalculateConsolidatedMaterials();
  }

  removeGeneralVariant(part: any): void {
    delete this.selectedGeneralTypes[part.id];
    this.recalculateConsolidatedMaterials();
  }

  anchorGeneralPartToZone(partId: number, zoneId: string): void {
    if (this.generalPartZoneAnchors[partId] === zoneId) {
      delete this.generalPartZoneAnchors[partId];
    } else {
      this.generalPartZoneAnchors[partId] = zoneId;
    }
  }

  unanchorGeneralPart(partId: number): void {
    delete this.generalPartZoneAnchors[partId];
  }

  getAnchoredGeneralPartsForZone(zoneId: string): any[] {
    return this.generalParts.filter(p =>
      this.generalPartZoneAnchors[p.id] === zoneId && this.selectedGeneralTypes[p.id]
    );
  }

  openGeneralPartsFromZone(): void {
    if (this.activeFloatingZone) {
      this.originatingZoneId = this.activeFloatingZone.id;
      this.showFloatingZoneModal = false;
      this.generalPartsModalStep = 'select-part';
      this.activeGeneralPartInModal = null;
      this.showGeneralPartsModal = true;
    }
  }

  isGeneralVariantSelected(part: any, variant: any): boolean {
    return this.selectedGeneralTypes[part.id]?.id === variant.id;
  }

  get activeGeneralPartsCount(): number {
    return Object.keys(this.selectedGeneralTypes).length;
  }

  getZoneTitle(zoneId: string): string {
    const zone = this.zones.find(z => z.id === zoneId);
    return zone ? zone.title : zoneId;
  }

  // ==================== CONGLOMERADO DE MATERIALES ====================

  consolidatedMaterials: { name: string; type: 'tela' | 'insumo'; sourceParts: string[]; notes: string }[] = [];
  consolidatedTelas: { name: string; type: 'tela' | 'insumo'; sourceParts: string[]; notes: string }[] = [];
  consolidatedInsumos: { name: string; type: 'tela' | 'insumo'; sourceParts: string[]; notes: string }[] = [];
  consolidatedCount = { telas: 0, insumos: 0 };

  openExtrasModal(): void {
    this.recalculateConsolidatedMaterials();
    this.showFloatingExtrasModal = true;
  }

  closeExtrasModal(): void {
    this.showFloatingExtrasModal = false;
  }

  recalculateConsolidatedMaterials(): void {
    const map = new Map<string, { name: string; type: 'tela' | 'insumo'; sourceParts: Set<string>; notes: string }>();

    const addMat = (matName: string, source: string, forceType?: 'tela' | 'insumo') => {
      const trimmed = (matName || '').trim();
      if (!trimmed) return;
      let name = trimmed;
      if (name.toLowerCase() === 'tela') name = 'Tela Principal';
      if (name.toLowerCase() === 'hilo') name = 'Hilo de Confección';
      if (name.toLowerCase() === 'botones' || name.toLowerCase() === 'botón' || name.toLowerCase() === 'boton') name = 'Botones';
      if (name.toLowerCase() === 'cremallera' || name.toLowerCase() === 'cierre' || name.toLowerCase() === 'zipper') name = 'Cremallera / Cierre';
      if (name.toLowerCase() === 'velcro' || name.toLowerCase() === 'contacto') name = 'Velcro / Contacto';
      if (name.toLowerCase() === 'elástico' || name.toLowerCase() === 'elastico') name = 'Elástico';

      const key = name.toLowerCase();
      const isTela = forceType ? (forceType === 'tela') : (key.includes('tela') || key.includes('forro') || key.includes('malla') || key.includes('mesh') || key.includes('denim') || key.includes('dril'));
      const type: 'tela' | 'insumo' = isTela ? 'tela' : 'insumo';

      if (!map.has(key)) {
        map.set(key, { name, type, sourceParts: new Set<string>(), notes: '' });
      }
      map.get(key)!.sourceParts.add(source);
    };

    // 1. Base fija para prenda
    addMat('Tela Principal', 'Cuerpo / Prenda Base', 'tela');
    addMat('Hilo de Confección', 'Costura y Ensamble', 'insumo');

    // 2. Extraer de partes de Zonas
    for (const zone of this.zones) {
      for (const part of zone.parts) {
        const selVariant = this.selectedTypes[part.id];
        if (selVariant) {
          const sourceName = `${zone.title} (${selVariant.name})`;
          if (Array.isArray(selVariant.materials)) {
            selVariant.materials.forEach((m: any) => {
              if (typeof m === 'string') addMat(m, sourceName);
              else if (m?.name) addMat(m.name, sourceName, m.type);
            });
          }
          const text = `${part.name} ${selVariant.name || ''} ${selVariant.technical_description || ''} ${selVariant.description || ''}`.toLowerCase();
          if (text.includes('botón') || text.includes('botones') || text.includes('pechera') || text.includes('ojal')) addMat('Botones', sourceName, 'insumo');
          if (text.includes('cremallera') || text.includes('cierre') || text.includes('zipper')) addMat('Cremallera / Cierre', sourceName, 'insumo');
          if (text.includes('velcro') || text.includes('contacto')) addMat('Velcro / Contacto', sourceName, 'insumo');
          if (text.includes('elástico') || text.includes('elastico') || text.includes('resorte')) addMat('Elástico', sourceName, 'insumo');
          if (text.includes('cuello') || text.includes('puño') || text.includes('fusionado')) addMat('Entretela Fusionable', sourceName, 'tela');
          if (text.includes('broche')) addMat('Broches Metálicos', sourceName, 'insumo');
          if (text.includes('cordón') || text.includes('cordon')) addMat('Cordón de Ajuste', sourceName, 'insumo');
          if (text.includes('sesgo') || text.includes('vivo')) addMat('Sesgo / Vivo', sourceName, 'insumo');
        }
      }
    }

    // 3. Extraer de Partes Generales seleccionadas
    for (const part of this.generalParts) {
      const selVariant = this.selectedGeneralTypes[part.id];
      if (selVariant) {
        const sourceName = `Aplique: ${part.name} (${selVariant.name})`;
        if (Array.isArray(selVariant.materials)) {
          selVariant.materials.forEach((m: any) => {
            if (typeof m === 'string') addMat(m, sourceName);
            else if (m?.name) addMat(m.name, sourceName, m.type);
          });
        }
        const text = `${part.name} ${selVariant.name || ''}`.toLowerCase();
        if (text.includes('reflectiv')) addMat('Cinta Reflectiva de Seguridad', sourceName, 'insumo');
        if (text.includes('bordad')) addMat('Hilo de Bordado / Hiladilla', sourceName, 'insumo');
        if (text.includes('marquilla')) addMat('Marquilla Tejida Identificativa', sourceName, 'insumo');
        if (text.includes('estampad') || text.includes('dtf') || text.includes('vinilo')) addMat('Vinilo Textil / DTF Termotransferible', sourceName, 'insumo');
        if (text.includes('vivo') || text.includes('sesgo')) addMat('Sesgo / Vivo Decorativo', sourceName, 'insumo');
        if (text.includes('contraste')) addMat('Tela Contraste de Color', sourceName, 'tela');
        if (text.includes('cremallera')) addMat('Cremallera / Cierre', sourceName, 'insumo');
        if (text.includes('botón') || text.includes('botones')) addMat('Botones', sourceName, 'insumo');
      }
    }

    // 4. Extras manuales activos
    this.getActiveMaterials().forEach(mat => {
      addMat(mat.name, 'Adicional Opcional', mat.type);
    });

    this.consolidatedMaterials = Array.from(map.values()).map(m => ({
      name: m.name,
      type: m.type,
      sourceParts: Array.from(m.sourceParts),
      notes: this.materialNotes[m.name.toLowerCase()] || ''
    }));

    this.consolidatedTelas = this.consolidatedMaterials.filter(m => m.type === 'tela');
    this.consolidatedInsumos = this.consolidatedMaterials.filter(m => m.type === 'insumo');
    this.consolidatedCount = {
      telas: this.consolidatedTelas.length,
      insumos: this.consolidatedInsumos.length
    };
  }

  // ==================== VINCULACIÓN CON INVENTARIO SIESA (BODEGA INSUMOS/TELAS) ====================

  openInventoryModalForMaterial(mat: any): void {
    this.inventorySearchTargetMat = mat;
    this.inventorySearchFilterType = mat.type === 'tela' ? 'tela' : 'insumo';
    this.showInventorySearchModal = true;
  }

  closeInventoryModal(): void {
    this.showInventorySearchModal = false;
    this.inventorySearchTargetMat = null;
  }

  onSelectInventoryItem(siesaItem: any): void {
    if (this.inventorySearchTargetMat) {
      const key = this.inventorySearchTargetMat.name.toLowerCase();
      this.materialSiesaBindings[key] = {
        id_item: siesaItem.id_item || siesaItem.referencia,
        referencia: siesaItem.referencia,
        descripcion: siesaItem.descripcion,
        color: siesaItem.color || '',
        id_color: siesaItem.id_color || '',
        existencias: siesaItem.existencias !== undefined ? siesaItem.existencias : undefined,
        is_fabric: !!siesaItem.is_fabric
      };
    }
    this.closeInventoryModal();
  }

  clearMaterialSiesa(matName: string): void {
    const key = matName.toLowerCase();
    delete this.materialSiesaBindings[key];
  }

  toggleSourceTooltip(matName: string): void {
    this.activeSourceTooltip = this.activeSourceTooltip === matName ? null : matName;
  }

  trackByMatName(index: number, item: any): string {
    return item ? item.name : String(index);
  }

  toggleZone(zoneId: string): void {
    this.openZoneModal(zoneId);
  }

  /**
   * Clic en una zona SVG o en un punto del figurín → abre el flotante pequeño
   */
  onZoneSvgClick(moldZone: any): void {
    const matchedZone = this.zones.find(z => this.matchZone(moldZone, z.id));
    if (matchedZone) {
      this.openZoneModal(matchedZone.id);
    }
  }

  isZoneReadyOrSelected(moldZone: any): boolean {
    const matched = this.zones.find(z => this.matchZone(moldZone, z.id));
    if (!matched) return false;
    return matched.isCompleted || this.expandedZone === matched.id;
  }

  getSelectedTypeNameForZone(zone: ZoneConfig): string {
    if (!zone?.parts || zone.parts.length === 0) return '';
    for (const p of zone.parts) {
      if (this.selectedTypes[p.id]) {
        return this.selectedTypes[p.id].name;
      }
    }
    return '';
  }

  toggleViewManual(): void {
    this.activeView = this.activeView === 'front' ? 'back' : 'front';
  }

  getExpandedZoneTitle(): string {
    if (!this.expandedZone) return '';
    const zone = this.zones.find(z => z.id === this.expandedZone);
    return zone ? zone.title : '';
  }

  /**
   * Actualiza el estado de completitud de cada zona.
   * Una zona está completa si al menos una de sus partes tiene una selección.
   */
  refreshZoneCompletion(): void {
    this.zones.forEach(zone => {
      if (zone.parts.length === 0) {
        zone.isCompleted = false;
      } else {
        zone.isCompleted = zone.parts.some((p: any) => !!this.selectedTypes[p.id]);
      }
    });
  }

  get completedZonesCount(): number {
    return this.zones.filter(z => z.isCompleted).length;
  }

  get totalZonesCount(): number {
    return this.zones.length;
  }

  get activeExtrasCount(): number {
    return Object.values(this.selectedExtras).filter(e => e.active).length;
  }

  selectTypeForPart(part: any, type: any): void {
    // Si la parte tiene hermanas consolidadas, asignar a todas
    if (part.siblingPartIds && Array.isArray(part.siblingPartIds)) {
      part.siblingPartIds.forEach((pid: number) => {
        this.selectedTypes[pid] = type;
      });
    } else {
      this.selectedTypes[part.id] = type;
    }

    // Si es manga y no se diferencian, asegurar que todas las partes de manga queden sincronizadas
    if (this.activeFloatingZone?.id === 'manga' && !this.diferenciarMangas) {
      this.activeFloatingZone.parts.forEach(p => {
        this.selectedTypes[p.id] = type;
      });
    }

    // Si es cuello, asegurar que las partes de cuello (frente/espalda) compartan el mismo selector
    if (this.activeFloatingZone?.id === 'cuello') {
      this.activeFloatingZone.parts.forEach(p => {
        this.selectedTypes[p.id] = type;
      });
    }

    this.refreshZoneCompletion();
    this.recalculateConsolidatedMaterials();

    // Auto-close the zone modal after selecting a variant
    setTimeout(() => {
      this.closeZoneModal();
    }, 300);
  }

  isTypeSelected(partId: number, typeId: number): boolean {
    return this.selectedTypes[partId]?.id === typeId;
  }

  // Helper para distinguir partes de cartera vs bolsillos en zona Pecho
  isCarteraPart(part: any): boolean {
    const name = (part.name || '').toLowerCase();
    return name.includes('cartera') || name.includes('cierre') || name.includes('botón');
  }

  isBolsilloPart(part: any): boolean {
    const name = (part.name || '').toLowerCase();
    return name.includes('bolsillo');
  }

  // ==================== MATERIALES Y EXTRAS ====================

  toggleExtra(materialId: string): void {
    if (this.selectedExtras[materialId]) {
      this.selectedExtras[materialId].active = !this.selectedExtras[materialId].active;
      this.recalculateConsolidatedMaterials();
    }
  }

  isExtraActive(materialId: string): boolean {
    return this.selectedExtras[materialId]?.active || false;
  }

  getActiveMaterials(): GenericMaterial[] {
    return this.availableMaterials.filter(m => this.selectedExtras[m.id]?.active);
  }

  get telaMaterials(): GenericMaterial[] {
    return this.availableMaterials.filter(m => m.type === 'tela');
  }

  get insumoMaterials(): GenericMaterial[] {
    return this.availableMaterials.filter(m => m.type === 'insumo');
  }

  // ==================== CÁLCULO DE TIEMPO SAM ====================

  get totalSamTime(): number {
    let total = 0;
    // Zonas estructurales
    Object.values(this.selectedTypes).forEach((type: any) => {
      if (type?.total_time) {
        total += parseFloat(type.total_time) || 0;
      }
    });
    // Partes Generales y Apliques
    Object.values(this.selectedGeneralTypes).forEach((type: any) => {
      if (type?.total_time) {
        total += parseFloat(type.total_time) || 0;
      }
    });
    return parseFloat(total.toFixed(2));
  }

  getSamForPart(partId: number): number {
    return parseFloat(this.selectedTypes[partId]?.total_time || 0);
  }

  // ==================== ILUSTRACIÓN Y ZONAS SVG ====================

  imageLoadError: { front?: boolean; back?: boolean } = {};

  get activeImageUrl(): string {
    if (this.imageLoadError[this.activeView]) {
      return this.activeView === 'back' ? 'assets/garments/camisa_back.png' : 'assets/garments/camisa.png';
    }
    if (!this.mold) {
      return this.activeView === 'back' ? 'assets/garments/camisa_back.png' : 'assets/garments/camisa.png';
    }
    if (this.activeView === 'back') {
      return this.mold.back_image_signed_url || this.mold.back_image_url || 'assets/garments/camisa_back.png';
    }
    return this.mold.image_signed_url || this.mold.front_image_signed_url || this.mold.front_image_url || 'assets/garments/camisa.png';
  }

  onImageError(): void {
    this.imageLoadError[this.activeView] = true;
  }

  get currentActiveZones(): any[] {
    if (!this.mold?.zones) return [];
    return this.mold.zones.filter((z: any) => ((z.view || 'front').toLowerCase() === this.activeView));
  }

  isZoneHighlighted(zone: any): boolean {
    if (!this.expandedZone) return false;
    return this.matchZone(zone, this.expandedZone);
  }

  isZoneCompletedByObj(moldZone: any): boolean {
    const matched = this.zones.find(z => this.matchZone(moldZone, z.id));
    return matched ? matched.isCompleted : false;
  }

  getPolygonPoints(points?: any): string {
    let pts = points;
    if (typeof pts === 'string') {
      try {
        pts = JSON.parse(pts);
      } catch (e) {
        pts = [];
      }
    }
    if (!Array.isArray(pts) || pts.length === 0) return '';
    return pts.map((p: any) => `${parseFloat(p.x) || 0},${parseFloat(p.y) || 0}`).join(' ');
  }

  getZoneCenter(zone: any): { x: number; y: number } {
    let pts = zone.path_data;
    if (typeof pts === 'string') {
      try {
        pts = JSON.parse(pts);
      } catch (e) {
        pts = null;
      }
    }
    if (Array.isArray(pts) && pts.length > 0) {
      const sumX = pts.reduce((acc: number, p: any) => acc + (parseFloat(p.x) || 0), 0);
      const sumY = pts.reduce((acc: number, p: any) => acc + (parseFloat(p.y) || 0), 0);
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

  getZoneIcon(zoneType?: string): string {
    const t = (zoneType || '').toLowerCase();
    if (t.includes('cue') || t.includes('sol')) return 'bi-bullseye';
    if (t.includes('pech') || t.includes('delan') || t.includes('car') || t.includes('bol')) return 'bi-columns';
    if (t.includes('man') || t.includes('puñ')) return 'bi-layers';
    if (t.includes('esp') || t.includes('alm')) return 'bi-border-all';
    if (t.includes('pret') || t.includes('cin') || t.includes('bot')) return 'bi-bounding-box-circles';
    return 'bi-bounding-box';
  }

  getZoneColor(zoneType?: string): string {
    const t = (zoneType || '').toLowerCase();
    if (t.includes('cue')) return '#6366f1';
    if (t.includes('pech') || t.includes('delan')) return '#0ea5e9';
    if (t.includes('man')) return '#8b5cf6';
    if (t.includes('esp')) return '#f59e0b';
    if (t.includes('pret') || t.includes('cin')) return '#10b981';
    return '#64748b';
  }

  // ==================== TALLAS Y CANTIDADES ====================

  addTallaPreset(tallaStr: string): void {
    if (!this.item.tallas) this.item.tallas = [];
    const existing = this.item.tallas.find((t: any) => t.talla === tallaStr);
    if (!existing) {
      this.item.tallas.push({ talla: tallaStr, cantidad: 1 });
    }
  }

  addCustomTalla(): void {
    const t = this.customTallaInput.trim().toUpperCase();
    if (!t) return;
    this.addTallaPreset(t);
    this.customTallaInput = '';
  }

  removeTalla(index: number): void {
    if (this.item.tallas) {
      this.item.tallas.splice(index, 1);
    }
  }

  getItemTotal(): number {
    if (!this.item?.tallas) return 0;
    return this.item.tallas.reduce((acc: number, t: any) => acc + (parseInt(t.cantidad, 10) || 0), 0);
  }

  // ==================== GENERACIÓN FINAL DE OPM ====================

  generarOpmFinal(): void {
    if (!this.mold) return;

    if (!this.item.tallas || this.item.tallas.length === 0 || this.getItemTotal() <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan tallas y cantidades',
        text: 'Por favor asigna al menos una talla con cantidad mayor a cero antes de generar la OPM.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    this.isSavingOpm = true;

    // Estructurar el array de partes para TechnicalSpecController
    const partsPayload: any[] = [];

    this.zones.forEach(zone => {
      const zoneObs = this.zoneObservations[zone.id] || '';

      zone.parts.forEach(part => {
        const selType = this.selectedTypes[part.id];
        partsPayload.push({
          mold_part_id: part.id,
          mold_part_type_id: selType ? selType.id : null,
          selected_type_name: selType ? selType.name : null,
          name: part.name,
          zone_name: zone.title,
          item_type: 'parte',
          technical_spec: selType
            ? (selType.technical_description || selType.name)
            : part.name,
          client_spec: zoneObs,
          estimated_time: selType ? (selType.total_time || 0) : 0,
          position_x: part.position_x,
          position_y: part.position_y,
          inventory_reference: null,
          inventory_description: null,
        });
      });
    });

    // Agregar partes generales/apliques seleccionados al payload
    // NOTA: Los IDs de variantes de partes generales vienen de garment_part_types (o son canónicos ficticios),
    // NO de mold_part_types. El FK constraint de technical_spec_parts apunta a mold_part_types,
    // por lo que mold_part_type_id DEBE ser null para evitar violación de FK.
    const generalPartsPayload = Object.entries(this.selectedGeneralTypes).map(([partIdStr, selType]: [string, any]) => {
      const partId = Number(partIdStr);
      const part = this.generalParts.find(p => p.id === partId) || { name: selType.name };
      const anchorZone = this.generalPartZoneAnchors[partId] || null;
      return {
        mold_part_id: null,
        mold_part_type_id: null,
        selected_type_name: selType.name,
        name: part.name,
        zone_name: anchorZone,
        item_type: 'parte_general',
        technical_spec: selType.technical_description || selType.name,
        client_spec: '',
        estimated_time: selType.total_time || 0,
        position_x: null,
        position_y: null,
        inventory_reference: null,
        inventory_description: null,
      };
    });

    // Agregar materiales del conglomerado / extras al payload
    const consolidatedPayload = this.consolidatedMaterials.map(mat => {
      const key = mat.name.toLowerCase();
      const siesa = this.materialSiesaBindings[key];
      const note = this.materialNotes[key] || mat.notes || '';
      const siesaDesc = siesa
        ? `${siesa.descripcion}${siesa.color ? ' (Color: ' + siesa.color + ')' : ''}`
        : null;
      return {
        name: mat.name,
        selected_type_name: siesa ? siesa.referencia : mat.type,
        zone_name: mat.sourceParts.join(', '),
        item_type: 'material',
        technical_spec: siesa
          ? `[SIESA: ${siesa.referencia}] ${siesaDesc}`
          : `Origen: ${mat.sourceParts.join(', ')}`,
        client_spec: note,
        estimated_time: 0,
        inventory_reference: siesa ? siesa.referencia : null,
        inventory_description: siesaDesc || (note || null),
        position_x: null,
        position_y: null,
      };
    });

    const payload = {
      mold_id: this.mold.id,
      description: `OPM Muestra - ${this.item.descripcion || this.item.item_cliente || this.mold.name}`,
      technical_description: `Molde: ${this.mold.name}. Tiempo SAM estimado: ${this.totalSamTime} min.`,
      parts: [...partsPayload, ...generalPartsPayload, ...consolidatedPayload],
    };

    this.moldService.createTechnicalSpec(payload).subscribe({
      next: (res: any) => {
        this.isSavingOpm = false;
        if (res?.success && res?.data) {
          const spec = res.data;
          this.opmSuccess = true;
          this.generatedOpmCode = spec.reference;
          this.item.technicalSpecId = spec.id;
          this.item.technical_spec_id = spec.id;
          this.item.opmReference = spec.reference;
          this.item.opm_reference = spec.reference;
          this.item.moldId = this.mold.id;
          this.item.mold_id = this.mold.id;
          this.item.totalSamTime = this.totalSamTime;

          Swal.fire({
            icon: 'success',
            title: '¡OPM Generada Exitosamente!',
            html: `Se ha registrado la ficha técnica <strong>${spec.reference}</strong> vinculada a este ítem con un tiempo SAM de <strong>${this.totalSamTime} min</strong>.`,
            confirmButtonColor: '#4f46e5'
          });

          this.onOpmSaved.emit({
            itemIndex: this.itemIndex,
            technicalSpecId: spec.id,
            reference: spec.reference,
            samTime: this.totalSamTime,
            tallas: this.item.tallas,
          });
        }
      },
      error: (err: any) => {
        this.isSavingOpm = false;
        console.error('Error al generar OPM:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error al generar OPM',
          text: err.error?.error || err.message || 'No se pudo registrar la OPM en pruebas.',
          confirmButtonColor: '#ef4444'
        });
      }
    });
  }
}
