import { Component, OnInit, OnDestroy } from '@angular/core';
import { MetricsService } from 'src/app/services/metrics.service';
import { BillingService } from 'src/app/services/billing.service';
import { InventarioService, BodegaSummary, ItemBodega } from 'src/app/services/inventario.service';
import { ProcessMetric } from 'src/app/models/process-metric.model';
import { AuthService } from 'src/app/services/auth.service';
import Chart, { ChartConfiguration } from 'chart.js/auto';

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
  
  private charts: Map<string, Chart> = new Map();
  
  Math = Math;

  constructor(
    private metricsService: MetricsService,
    private billingService: BillingService,
    private inventoryService: InventarioService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    // Verificar roles
    this.isAdmin = this.authService.hasRole('Administrador del sistema');
    this.isBillingConsultant = this.authService.hasRole('Consulta KPIs Facturación');
    
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

  loadPreviousShipmentsDetail(): void {
    this.billingService.getPreviousShipmentsDetail(
      this.selectedYear, 
      this.selectedMonth
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

  loadMetrics(): void {
    this.metricsService.getProcessMetrics().subscribe(data => {
      this.metrics = data;
    });
  }

  loadBillingData(): void {
    this.loading = true;
    const periodo = parseInt(`${this.selectedYear}${this.selectedMonth.toString().padStart(2, '0')}`);
    
    this.billingService.getBillingData(this.selectedYear, this.selectedPlan, periodo).subscribe({
      next: (data) => {
        this.billingData = data;
        this.loading = false;
        this.loadPreviousShipmentsDetail();
        setTimeout(() => this.renderAllCharts(), 100);
      },
      error: (error) => {
        console.error('Error loading billing data:', error);
        this.loading = false;
      }
    });
  }

  // NUEVOS MÉTODOS PARA BODEGAS
  loadWarehousesData(): void {
    this.loadingWarehouses = true;
    this.inventoryService.getWarehousesSummary().subscribe({
      next: (data) => {
        this.warehousesSummary = data;
        this.loadingWarehouses = false;
        setTimeout(() => this.renderWarehouseCharts(), 100);
      },
      error: (error) => {
        console.error('Error loading warehouses data:', error);
        this.loadingWarehouses = false;
      }
    });
  }

  loadWarehouseItems(codigoBodega: string): void {
    this.selectedWarehouse = codigoBodega;
    this.loadingWarehouseItems = true;
    this.inventoryService.getWarehouseItems(codigoBodega).subscribe({
      next: (data) => {
        this.warehouseItems = data;
        this.loadingWarehouseItems = false;
      },
      error: (error) => {
        console.error('Error loading warehouse items:', error);
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
    if (this.warehousesSummary.length === 0) return;
    
    // Destruir gráficos anteriores de bodegas
    if (this.charts.has('warehouseValue')) {
      this.charts.get('warehouseValue')?.destroy();
    }
    if (this.charts.has('warehouseItems')) {
      this.charts.get('warehouseItems')?.destroy();
    }
    
    this.renderWarehouseValueChart();
    this.renderWarehouseItemsChart();
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
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
          borderRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            callbacks: {
              label: (context) => `$${(context.parsed.y as number).toLocaleString('es-CO')}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => '$' + (value as number).toLocaleString('es-CO')
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

    const config: ChartConfiguration = {
      type: 'doughnut',
      data: {
        labels: this.warehousesSummary.map(w => w.nombre_bodega),
        datasets: [{
          label: 'Total Items',
          data: this.warehousesSummary.map(w => w.total_items),
          backgroundColor: [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${context.parsed} items`
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
    return this.filteredWarehouseItems
      ? this.filteredWarehouseItems.reduce((sum, item) => sum + item.cantidad, 0)
      : 0;
  }

  get totalCosto(): number {
    return this.filteredWarehouseItems
      ? this.filteredWarehouseItems.reduce((sum, item) => sum + item.costo_prom_total, 0)
      : 0;
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
      const key = `${item.nro_factura}_${item.fecha_factura}`;
      
      if (!this.groupedInvoices.has(key)) {
        this.groupedInvoices.set(key, {
          nro_factura: item.nro_factura,
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
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        valor_bruto: item.valor_bruto
      });
      invoice.valor_bruto += item.valor_bruto;
    });
    
    this.invoiceDetails = Array.from(this.groupedInvoices.values());
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

  getTotalInvoices(): number {
    return this.invoiceDetails.reduce((sum, inv) => sum + inv.valor_bruto, 0);
  }

  openShipmentModal(unidad?: string): void {
    this.selectedUnit = unidad || '';
    this.showShipmentModal = true;
    this.shipmentCurrentPage = 1;
    this.shipmentSearchTerm = '';
    this.shipmentFilterByUN = unidad || '';
    this.loadShipmentDetails();
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
      const key = `${item.nro_documento}_${item.fecha}`;
      
      if (!this.groupedShipments.has(key)) {
        this.groupedShipments.set(key, {
          nro_documento: item.nro_documento,
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
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        valor_bruto: item.valor_bruto
      });
      shipment.valor_bruto += item.valor_bruto;
    });
    
    this.shipmentDetails = Array.from(this.groupedShipments.values());
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
    
    this.charts.forEach(chart => chart.destroy());
    this.charts.clear();
    
    this.renderComparisonChart();
    this.renderExecutionPercentageChart();
    this.renderVariationChart();
    this.renderDifferenceTrendChart();
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
            label: 'Presupuesto',
            data: units.map(u => u.presupuesto),
            backgroundColor: 'rgba(54, 162, 235, 0.8)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2,
            borderRadius: 5
          },
          {
            label: 'Facturado Real',
            data: units.map(u => u.real),
            backgroundColor: 'rgba(75, 192, 192, 0.8)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 2,
            borderRadius: 5
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 12, weight: 'bold' } }
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            callbacks: {
              label: (context) => {
                return `${context.dataset.label}: $${context.parsed.x.toLocaleString('es-CO')}`
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              callback: (value) => '$' + (value as number).toLocaleString('es-CO')
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

    const percentage = this.billingData.porcentajeEjecutado;
    const remaining = 100 - percentage;

    let color = 'rgba(75, 192, 75, 0.8)';
    if (percentage < 50) {
      color = 'rgba(255, 99, 99, 0.8)';
    } else if (percentage < 75) {
      color = 'rgba(255, 193, 7, 0.8)';
    }

    const config: ChartConfiguration = {
      type: 'doughnut',
      data: {
        labels: ['Ejecutado', 'Pendiente'],
        datasets: [{
          data: [percentage, remaining],
          backgroundColor: [color, 'rgba(200, 200, 200, 0.3)'],
          borderColor: [color, 'rgba(200, 200, 200, 1)'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 12, weight: 'bold' } }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.label}: ${context.parsed}%`
              }
            }
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
    
    const colors = units.map(u => 
      u.porcentajeEjecutado >= 80 ? 'rgba(75, 192, 75, 0.8)' :
      u.porcentajeEjecutado >= 50 ? 'rgba(255, 193, 7, 0.8)' :
      'rgba(255, 99, 99, 0.8)'
    );

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: units.map(u => u.descripcion),
        datasets: [{
          label: '% Ejecución',
          data: units.map(u => u.porcentajeEjecutado),
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.8', '1')),
          borderWidth: 2,
          borderRadius: 5
        }]
      },
      options: {
        indexAxis: 'x',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            callbacks: {
              label: (context) => `${context.parsed.y.toFixed(2)}%`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value) => (value as number) + '%'
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
    
    const colors = units.map(u => u.diferencia >= 0 ? 'rgba(75, 192, 75, 0.8)' : 'rgba(255, 99, 99, 0.8)');

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: units.map(u => u.descripcion),
        datasets: [{
          label: 'Diferencia ($)',
          data: units.map(u => u.diferencia),
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.8', '1')),
          borderWidth: 2,
          borderRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        indexAxis: 'x',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            callbacks: {
              label: (context) => `$${(context.parsed.y as number).toLocaleString('es-CO')}`
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => '$' + (value as number).toLocaleString('es-CO')
            }
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this.charts.set('difference', chart);
  }
}