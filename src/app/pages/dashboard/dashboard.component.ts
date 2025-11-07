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
  valor_subtotal: number;
  items?: InvoiceItem[];
  expanded?: boolean;
}

interface InvoiceItem {
  codigo_item: string;
  descripcion_item: string;
  cantidad: number;
  precio_unitario: number;
  valor_subtotal: number;
}

interface ShipmentDetail {
  nro_documento: string;
  fecha: string;
  cliente_despacho: string;
  pedido_documento: string;
  valor_subtotal: number;
  items?: ShipmentItem[];
  expanded?: boolean;
}

interface ShipmentItem {
  codigo_item: string;
  descripcion_item: string;
  cantidad: number;
  precio_unitario: number;
  valor_subtotal: number;
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
  
  private chart: Chart | null = null;
  
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
    if (this.chart) {
      this.chart.destroy();
    }
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
        
        setTimeout(() => this.renderChart(), 100);
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
        // Agrupar facturas por número de factura
        this.groupInvoices(data);
        
        // Obtener unidades únicas para el filtro
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
          valor_subtotal: 0,
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
        valor_subtotal: item.valor_subtotal
      });
      invoice.valor_subtotal += item.valor_subtotal;
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
    return this.invoiceDetails.reduce((sum, inv) => sum + inv.valor_subtotal, 0);
  }

  // Modal de remisiones
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
          valor_subtotal: 0,
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
        valor_subtotal: item.valor_subtotal
      });
      shipment.valor_subtotal += item.valor_subtotal;
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
    return this.shipmentDetails.reduce((sum, ship) => sum + ship.valor_subtotal, 0);
  }

  getMonthName(month: number): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[month - 1];
  }

  renderChart(): void {
    if (this.chart) {
      this.chart.destroy();
    }

    const canvas = document.getElementById('billingChart') as HTMLCanvasElement;
    if (!canvas || !this.billingData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: this.billingData.detalleUnidades.map(u => u.descripcion),
        datasets: [
          {
            label: 'Presupuesto',
            data: this.billingData.detalleUnidades.map(u => u.presupuesto),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          },
          {
            label: 'Real',
            data: this.billingData.detalleUnidades.map(u => u.real),
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                label += '$' + context.parsed.y.toLocaleString();
                return label;
              }
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }
}