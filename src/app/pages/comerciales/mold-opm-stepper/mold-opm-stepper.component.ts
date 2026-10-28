import { Component, Input, Output, EventEmitter, OnInit, OnChanges, DoCheck, OnDestroy, SimpleChanges } from '@angular/core';
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
export class MoldOpmStepperComponent implements OnInit, OnChanges, DoCheck, OnDestroy {
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
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  autoSaveTimer: any = null;

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

  loadedMoldId: number | null = null;
  private cachedSpecPartsForRestoration: any[] = [];

  constructor(private moldService: MoldService) {}

  ngOnInit(): void {
    const moldId = this.item?.moldId || this.item?.mold_id;
    if (moldId) {
      this.loadedMoldId = moldId;
      this.loadMoldData(moldId);
    }
    this.loadGenericMaterials();
    this.loadGeneralParts();
    this.recalculateConsolidatedMaterials();
  }

  ngOnDestroy(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  triggerAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveStatus = 'saving';
    this.autoSaveTimer = setTimeout(() => {
      this.generarOpmFinal(true);
    }, 600);
  }

  ngOnChanges(changes: SimpleChanges): void {
    const currentMoldId = this.item?.moldId || this.item?.mold_id;
    if (currentMoldId && currentMoldId !== this.loadedMoldId) {
      this.cambiarAMolde(currentMoldId);
    }
  }

  ngDoCheck(): void {
    const currentMoldId = this.item?.moldId || this.item?.mold_id;
    if (currentMoldId && currentMoldId !== this.loadedMoldId) {
      this.cambiarAMolde(currentMoldId);
    }
  }

  cambiarAMolde(moldId: number): void {
    this.loadedMoldId = moldId;
    this.selectedTypes = {};
    this.zoneObservations = {};
    this.activeFloatingZone = null;
    this.showFloatingZoneModal = false;
    this.showGeneralPartsModal = false;
    this.showInventorySearchModal = false;
    this.opmSuccess = false;
    this.generatedOpmCode = '';
    this.loadMoldData(moldId);
  }

  // ==================== CARGA DEL MOLDE ====================

  loadMoldData(moldId: number): void {
    this.loadingMold = true;
    this.mold = null; // Limpiar molde previo para evitar mezclas visuales
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
  /**
   * Determina la familia anatómica del molde cargado (SUPERIOR, INFERIOR, COMPLETA o GENERAL)
   */
  get anatomicalFamily(): 'SUPERIOR' | 'INFERIOR' | 'COMPLETA' | 'GENERAL' {
    if (!this.mold) return 'SUPERIOR';
    const catName = (this.mold.category?.name || this.item?.categoryName || '').toUpperCase();
    const moldName = (this.mold.name || this.item?.moldName || '').toUpperCase();
    const text = `${catName} ${moldName}`;

    if (text.includes('OVEROL') || text.includes('ENTERIZO') || text.includes('MAMELUCO') || text.includes('TRAJE')) {
      return 'COMPLETA';
    }
    if (text.includes('PANTALON') || text.includes('PANTALÓN') || text.includes('BERMUDA') || 
        text.includes('JEAN') || text.includes('FALDA') || text.includes('SHORT') || text.includes('JOGGER')) {
      return 'INFERIOR';
    }
    if (text.includes('CAMISA') || text.includes('POLO') || text.includes('CHAQUETA') || 
        text.includes('CHALECO') || text.includes('BLUSA') || text.includes('CAMISETA') || 
        text.includes('CAMIBUSO') || text.includes('SUETER') || text.includes('CHOMPA')) {
      return 'SUPERIOR';
    }
    const catId = this.mold.mold_category_id || this.mold.category_id || this.mold.id_product_category;
    if (catId === 1 || catId === 3) return 'SUPERIOR';
    if (catId === 4) return 'INFERIOR';
    if (catId === 2) return 'COMPLETA';
    return 'SUPERIOR';
  }

  /**
   * Construye dinámicamente las zonas de diseño según la anatomía real de la prenda
   * y las partes que efectivamente están habilitadas/configuradas en el molde.
   */
  buildDynamicZones(): void {
    if (!this.mold) return;

    const parts = this.mold.parts || [];
    const family = this.anatomicalFamily;
    const moldNameUpper = (this.mold.name || '').toUpperCase();
    const hasCapucha = moldNameUpper.includes('CAPUCHA') || moldNameUpper.includes('CAPOTA');

    let candidateZones: ZoneConfig[] = [];

    if (family === 'INFERIOR') {
      candidateZones = [
        {
          id: 'pretina',
          title: 'Pretina & Pasadores',
          subtitle: 'Tipo de pretina, elásticos y pasadores',
          icon: 'bi-bounding-box-circles',
          view: 'front',
          zoneType: 'pretina',
          parts: [],
          isCompleted: false
        },
        {
          id: 'tiro',
          title: 'Tiro & Bragueta',
          subtitle: 'Bragueta, tiro y cierre frontal',
          icon: 'bi-arrows-collapse',
          view: 'front',
          zoneType: 'tiro',
          parts: [],
          isCompleted: false
        },
        {
          id: 'bolsillo_del',
          title: 'Bolsillos Laterales',
          subtitle: 'Bolsillos delanteros, diagonales o relojera',
          icon: 'bi-columns',
          view: 'front',
          zoneType: 'bolsillo_del',
          parts: [],
          isCompleted: false
        },
        {
          id: 'bolsillo_tras',
          title: 'Bolsillos Traseros',
          subtitle: 'Bolsillos posteriores, de ribete o parche',
          icon: 'bi-border-all',
          view: 'back',
          zoneType: 'bolsillo_tras',
          parts: [],
          isCompleted: false
        },
        {
          id: 'bota',
          title: 'Bota & Ruedo',
          subtitle: 'Bota recta, bota tubo y dobladillo inferior',
          icon: 'bi-arrows-vertical',
          view: 'front',
          zoneType: 'pierna_bota',
          parts: [],
          isCompleted: false
        }
      ];
    } else if (family === 'COMPLETA') {
      candidateZones = [
        {
          id: 'cuello',
          title: hasCapucha ? 'Capota / Cuello' : 'Cuello / Capota',
          subtitle: 'Tipo de cuello o capota de protección',
          icon: 'bi-bullseye',
          view: 'front',
          zoneType: 'cuello',
          parts: [],
          isCompleted: false
        },
        {
          id: 'pecho',
          title: 'Pecho & Cierre',
          subtitle: 'Cierre principal de doble vía o cremallera frontal',
          icon: 'bi-columns',
          view: 'front',
          zoneType: 'pecho',
          parts: [],
          isCompleted: false
        },
        {
          id: 'manga',
          title: 'Mangas & Puños',
          subtitle: 'Largo de manga, puños elásticos o ajustables',
          icon: 'bi-layers',
          view: 'front',
          zoneType: 'manga',
          parts: [],
          isCompleted: false
        },
        {
          id: 'cintura',
          title: 'Cintura & Elástico',
          subtitle: 'Ajuste elástico o cinturón en pretina',
          icon: 'bi-bounding-box-circles',
          view: 'front',
          zoneType: 'cintura',
          parts: [],
          isCompleted: false
        },
        {
          id: 'bota',
          title: 'Pierna & Bota',
          subtitle: 'Terminación de bota y refuerzos',
          icon: 'bi-arrows-vertical',
          view: 'front',
          zoneType: 'pierna_bota',
          parts: [],
          isCompleted: false
        }
      ];
    } else if (family === 'GENERAL') {
      candidateZones = [
        {
          id: 'zona1',
          title: 'Zona Superior / Frente',
          subtitle: 'Parte superior o delantera de la prenda',
          icon: 'bi-bullseye',
          view: 'front',
          zoneType: 'zona1',
          parts: [],
          isCompleted: false
        },
        {
          id: 'zona2',
          title: 'Mangas / Laterales',
          subtitle: 'Extremidades o costados laterales',
          icon: 'bi-layers',
          view: 'front',
          zoneType: 'zona2',
          parts: [],
          isCompleted: false
        },
        {
          id: 'zona3',
          title: 'Espalda / Trasero',
          subtitle: 'Parte posterior o trasera',
          icon: 'bi-border-all',
          view: 'back',
          zoneType: 'zona3',
          parts: [],
          isCompleted: false
        },
        {
          id: 'zona4',
          title: 'Terminación Inferior',
          subtitle: 'Ruedos, pretina o acabado inferior',
          icon: 'bi-bounding-box-circles',
          view: 'front',
          zoneType: 'zona4',
          parts: [],
          isCompleted: false
        }
      ];
    } else {
      // SUPERIOR
      candidateZones = [
        {
          id: 'cuello',
          title: hasCapucha ? 'Capota / Cuello' : 'Cuello / Solapa',
          subtitle: hasCapucha ? 'Tipo de capota, cuello y acabados' : 'Tipo de cuello y acabado',
          icon: 'bi-bullseye',
          view: 'front',
          zoneType: 'cuello',
          parts: [],
          isCompleted: false
        },
        {
          id: 'pecho',
          title: 'Pechera y Delantero',
          subtitle: 'Cartera, botones y bolsillos frontales',
          icon: 'bi-columns',
          view: 'front',
          zoneType: 'pecho',
          parts: [],
          isCompleted: false
        },
        {
          id: 'manga',
          title: 'Mangas y Puños',
          subtitle: 'Largo, puño y guardapolvo',
          icon: 'bi-layers',
          view: 'front',
          zoneType: 'manga',
          parts: [],
          isCompleted: false
        },
        {
          id: 'espalda',
          title: 'Espalda y Almilla',
          subtitle: 'Corte posterior y tablones',
          icon: 'bi-border-all',
          view: 'back',
          zoneType: 'espalda',
          parts: [],
          isCompleted: false
        },
        {
          id: 'pretina',
          title: 'Cintura y Ruedo',
          subtitle: 'Terminación inferior y ruedo',
          icon: 'bi-bounding-box-circles',
          view: 'front',
          zoneType: 'pretina',
          parts: [],
          isCompleted: false
        },
        {
          id: 'tiro',
          title: 'Bragueta & Figurado',
          subtitle: 'Bragueta delantera, aletilla y figurado',
          icon: 'bi-arrows-collapse',
          view: 'front',
          zoneType: 'tiro',
          parts: [],
          isCompleted: false
        }
      ];
    }

    // Distribuir partes entre las zonas candidatas
    candidateZones.forEach(zone => {
      zone.parts = parts.filter((p: any) => this.matchZone(p, zone.id));
    });

    // Conservar solo las zonas que efectivamente tienen partes configuradas
    let activeZones = candidateZones.filter(z => z.parts.length > 0);

    // Identificar partes no asignadas a ninguna candidata
    const assignedPartIds = new Set();
    activeZones.forEach(z => z.parts.forEach(p => assignedPartIds.add(p.id)));
    const unassignedParts = parts.filter(p => !assignedPartIds.has(p.id));

    if (unassignedParts.length > 0) {
      const customGroups = new Map();
      unassignedParts.forEach(p => {
        const groupName = p.zone_name || p.name || 'Otras Partes';
        if (!customGroups.has(groupName)) customGroups.set(groupName, []);
        customGroups.get(groupName).push(p);
      });

      customGroups.forEach((cParts, cName) => {
        const sampleView = (cParts[0]?.view === 'back') ? 'back' : 'front';
        activeZones.push({
          id: 'custom_' + cName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          title: cName,
          subtitle: 'Partes específicas configuradas en este molde',
          icon: 'bi-scissors',
          view: sampleView,
          zoneType: 'custom',
          parts: cParts,
          isCompleted: false
        });
      });
    }

    this.zones = activeZones.length > 0 ? activeZones : candidateZones;
    this.refreshZoneCompletion();
  }

  matchZone(partOrZone: any, zoneTarget: string): boolean {
    if (!partOrZone) return false;
    const name = (partOrZone.name || '').toLowerCase();
    const zoneName = (partOrZone.zone?.zone_type || partOrZone.zone?.name || partOrZone.zone_name || '').toLowerCase();
    const zoneType = (partOrZone.zone_type || '').toLowerCase();
    const code = (partOrZone.code || '').toLowerCase();

    const allText = `${name} ${zoneName} ${zoneType} ${code}`;
    const family = this.anatomicalFamily;

    if (zoneTarget.startsWith('custom_')) {
      const targetSlug = zoneTarget.replace('custom_', '');
      const currentSlug = (zoneName || name).toLowerCase().replace(/[^a-z0-9]/g, '_');
      return currentSlug.includes(targetSlug) || targetSlug.includes(currentSlug);
    }

    if (family === 'INFERIOR') {
      if (zoneTarget === 'pretina') {
        return allText.includes('pret') || allText.includes('pasador') || allText.includes('cint');
      }
      if (zoneTarget === 'tiro') {
        return allText.includes('braguet') || allText.includes('tiro') || allText.includes('cremallera') || allText.includes('figura');
      }
      if (zoneTarget === 'bolsillo_del') {
        const isBolsillo = allText.includes('bolsill') || allText.includes('later') || allText.includes('relojer') || allText.includes('boca') || allText.includes('delan');
        const isTrasero = allText.includes('post') || allText.includes('tras') || allText.includes('ribete') || allText.includes('espal');
        const isTiro = allText.includes('braguet') || allText.includes('tiro');
        return isBolsillo && !isTrasero && !isTiro;
      }
      if (zoneTarget === 'bolsillo_tras') {
        return allText.includes('post') || allText.includes('tras') || allText.includes('ribete') || allText.includes('parche');
      }
      if (zoneTarget === 'bota') {
        return allText.includes('bota') || allText.includes('pierna') || allText.includes('rued') || allText.includes('dobl');
      }
      return false;
    }

    if (family === 'SUPERIOR') {
      if (zoneTarget === 'cuello') {
        return allText.includes('cuel') || allText.includes('solap') || allText.includes('collar') || allText.includes('capot') || allText.includes('capuch') || allText.includes('cue');
      }
      if (zoneTarget === 'tiro' || zoneTarget === 'bragueta') {
        return allText.includes('braguet') || allText.includes('figura');
      }
      if (zoneTarget === 'pecho') {
        return (allText.includes('pech') || allText.includes('delan') || allText.includes('carter') || allText.includes('bolsill') ||
               allText.includes('frente') || allText.includes('botón') || allText.includes('boton') || allText.includes('cierre') ||
               allText.includes('car') || (allText.includes('bol') && !allText.includes('espal'))) &&
               !allText.includes('braguet') && !allText.includes('figura');
      }
      if (zoneTarget === 'manga') {
        return allText.includes('mang') || allText.includes('puñ') || allText.includes('sleeve') || allText.includes('mga');
      }
      if (zoneTarget === 'espalda') {
        return allText.includes('espal') || allText.includes('almill') || allText.includes('post') || allText.includes('tras') || allText.includes('esp');
      }
      if (zoneTarget === 'pretina' || zoneTarget === 'cintura') {
        return allText.includes('pret') || allText.includes('cint') || allText.includes('dobl') || allText.includes('rued') || allText.includes('faldon');
      }
      return false;
    }

    if (family === 'COMPLETA') {
      if (zoneTarget === 'cuello') {
        return allText.includes('cuel') || allText.includes('capot') || allText.includes('capuch') || allText.includes('solap');
      }
      if (zoneTarget === 'pecho') {
        return allText.includes('pech') || allText.includes('delan') || allText.includes('cierre') || allText.includes('cremallera');
      }
      if (zoneTarget === 'manga') {
        return allText.includes('mang') || allText.includes('puñ');
      }
      if (zoneTarget === 'cintura') {
        return allText.includes('cint') || allText.includes('pret') || allText.includes('elast');
      }
      if (zoneTarget === 'bota') {
        return allText.includes('bota') || allText.includes('pierna') || allText.includes('rued');
      }
      return false;
    }

    if (zoneTarget === 'zona1') {
      return allText.includes('cuel') || allText.includes('pech') || allText.includes('frente') || allText.includes('base');
    }
    if (zoneTarget === 'zona2') {
      return allText.includes('mang') || allText.includes('cint') || allText.includes('corte');
    }
    if (zoneTarget === 'zona3') {
      return allText.includes('espal') || allText.includes('tras') || allText.includes('post');
    }
    if (zoneTarget === 'zona4') {
      return allText.includes('rued') || allText.includes('bota') || allText.includes('pret');
    }

    return false;
  }

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
    const family = this.anatomicalFamily;
    if (family === 'INFERIOR') {
      if (allText.includes('pret') || allText.includes('pasador') || allText.includes('cint')) return 'pretina';
      if (allText.includes('braguet') || allText.includes('tiro')) return 'tiro';
      if (allText.includes('bota') || allText.includes('pierna') || allText.includes('rued')) return 'bota';
      if (allText.includes('post') || allText.includes('tras') || allText.includes('ribete')) return 'bolsillo_tras';
      if (allText.includes('bolsill') || allText.includes('delan') || allText.includes('later')) return 'bolsillo_del';
    }
    if (allText.includes('mang') || allText.includes('puñ')) return 'manga';
    if (allText.includes('cuel') || allText.includes('solap') || allText.includes('cap')) return 'cuello';
    if (allText.includes('pech') || allText.includes('delan') || allText.includes('carter')) return 'pecho';
    if (allText.includes('espal') || allText.includes('almill')) return 'espalda';
    if (allText.includes('pret') || allText.includes('cint')) return 'pretina';
    return zone.zone_type || zone.name || `z_${zone.id}`;
  }

  restoreExistingSelections(): void {
    const specId = this.item?.technicalSpecId || this.item?.technical_spec_id || this.item?.technical_spec?.id;
    const opmRef = this.item?.opmReference || this.item?.opm_reference || this.item?.technical_spec?.reference;

    if (opmRef || specId) {
      this.generatedOpmCode = opmRef || `OPM-${specId}`;
      this.opmSuccess = true;
    }

    // Auto-vincular tela principal y materiales SOLO si NO hay ficha técnica previa guardada.
    // Si ya existe una ficha técnica, las vinculaciones se restauran desde restoreMaterials(parts)
    // para respetar las acciones del usuario (como desvincular una tela).
    const hasExistingSpec = specId || (Array.isArray(this.item?.technical_spec?.parts) && this.item.technical_spec.parts.length > 0);

    if (!hasExistingSpec) {
      // Auto-vincular tela principal si el ítem ya contiene referencia de tela de SIESA (del costeo o solicitud previa)
      const itemTelaRef = this.item?.ref_siesa_referencia;
      const itemTelaDesc = this.item?.ref_siesa_descripcion;
      if (itemTelaRef && !this.materialSiesaBindings['tela principal']) {
        this.materialSiesaBindings['tela principal'] = {
          id_item: itemTelaRef,
          referencia: itemTelaRef,
          descripcion: itemTelaDesc || itemTelaRef,
          color: this.item?.siesa_color || '',
          is_fabric: true
        };
      }

      // Auto-vincular materiales previos si vienen en el ítem (solo primera vez)
      if (Array.isArray(this.item?.materiales) && this.item.materiales.length > 0) {
        this.item.materiales.forEach((m: any) => {
          const ref = m.siesa_referencia || m.siesa_id_item;
          if (ref) {
            const desc = m.siesa_descripcion || m.descripcion_personalizada || ref;
            const isTela = m.tipo_material === 'TELA' || (desc || '').toLowerCase().includes('tela');
            const targetKey = isTela ? 'tela principal' : (m.descripcion_personalizada || desc).toLowerCase().trim();
            if (!this.materialSiesaBindings[targetKey]) {
              this.materialSiesaBindings[targetKey] = {
                id_item: ref,
                referencia: ref,
                descripcion: desc,
                color: m.siesa_color || '',
                is_fabric: isTela
              };
            }
          }
        });
      }
    }

    // 1. Si el ítem ya contiene las partes en technical_spec
    const existingParts = this.item?.technical_spec?.parts;
    if (Array.isArray(existingParts) && existingParts.length > 0) {
      this.applySpecPartsRestoration(existingParts);
    } else if (specId) {
      // 2. Si no vienen parts directamente en el objeto pero hay specId, consultar al backend
      this.moldService.getTechnicalSpec(specId).subscribe({
        next: (res: any) => {
          const specData = res?.data || res;
          if (specData) {
            if (specData.reference) {
              this.generatedOpmCode = specData.reference;
            }
            if (Array.isArray(specData.parts) && specData.parts.length > 0) {
              this.applySpecPartsRestoration(specData.parts);
            }
          }
        },
        error: (err: any) => {
          console.warn('No se pudo cargar la ficha técnica previa para restauración:', err);
        }
      });
    }
  }

  /**
   * Aplica la restauración de variantes, observaciones, partes generales y materiales guardados
   */
  applySpecPartsRestoration(parts: any[]): void {
    if (!parts || !Array.isArray(parts)) return;
    this.cachedSpecPartsForRestoration = parts;

    let mangaTypesSeen = new Set<string>();
    let mangaCount = 0;

    for (const p of parts) {
      const itemType = p.item_type || 'parte';

      if (itemType === 'parte') {
        const rawPartId = p.mold_part_id ? Number(p.mold_part_id) : null;
        const targetTypeId = (p.mold_part_type_id || p.selected_type_id) ? Number(p.mold_part_type_id || p.selected_type_id) : null;
        const targetTypeName = (p.selected_type_name || '').toLowerCase().trim();
        const targetTech = (p.technical_spec || '').toLowerCase().trim();
        const partName = (p.name || '').toLowerCase().trim();

        // Restaurar observación de zona si viene client_spec
        if (p.client_spec && typeof p.client_spec === 'string' && p.client_spec.trim()) {
          const obsText = p.client_spec.trim();
          let matchedZone = this.zones.find(z =>
            (p.zone_name && (z.title.toLowerCase().includes(p.zone_name.toLowerCase()) || p.zone_name.toLowerCase().includes(z.id))) ||
            z.parts.some(pt => rawPartId && Number(pt.id) === rawPartId) ||
            z.parts.some(pt => (pt.name || '').toLowerCase().trim() === partName)
          );
          if (!matchedZone) {
            matchedZone = this.zones.find(z => this.matchZone({ name: partName, zone_name: p.zone_name }, z.id));
          }
          if (matchedZone) {
            this.zoneObservations[matchedZone.id] = obsText;
          }
        }

        // Buscar la parte correspondiente en las zonas del molde
        let matchedPart: any = null;
        for (const zone of this.zones) {
          matchedPart = zone.parts.find(pt =>
            (rawPartId && Number(pt.id) === rawPartId) ||
            (partName && (pt.name || '').toLowerCase().trim() === partName)
          );
          if (matchedPart) break;
        }

        if (matchedPart) {
          const partIdToUse = matchedPart.id;
          const availableTypes = matchedPart.types || [];

          let matchedType = availableTypes.find((t: any) =>
            (targetTypeId && Number(t.id) === targetTypeId) ||
            (targetTypeName && (t.name || '').toLowerCase().trim() === targetTypeName) ||
            (targetTech && (t.technical_description || '').toLowerCase().trim() === targetTech) ||
            (targetTech && (t.name || '').toLowerCase().trim() === targetTech)
          );

          if (!matchedType && targetTech) {
            matchedType = availableTypes.find((t: any) =>
              t.technical_description && targetTech.includes((t.technical_description || '').toLowerCase().trim())
            );
          }

          if (matchedType) {
            this.selectedTypes[partIdToUse] = matchedType;
          } else if (targetTypeName || targetTypeId || targetTech) {
            this.selectedTypes[partIdToUse] = {
              id: targetTypeId || partIdToUse,
              name: p.selected_type_name || p.technical_spec || matchedPart.name,
              technical_description: p.technical_spec || p.selected_type_name,
              total_time: Number(p.estimated_time) || 0
            };
          }

          if (this.matchZone(matchedPart, 'manga')) {
            mangaCount++;
            if (this.selectedTypes[partIdToUse]) {
              mangaTypesSeen.add(this.selectedTypes[partIdToUse].name || String(this.selectedTypes[partIdToUse].id));
            }
          }
        }
      }
    }

    if (mangaCount > 1 && mangaTypesSeen.size > 1) {
      this.diferenciarMangas = true;
    }

    this.restoreGeneralParts(parts);
    this.restoreMaterials(parts);
    this.refreshZoneCompletion();
    this.recalculateConsolidatedMaterials();
  }

  restoreGeneralParts(parts: any[]): void {
    if (!parts || !Array.isArray(parts)) return;
    for (const p of parts) {
      if ((p.item_type || 'parte') === 'parte_general') {
        const pName = (p.name || '').toLowerCase().trim();
        const selName = (p.selected_type_name || '').toLowerCase().trim();
        const targetTech = (p.technical_spec || '').toLowerCase().trim();

        const matchedGenPart = this.generalParts.find(gp =>
          (gp.name || '').toLowerCase().trim() === pName ||
          (p.name && (gp.code || '').toLowerCase().trim() === (p.name || '').toLowerCase().trim()) ||
          (gp.types && gp.types.some((gt: any) => (gt.name || '').toLowerCase().trim() === selName))
        );

        if (matchedGenPart) {
          let matchedVariant = (matchedGenPart.types || []).find((gt: any) =>
            (selName && (gt.name || '').toLowerCase().trim() === selName) ||
            (targetTech && (gt.technical_description || '').toLowerCase().trim() === targetTech)
          );

          if (!matchedVariant) {
            matchedVariant = {
              id: matchedGenPart.id * 10 + 1,
              name: p.selected_type_name || p.name,
              technical_description: p.technical_spec,
              total_time: Number(p.estimated_time) || 0
            };
          }

          this.selectedGeneralTypes[matchedGenPart.id] = matchedVariant;
          if (p.zone_name) {
            const zoneObj = this.zones.find(z => z.title === p.zone_name || z.id === p.zone_name);
            this.generalPartZoneAnchors[matchedGenPart.id] = zoneObj ? zoneObj.id : p.zone_name;
          }
        }
      }
    }

    // Restaurar materiales guardados en la ficha técnica (telas e insumos)
    this.restoreMaterials(parts);
    this.recalculateConsolidatedMaterials();
    this.refreshZoneCompletion();
  }

  restoreMaterials(parts: any[]): void {
    if (!parts || !Array.isArray(parts)) return;
    for (const p of parts) {
      if (p.item_type === 'material') {
        const matKey = (p.name || '').toLowerCase().trim();
        if (p.client_spec) {
          this.materialNotes[matKey] = p.client_spec;
        }
        if (p.inventory_reference) {
          this.materialSiesaBindings[matKey] = {
            id_item: p.inventory_reference,
            referencia: p.inventory_reference,
            descripcion: p.inventory_description || p.selected_type_name || '',
            color: '',
            is_fabric: (p.selected_type_name || '').toLowerCase().includes('tela') || matKey.includes('tela')
          };
        } else {
          // Si la ficha técnica guardada tiene inventory_reference = null,
          // asegurar que NO quede un binding viejo (el usuario desvinculó)
          delete this.materialSiesaBindings[matKey];
        }
        const foundExtra = this.availableMaterials.find(m => m.name.toLowerCase().trim() === matKey);
        if (foundExtra) {
          this.selectedExtras[foundExtra.id] = {
            active: true,
            notes: p.client_spec || ''
          };
        }
      }
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
    if (!zone) return 'Zona';

    // 1. Coincidencia directa con una de las zonas activas del molde
    const matched = this.zones.find(z => this.matchZone(zone, z.id));
    if (matched) return matched.title;

    // 2. Si el objeto trae un nombre amigable propio
    const rawName = (zone.name || '').trim();
    const allText = `${zone.zone_type || ''} ${rawName}`.toLowerCase();
    const family = this.anatomicalFamily;

    if (family === 'INFERIOR') {
      if (allText.includes('braguet') || allText.includes('tiro')) return 'Tiro & Bragueta';
      if (allText.includes('pret') || allText.includes('pasador') || allText.includes('cint')) return 'Pretina & Pasadores';
      if (allText.includes('bota') || allText.includes('pierna') || allText.includes('rued')) return 'Bota & Ruedo';
      if (allText.includes('post') || allText.includes('tras') || allText.includes('ribete') || allText.includes('parche')) return 'Bolsillos Traseros';
      if (allText.includes('bolsill') || allText.includes('later') || allText.includes('relojer') || allText.includes('delan')) return 'Bolsillos Laterales';
      if (rawName && rawName.length > 2) return rawName;
      return 'Zona Inferior';
    }

    if (family === 'SUPERIOR') {
      if (allText.includes('capuch') || allText.includes('capot')) return 'Capota / Cuello';
      if (allText.includes('cuel') || allText.includes('solap')) return 'Cuello / Solapa';
      if (allText.includes('mang') || allText.includes('puñ')) return 'Mangas y Puños';
      if (allText.includes('pech') || allText.includes('delan') || allText.includes('carter')) return 'Pechera y Delantero';
      if (allText.includes('espal') || allText.includes('almill')) return 'Espalda y Almilla';
      if (allText.includes('pret') || allText.includes('cint') || allText.includes('rued')) return 'Cintura y Ruedo';
      if (allText.includes('gen') || allText.includes('acab')) return 'Acabados & Apliques';
      if (rawName && rawName.length > 2) return rawName;
      return 'Zona de Prenda';
    }

    if (family === 'COMPLETA') {
      if (allText.includes('capuch') || allText.includes('capot') || allText.includes('cuel')) return 'Cuello / Capota';
      if (allText.includes('pech') || allText.includes('cierre') || allText.includes('delan')) return 'Pecho & Cierre';
      if (allText.includes('mang') || allText.includes('puñ')) return 'Mangas & Puños';
      if (allText.includes('cint') || allText.includes('pret')) return 'Cintura & Elástico';
      if (allText.includes('bota') || allText.includes('pierna')) return 'Pierna & Bota';
      if (rawName && rawName.length > 2) return rawName;
      return 'Zona Overol';
    }

    if (rawName && rawName.length > 2) return rawName;
    return zone.zone_type || 'Zona';
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
        if (this.cachedSpecPartsForRestoration && this.cachedSpecPartsForRestoration.length > 0) {
          this.restoreGeneralParts(this.cachedSpecPartsForRestoration);
        }
        this.recalculateConsolidatedMaterials();
      },
      error: () => {
        this.generalParts = canonical;
        if (this.cachedSpecPartsForRestoration && this.cachedSpecPartsForRestoration.length > 0) {
          this.restoreGeneralParts(this.cachedSpecPartsForRestoration);
        }
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
    this.triggerAutoSave();
  }

  removeGeneralVariant(part: any): void {
    delete this.selectedGeneralTypes[part.id];
    this.recalculateConsolidatedMaterials();
    this.triggerAutoSave();
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
    const sel = this.selectedGeneralTypes[part.id];
    if (!sel) return false;
    return Number(sel.id) === Number(variant.id);
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
    this.recalculateConsolidatedMaterials();
    this.generarOpmFinal(true);
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
    this.recalculateConsolidatedMaterials();
    this.triggerAutoSave();
  }

  clearMaterialSiesa(matName: string): void {
    const key = matName.toLowerCase();
    delete this.materialSiesaBindings[key];
    // Si es la Tela Principal, limpiar también las refs en el item
    // para que no se re-inyecten al restaurar
    if (key === 'tela principal' || key.includes('tela principal')) {
      if (this.item) {
        this.item.ref_siesa_referencia = null;
        this.item.ref_siesa_descripcion = null;
      }
    }
    this.recalculateConsolidatedMaterials();
    this.triggerAutoSave();
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
    this.triggerAutoSave();

    // Auto-close the zone modal after selecting a variant
    setTimeout(() => {
      this.closeZoneModal();
    }, 300);
  }

  isTypeSelected(partId: number, typeId: number): boolean {
    const sel = this.selectedTypes[partId];
    if (!sel) return false;
    return Number(sel.id) === Number(typeId);
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
      this.triggerAutoSave();
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
    if (t.includes('cue') || t.includes('sol') || t.includes('cap')) return 'bi-bullseye';
    if (t.includes('tiro') || t.includes('braguet')) return 'bi-arrows-collapse';
    if (t.includes('bota') || t.includes('pierna')) return 'bi-arrows-vertical';
    if (t.includes('pech') || t.includes('delan') || t.includes('car') || t.includes('bol')) return 'bi-columns';
    if (t.includes('man') || t.includes('puñ')) return 'bi-layers';
    if (t.includes('esp') || t.includes('alm') || t.includes('tras') || t.includes('post')) return 'bi-border-all';
    if (t.includes('pret') || t.includes('cin')) return 'bi-bounding-box-circles';
    if (t.includes('gen') || t.includes('acab')) return 'bi-gem';
    return 'bi-bounding-box';
  }

  getZoneColor(zoneType?: string): string {
    const t = (zoneType || '').toLowerCase();
    if (t.includes('cue') || t.includes('cap')) return '#6366f1';
    if (t.includes('tiro') || t.includes('braguet')) return '#0284c7';
    if (t.includes('pech') || t.includes('delan')) return '#0ea5e9';
    if (t.includes('man')) return '#8b5cf6';
    if (t.includes('esp') || t.includes('post') || t.includes('tras')) return '#f59e0b';
    if (t.includes('pret') || t.includes('cin')) return '#10b981';
    if (t.includes('bota') || t.includes('pierna')) return '#14b8a6';
    return '#64748b';
  }

  // ==================== TALLAS Y CANTIDADES ====================

  addTallaPreset(tallaStr: string): void {
    if (!this.item.tallas) this.item.tallas = [];
    const existing = this.item.tallas.find((t: any) => t.talla === tallaStr);
    if (!existing) {
      this.item.tallas.push({ talla: tallaStr, cantidad: 1 });
      this.triggerAutoSave();
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
      this.triggerAutoSave();
    }
  }

  getItemTotal(): number {
    if (!this.item?.tallas) return 0;
    return this.item.tallas.reduce((acc: number, t: any) => acc + (parseInt(t.cantidad, 10) || 0), 0);
  }

  // ==================== GENERACIÓN FINAL DE OPM ====================

  generarOpmFinal(silent: boolean = false): void {
    if (!this.mold) return;

    if (!this.item.tallas || this.item.tallas.length === 0 || this.getItemTotal() <= 0) {
      if (silent) {
        this.item.tallas = [{ talla: this.item.talla || 'M', cantidad: this.item.cantidad_muestra || 1 }];
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Faltan tallas y cantidades',
          text: 'Por favor asigna al menos una talla con cantidad mayor a cero antes de generar la OPM.',
          confirmButtonColor: '#4f46e5'
        });
        return;
      }
    }

    this.isSavingOpm = true;
    if (silent) {
      this.autoSaveStatus = 'saving';
    }

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
      const originParts = Array.from(mat.sourceParts);
      const originStr = originParts.length > 0 ? originParts.join(' | ') : 'Prenda Base';
      return {
        name: mat.name,
        selected_type_name: siesa ? siesa.referencia : mat.type,
        zone_name: originStr,
        item_type: 'material',
        technical_spec: siesa
          ? `[SIESA: ${siesa.referencia}] ${siesaDesc}`
          : `Origen: ${originStr}`,
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

    const specId = this.item?.technicalSpecId || this.item?.technical_spec_id || this.item?.technical_spec?.id;
    const saveRequest$ = specId
      ? this.moldService.updateTechnicalSpec(specId, payload)
      : this.moldService.createTechnicalSpec(payload);

    saveRequest$.subscribe({
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
          this.item.technical_spec = spec;
          this.autoSaveStatus = 'saved';

          if (!silent) {
            Swal.fire({
              icon: 'success',
              title: specId ? '¡OPM Actualizada Exitosamente!' : '¡OPM Generada Exitosamente!',
              html: `Se ha registrado la ficha técnica <strong>${spec.reference}</strong> vinculada a este ítem con un tiempo SAM de <strong>${this.totalSamTime} min</strong>.`,
              confirmButtonColor: '#4f46e5'
            });
          }

          this.onOpmSaved.emit({
            itemId: this.item?.id || this.item?.solicitud_item_id,
            itemIndex: this.itemIndex,
            technicalSpecId: spec.id,
            reference: spec.reference,
            samTime: this.totalSamTime,
            tallas: this.item.tallas,
            materials: this.consolidatedMaterials.map(mat => {
              const key = mat.name.toLowerCase();
              const siesa = this.materialSiesaBindings[key];
              const note = this.materialNotes[key] || mat.notes || '';
              return {
                name: mat.name,
                type: mat.type,
                sourceParts: mat.sourceParts,
                note: note,
                siesa: siesa || null
              };
            })
          });
        }
      },
      error: (err: any) => {
        this.isSavingOpm = false;
        this.autoSaveStatus = 'error';
        console.error('Error al generar OPM:', err);
        if (!silent) {
          Swal.fire({
            icon: 'error',
            title: 'Error al generar OPM',
            text: err.error?.error || err.message || 'No se pudo registrar la OPM en pruebas.',
            confirmButtonColor: '#ef4444'
          });
        }
      }
    });
  }
}
