import { Component, OnInit, OnDestroy } from '@angular/core';
import { MetricsService } from 'src/app/services/metrics.service';
import { BillingService } from 'src/app/services/billing.service';
import { ProcessMetric } from 'src/app/models/process-metric.model';
import { AuthService } from 'src/app/services/auth.service';
import Chart, { ChartConfiguration } from 'chart.js/auto';

interface BillingData {
  totalPresupuesto: number;
  totalReal: number;
  totalDiferencia: number;
  porcentajeEjecutado: number;
  remisionadoMesActual?: number;
  remisionadoMesAnterior?: number;
  detalleUnidades: Array<{
    unidad: string;
    descripcion: string;
    presupuesto: number;
    real: number;
    diferencia: number;
    porcentajeEjecutado: number;
    remisionadoMesActual?: number;
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
  activeTab: string = 'production';
  
  // Billing data
  billingData: BillingData | null = null;
  loading: boolean = false;
  selectedYear: number = new Date().getFullYear();
  selectedMonth: number = new Date().getMonth() + 1;
  selectedPlan: string = '008';
  availableYears: number[] = [];
  
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
  
  private charts: Map<string, Chart> = new Map();
  
  // Exponer Math para el template
  Math = Math;

  constructor(
    private metricsService: MetricsService,
    private billingService: BillingService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.hasRole('Administrador del sistema');
    
    if (this.isAdmin) {
      this.loadMetrics();
      this.initializeYears();
    }
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
        
        setTimeout(() => this.renderAllCharts(), 100);
      },
      error: (error) => {
        console.error('Error loading billing data:', error);
        this.loading = false;
      }
    });
  }

  // Filtrado de la tabla principal
  get filteredBillingUnits() {
    if (!this.billingData) return [];
    
    return this.billingData.detalleUnidades.filter(item => {
      const matchUnidad = !this.filterUnidad || 
        item.unidad.toLowerCase().includes(this.filterUnidad.toLowerCase()) ||
        item.descripcion.toLowerCase().includes(this.filterUnidad.toLowerCase());
      
      return matchUnidad;
    });
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
    
    // Destruir gráficos anteriores
    this.charts.forEach(chart => chart.destroy());
    this.charts.clear();
    
    this.renderComparisonChart();
    this.renderExecutionPercentageChart();
    this.renderVariationChart();
    this.renderDifferenceTrendChart();
  }

  // Gráfico 1: Comparativa Presupuesto vs Real (Barras horizontales)
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

  // Gráfico 2: % de Ejecución (Gauge/Dónut)
  renderExecutionPercentageChart(): void {
    const canvas = document.getElementById('executionChart') as HTMLCanvasElement;
    if (!canvas || !this.billingData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const percentage = this.billingData.porcentajeEjecutado;
    const remaining = 100 - percentage;

    // Determinar color según porcentaje
    let color = 'rgba(75, 192, 75, 0.8)'; // Verde
    if (percentage < 50) {
      color = 'rgba(255, 99, 99, 0.8)'; // Rojo
    } else if (percentage < 75) {
      color = 'rgba(255, 193, 7, 0.8)'; // Amarillo
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

  // Gráfico 3: Variación por Unidad (Porcentaje)
  renderVariationChart(): void {
    const canvas = document.getElementById('variationChart') as HTMLCanvasElement;
    if (!canvas || !this.billingData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const units = this.billingData.detalleUnidades;
    
    // Colores rojo/verde según si es negativo o positivo
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

  // Gráfico 4: Diferencia (Ingreso Real + Remisionado - Remisionado Anterior)
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