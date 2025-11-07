// dashboard-bigbag.component.ts - SOLUCIÓN 2: Porcentaje solo en tooltip
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { HttpParams } from '@angular/common/http';
import { Observable, Subject, Subscription, interval, of } from 'rxjs';
import { switchMap, retry, catchError, startWith, takeUntil } from 'rxjs/operators';
import Chart, { ChartConfiguration, ChartType } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { BigbagService } from 'src/app/services/bigbag.service';
import { DashboardResponse, DashboardFilters } from 'src/app/models/dashboard.interface';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard-bigbag.component.html',
  styleUrls: ['./dashboard-bigbag.component.css']
})
export class DashboardBigbagComponent implements OnInit, OnDestroy, AfterViewInit {
  
  // Referencias a canvas para gráficos
  @ViewChild('chartEstados', { static: false }) chartEstadosRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartTopClientes', { static: false }) chartTopClientesRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartPorFecha', { static: false }) chartPorFechaRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartPrecintosColor', { static: false }) chartPrecintosColorRef!: ElementRef<HTMLCanvasElement>;

  // Charts instances
  private chartEstados?: Chart;
  private chartTopClientes?: Chart;
  private chartPorFecha?: Chart;
  private chartPrecintosColor?: Chart;

  // Form para filtros
  filtersForm!: FormGroup;
  
  // Data del dashboard
  dashboardData?: DashboardResponse['data'];
  loading = false;
  lastUpdate = '';
  
  // Clientes para dropdown
  clientesList: string[] = [];
  
  // Control de subscripciones
  private destroy$ = new Subject<void>();
  private refreshSubscription?: Subscription;
  
  // Flags de control
  private chartsReady = false;
  private dataReady = false;
  private noDataPluginRegistered = false;
  
  // Configuración
  public readonly REFRESH_INTERVAL = 15000;

  constructor(
    private bigbagService: BigbagService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
    this.registerNoDataPlugin();
    // Registrar el plugin de datalabels globalmente
    Chart.register(ChartDataLabels);
  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  ngAfterViewInit(): void {
    this.initChartsWhenReady();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyCharts();
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  // ===== LÓGICA ESPECÍFICA DEL DASHBOARD =====
  
  private buildHttpParams(filters?: DashboardFilters): HttpParams | undefined {
    if (!filters) return undefined;
    
    let params = new HttpParams();
    
    if (filters.start) params = params.set('start', filters.start);
    if (filters.end) params = params.set('end', filters.end);
    if (filters.cliente) params = params.set('cliente', filters.cliente);
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    
    return params.keys().length > 0 ? params : undefined;
  }

  private getDashboardData(filters?: DashboardFilters): Observable<DashboardResponse> {
    const params = this.buildHttpParams(filters);
    
    return this.bigbagService.getDatos(params).pipe(
      catchError(error => {
        console.error('Error obteniendo datos del dashboard:', error);
        return of({
          success: false,
          error: 'Error de conexión',
          data: null
        } as DashboardResponse);
      })
    );
  }

  private getDatosAutoRefresh(filters?: DashboardFilters, intervalMs: number = 15000): Observable<DashboardResponse> {
    return interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.getDashboardData(filters)),
      retry(3)
    );
  }

  private getFiltersFromForm(): DashboardFilters {
    const formValue = this.filtersForm.value;
    return {
      start: formValue.start,
      end: formValue.end,
      cliente: formValue.cliente || undefined,
      limit: 10
    };
  }

  // ===== LÓGICA DEL COMPONENTE =====

  private initChartsWhenReady(): void {
    let attempts = 0;
    const maxAttempts = 50;
    
    const checkAndInit = () => {
      attempts++;
      
      if (this.allCanvasRefsAvailable()) {
        this.initCharts();
        this.chartsReady = true;
        
        if (this.dataReady && this.dashboardData) {
          this.updateAllCharts();
        }
        
        this.cdr.detectChanges();
        return;
      }
      
      if (attempts < maxAttempts) {
        setTimeout(checkAndInit, 100);
      } else {
        console.warn('Canvas elements no disponibles después de 5 segundos');
      }
    };
    
    checkAndInit();
  }

  private allCanvasRefsAvailable(): boolean {
    return !!(this.chartEstadosRef?.nativeElement && 
              this.chartTopClientesRef?.nativeElement && 
              this.chartPorFechaRef?.nativeElement && 
              this.chartPrecintosColorRef?.nativeElement);
  }

  private registerNoDataPlugin(): void {
    if (this.noDataPluginRegistered) return;
    
    const noDataPlugin = {
      id: 'noDataPlugin',
      afterDraw: (chart: Chart, args: any, options: any) => {
        const { ctx, width, height } = chart;
        const hasData = chart.data.datasets.some(dataset => 
          dataset.data && dataset.data.length > 0 && 
          dataset.data.some((value: any) => value !== null && value !== undefined && value !== 0)
        );

        if (!hasData && options.message) {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#6b7280';
          ctx.font = '14px Arial';
          ctx.fillText(options.message, width / 2, height / 2);
          ctx.restore();
        }
      }
    };
    
    Chart.register(noDataPlugin);
    this.noDataPluginRegistered = true;
  }

  private initForm(): void {
    const today = new Date();
    const startDefault = new Date(today.getFullYear(), today.getMonth(), 1);
    
    this.filtersForm = this.fb.group({
      start: [this.formatDate(startDefault)],
      end: [this.formatDate(today)],
      cliente: [''],
      autoRefresh: [false]
    });
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private loadInitialData(): void {
    this.loading = true;
    this.dataReady = false;
    const filters = this.getFiltersFromForm();
    
    this.getDashboardData(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.dashboardData = response.data;
            this.clientesList = response.data.clientes;
            this.lastUpdate = new Date().toLocaleTimeString();
            this.dataReady = true;
            
            if (this.chartsReady) {
              this.updateAllCharts();
            }
            
            const autoRefreshValue = this.filtersForm.get('autoRefresh')?.value;
            if (autoRefreshValue) {
              this.startAutoRefresh();
            }
          }
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error cargando dashboard:', error);
          this.loading = false;
          this.dataReady = false;
          this.cdr.detectChanges();
        }
      });
  }

  onApplyFilters(): void {
    this.loadInitialData();
  }

  onAutoRefreshToggle(): void {
    const autoRefreshValue = this.filtersForm.get('autoRefresh')?.value;
    if (autoRefreshValue) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  get autoRefreshEnabled(): boolean {
    return this.filtersForm.get('autoRefresh')?.value || false;
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    
    const filters = this.getFiltersFromForm();
    this.refreshSubscription = this.getDatosAutoRefresh(filters, this.REFRESH_INTERVAL)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.dashboardData = response.data;
            if (this.chartsReady) {
              this.updateAllCharts();
            }
            this.lastUpdate = new Date().toLocaleTimeString();
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('Error en auto-refresh:', error);
        }
      });
  }

  private stopAutoRefresh(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = undefined;
    }
  }

  private initCharts(): void {
    // Chart Estados (Doughnut) - Solo valor visible, porcentaje en tooltip
    this.chartEstados = this.createChart(
      this.chartEstadosRef.nativeElement,
      'doughnut',
      {
        plugins: {
          legend: { position: 'bottom' },
          noDataPlugin: {
            message: 'No se han registrado recepciones en este período'
          },
          datalabels: {
            color: '#fff',
            font: {
              weight: 'bold',
              size: 14
            },
            formatter: (value: number) => value // Solo mostrar el valor
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const dataset = context.dataset;
                const total = dataset.data.reduce((acc: number, val: number) => acc + val, 0);
                const value = context.parsed;
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${value} (${percentage}%)`;
              }
            }
          }
        },
        animation: { duration: 800 }
      }
    );

    // Chart Top Clientes (Bar) - CON DATALABELS (sin porcentaje)
    this.chartTopClientes = this.createChart(
      this.chartTopClientesRef.nativeElement,
      'bar',
      {
        scales: { y: { beginAtZero: true } },
        plugins: {
          noDataPlugin: {
            message: 'No se han repartido empaques en este período'
          },
          datalabels: {
            anchor: 'end',
            align: 'top',
            color: '#1f2937',
            font: {
              weight: 'bold',
              size: 16
            },
            formatter: (value: number) => value.toLocaleString('es-CO')
          }
        },
        animation: { duration: 800 },
        hover: { mode: null }
      }
    );

    // Chart Por Fecha (Line) - SIN DATALABELS (muchos datos)
    this.chartPorFecha = this.createChart(
      this.chartPorFechaRef.nativeElement,
      'line',
      {
        scales: { y: { beginAtZero: true } },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          noDataPlugin: {
            message: 'No se han registrado empaques en este período'
          },
          datalabels: {
            display: false // Desactivar en gráficas de línea con muchos puntos
          }
        },
        animation: { duration: 800 },
        hover: { mode: null }
      }
    );

    // Chart Precintos Color (Pie) - Solo valor visible, porcentaje en tooltip
    this.chartPrecintosColor = this.createChart(
      this.chartPrecintosColorRef.nativeElement,
      'pie',
      {
        plugins: {
          legend: { position: 'bottom' },
          noDataPlugin: {
            message: 'No se han repartido precintos en este período'
          },
          datalabels: {
            color: '#fff',
            font: {
              weight: 'bold',
              size: 18
            },
            formatter: (value: number) => Number(value) // Solo mostrar el valor
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const dataset = context.dataset;
                const total = dataset.data.reduce((acc: number, val: any) => acc + Number(val), 0);
                const value = Number(context.parsed);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${value} (${percentage}%)`;
              }
            }
          }
        },
        animation: { duration: 800 },
        hover: { mode: null }
      }
    );
  }

  private createChart(canvas: HTMLCanvasElement, type: ChartType, options: any): Chart {
    return new Chart(canvas, {
      type,
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        ...options
      }
    });
  }

  private updateAllCharts(): void {
    if (!this.dashboardData || !this.chartsReady) return;

    requestAnimationFrame(() => {
      this.updateEstadosChart();
      this.updateTopClientesChart();
      this.updatePorFechaChart();
      this.updatePrecintosColorChart();
    });
  }

  private updateEstadosChart(): void {
    if (!this.chartEstados || !this.dashboardData) return;
    
    const estados = this.dashboardData.estados;
    this.chartEstados.data.labels = estados.map(e => e.estado);
    this.chartEstados.data.datasets = [{
      label: 'Reportes',
      data: estados.map(e => e.total)
    }];
    this.chartEstados.update('none');
  }

  private updateTopClientesChart(): void {
    if (!this.chartTopClientes || !this.dashboardData) return;
    
    const topClientes = this.dashboardData.top_clientes;
    this.chartTopClientes.data.labels = topClientes.map(c => c.cliente);
    this.chartTopClientes.data.datasets = [{
      label: 'Empaques',
      data: topClientes.map(c => c.total_empaques),
      backgroundColor: '#3b82f6'
    }];
    this.chartTopClientes.update('none');
  }

  private generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    const current = new Date(start);
    
    const maxDays = 366;
    let dayCount = 0;
    
    while (current <= end && dayCount < maxDays) {
      dates.push(current.toLocaleDateString('es-CO'));
      current.setDate(current.getDate() + 1);
      dayCount++;
    }
    
    return dates;
  }

  private updatePorFechaChart(): void {
    if (!this.chartPorFecha || !this.dashboardData) return;
    
    const porFecha = this.dashboardData.por_fecha;
    const clienteSeleccionado = this.filtersForm.value.cliente;
    
    const startDate = this.filtersForm.value.start;
    const endDate = this.filtersForm.value.end;
    const allDates = this.generateDateRange(startDate, endDate);
    
    const dataMap = new Map<string, number>();
    porFecha.forEach(item => {
      const fecha = new Date(item.fecha_ingreso);
      const fechaFormatted = fecha.toLocaleDateString('es-CO');
      dataMap.set(fechaFormatted, item.total_empaques);
    });
    
    const completeData = allDates.map(fecha => dataMap.get(fecha) || 0);
    
    this.chartPorFecha.data.labels = allDates;
    this.chartPorFecha.data.datasets = [{
      label: clienteSeleccionado || 'Todos',
      data: completeData,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.3,
      fill: false
    }];
    this.chartPorFecha.update();
  }

  private updatePrecintosColorChart(): void {
    if (!this.chartPrecintosColor || !this.dashboardData) return;
    
    const precintosColor = this.dashboardData.precintosColor;
    
    const colorMap: { [key: string]: string } = {
      'rojo': '#ef4444',
      'azul': '#3b82f6',
      'verde': '#22c55e',
      'amarillo': '#eab308',
      'negro': '#374151',
      'blanco': '#f8fafc',
      'naranja': '#f97316',
      'rosa': '#ec4899',
      'morado': '#8b5cf6'
    };
    
    const backgroundColors = precintosColor.map(item => 
      colorMap[item.color.toLowerCase()] || '#6b7280'
    );
    
    this.chartPrecintosColor.data.labels = precintosColor.map(p => p.color);
    this.chartPrecintosColor.data.datasets = [{
      label: 'Precintos',
      data: precintosColor.map(p => p.total_precintos),
      backgroundColor: backgroundColors
    }];
    this.chartPrecintosColor.update();
  }

  private destroyCharts(): void {
    this.chartEstados?.destroy();
    this.chartTopClientes?.destroy();
    this.chartPorFecha?.destroy();
    this.chartPrecintosColor?.destroy();
    
    this.chartsReady = false;
    this.dataReady = false;
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('es-CO').format(num);
  }
}