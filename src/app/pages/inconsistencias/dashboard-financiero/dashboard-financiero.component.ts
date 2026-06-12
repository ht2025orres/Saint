import { Component, OnInit } from '@angular/core';
import { ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
import { InconsistenciaService } from '../../../services/inconsistencia.service';

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

  periodos = [
    { value: 'mes', label: 'Mes actual' },
    { value: 'trimestre', label: 'Trimestre actual' },
    { value: 'semestre', label: 'Semestre actual' },
    { value: 'anio', label: 'Año completo' },
    { value: 'anio_anterior', label: 'Año anterior completo' }
  ];

  tipos = [
    { value: 'todos', label: 'Todos los tipos' },
    { value: 'error_operario', label: 'Error de Operario' },
    { value: 'prenda_imperfectos', label: 'Prenda con Imperfectos' },
    { value: 'dano_maquina', label: 'Daño por Máquina' },
    { value: 'faltante_materiales', label: 'Faltante Materiales' },
    { value: 'perdida_insumos', label: 'Pérdida de Insumos' },
    { value: 'error_patronaje', label: 'Error en Patronaje' },
    { value: 'imperfeccion_tela', label: 'Imperfecto en Tela' }
  ];

  grupos = [
    { value: 'todos', label: 'Todos los grupos' },
    { value: 'produccion', label: 'Producción' },
    { value: 'calidad', label: 'Calidad' },
    { value: 'logistica', label: 'Logística' },
    { value: 'patronaje', label: 'Patronaje' }
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
  costoTiempoTotal: number = 0;
  tarifaHora: number = 8_000;

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
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#ef4444',
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Costo Neto',
        data: [],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#f59e0b',
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Material Recuperado',
        data: [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.08)',
        fill: true,
        tension: 0.4,
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
        labels: { color: '#374151', font: { size: 12, family: 'Inter, sans-serif' }, padding: 20 }
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
            const pct = ((ctx.parsed / total) * 100).toFixed(1);
            return ` ${ctx.label}: ${this.formatCurrency(ctx.parsed)} (${pct}%)`;
          }
        }
      }
    }
  };

  // ─── Chart 2b: Doughnut — Clasificación del Impacto (4 categorías) ───────────
  clasificacionImpactoChartData: ChartData<'doughnut'> = {
    labels: ['Sobrecosto (Al Gasto)', 'Asumido por OP', 'Dinero en Devoluciones', 'Dinero en Aprovechamiento'],
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

  // ─── Chart 4: Barras apiladas — Costo de tiempo por etapa ───────────────────
  costoTiempoChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        label: 'Costo por Hora (×8000)',
        data: [],
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#6366f1', '#ef4444'],
        borderRadius: 6,
        borderSkipped: false
      }
    ]
  };

  costoTiempoChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const horas = ctx.parsed.y / this.tarifaHora;
            return [
              ` Costo: ${this.formatCurrency(ctx.parsed.y)}`,
              ` Horas: ${horas}h × $${this.formatNumber(this.tarifaHora)}/h`
            ];
          }
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
        ticks: { color: '#6b7280', font: { size: 11 }, callback: (v) => this.formatCurrencyShort(+v) }
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
    this.cargarDatos();
  }

  onFiltroChange() {
    this.cargarDatos();
  }

  getFiltrosActuales() {
    const filtros: any = {};
    
    // Filtro de tipo
    if (this.selectedTipo !== 'todos') {
      filtros.tipo_inconsistencia = this.selectedTipo;
    }

    // Filtro de grupo (etapa)
    if (this.selectedGrupo !== 'todos') {
      filtros.etapa = this.selectedGrupo;
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
          this.costoTiempoTotal = kpis.costoTiempoTotal || 0;

          // Charts
          if (res.data.charts.costoMensual) {
            this.costoMensualChartData.labels = res.data.charts.costoMensual.labels;
            this.costoMensualChartData.datasets[0].data = res.data.charts.costoMensual.bruto;
            this.costoMensualChartData.datasets[1].data = res.data.charts.costoMensual.neto;
            this.costoMensualChartData.datasets[2].data = res.data.charts.costoMensual.recuperado;
          }

          if (res.data.charts.tipos) {
            this.distribucionTiposChartData.labels = res.data.charts.tipos.labels;
            this.distribucionTiposChartData.datasets[0].data = res.data.charts.tipos.data;
            
            this.costoPorTipoChartData.labels = res.data.charts.tipos.labels;
            this.costoPorTipoChartData.datasets[0].data = res.data.charts.tipos.data;
          }

          if (res.data.charts.tiempo) {
            this.costoTiempoChartData.labels = res.data.charts.tiempo.labels;
            this.costoTiempoChartData.datasets[0].data = res.data.charts.tiempo.data;
          }

          if (res.data.charts.consumo) {
            this.consumoChartData.labels = res.data.charts.consumo.labels;
            this.consumoChartData.datasets[0].data = res.data.charts.consumo.consumidas;
            this.consumoChartData.datasets[1].data = res.data.charts.consumo.pendientes;
          }
          
          // Clasificación de impacto (4 categorías desde KPIs)
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
          this.costoTiempoChartData = { ...this.costoTiempoChartData };
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
    const mapping: any = {
      'ajuste_promedio': 'Ajuste de Promedio',
      'aprovechamiento_insumos': 'Aprovechamiento de Insumos',
      'cancelacion_pedido': 'Cancelación de Pedido',
      'dano_maquina': 'Daño por Máquina',
      'devolucion_materiales': 'Devolución a la OP',
      'documental_calidad': 'Documental Calidad',
      'documental_contabilidad': 'Documental Contabilidad',
      'empate_tendido': 'Empate de Tendido en Corte',
      'error_bordado': 'Error de Bordado',
      'error_corte': 'Error de Corte',
      'error_operario': 'Error de Operario',
      'error_patronaje': 'Error en Patronaje',
      'faltante_lista_materiales': 'Faltante en Lista de Materiales',
      'faltante_materiales': 'Faltante en Cantidad',
      'faltante_rollo': 'Faltante en Rollo de Tela',
      'imperfeccion_tela': 'Imperfecto en Tela',
      'insumo_imperfecto': 'Insumo Imperfecto',
      'montaje_modulo': 'Montaje de Módulo',
      'perdida_insumos': 'Pérdida de Insumo en Planta',
      'perdida_piezas': 'Pérdida de Piezas en Corte',
      'prenda_imperfectos': 'Prenda con Imperfectos',
      'reposicion_produccion': 'Reposición por Producción',
      'sobrante_tela': 'Sobrante en Rollo de Tela'
    };
    return mapping[key] || key;
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
}
