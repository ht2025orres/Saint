import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { MoldService } from '../../../services/mold.service';
import Swal from 'sweetalert2';

export interface StepperStep {
  id: string; // 'cuello' | 'pecho' | 'manga' | 'espalda' | 'pretina' | 'resumen'
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
  activeStepIndex = 0;
  activeView: 'front' | 'back' = 'front';

  // Configuración de los 5 pasos de diseño + Paso 6 de Resumen
  steps: StepperStep[] = [];

  // Almacenamiento de selecciones: [partId] -> mold_part_type
  selectedTypes: { [partId: number]: any } = {};

  // Observaciones por paso/zona: [stepId] -> string
  zoneObservations: { [stepId: string]: string } = {};

  // Toggle opcional para diferenciar manga izquierda de manga derecha
  diferenciarMangas = false;

  // Estado OPM
  isSavingOpm = false;
  opmSuccess = false;
  generatedOpmCode = '';

  // Tallas disponibles para agregar en Paso 6
  tallasLetra: string[] = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
  tallasNumericas: string[] = ['28', '30', '32', '34', '36', '38', '40', '42'];
  selectedTallaToAdd: string = 'M';
  customTallaInput: string = '';

  constructor(private moldService: MoldService) {}

  ngOnInit(): void {
    const moldId = this.item?.moldId || this.item?.mold_id;
    if (moldId) {
      this.loadMoldData(moldId);
    }
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
          this.buildDynamicSteps();
          this.restoreExistingSelections();
        }
      },
      error: (err: any) => {
        this.loadingMold = false;
        console.error('Error al cargar molde:', err);
      }
    });
  }

  /**
   * Construye dinámicamente los 5 pasos superiores de diseño según las partes del molde,
   * más el paso 6 de Resumen & Tallas.
   */
  buildDynamicSteps(): void {
    if (!this.mold) return;

    const parts = this.mold.parts || [];

    // Agrupación anatómica inteligente (pensada para camisa y escalable a cualquier molde)
    const cuelloParts = parts.filter((p: any) => this.matchZone(p, 'cuello'));
    const pechoParts = parts.filter((p: any) => this.matchZone(p, 'pecho'));
    const mangaParts = parts.filter((p: any) => this.matchZone(p, 'manga'));
    const espaldaParts = parts.filter((p: any) => this.matchZone(p, 'espalda'));
    const pretinaParts = parts.filter((p: any) => this.matchZone(p, 'pretina'));

    this.steps = [
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
        title: 'Pecho y Delantero',
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
      },
      {
        id: 'resumen',
        title: 'Resumen & Tallas',
        subtitle: 'Confección OPM y cantidades',
        icon: 'bi-check2-all',
        view: 'front',
        zoneType: 'resumen',
        parts: [],
        isCompleted: false
      }
    ];

    // Por defecto, preseleccionar las opciones predeterminadas (is_default) si no hay selección previa
    parts.forEach((part: any) => {
      if (part.types && part.types.length > 0 && !this.selectedTypes[part.id]) {
        const defaultType = part.types.find((t: any) => t.is_default) || part.types[0];
        if (defaultType) {
          this.selectedTypes[part.id] = defaultType;
        }
      }
    });

    this.activeStepIndex = 0;
    this.updateActiveView();
    this.checkStepsCompletion();
  }

  matchZone(part: any, zoneTarget: string): boolean {
    const name = (part.name || '').toLowerCase();
    const zoneName = (part.zone?.zone_type || part.zone?.name || '').toLowerCase();
    const code = (part.code || '').toLowerCase();

    if (zoneTarget === 'cuello') {
      return name.includes('cuello') || name.includes('solapa') || zoneName.includes('cuello') || code.includes('cue');
    }
    if (zoneTarget === 'pecho') {
      return name.includes('pecho') || name.includes('cartera') || name.includes('bolsillo') || zoneName.includes('pecho') || code.includes('car') || code.includes('bol');
    }
    if (zoneTarget === 'manga') {
      return name.includes('manga') || name.includes('puño') || zoneName.includes('manga') || code.includes('mga');
    }
    if (zoneTarget === 'espalda') {
      return name.includes('espalda') || name.includes('almilla') || zoneName.includes('espalda') || code.includes('esp');
    }
    if (zoneTarget === 'pretina') {
      return name.includes('pretina') || name.includes('cintura') || name.includes('dobladillo') || name.includes('bota') || zoneName.includes('pretina') || code.includes('prt');
    }
    return false;
  }

  restoreExistingSelections(): void {
    if (this.item?.opmReference || this.item?.technicalSpecId) {
      this.generatedOpmCode = this.item.opmReference || `OPM-REG-${this.item.technicalSpecId}`;
      this.opmSuccess = true;
    }
  }

  // ==================== NAVEGACIÓN DEL STEPPER ====================

  goToStep(index: number): void {
    if (index < 0 || index >= this.steps.length) return;
    this.activeStepIndex = index;
    this.updateActiveView();
  }

  nextStep(): void {
    // Marcar el paso actual como completado
    if (this.steps[this.activeStepIndex]) {
      this.steps[this.activeStepIndex].isCompleted = true;
    }
    if (this.activeStepIndex < this.steps.length - 1) {
      this.activeStepIndex++;
      this.updateActiveView();
    }
  }

  prevStep(): void {
    if (this.activeStepIndex > 0) {
      this.activeStepIndex--;
      this.updateActiveView();
    }
  }

  updateActiveView(): void {
    const curStep = this.steps[this.activeStepIndex];
    if (curStep && curStep.view) {
      this.activeView = curStep.view;
    }
  }

  toggleViewManual(): void {
    this.activeView = this.activeView === 'front' ? 'back' : 'front';
  }

  checkStepsCompletion(): void {
    this.steps.forEach((step, idx) => {
      if (idx === 5) {
        step.isCompleted = (this.item?.tallas?.length > 0) && (this.getItemTotal() > 0);
      } else {
        step.isCompleted = step.parts.every((p: any) => !!this.selectedTypes[p.id]);
      }
    });
  }

  // ==================== SELECCIÓN DE VARIANTES ====================

  selectTypeForPart(part: any, type: any): void {
    this.selectedTypes[part.id] = type;
    this.checkStepsCompletion();
  }

  isTypeSelected(partId: number, typeId: number): boolean {
    return this.selectedTypes[partId]?.id === typeId;
  }

  // Helper para distinguir partes de cartera vs bolsillos en Paso Pecho
  isCarteraPart(part: any): boolean {
    const name = (part.name || '').toLowerCase();
    return name.includes('cartera') || name.includes('cierre') || name.includes('botón');
  }

  isBolsilloPart(part: any): boolean {
    const name = (part.name || '').toLowerCase();
    return name.includes('bolsillo');
  }

  // ==================== CÁLCULO DE TIEMPO SAM ====================

  get totalSamTime(): number {
    let total = 0;
    Object.values(this.selectedTypes).forEach((type: any) => {
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
    return this.mold.zones.filter((z: any) => z.view === this.activeView);
  }

  isZoneHighlighted(zone: any): boolean {
    const curStep = this.steps[this.activeStepIndex];
    if (!curStep || curStep.id === 'resumen') return false;
    return this.matchZone(zone, curStep.zoneType);
  }

  getSvgPath(zone: any): string {
    let points = zone.path_data;
    if (typeof points === 'string') {
      try {
        points = JSON.parse(points);
      } catch (e) {
        points = [];
      }
    }
    if (!Array.isArray(points) || points.length === 0) return '';
    return points.map((pt: any, i: number) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ') + ' Z';
  }

  // ==================== TALLAS Y CANTIDADES (PASO 6) ====================

  addTallaPreset(tallaStr: string): void {
    if (!this.item.tallas) this.item.tallas = [];
    const existing = this.item.tallas.find((t: any) => t.talla === tallaStr);
    if (!existing) {
      this.item.tallas.push({ talla: tallaStr, cantidad: 1 });
    }
    this.checkStepsCompletion();
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
    this.checkStepsCompletion();
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

    this.steps.forEach(step => {
      if (step.id === 'resumen') return;
      const zoneObs = this.zoneObservations[step.id] || '';

      step.parts.forEach(part => {
        const selType = this.selectedTypes[part.id];
        partsPayload.push({
          mold_part_id: part.id,
          name: part.name,
          item_type: 'parte',
          technical_spec: selType ? selType.name : part.name,
          client_spec: zoneObs,
          position_x: part.position_x,
          position_y: part.position_y,
          inventory_reference: null,
          inventory_description: null,
        });
      });
    });

    const payload = {
      mold_id: this.mold.id,
      description: `OPM Muestra - ${this.item.descripcion || this.item.item_cliente || this.mold.name}`,
      technical_description: `Molde: ${this.mold.name}. Tiempo SAM estimado: ${this.totalSamTime} min.`,
      parts: partsPayload,
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
