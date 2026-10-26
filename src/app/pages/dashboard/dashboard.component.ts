import { Component, OnInit, OnDestroy } from '@angular/core';
import { MetricsService, ProduccionFlujoData } from 'src/app/services/metrics.service';
import { BillingService } from 'src/app/services/billing.service';
import { InventarioService, BodegaSummary, ItemBodega } from 'src/app/services/inventario.service';
import { AuthService } from 'src/app/services/auth.service';
import { ProcessMetric } from 'src/app/models/process-metric.model';
import Chart, { ChartConfiguration } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(ChartDataLabels);

interface BillingData {
  totalPresupuesto: number;
  totalReal: number;
  totalDiferencia: number;
  totalDiferenciaConCreditos?: number;
  porcentajeEjecutado: number;
  porcentajeEjecutadoConCreditos?: number;
  remisionadoMesActual?: number;
  remisionadoMesActualConCreditos?: number;
  remisionadoMesAnterior?: number;
  isPastMonth?: boolean;
  detalleUnidades: Array<{
    unidad: string;
    descripcion: string;
    presupuesto: number;
    real: number;
    diferencia: number;
    diferenciaConCreditos?: number;
    porcentajeEjecutado: number;
    porcentajeEjecutadoConCreditos?: number;
    remisionadoMesActual?: number;
    remisionadoMesActualConCreditos?: number;
    remisionadoMesAnterior?: number;
  }>;
}

interface InvoiceDetail {
  nro_factura: string;
  fecha_factura: string;
  cliente: string;
  codigo_item: string;
  descripcion_item: string;
  cantidad: number;
  precio_unitario: number;
  valor_bruto: number;
  items?: InvoiceItem[];
  expanded?: boolean;
}

interface InvoiceItem {
  codigo_item: string;
  descripcion_item: string;
  cantidad: number;
  precio_unitario: number;
  valor_bruto: number;
}

interface ShipmentDetail {
  nro_documento: string;
  fecha: string;
  cliente_despacho: string;
  pedido_documento: string;
  valor_bruto: number;
  items?: ShipmentItem[];
  expanded?: boolean;
}

interface ShipmentItem {
  codigo_item: string;
  descripcion_item: string;
  cantidad: number;
  precio_unitario: number;
  valor_bruto: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  metrics: ProcessMetric[] = [];
  isAdmin: boolean = false;
  isBillingConsultant: boolean = false;
  activeTab: string = 'production';
  
  // Billing data
  billingData: BillingData | null = null;
  loading: boolean = false;
  selectedYear: number = new Date().getFullYear();
  selectedMonth: number = new Date().getMonth() + 1;
  selectedPlan: string = '008';
  availableYears: number[] = [];
  
  // Inventory data
  warehousesSummary: BodegaSummary[] = [];
  warehouseItems: ItemBodega[] = [];
  selectedWarehouse: string = '';
  loadingWarehouses: boolean = false;
  loadingWarehouseItems: boolean = false;
  warehouseSearchTerm: string = '';
  
  // Tabla principal - Filtros
  filterUnidad: string = '';
  
  // Modal de facturas
  showInvoiceModal: boolean = false;
  invoiceDetails: InvoiceDetail[] = [];
  groupedInvoices: Map<string, InvoiceDetail> = new Map();
  loadingInvoices: boolean = false;
  selectedUnit: string = '';
  
  // Paginación y filtros del modal de facturas
  currentPage: number = 1;
  pageSize: number = 10;
  searchTerm: string = '';
  filterByUN: string = '';
  availableUnits: string[] = [];
  
  // Modal de remisiones
  showShipmentModal: boolean = false;
  shipmentDetails: ShipmentDetail[] = [];
  groupedShipments: Map<string, ShipmentDetail> = new Map();
  loadingShipments: boolean = false;
  
  // Paginación y filtros del modal de remisiones
  shipmentCurrentPage: number = 1;
  shipmentPageSize: number = 10;
  shipmentSearchTerm: string = '';
  shipmentFilterByUN: string = '';

  previousShipmentsDetail: Map<string, any> = new Map();
  showTooltip: Map<string, boolean> = new Map();
  tooltipPosition: Map<string, {top: number, left: number}> = new Map();
  
  private charts: Map<string, any> = new Map();
  
  Math = Math;

  constructor(
    private metricsService: MetricsService,
    private billingService: BillingService,
    private inventoryService: InventarioService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    // Verificar roles
    this.isAdmin = this.authService.hasPermission(1);
    this.isBillingConsultant = this.authService.hasPermission(35);
    
    // Determinar el tab inicial según el rol
    if (this.isAdmin || this.isBillingConsultant) {
      if (this.isBillingConsultant && !this.isAdmin) {
        // Si solo es consultor de facturación, inicia en billing
        this.activeTab = 'billing';
        this.loadBillingData();
      } else if (this.isAdmin) {
        // Si es admin, carga métricas de producción por defecto
        this.loadMetrics();
      }
      
      this.initializeYears();
    }
  }

  get totalFilteredInvoices(): number {
    return this.filteredInvoices.reduce((sum, inv) => sum + inv.valor_bruto, 0);
  }

  // Método helper para verificar si debe mostrar las pestañas
  shouldShowTab(tab: string): boolean {
    // Si es admin, puede ver todas las pestañas
    if (this.isAdmin) {
      return true;
    }
    
    // Si es consultor de facturación, solo puede ver billing
    if (this.isBillingConsultant) {
      return tab === 'billing';
    }
    
    return false;
  }

  private lastBillingPeriod: string | null = null;

  setTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'billing') {
      this.loadBillingData(false);
    } else if (tab === 'inventory') {
      this.loadWarehousesData(false);
    } else if (tab === 'production') {
      this.loadMetrics();
    }
  }

  loadPreviousShipmentsDetail(forceRefresh: boolean = false): void {
    this.billingService.getPreviousShipmentsDetail(
      this.selectedYear, 
      this.selectedMonth,
      undefined,
      forceRefresh
    ).subscribe({
      next: (data) => {
        this.previousShipmentsDetail.clear();
        data.forEach((item: any) => {
          this.previousShipmentsDetail.set(item.unidad_negocio, item.detalle_por_mes);
        });
      },
      error: (error) => {
        console.error('Error loading previous shipments detail:', error);
      }
    });
  }

  ngOnDestroy(): void {
    this.charts.forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
  }

  initializeYears(): void {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 2; i <= currentYear + 1; i++) {
      this.availableYears.push(i);
    }
  }

  loadingProduction: boolean = false;
  produccionData: ProduccionFlujoData = {
    producido: 3200,
    terminado: 2900,
    empacado: 2750,
    wip_terminacion: 300,
    wip_empaque: 150,
    total_wip: 450,
    eficiencia_terminacion: 91,
    eficiencia_empaque: 95,
    eficiencia_global: 86,
    ops_activas: 12,
    periodo: 'mes_actual',
    timestamp: new Date().toISOString()
  };

  get totalProducido(): number {
    return this.produccionData?.producido ?? 3200;
  }

  get totalTerminado(): number {
    return this.produccionData?.terminado ?? 2900;
  }

  get totalEmpacado(): number {
    return this.produccionData?.empacado ?? 2750;
  }

  get totalWip(): number {
    return this.produccionData?.total_wip ?? 450;
  }

  get wipTerminacion(): number {
    return this.produccionData?.wip_terminacion ?? 300;
  }

  get wipEmpaque(): number {
    return this.produccionData?.wip_empaque ?? 150;
  }

  get avanceTerminacion(): number {
    return this.produccionData?.eficiencia_terminacion ?? 91;
  }

  get avanceEmpaque(): number {
    return this.produccionData?.eficiencia_empaque ?? 95;
  }

  get eficienciaGlobal(): number {
    return this.produccionData?.eficiencia_global ?? 86;
  }

  get opsActivas(): number {
    return this.produccionData?.ops_activas ?? 12;
  }

  get retencionTerminacion(): number {
    if (!this.totalProducido) return 0;
    return Math.round((this.wipTerminacion / this.totalProducido) * 1000) / 10;
  }

  get retencionEmpaque(): number {
    if (!this.totalTerminado) return 0;
    return Math.round((this.wipEmpaque / this.totalTerminado) * 1000) / 10;
  }

  loadMetrics(forceRefresh: boolean = false): void {
    this.loadingProduction = true;
    this.metricsService.getFlujoPlanta().subscribe({
      next: (data) => {
        if (data) {
          this.produccionData = data;
        }
        this.loadingProduction = false;
        setTimeout(() => this.renderProductionChart(), 120);
      },
      error: () => {
        this.loadingProduction = false;
        setTimeout(() => this.renderProductionChart(), 120);
      }
    });
  }

  renderProductionChart(): void {
    const canvas = document.getElementById('productionFlowChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.charts.has('productionFlow')) {
      this.charts.get('productionFlow')?.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const d = this.produccionData;
    const entradas = [d.producido, d.producido, d.terminado];
    const salidas = [d.producido, d.terminado, d.empacado];
    const wip = [0, d.wip_terminacion, d.wip_empaque];

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['1. Confección (Producción)', '2. Terminación & Acabados', '3. Empaque & P.T.'],
        datasets: [
          {
            label: 'Entradas (Recibidas)',
            data: entradas,
            backgroundColor: 'rgba(59, 130, 246, 0.85)',
            borderColor: '#2563eb',
            borderWidth: 1.5,
            borderRadius: 6
          },
          {
            label: 'Salidas (Procesadas)',
            data: salidas,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: '#059669',
            borderWidth: 1.5,
            borderRadius: 6
          },
          {
            label: 'En Proceso (WIP)',
            data: wip,
            backgroundColor: 'rgba(245, 158, 11, 0.85)',
            borderColor: '#d97706',
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { size: 11, weight: 'bold' },
              color: '#475569'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: 10,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${context.parsed.y.toLocaleString('es-CO')} prendas`
            }
          },
          datalabels: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.6)' },
            ticks: {
              font: { size: 11 },
              color: '#64748b',
              callback: (value) => (value as number).toLocaleString('es-CO')
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11, weight: 'bold' },
              color: '#334155'
            }
          }
        }
      }
    });

    this.charts.set('productionFlow', chart);
  }

  private billingDataCache: Map<string, BillingData> = new Map();
  private warehouseItemsCache: Map<string, ItemBodega[]> = new Map();

  get totalValorBodegas(): number {
    if (!this.warehousesSummary || this.warehousesSummary.length === 0) return 0;
    return this.warehousesSummary.reduce((sum, w) => sum + (parseFloat(w.valor_total as any) || 0), 0);
  }

  get totalItemsBodegas(): number {
    if (!this.warehousesSummary || this.warehousesSummary.length === 0) return 0;
    return this.warehousesSummary.reduce((sum, w) => sum + (parseFloat(w.total_items as any) || 0), 0);
  }

  get totalExistenciasBodegas(): number {
    if (!this.warehousesSummary || this.warehousesSummary.length === 0) return 0;
    return this.warehousesSummary.reduce((sum, w) => sum + (parseFloat(w.total_existencias as any) || 0), 0);
  }

  loadBillingData(forceRefresh: boolean = false): void {
    const periodo = parseInt(`${this.selectedYear}${this.selectedMonth.toString().padStart(2, '0')}`);
    const cacheKey = `${this.selectedYear}-${this.selectedPlan}-${periodo}`;

    // Si ya tenemos los datos en caché en memoria y no es forzado, mostrar de inmediato sin espera
    if (!forceRefresh && this.billingDataCache.has(cacheKey)) {
      this.billingData = this.billingDataCache.get(cacheKey)!;
      this.lastBillingPeriod = cacheKey;
      setTimeout(() => this.renderAllCharts(), 60);
      return;
    }

    this.loading = true;
    this.lastBillingPeriod = cacheKey;
    
    this.billingService.getBillingData(this.selectedYear, this.selectedPlan, periodo, forceRefresh).subscribe({
      next: (data) => {
        this.billingData = data;
        this.billingDataCache.set(cacheKey, data);
        this.loading = false;
        this.loadPreviousShipmentsDetail(forceRefresh);
        setTimeout(() => this.renderAllCharts(), 60);
      },
      error: (error) => {
        console.error('Error loading billing data:', error);
        this.loading = false;
      }
    });
  }

  getSelectedWarehouseName(): string {
    const w = this.warehousesSummary.find(item => item.codigo === this.selectedWarehouse);
    return w ? w.nombre_bodega : (this.selectedWarehouse || 'Sin selección');
  }

  // MÉTODOS PARA BODEGAS
  loadWarehousesData(forceRefresh: boolean = false): void {
    // Si ya tenemos bodegas cargadas y no es refresco forzado, evitar re-consultar
    if (!forceRefresh && this.warehousesSummary && this.warehousesSummary.length > 0) {
      if (!this.selectedWarehouse && this.warehousesSummary.length > 0) {
        this.loadWarehouseItems(this.warehousesSummary[0].codigo);
      }
      setTimeout(() => this.renderWarehouseCharts(), 60);
      return;
    }

    this.loadingWarehouses = true;
    this.inventoryService.getWarehousesSummary(forceRefresh).subscribe({
      next: (data) => {
        const list = Array.isArray(data) ? data : ((data as any)?.data || []);
        const sanitized = list.map(w => ({
          ...w,
          valor_total: parseFloat(w.valor_total as any) || 0,
          total_items: parseInt(w.total_items as any, 10) || 0,
          total_existencias: parseFloat(w.total_existencias as any) || 0
        }));
        this.warehousesSummary = sanitized;
        this.loadingWarehouses = false;
        if (!this.selectedWarehouse && sanitized.length > 0) {
          this.loadWarehouseItems(sanitized[0].codigo);
        }
        setTimeout(() => this.renderWarehouseCharts(), 60);
      },
      error: (error) => {
        console.error('Error loading warehouses data:', error);
        this.loadingWarehouses = false;
      }
    });
  }

  loadWarehouseItems(codigoBodega: string): void {
    this.selectedWarehouse = codigoBodega;

    if (this.warehouseItemsCache.has(codigoBodega)) {
      this.warehouseItems = this.warehouseItemsCache.get(codigoBodega)!;
      return;
    }

    this.loadingWarehouseItems = true;
    this.inventoryService.getWarehouseItems(codigoBodega).subscribe({
      next: (data) => {
        const list = Array.isArray(data) ? data : ((data as any)?.data || []);
        const sanitized = list.map(item => ({
          ...item,
          cantidad: parseFloat(item.cantidad as any) || 0,
          costo_prom_unitario: parseFloat(item.costo_prom_unitario as any) || 0,
          costo_prom_total: parseFloat(item.costo_prom_total as any) || 0
        }));
        this.warehouseItems = sanitized;
        this.warehouseItemsCache.set(codigoBodega, sanitized);
        this.loadingWarehouseItems = false;
      },
      error: (error) => {
        console.error('Error loading warehouse items:', error);
        this.warehouseItems = [];
        this.loadingWarehouseItems = false;
      }
    });
  }

  get filteredWarehouseItems(): ItemBodega[] {
    if (!this.warehouseSearchTerm) return this.warehouseItems;
    
    const searchLower = this.warehouseSearchTerm.toLowerCase();
    return this.warehouseItems.filter(item => 
      item.id_item.toLowerCase().includes(searchLower) ||
      item.descripcion.toLowerCase().includes(searchLower) ||
      item.referencia?.toLowerCase().includes(searchLower)
    );
  }

  renderWarehouseCharts(): void {
    if (!this.warehousesSummary || this.warehousesSummary.length === 0) return;
    
    // Destruir únicamente gráficos de bodegas para no afectar producción ni facturación
    ['warehouseValue', 'warehouseItems'].forEach(key => {
      this.charts.get(key)?.destroy();
      this.charts.delete(key);
    });
    
    requestAnimationFrame(() => {
      this.renderWarehouseValueChart();
      this.renderWarehouseItemsChart();
    });
  }

  renderWarehouseValueChart(): void {
    const canvas = document.getElementById('warehouseValueChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: this.warehousesSummary.map(w => w.nombre_bodega),
        datasets: [{
          label: 'Valor Total Inventario',
          data: this.warehousesSummary.map(w => w.valor_total),
          backgroundColor: '#6366f1',
          hoverBackgroundColor: '#4f46e5',
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (context) => ` Valor Total: $${(context.parsed.y as number).toLocaleString('es-CO')}`
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'top',
            formatter: (value) => {
              const num = Number(value) || 0;
              return '$' + (num >= 1000000 ? (num / 1000000).toFixed(1) + 'M' : num.toLocaleString('es-CO'));
            },
            color: '#475569',
            font: { weight: 'bold', size: 10 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(241, 245, 249, 1)' },
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              callback: (value) => {
                const num = Number(value) || 0;
                return '$' + (num >= 1000000 ? (num / 1000000).toFixed(0) + 'M' : num.toLocaleString('es-CO'));
              }
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              color: '#334155',
              font: { size: 11, weight: 'bold' }
            }
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this.charts.set('warehouseValue', chart);
  }

  renderWarehouseItemsChart(): void {
    const canvas = document.getElementById('warehouseItemsChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: this.warehousesSummary.map(w => w.nombre_bodega),
        datasets: [{
          label: 'Total Items',
          data: this.warehousesSummary.map(w => w.total_items),
          backgroundColor: [
            '#6366f1', // Indigo
            '#0ea5e9', // Sky
            '#10b981', // Emerald
            '#f59e0b', // Amber
            '#ec4899', // Pink
            '#8b5cf6'  // Purple
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              font: { size: 11, weight: 'bold' },
              color: '#475569',
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (context) => ` ${context.label}: ${(context.parsed as number).toLocaleString('es-CO')} referencias`
            }
          },
          datalabels: {
            color: '#fff',
            font: { weight: 'bold', size: 11 },
            formatter: (value, ctx) => {
              const total = (ctx.chart.data.datasets[0].data as number[]).reduce((a, b) => a + b, 0);
              const pct = total ? Math.round((Number(value) / total) * 100) : 0;
              return pct >= 8 ? `${pct}%` : '';
            }
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this.charts.set('warehouseItems', chart);
  }

  showPreviousShipmentsTooltip(unidad: string, event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    this.showTooltip.set(unidad, true);
    this.tooltipPosition.set(unidad, {
      top: rect.top - 10,
      left: rect.left + rect.width / 2
    });
  }

  hidePreviousShipmentsTooltip(unidad: string): void {
    this.showTooltip.set(unidad, false);
  }

  getPreviousShipmentsDetail(unidad: string): any[] {
    return this.previousShipmentsDetail.get(unidad) || [];
  }

  isTooltipVisible(unidad: string): boolean {
    return this.showTooltip.get(unidad) || false;
  }

  getTooltipPosition(unidad: string): {top: number, left: number} {
    return this.tooltipPosition.get(unidad) || {top: 0, left: 0};
  }

  get filteredBillingUnits() {
    if (!this.billingData) return [];
    
    return this.billingData.detalleUnidades.filter(item => {
      const matchUnidad = !this.filterUnidad || 
        item.unidad.toLowerCase().includes(this.filterUnidad.toLowerCase()) ||
        item.descripcion.toLowerCase().includes(this.filterUnidad.toLowerCase());
      
      return matchUnidad;
    });
  }

  get totalCantidad(): number {
    if (!this.filteredWarehouseItems || this.filteredWarehouseItems.length === 0) return 0;
    return this.filteredWarehouseItems.reduce((sum, item) => sum + (parseFloat(item.cantidad as any) || 0), 0);
  }

  get totalCosto(): number {
    if (!this.filteredWarehouseItems || this.filteredWarehouseItems.length === 0) return 0;
    return this.filteredWarehouseItems.reduce((sum, item) => sum + (parseFloat(item.costo_prom_total as any) || 0), 0);
  }

  openInvoiceModal(unidad?: string): void {
    this.selectedUnit = unidad || '';
    this.showInvoiceModal = true;
    this.currentPage = 1;
    this.searchTerm = '';
    this.filterByUN = unidad || '';
    this.loadInvoiceDetails();
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.invoiceDetails = [];
    this.groupedInvoices.clear();
    this.selectedUnit = '';
    this.searchTerm = '';
    this.filterByUN = '';
    this.currentPage = 1;
  }

  loadInvoiceDetails(): void {
    this.loadingInvoices = true;
    
    this.billingService.getInvoiceDetail(
      this.selectedYear, 
      this.selectedMonth, 
      this.selectedUnit || undefined
    ).subscribe({
      next: (data) => {
        this.groupInvoices(data);
        this.availableUnits = [...new Set(data.map((inv: any) => inv.unidad_negocio))];
        this.loadingInvoices = false;
      },
      error: (error) => {
        console.error('Error loading invoice details:', error);
        this.loadingInvoices = false;
      }
    });
  }

  groupInvoices(data: any[]): void {
    this.groupedInvoices.clear();
    
    data.forEach(item => {
      const key = item.nro_factura.trim();
      
      if (!this.groupedInvoices.has(key)) {
        this.groupedInvoices.set(key, {
          nro_factura: item.nro_factura.trim(),
          fecha_factura: item.fecha_factura,
          cliente: item.cliente,
          codigo_item: '',
          descripcion_item: '',
          cantidad: 0,
          precio_unitario: 0,
          valor_bruto: 0,
          items: [],
          expanded: false
        });
      }
      
      const invoice = this.groupedInvoices.get(key)!;
      invoice.items!.push({
        codigo_item: item.codigo_item,
        descripcion_item: item.descripcion_item,
        cantidad: parseFloat(item.cantidad),
        precio_unitario: parseFloat(item.precio_unitario),
        valor_bruto: parseFloat(item.valor_bruto)
      });
      invoice.valor_bruto += parseFloat(item.valor_bruto);
    });
    
    this.invoiceDetails = Array.from(this.groupedInvoices.values())
      .sort((a, b) => new Date(b.fecha_factura).getTime() - new Date(a.fecha_factura).getTime());
  }

  toggleInvoiceExpansion(invoice: InvoiceDetail): void {
    invoice.expanded = !invoice.expanded;
  }

  get filteredInvoices(): InvoiceDetail[] {
    return this.invoiceDetails.filter(inv => {
      const matchSearch = !this.searchTerm || 
        inv.nro_factura.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        inv.cliente.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      return matchSearch;
    });
  }

  get paginatedInvoices(): InvoiceDetail[] {
    const filtered = this.filteredInvoices;
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return filtered.slice(start, end);
  }

  get totalInvoicePages(): number {
    return Math.ceil(this.filteredInvoices.length / this.pageSize);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalInvoicePages) {
      this.currentPage = page;
    }
  }

  openShipmentModal(unidad?: string): void {
    this.selectedUnit = unidad || '';
    this.showShipmentModal = true;
    this.shipmentCurrentPage = 1;
    this.shipmentSearchTerm = '';
    this.shipmentFilterByUN = unidad || '';
    this.loadShipmentDetails();
  }

  openShipmentModalByMonth(unidad?: string): void {
    this.selectedUnit = unidad || '';
    this.showShipmentModal = true;
    this.shipmentCurrentPage = 1;
    this.shipmentSearchTerm = '';
    this.shipmentFilterByUN = unidad || '';
    this.loadShipmentDetailsMonth();
  }

  closeShipmentModal(): void {
    this.showShipmentModal = false;
    this.shipmentDetails = [];
    this.groupedShipments.clear();
    this.selectedUnit = '';
    this.shipmentSearchTerm = '';
    this.shipmentFilterByUN = '';
    this.shipmentCurrentPage = 1;
  }

  loadShipmentDetailsMonth(): void {

    if (!this.selectedYear || !this.selectedMonth) {
      console.warn('Debe seleccionar año y mes');
      return;
    }

    this.billingService.getPendingShipmentsByMonth(
      this.selectedUnit || undefined,
      this.selectedYear,
      this.selectedMonth
    ).subscribe({
      next: (data) => {
        this.groupShipments(data);
      },
      error: (error) => {
        console.error('Error loading shipment details:', error);
      }
    });
  }

  loadShipmentDetails(): void {
    this.loadingShipments = true;
    
    const fechaHasta = `${this.selectedYear}-${this.selectedMonth.toString().padStart(2, '0')}-${new Date(this.selectedYear, this.selectedMonth, 0).getDate()}`;
    
    this.billingService.getPendingShipments(
      this.selectedUnit || undefined,
      fechaHasta
    ).subscribe({
      next: (data) => {
        this.groupShipments(data);
        this.loadingShipments = false;
      },
      error: (error) => {
        console.error('Error loading shipment details:', error);
        this.loadingShipments = false;
      }
    });
  }

  groupShipments(data: any[]): void {
    this.groupedShipments.clear();
    
    data.forEach(item => {
      const key = item.nro_documento.trim();
      
      if (!this.groupedShipments.has(key)) {
        this.groupedShipments.set(key, {
          nro_documento: item.nro_documento.trim(),
          fecha: item.fecha,
          cliente_despacho: item.cliente_despacho,
          pedido_documento: item.pedido_documento,
          valor_bruto: 0,
          items: [],
          expanded: false
        });
      }
      
      const shipment = this.groupedShipments.get(key)!;
      shipment.items!.push({
        codigo_item: item.codigo_item,
        descripcion_item: item.descripcion_item,
        cantidad: parseFloat(item.cantidad),
        precio_unitario: parseFloat(item.precio_unitario),
        valor_bruto: parseFloat(item.valor_bruto)
      });
      shipment.valor_bruto += parseFloat(item.valor_bruto);
    });
    
    this.shipmentDetails = Array.from(this.groupedShipments.values())
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  toggleShipmentExpansion(shipment: ShipmentDetail): void {
    shipment.expanded = !shipment.expanded;
  }

  get filteredShipments(): ShipmentDetail[] {
    return this.shipmentDetails.filter(ship => {
      const matchSearch = !this.shipmentSearchTerm || 
        ship.nro_documento.toLowerCase().includes(this.shipmentSearchTerm.toLowerCase()) ||
        ship.cliente_despacho.toLowerCase().includes(this.shipmentSearchTerm.toLowerCase());
      
      return matchSearch;
    });
  }

  get paginatedShipments(): ShipmentDetail[] {
    const filtered = this.filteredShipments;
    const start = (this.shipmentCurrentPage - 1) * this.shipmentPageSize;
    const end = start + this.shipmentPageSize;
    return filtered.slice(start, end);
  }

  get totalShipmentPages(): number {
    return Math.ceil(this.filteredShipments.length / this.shipmentPageSize);
  }

  changeShipmentPage(page: number): void {
    if (page >= 1 && page <= this.totalShipmentPages) {
      this.shipmentCurrentPage = page;
    }
  }

  getTotalShipments(): number {
    return this.shipmentDetails.reduce((sum, ship) => sum + ship.valor_bruto, 0);
  }

  getMonthName(month: number): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[month - 1];
  }

  renderAllCharts(): void {
    if (!this.billingData) return;
    
    // Destruir únicamente los gráficos de facturación para no afectar los otros tabs
    ['comparison', 'execution', 'variation', 'difference'].forEach(key => {
      this.charts.get(key)?.destroy();
      this.charts.delete(key);
    });
    
    requestAnimationFrame(() => {
      this.renderComparisonChart();
      this.renderExecutionPercentageChart();
      setTimeout(() => {
        this.renderVariationChart();
        this.renderDifferenceTrendChart();
      }, 40);
    });
  }

  renderComparisonChart(): void {
    const canvas = document.getElementById('comparisonChart') as HTMLCanvasElement;
    if (!canvas || !this.billingData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const units = this.billingData.detalleUnidades;
    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: units.map(u => u.descripcion),
        datasets: [
          {
            label: 'Presupuesto Meta',
            data: units.map(u => u.presupuesto),
            backgroundColor: '#6366f1',
            hoverBackgroundColor: '#4f46e5',
            borderRadius: 6,
            borderSkipped: false
          },
          {
            label: 'Facturación Real',
            data: units.map(u => u.real),
            backgroundColor: '#10b981',
            hoverBackgroundColor: '#059669',
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              font: { size: 11, weight: 'bold' },
              color: '#475569',
              padding: 14
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: $${(context.parsed.x as number).toLocaleString('es-CO')}`
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            formatter: (value) => {
              const num = Number(value) || 0;
              return '$' + (num >= 1000000 ? (num / 1000000).toFixed(0) + 'M' : num.toLocaleString('es-CO'));
            },
            color: '#475569',
            font: { weight: 'bold', size: 9 }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(241, 245, 249, 1)' },
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              callback: (value) => {
                const num = Number(value) || 0;
                return '$' + (num >= 1000000 ? (num / 1000000).toFixed(0) + 'M' : num.toLocaleString('es-CO'));
              }
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              color: '#334155',
              font: { size: 11, weight: 'bold' }
            }
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this.charts.set('comparison', chart);
  }

  renderExecutionPercentageChart(): void {
    const canvas = document.getElementById('executionChart') as HTMLCanvasElement;
    if (!canvas || !this.billingData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const percentage = this.billingData.isPastMonth && this.billingData.porcentajeEjecutadoConCreditos !== undefined
      ? this.billingData.porcentajeEjecutadoConCreditos
      : this.billingData.porcentajeEjecutado;
    const remaining = Math.max(0, 100 - percentage);

    let color = '#10b981';
    if (percentage < 50) {
      color = '#f43f5e';
    } else if (percentage < 80) {
      color = '#f59e0b';
    }

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: ['Ejecutado', 'Pendiente'],
        datasets: [{
          data: [percentage, remaining],
          backgroundColor: [color, '#f1f5f9'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              font: { size: 11, weight: 'bold' },
              color: '#475569',
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context) => ` ${context.label}: ${(context.parsed as number).toFixed(1)}%`
            }
          },
          datalabels: {
            color: (context) => context.dataIndex === 0 ? '#0f172a' : 'transparent',
            font: { weight: 'bold', size: 15 },
            formatter: (value, context) => context.dataIndex === 0 ? `${Number(value).toFixed(1)}%` : ''
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this.charts.set('execution', chart);
  }

  renderVariationChart(): void {
    const canvas = document.getElementById('variationChart') as HTMLCanvasElement;
    if (!canvas || !this.billingData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const units = this.billingData.detalleUnidades;
    
    const colors = units.map(u => {
      const pct = this.billingData?.isPastMonth && u.porcentajeEjecutadoConCreditos !== undefined
        ? u.porcentajeEjecutadoConCreditos
        : u.porcentajeEjecutado;
      return pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e';
    });

    const values = units.map(u => 
      this.billingData?.isPastMonth && u.porcentajeEjecutadoConCreditos !== undefined
        ? u.porcentajeEjecutadoConCreditos
        : u.porcentajeEjecutado
    );

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: units.map(u => u.descripcion),
        datasets: [{
          label: '% Ejecución',
          data: values,
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (context) => ` Ejecución: ${(context.parsed.y as number).toFixed(1)}%`
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'top',
            formatter: (value) => `${Number(value).toFixed(0)}%`,
            color: '#475569',
            font: { weight: 'bold', size: 10 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(241, 245, 249, 1)' },
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              callback: (value) => `${value}%`
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              color: '#334155',
              font: { size: 11, weight: 'bold' }
            }
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this.charts.set('variation', chart);
  }

  renderDifferenceTrendChart(): void {
    const canvas = document.getElementById('differenceChart') as HTMLCanvasElement;
    if (!canvas || !this.billingData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const units = this.billingData.detalleUnidades;
    const values = units.map(u => 
      this.billingData?.isPastMonth && u.diferenciaConCreditos !== undefined 
        ? u.diferenciaConCreditos 
        : u.diferencia
    );
    const colors = values.map(v => v >= 0 ? '#10b981' : '#f43f5e');

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: units.map(u => u.descripcion),
        datasets: [{
          label: 'Diferencia / Margen ($)',
          data: values,
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (context) => ` Diferencia: $${(context.parsed.y as number).toLocaleString('es-CO')}`
            }
          },
          datalabels: {
            anchor: 'end',
            align: (context) => (context.dataset.data as number[])[context.dataIndex] >= 0 ? 'top' : 'bottom',
            formatter: (value) => {
              const num = Number(value) || 0;
              return '$' + (Math.abs(num) >= 1000000 ? (num / 1000000).toFixed(1) + 'M' : num.toLocaleString('es-CO'));
            },
            color: '#475569',
            font: { weight: 'bold', size: 9 }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(241, 245, 249, 1)' },
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              callback: (value) => {
                const num = Number(value) || 0;
                return '$' + (Math.abs(num) >= 1000000 ? (num / 1000000).toFixed(0) + 'M' : num.toLocaleString('es-CO'));
              }
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              color: '#334155',
              font: { size: 11, weight: 'bold' }
            }
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this.charts.set('difference', chart);
  }

  get totalFilteredShipments(): number {
    return this.filteredShipments.reduce((sum, ship) => sum + ship.valor_bruto, 0);
  }

  trackByInvoice(index: number, invoice: InvoiceDetail): string {
    return invoice.nro_factura;
  }

  trackByShipment(index: number, shipment: ShipmentDetail): string {
    return shipment.nro_documento;
  }

  trackByItem(index: number, item: any): string {
    return item.codigo_item + index;
  }

  getVisiblePages(): number[] {
    const pages: number[] = [];
    const total = this.totalInvoicePages;
    const current = this.currentPage;
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push(-1);
        pages.push(total);
      } else if (current >= total - 3) {
        pages.push(1);
        pages.push(-1);
        for (let i = total - 4; i <= total; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1);
        for (let i = current - 1; i <= current + 1; i++) pages.push(i);
        pages.push(-1);
        pages.push(total);
      }
    }
    return pages;
  }

  getVisibleShipmentPages(): number[] {
    const pages: number[] = [];
    const total = this.totalShipmentPages;
    const current = this.shipmentCurrentPage;
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push(-1);
        pages.push(total);
      } else if (current >= total - 3) {
        pages.push(1);
        pages.push(-1);
        for (let i = total - 4; i <= total; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1);
        for (let i = current - 1; i <= current + 1; i++) pages.push(i);
        pages.push(-1);
        pages.push(total);
      }
    }
    return pages;
  }
}