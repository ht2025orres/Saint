import {
  Component, OnInit, OnChanges, SimpleChanges, Input,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { ProyectoService, EstadisticasProyectosData, EstadisticaProyectoItem } from 'src/app/services/proyectos.service';
import { SeguimientoStateService } from '../../seguimiento-state.service';

@Component({
  selector: 'app-estadisticas-proyectos',
  templateUrl: './estadisticas-proyectos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadisticasProyectosComponent implements OnInit, OnChanges {
  @Input() usuarioId = 0;
  @Input() puedeGestionarModulo = false;
  @Input() vistaMode?: 'member' | undefined;

  loading = true;
  mesActual = new Date().getMonth() + 1;
  anioActual = new Date().getFullYear();

  searchQuery = '';
  estadoFiltro = 'todos';
  filtroEnfoque: 'todos' | 'crecimiento' | 'avance' = 'todos';
  viewMode: 'grid' | 'table' = 'grid';

  showModalDetalle = false;
  proyectoSeleccionadoModal: EstadisticaProyectoItem | null = null;
  tabModalDetalle: 'creadas' | 'completadas' = 'creadas';

  dataEstadisticas: EstadisticasProyectosData | null = null;

  readonly meses = [
    { id: 1, nombre: 'Enero' },
    { id: 2, nombre: 'Febrero' },
    { id: 3, nombre: 'Marzo' },
    { id: 4, nombre: 'Abril' },
    { id: 5, nombre: 'Mayo' },
    { id: 6, nombre: 'Junio' },
    { id: 7, nombre: 'Julio' },
    { id: 8, nombre: 'Agosto' },
    { id: 9, nombre: 'Septiembre' },
    { id: 10, nombre: 'Octubre' },
    { id: 11, nombre: 'Noviembre' },
    { id: 12, nombre: 'Diciembre' }
  ];

  readonly anios = [2024, 2025, 2026, 2027];

  constructor(
    private _proyectosService: ProyectoService,
    public state: SeguimientoStateService,
    private _cdr: ChangeDetectorRef,
  ) {}

  abrirModalDetalle(proyecto: EstadisticaProyectoItem, tab: 'creadas' | 'completadas' = 'creadas'): void {
    this.proyectoSeleccionadoModal = proyecto;
    this.tabModalDetalle = tab;
    this.showModalDetalle = true;
    this._cdr.markForCheck();
  }

  cerrarModalDetalle(): void {
    this.showModalDetalle = false;
    this.proyectoSeleccionadoModal = null;
    this._cdr.markForCheck();
  }

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

    this._proyectosService.getEstadisticasProyectos(this.usuarioId, Number(this.mesActual), Number(this.anioActual), this.vistaMode).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.dataEstadisticas = res.data;
        } else {
          this.dataEstadisticas = null;
        }
        this._cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error al cargar estadísticas de proyectos:', err);
        this.loading = false;
        this.dataEstadisticas = null;
        this._cdr.markForCheck();
      }
    });
  }

  onFiltroFechaChange(): void {
    this.cargarEstadisticas();
  }

  nombreMes(mesNum: number): string {
    const found = this.meses.find(m => m.id === Number(mesNum));
    return found ? found.nombre : '';
  }

  get proyectosFiltrados(): EstadisticaProyectoItem[] {
    if (!this.dataEstadisticas || !this.dataEstadisticas.proyectos) {
      return [];
    }
    let lista = this.dataEstadisticas.proyectos;

    if (this.estadoFiltro !== 'todos') {
      lista = lista.filter(p => p.estado === this.estadoFiltro);
    }

    if (this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase().trim();
      lista = lista.filter(p =>
        p.titulo.toLowerCase().includes(q) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(q)) ||
        (p.etiquetas && p.etiquetas.some(e => e.texto.toLowerCase().includes(q)))
      );
    }

    if (this.filtroEnfoque === 'crecimiento') {
      lista = lista.filter(p => p.tareas_creadas_mes > 0);
    } else if (this.filtroEnfoque === 'avance') {
      lista = lista.filter(p => p.tareas_completadas_mes > 0);
    }

    return lista;
  }

  /** Proyectos con impacto en el mes para la gráfica comparativa visual */
  get proyectosImpactadosGrafico(): EstadisticaProyectoItem[] {
    if (!this.dataEstadisticas || !this.dataEstadisticas.proyectos) {
      return [];
    }
    return this.dataEstadisticas.proyectos.filter(p => p.tareas_creadas_mes > 0 || p.tareas_completadas_mes > 0);
  }

  /** Cálculo del valor máximo de tareas creadas/completadas para la escala de la gráfica */
  get maxTareasGrafico(): number {
    let max = 1;
    for (const p of this.proyectosImpactadosGrafico) {
      if (p.tareas_creadas_mes > max) max = p.tareas_creadas_mes;
      if (p.tareas_completadas_mes > max) max = p.tareas_completadas_mes;
    }
    return max;
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'completado':
      case 'finalizado':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'en_ejecucion':
      case 'en_progreso':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'pausado':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cancelado':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  getBadgeCrecimientoClass(pct: number): string {
    if (pct > 25) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (pct > 0)  return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  }

  getBadgeAvanceClass(pct: number): string {
    if (pct >= 50) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (pct > 0)  return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}
