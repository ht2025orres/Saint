import { Component, OnInit } from '@angular/core';
import { ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { getNombreInconsistencia } from '../../../shared/constants/inconsistencias.constants';

@Component({
  selector: 'app-dashboard-financiero-inconsistencias',
  templateUrl: './dashboard-financiero.component.html',
  styleUrls: ['./dashboard-financiero.component.css']
})
export class DashboardFinancieroInconsistenciasComponent implements OnInit {

  // ─── Filtros ────────────────────────────────────────────────────────────────
  selectedPeriodo: string = 'mes';
  selectedTipo: string = 'todos';
  selectedGrupo: string = 'todos';
  usarReclasificacion: boolean = true;

  fechaInicioPersonalizada: string = '';
  fechaFinPersonalizada: string = '';

  periodos = [
    { value: 'mes', label: 'Mes actual' },
    { value: 'trimestre', label: 'Trimestre actual' },
    { value: 'semestre', label: 'Semestre actual' },
    { value: 'anio', label: 'Año actual completo' },
    { value: 'anio_anterior', label: 'Año anterior completo' },
    { value: 'personalizado', label: 'Rango personalizado' }
  ];

  tipos: { value: string, label: string }[] = [
    { value: 'todos', label: 'Todos los tipos' }
  ];

  grupos: { value: any, label: string }[] = [
    { value: 'todos', label: 'Todos los procesos' }
  ];

  // ─── KPIs ───────────────────────────────────────────────────────────────────
  costoBrutoTotal: number = 0;
  costoNetoPerdidas: number = 0;
  costoNetoOP: number = 0;
  costoNetoGasto: number = 0;
  materialRecuperado: number = 0;
  ahorroAprovechamiento: number = 0;
  costoNetoAjustado: number = 0;
  notasCreditoAplicadas: number = 0;
  inconsistenciasPendientes: number = 0;
  valorPendienteConsumo: number = 0;
  tasaConsumo: number = 0;
  tiempoPromedioResolucion: number = 0;

  // ─── Modal de Detalles y Consumo ─────────────────────────────────────────────
  modalDetalleAbierto: boolean = false;
  modalDetalleTitulo: string = '';
  modalDetalleOrigen: string = '';
  modalDetalleFiltros: any = {};

  // ─── Vista 5: Tablas Analíticas ─────────────────────────────────────────────
  tablaGeneral: any[] = [];
  tablaAhorros: any[] = [];
  tablaOP: any[] = [];
  tablaGasto: any[] = [];
  tablasLoading: boolean = false;

  // ─── Drill-downs ────────────────────────────────────────────────────────────
  drilldownLoading: boolean = false;
  drilldownMotivosLoading: boolean = false;
  
  expandedRowId: string | null = null;
  drilldownItems: any[] = [];

  expandedItemId: string | null = null;
  drilldownMotivos: any[] = [];

  // ─── Chart 1: Línea — Evolución mensual ─────────────────────────────────────
  costoMensualChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        label: 'Costo Bruto',
        data: [],
        borderColor: '#002A3F',
        backgroundColor: 'rgba(0,42,63,0.06)',
        fill: false,
        tension: 0.3,
        pointBackgroundColor: '#002A3F',
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Pérdida Real (Al Gasto)',
        data: [],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.08)',
        fill: false,
        tension: 0.3,
        pointBackgroundColor: '#ef4444',
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Asumido por OP',
        data: [],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.08)',
        fill: false,
        tension: 0.3,
        pointBackgroundColor: '#f59e0b',
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Devoluciones y Aprovechamiento',
        data: [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.08)',
        fill: false,
        tension: 0.3,
        pointBackgroundColor: '#10b981',
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  };

  costoMensualChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#374151', font: { size: 12, family: 'Inter, sans-serif' }, padding: 16 }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${this.formatCurrency(ctx.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { color: '#6b7280', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          color: '#6b7280',
          font: { size: 11 },
          callback: (value) => this.formatCurrencyShort(+value)
        }
      }
    }
  };

  // ─── Chart 2: Doughnut — Distribución por tipos ──────────────────────────────
  distribucionTiposChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#6366f1', '#ec4899', '#6b7280', '#002A3F'],
      hoverOffset: 8,
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  distribucionTiposChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#374151', font: { size: 11 }, padding: 12, boxWidth: 14 }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0';
            return ` ${ctx.label}: ${this.formatCurrency(ctx.parsed)} (${pct}%)`;
          }
        }
      }
    }
  };

  // ─── Chart 2b: Doughnut — Clasificación del Impacto (4 categorías) ───────────
  clasificacionImpactoChartData: ChartData<'doughnut'> = {
    labels: ['Pérdida Real (Al Gasto)', 'Asumido por OP', 'Dinero en Devoluciones', 'Dinero en Aprovechamiento'],
    datasets: [{
      data: [0, 0, 0, 0],
      backgroundColor: ['#ef4444', '#f97316', '#10b981', '#6366f1'],
      hoverOffset: 10,
      borderWidth: 3,
      borderColor: '#ffffff'
    }]
  };

  clasificacionImpactoChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#374151', font: { size: 12, weight: '500' }, padding: 16, boxWidth: 14 }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0';
            return ` ${ctx.label}: ${this.formatCurrency(ctx.parsed)} (${pct}%)`;
          }
        }
      }
    }
  };

  // ─── Chart 3: Barras horizontales — Top tipos por costo ──────────────────────
  costoPorTipoChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Costo Total',
      data: [],
      backgroundColor: ['#002A3F', '#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#6366f1', '#ec4899', '#6b7280'],
      borderRadius: 6,
      borderSkipped: false
    }]
  };

  costoPorTipoChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const datos = ctx.dataset.data as number[];
            const total = datos.reduce((a, b) => a + (b as number), 0);
            const pct = total > 0 ? ((ctx.parsed.x / total) * 100).toFixed(1) : '0.0';
            return ` ${this.formatCurrency(ctx.parsed.x)} · ${pct}% del total`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { color: '#6b7280', font: { size: 11 }, callback: (v) => this.formatCurrencyShort(+v) }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#374151', font: { size: 11 } }
      }
    }
  };

  // ─── Chart 5: Barras agrupadas — Consumo por mes ────────────────────────────
  consumoChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        label: 'Consumidas',
        data: [],
        backgroundColor: '#10b981',
        borderRadius: 5,
        borderSkipped: false
      },
      {
        label: 'Por Consumir',
        data: [],
        backgroundColor: '#f59e0b',
        borderRadius: 5,
        borderSkipped: false
      }
    ]
  };

  consumoChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#374151', font: { size: 12 }, padding: 16 }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} inconsistencias`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#374151', font: { size: 12 } }
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.05)' },
        beginAtZero: true,
        ticks: { color: '#6b7280', font: { size: 11 }, stepSize: 5 }
      }
    }
  };

  // ─── Tipos de chart ──────────────────────────────────────────────────────────
  lineChartType: ChartConfiguration['type'] = 'line';
  doughnutChartType: ChartConfiguration['type'] = 'doughnut';
  barChartType: ChartConfiguration['type'] = 'bar';

  loading: boolean = true;

  constructor(private inconsistenciaService: InconsistenciaService) {}

  ngOnInit(): void {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    this.fechaInicioPersonalizada = `${yyyy}-${mm}-01`;
    this.fechaFinPersonalizada = `${yyyy}-${mm}-${dd}`;

    this.cargarFiltrosDisponibles();
    this.cargarDatos();
  }

  cargarFiltrosDisponibles(): void {
    this.inconsistenciaService.getDepartamentos().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.grupos = [
            { value: 'todos', label: 'Todos los procesos' },
            ...res.data.map((d: any) => ({
              value: d.id,
              label: d.nombre || d.nombre_departamento || `Proceso ${d.id}`
            }))
          ];
        }
      },
      error: (err) => console.error('Error cargando departamentos', err)
    });

    this.inconsistenciaService.getTiposInconsistencia().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.tipos = [
            { value: 'todos', label: 'Todos los tipos' },
            ...res.data.map((t: string) => ({
              value: t,
              label: this.getNombreInconsistencia(t)
            }))
          ];
        }
      },
      error: (err) => console.error('Error cargando tipos de inconsistencia', err)
    });
  }

  onFiltroChange() {
    if (this.selectedPeriodo === 'personalizado') {
      if (!this.fechaInicioPersonalizada || !this.fechaFinPersonalizada) {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = String(hoy.getDate()).padStart(2, '0');
        this.fechaInicioPersonalizada = this.fechaInicioPersonalizada || `${yyyy}-${mm}-01`;
        this.fechaFinPersonalizada = this.fechaFinPersonalizada || `${yyyy}-${mm}-${dd}`;
      }
    }
    this.cargarDatos();
  }

  onFechaPersonalizadaChange() {
    if (this.selectedPeriodo === 'personalizado' && this.fechaInicioPersonalizada && this.fechaFinPersonalizada) {
      this.cargarDatos();
    }
  }

  getFiltrosActuales() {
    const filtros: any = {};
    
    // Filtro de tipo
    if (this.selectedTipo !== 'todos') {
      filtros.tipo_inconsistencia = this.selectedTipo;
    }

    // Filtro de grupo (departamento/proceso)
    if (this.selectedGrupo !== 'todos') {
      filtros.departamento = this.selectedGrupo;
    }

    // Si el período es personalizado, tomar las fechas seleccionadas directamente
    if (this.selectedPeriodo === 'personalizado') {
      if (this.fechaInicioPersonalizada && this.fechaFinPersonalizada) {
        filtros.fecha_inicio = this.fechaInicioPersonalizada;
        filtros.fecha_fin = this.fechaFinPersonalizada;
        return filtros;
      }
    }

    // Calcular fechas según el periodo
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    
    let fechaInicio = new Date(anioActual, 0, 1);
    let fechaFin = new Date(anioActual, 11, 31, 23, 59, 59);

    if (this.selectedPeriodo === 'mes') {
      fechaInicio = new Date(anioActual, mesActual, 1);
      fechaFin = new Date(anioActual, mesActual + 1, 0, 23, 59, 59);
    } else if (this.selectedPeriodo === 'trimestre') {
      const inicioTrimestre = Math.floor(mesActual / 3) * 3;
      fechaInicio = new Date(anioActual, inicioTrimestre, 1);
      fechaFin = new Date(anioActual, inicioTrimestre + 3, 0, 23, 59, 59);
    } else if (this.selectedPeriodo === 'semestre') {
      const inicioSemestre = mesActual < 6 ? 0 : 6;
      fechaInicio = new Date(anioActual, inicioSemestre, 1);
      fechaFin = new Date(anioActual, inicioSemestre + 6, 0, 23, 59, 59);
    } else if (this.selectedPeriodo === 'anio_anterior') {
      fechaInicio = new Date(anioActual - 1, 0, 1);
      fechaFin = new Date(anioActual - 1, 11, 31, 23, 59, 59);
    }

    const formatearFecha = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    filtros.fecha_inicio = formatearFecha(fechaInicio);
    filtros.fecha_fin = formatearFecha(fechaFin);
    filtros.usar_reclasificacion = this.usarReclasificacion;

    return filtros;
  }

  cargarDatos() {
    this.loading = true;
    const filtros = this.getFiltrosActuales();
    
    // Cargar las tablas de la Vista 5
    this.cargarTablasFinancieras(filtros);
    
    this.inconsistenciaService.getDashboardFinanciero(filtros).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const kpis = res.data.kpis;
          this.costoBrutoTotal = kpis.costoBrutoTotal || 0;
          this.costoNetoPerdidas = kpis.costoNetoPerdidas || 0;
          this.costoNetoOP = kpis.costoNetoOP || 0;
          this.costoNetoGasto = kpis.costoNetoGasto || 0;
          this.materialRecuperado = kpis.materialRecuperado || 0;
          this.ahorroAprovechamiento = kpis.ahorroAprovechamiento || 0;
          this.costoNetoAjustado = kpis.costoNetoAjustado || 0;
          this.notasCreditoAplicadas = kpis.notasCreditoAplicadas || 0;
          this.inconsistenciasPendientes = kpis.inconsistenciasPendientes || 0;
          this.valorPendienteConsumo = kpis.valorPendienteConsumo || 0;
          this.tasaConsumo = kpis.tasaConsumo || 0;
          this.tiempoPromedioResolucion = kpis.tiempoPromedioResolucion || 0;

          // Chart 1: Evolución mensual
          if (res.data.charts.costoMensual) {
            this.costoMensualChartData.labels = res.data.charts.costoMensual.labels;
            this.costoMensualChartData.datasets[0].data = res.data.charts.costoMensual.bruto;
            this.costoMensualChartData.datasets[1].data = res.data.charts.costoMensual.gasto || [];
            
            // Asumido por OP = Neto - Gasto
            const opData = (res.data.charts.costoMensual.neto || []).map((val: number, idx: number) => {
              const gastoVal = (res.data.charts.costoMensual.gasto && res.data.charts.costoMensual.gasto[idx]) || 0;
              return Math.max(0, val - gastoVal);
            });
            this.costoMensualChartData.datasets[2].data = opData;
            this.costoMensualChartData.datasets[3].data = res.data.charts.costoMensual.recuperado;
          }

          // Chart 2: Top tipos
          if (res.data.charts.tipos) {
            const rawLabels = res.data.charts.tipos.labels || [];
            const formattedLabels = rawLabels.map((l: string) => this.getNombreInconsistencia(l));

            this.distribucionTiposChartData.labels = formattedLabels;
            this.distribucionTiposChartData.datasets[0].data = res.data.charts.tipos.data;
            
            this.costoPorTipoChartData.labels = formattedLabels;
            this.costoPorTipoChartData.datasets[0].data = res.data.charts.tipos.data;
          }

          // Chart 3: Consumo por mes
          if (res.data.charts.consumo) {
            this.consumoChartData.labels = res.data.charts.consumo.labels;
            this.consumoChartData.datasets[0].data = res.data.charts.consumo.consumidas;
            this.consumoChartData.datasets[1].data = res.data.charts.consumo.pendientes;
          }
          
          // Clasificación de impacto (4 categorías desde KPIs: Gasto, OP, Devolución, Aprovechamiento)
          this.clasificacionImpactoChartData.datasets[0].data = [
            kpis.costoNetoGasto || 0,
            kpis.costoNetoOP || 0,
            kpis.materialRecuperado || 0,
            kpis.ahorroAprovechamiento || 0
          ];
          this.clasificacionImpactoChartData = { ...this.clasificacionImpactoChartData };

          // Re-trigger ng2-charts to update
          this.costoMensualChartData = { ...this.costoMensualChartData };
          this.distribucionTiposChartData = { ...this.distribucionTiposChartData };
          this.costoPorTipoChartData = { ...this.costoPorTipoChartData };
          this.consumoChartData = { ...this.consumoChartData };
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando dashboard financiero', err);
        this.loading = false;
      }
    });
  }

  cargarTablasFinancieras(filtros: any) {
    this.tablasLoading = true;
    this.expandedRowId = null;
    this.expandedItemId = null;
    
    this.inconsistenciaService.getTablasFinancieras(filtros).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.tablaGeneral = res.data.tabla_general || [];
          this.tablaAhorros = res.data.tabla_ahorros || [];
          this.tablaOP = res.data.tabla_op || [];
          this.tablaGasto = res.data.tabla_gasto || [];
        }
        this.tablasLoading = false;
      },
      error: (err) => {
        console.error('Error cargando tablas', err);
        this.tablasLoading = false;
      }
    });
  }

  toggleDrilldownNivel1(tipo: string, tablaOrigen: string) {
    const rowId = `${tablaOrigen}_${tipo}`;
    
    if (this.expandedRowId === rowId) {
      this.expandedRowId = null;
      this.expandedItemId = null;
      return;
    }

    this.expandedRowId = rowId;
    this.expandedItemId = null;
    this.drilldownLoading = true;
    this.drilldownItems = [];

    const filtros = this.getFiltrosActuales();

    this.inconsistenciaService.getDrilldownItems(tipo, tablaOrigen, filtros).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.drilldownItems = res.data;
        }
        this.drilldownLoading = false;
      },
      error: (err) => {
        console.error('Error cargando Nivel 1', err);
        this.drilldownLoading = false;
      }
    });
  }

  toggleDrilldownNivel2(tipo: string, item: string, tablaOrigen: string) {
    const itemId = `${tablaOrigen}_${tipo}_${item}`;

    if (this.expandedItemId === itemId) {
      this.expandedItemId = null;
      return;
    }

    this.expandedItemId = itemId;
    this.drilldownMotivosLoading = true;
    this.drilldownMotivos = [];

    const filtros = this.getFiltrosActuales();

    this.inconsistenciaService.getDrilldownMotivos(tipo, item, tablaOrigen, filtros).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.drilldownMotivos = res.data;
        }
        this.drilldownMotivosLoading = false;
      },
      error: (err) => {
        console.error('Error cargando Nivel 2', err);
        this.drilldownMotivosLoading = false;
      }
    });
  }

  getNombreInconsistencia(key: string): string {
    return getNombreInconsistencia(key);
  }

  // ─── Utilidades de formato ───────────────────────────────────────────────────
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-CO').format(value);
  }

  formatCurrencyShort(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
  }

  getProgressCircleStyle(pct: number): string {
    const deg = (pct / 100) * 360;
    return `conic-gradient(#10b981 ${deg}deg, #e5e7eb ${deg}deg)`;
  }

  // ─── Modal de Detalles (delegated to sub-component) ────────────────────────
  abrirModalDetalle(origen: string, titulo: string, filtroExtra: any = {}): void {
    this.modalDetalleOrigen = origen;
    this.modalDetalleTitulo = titulo;
    this.modalDetalleFiltros = { ...this.getFiltrosActuales(), ...filtroExtra };
    this.modalDetalleAbierto = true;
  }

  cerrarModalDetalle(): void {
    this.modalDetalleAbierto = false;
  }
}
