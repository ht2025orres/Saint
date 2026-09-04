import {
  Component, OnInit, OnChanges, SimpleChanges, Input,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { ProyectoService } from 'src/app/services/proyectos.service';
import { SeguimientoStateService } from '../seguimiento-state.service';

export interface MiembroEstadistica {
  usuario_id: number;
  nombre: string;
  iniciales: string;
  cargo: string;
  saint_tareas_total: number;
  saint_tareas_completadas: number;
  saint_tareas_en_progreso: number;
  glpi_tickets_total: number;
  glpi_tickets_pendientes: number;
  glpi_tickets_tardios: number;
  avance_global: number;
  estado_capacidad: 'Óptimo' | 'En Progreso' | 'Sobrecargado';
  carga_total: number;
  porcentaje_capacidad: number;
  tareas_lista?: {
    id: number;
    titulo: string;
    descripcion?: string;
    estado: string;
    prioridad?: number;
    fecha_limite_entrega?: string;
    fecha_completado?: string;
    proyecto_nombre?: string;
    actividad_titulo?: string;
  }[];
}

export interface EstadisticasData {
  proceso: {
    nombre: string;
    es_ti: boolean;
    total_miembros: number;
  };
  kpis: {
    proyectos_activos: number;
    proyectos_completados: number;
    proyectos_total: number;
    saint_tareas_total: number;
    saint_tareas_completadas: number;
    saint_tareas_en_progreso: number;
    glpi_tickets_resueltos: number;
    glpi_tickets_total: number;
    glpi_sla_porcentaje: number;
    informes_total: number;
  };
  miembros: MiembroEstadistica[];
}

@Component({
  selector: 'app-estadisticas',
  templateUrl: './estadisticas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadisticasComponent implements OnInit, OnChanges {
  @Input() usuarioId = 0;
  @Input() puedeGestionarModulo = false;
  @Input() vistaMode?: 'member' | undefined;

  loading = true;
  mesActual = new Date().getMonth() + 1;
  anioActual = new Date().getFullYear();

  dataEstadisticas: EstadisticasData | null = null;

  showModalDetalleTareas = false;
  miembroSeleccionadoParaModal: MiembroEstadistica | null = null;

  readonly meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  constructor(
    private _proyectosService: ProyectoService,
    public state: SeguimientoStateService,
    private _cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargarEstadisticas();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vistaMode'] && !changes['vistaMode'].firstChange) {
      this.cargarEstadisticas();
    }
  }

  cargarEstadisticas(): void {
    this.loading = true;
    this._cdr.markForCheck();

    this._proyectosService.getEstadisticas(this.usuarioId, this.mesActual, this.anioActual, this.vistaMode).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.success) {
          this.dataEstadisticas = res.data;
        }
        this._cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error al cargar estadísticas:', err);
        this.loading = false;
        this._cdr.markForCheck();
      }
    });
  }

  cambiarMes(delta: number): void {
    this.mesActual += delta;
    if (this.mesActual < 1) {
      this.mesActual = 12;
      this.anioActual--;
    } else if (this.mesActual > 12) {
      this.mesActual = 1;
      this.anioActual++;
    }
    this.cargarEstadisticas();
  }

  nombreMes(mesNum: number): string {
    return this.meses[mesNum - 1] || '';
  }

  getBadgeCapacidadClass(estado: string): string {
    switch (estado) {
      case 'Óptimo':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Sobrecargado':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  }

  getBarColor(idx: number): string {
    const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500'];
    return colors[idx % colors.length];
  }

  get totalCargaProceso(): number {
    return this.dataEstadisticas?.miembros?.reduce((acc, m) => acc + (m.carga_total || 0), 0) || 0;
  }

  abrirModalTareasMiembro(m: MiembroEstadistica): void {
    this.miembroSeleccionadoParaModal = m;
    this.showModalDetalleTareas = true;
    this._cdr.markForCheck();
  }
}
