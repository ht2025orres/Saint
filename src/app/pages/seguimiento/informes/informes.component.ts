import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProyectoService, Informe, InformeTarea, TipoInforme, NivelImpacto } from 'src/app/services/proyectos.service';
import { SeguimientoStateService } from '../seguimiento-state.service';
import { InformeForm } from '../modals/modal-informe/modal-informe.component';
import { InformeTareaForm } from '../modals/modal-informe-tarea/modal-informe-tarea.component';
import Swal from 'sweetalert2';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-informes',
  templateUrl: './informes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InformesComponent implements OnInit, OnDestroy {
  @Input() usuarioId = 0;
  @Input() puedeGestionarModulo = false;
  @Input() vistaMode: 'member' | undefined;

  informes: Informe[] = [];
  loading = false;
  
  // Procesos
  procesos: { id: number; nombre: string }[] = [];

  // Vistas
  subVista: 'listado' | 'indicadores' = 'listado';
  vistaListado: 'tarjetas' | 'lista' = 'tarjetas';

  // Filtros Dashboard
  fechaInicio: string = '';
  fechaFin: string = '';

  // Métricas Dashboard
  filteredInformes: Informe[] = [];
  kpiTotal = 0;
  kpiAbiertos = 0;
  kpiEnProceso = 0;
  kpiCerrados = 0;
  kpiVencidos = 0;
  criticos: Informe[] = [];

  // Instancias de Gráficos
  private stateChart: any = null;
  private priorityChart: any = null;
  private processChart: any = null;
  private trendChart: any = null;

  // Detalle
  showDetalle = false;
  detalle: Informe | null = null;
  loadingDetalle = false;

  // Modales
  showModalInforme = false;
  informeParaEditar: Informe | null = null;
  savingInforme = false;

  showModalTarea = false;
  tareaParaEditar: InformeTarea | null = null;
  savingTarea = false;

  private _subs = new Subscription();

  constructor(
    private _proyectoService: ProyectoService,
    public state: SeguimientoStateService,
    private _cdr: ChangeDetectorRef
  ) {
    // Inicializar rango de fechas: últimos 12 meses
    const hoy = new Date();
    const haceUnAno = new Date();
    haceUnAno.setFullYear(hoy.getFullYear() - 1);

    this.fechaInicio = haceUnAno.toISOString().split('T')[0];
    this.fechaFin = hoy.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.cargarInformes();
    this.cargarProcesos();
  }

  ngOnDestroy(): void {
    this._subs.unsubscribe();
    this.destroyCharts();
  }

  cargarInformes(): void {
    this.loading = true;
    this._cdr.markForCheck();
    this._proyectoService.getInformes(this.usuarioId).subscribe({
      next: (res) => {
        this.informes = res.data || [];
        this.loading = false;
        this.actualizarMetricas();
        this._cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this._cdr.markForCheck();
      }
    });
  }

  cargarProcesos(): void {
    this._proyectoService.listarProcesosParaInformes().subscribe({
      next: (res) => {
        this.procesos = res.data || [];
        this._cdr.markForCheck();
      }
    });
  }

  cambiarSubVista(vista: 'listado' | 'indicadores'): void {
    this.subVista = vista;
    this.showDetalle = false;
    this._cdr.markForCheck();

    if (vista === 'indicadores') {
      setTimeout(() => {
        this.renderCharts();
      }, 50);
    } else {
      this.destroyCharts();
    }
  }

  cambiarVistaListado(vista: 'tarjetas' | 'lista'): void {
    this.vistaListado = vista;
    this._cdr.markForCheck();
  }

  aplicarFiltroFechas(): void {
    this.actualizarMetricas();
    if (this.subVista === 'indicadores') {
      this.renderCharts();
    }
    this._cdr.markForCheck();
  }

  actualizarMetricas(): void {
    const hoyStr = new Date().toISOString().split('T')[0];

    this.filteredInformes = this.informes.filter(inf => {
      const fecha = inf.fecha_evento;
      return fecha >= this.fechaInicio && fecha <= this.fechaFin;
    });

    this.kpiTotal = this.filteredInformes.length;
    this.kpiAbiertos = this.filteredInformes.filter(inf => inf.estado === 'abierto').length;
    this.kpiEnProceso = this.filteredInformes.filter(inf => inf.estado === 'en_proceso').length;
    this.kpiCerrados = this.filteredInformes.filter(inf => inf.estado === 'cerrado').length;
    
    this.kpiVencidos = this.filteredInformes.filter(inf => {
      if (inf.estado === 'cerrado') return false;
      if (inf.tareas_vencidas && inf.tareas_vencidas > 0) return true;
      if (inf.fecha_implementacion && inf.fecha_implementacion < hoyStr) return true;
      return false;
    }).length;

    // Lista de Críticos
    this.criticos = this.filteredInformes.filter(inf => inf.prioridad === 'Crítica');
  }

  // --- CHART GENERATION ---
  private renderCharts(): void {
    this.destroyCharts();

    this.renderStateChart();
    this.renderPriorityChart();
    this.renderProcessChart();
    this.renderTrendChart();
  }

  private destroyCharts(): void {
    if (this.stateChart) this.stateChart.destroy();
    if (this.priorityChart) this.priorityChart.destroy();
    if (this.processChart) this.processChart.destroy();
    if (this.trendChart) this.trendChart.destroy();

    this.stateChart = null;
    this.priorityChart = null;
    this.processChart = null;
    this.trendChart = null;
  }

  private renderStateChart(): void {
    const canvas = document.getElementById('stateChart') as HTMLCanvasElement;
    if (!canvas) return;

    this.stateChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Abierto', 'En Proceso', 'Cerrado'],
        datasets: [{
          data: [this.kpiAbiertos, this.kpiEnProceso, this.kpiCerrados],
          backgroundColor: ['#3b82f6', '#f59e0b', '#10b981'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  private renderPriorityChart(): void {
    const canvas = document.getElementById('priorityChart') as HTMLCanvasElement;
    if (!canvas) return;

    const count = (prio: string) => this.filteredInformes.filter(inf => inf.prioridad === prio).length;

    this.priorityChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Baja', 'Media', 'Alta', 'Crítica'],
        datasets: [{
          label: 'Hallazgos',
          data: [count('Baja'), count('Media'), count('Alta'), count('Crítica')],
          backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  private renderProcessChart(): void {
    const canvas = document.getElementById('processChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Agrupar por procesos
    const counts: { [name: string]: number } = {};
    this.filteredInformes.forEach(inf => {
      const pName = inf.proceso_nombre || 'Sin Proceso';
      counts[pName] = (counts[pName] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);

    this.processChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Hallazgos por Proceso',
          data: data,
          backgroundColor: '#6366f1',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  private renderTrendChart(): void {
    const canvas = document.getElementById('trendChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Generar lista de meses en el rango
    const months: string[] = [];
    let start = new Date(this.fechaInicio);
    const end = new Date(this.fechaFin);
    start.setDate(1); // Evitar problemas de salto de meses

    while (start <= end) {
      months.push(start.toISOString().slice(0, 7)); // YYYY-MM
      start.setMonth(start.getMonth() + 1);
    }

    const openedData: number[] = [];
    const closedData: number[] = [];

    months.forEach(m => {
      const opened = this.filteredInformes.filter(inf => inf.fecha_evento && inf.fecha_evento.slice(0, 7) === m).length;
      const closed = this.filteredInformes.filter(inf => inf.estado === 'cerrado' && inf.fecha_implementacion && inf.fecha_implementacion.slice(0, 7) === m).length;
      
      openedData.push(opened);
      closedData.push(closed);
    });

    const monthLabels = months.map(m => {
      const [year, month] = m.split('-');
      const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${names[parseInt(month) - 1]} ${year.slice(2)}`;
    });

    this.trendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: 'Creados/Abiertos',
            data: openedData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'Cerrados/Solucionados',
            data: closedData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  verDetalle(informe: Informe): void {
    this.loadingDetalle = true;
    this.showDetalle = true;
    this._cdr.markForCheck();

    this._proyectoService.getInformeDetalle(informe.id, this.usuarioId).subscribe({
      next: (res) => {
        this.detalle = res.data;
        this.loadingDetalle = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loadingDetalle = false;
        this.showDetalle = false;
        this._cdr.markForCheck();
      }
    });
  }

  cerrarDetalle(): void {
    this.showDetalle = false;
    this.detalle = null;
    this._cdr.markForCheck();
  }

  stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  }

  getImpactoClass(nivel: NivelImpacto): string {
    switch (nivel) {
      case 'Crítico': return 'bg-red-100 text-red-700 border-red-200';
      case 'Alto':    return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Medio':   return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Bajo':    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  getPrioridadClass(nivel: string | undefined): string {
    switch (nivel) {
      case 'Crítica': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Alta':    return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Media':   return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Baja':    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  // ── ACCIONES INFORME ─────────────────────────────────────────────

  abrirModalNuevoInforme(): void {
    this.informeParaEditar = null;
    this.showModalInforme = true;
    this._cdr.markForCheck();
  }

  editarInforme(inf: Informe): void {
    this.informeParaEditar = inf;
    this.showModalInforme = true;
    this._cdr.markForCheck();
  }

  onGuardarInforme(form: InformeForm): void {
    this.savingInforme = true;
    this._cdr.markForCheck();

    const body = {
      ...form,
      usuario_id: this.usuarioId
    };

    const req$ = this.informeParaEditar
      ? this._proyectoService.actualizarInforme(this.informeParaEditar.id, body)
      : this._proyectoService.crearInforme(body);

    req$.subscribe({
      next: () => {
        this.savingInforme = false;
        this.showModalInforme = false;
        this.state.showToast('Informe guardado');
        this.cargarInformes();
        if (this.detalle && this.informeParaEditar?.id === this.detalle.id) {
          this.verDetalle(this.detalle);
        }
      },
      error: () => {
        this.savingInforme = false;
        this.state.showToast('Error al guardar', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  eliminarInforme(inf: Informe): void {
    Swal.fire({
      title: '¿Eliminar informe?',
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar'
    }).then(res => {
      if (res.isConfirmed) {
        this._proyectoService.eliminarInforme(inf.id, this.usuarioId).subscribe({
          next: () => {
            this.state.showToast('Informe eliminado');
            this.cargarInformes();
            if (this.showDetalle) this.cerrarDetalle();
          },
          error: () => this.state.showToast('No se pudo eliminar', 'error')
        });
      }
    });
  }

  // ── ACCIONES TAREAS ──────────────────────────────────────────────

  abrirModalNuevaTarea(): void {
    this.tareaParaEditar = null;
    this.showModalTarea = true;
    this._cdr.markForCheck();
  }

  editarTarea(t: InformeTarea): void {
    this.tareaParaEditar = t;
    this.showModalTarea = true;
    this._cdr.markForCheck();
  }

  onGuardarTarea(form: InformeTareaForm): void {
    if (!this.detalle) return;
    this.savingTarea = true;
    this._cdr.markForCheck();

    const body = {
      ...form,
      informe_id: this.detalle.id,
      usuario_id: this.usuarioId
    };

    const req$ = this.tareaParaEditar
      ? this._proyectoService.actualizarInformeTarea(this.tareaParaEditar.id, body)
      : this._proyectoService.crearInformeTarea(body);

    req$.subscribe({
      next: () => {
        this.savingTarea = false;
        this.showModalTarea = false;
        this.state.showToast('Tarea guardada');
        this.verDetalle(this.detalle!);
      },
      error: () => {
        this.savingTarea = false;
        this.state.showToast('Error al guardar', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  eliminarTarea(t: InformeTarea): void {
    Swal.fire({
      title: '¿Eliminar tarea?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar'
    }).then(res => {
      if (res.isConfirmed) {
        this._proyectoService.eliminarInformeTarea(t.id, this.usuarioId).subscribe({
          next: () => {
            this.state.showToast('Tarea eliminada');
            this.verDetalle(this.detalle!);
          },
          error: () => this.state.showToast('No se pudo eliminar', 'error')
        });
      }
    });
  }

  completarTarea(t: InformeTarea): void {
    this._proyectoService.completarInformeTarea(t.id, this.usuarioId).subscribe({
      next: () => {
        this.state.showToast('Tarea completada');
        this.verDetalle(this.detalle!);
      }
    });
  }

  // ── DESCARGA PDF ──────────────────────────────────────────────────

  descargarPdf(): void {
    if (!this.detalle) return;
    const url = this._proyectoService.descargarPdfInformeUrl(this.detalle.id, this.usuarioId);
    window.open(url, '_blank');
  }
}
