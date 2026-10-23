import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PaginationService, PaginationState } from 'src/app/shared/pagination/pagination.service';
import { CentrosCostosService, CentroCosto } from 'src/app/services/centros-costos.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-centros-costos',
  templateUrl: './centros-costos.component.html',
  styleUrls: ['./centros-costos.component.css']
})
export class CentrosCostosComponent implements OnInit, OnDestroy {
  paginatorId = 'centros-costos-paginator';
  isLoading = false;

  todosCentros: CentroCosto[] = [];
  centrosFiltrados: CentroCosto[] = [];
  currentCentros: CentroCosto[] = [];
  totalCentros = 0;

  anoActual = new Date().getFullYear();
  mesActual = new Date().getMonth() + 1;

  filters = {
    busqueda: '',
    centroCosto: '',
    semaforo: '',
    area: 'comercial', // 'comercial' | 'todos'
    ano: this.anoActual,
    mes: this.mesActual
  };

  centrosCostosUnicos: string[] = [];

  // Totales y KPIs
  kpis = {
    totalPresupuesto: 0,
    totalReal: 0,
    totalDiferencia: 0,
    porcentajeGlobal: 0,
    conteoVerde: 0,
    conteoAmarillo: 0,
    conteoRojo: 0
  };

  private paginationSub: Subscription | null = null;

  constructor(
    public paginationService: PaginationService,
    private service: CentrosCostosService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.cargarDatos();
  }

  private loadTailwind(): void {
    if (!this.document.getElementById('tw-cdn-centros-costos')) {
      const link = this.document.createElement('link');
      link.id = 'tw-cdn-centros-costos';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      this.document.head.appendChild(link);
    }

    if (!this.document.getElementById('bi-cdn-centros-costos')) {
      const icons = this.document.createElement('link');
      icons.id = 'bi-cdn-centros-costos';
      icons.rel = 'stylesheet';
      icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
      this.document.head.appendChild(icons);
    }
  }

  ngOnDestroy(): void {
    if (this.paginationSub) {
      this.paginationSub.unsubscribe();
    }
    const links = this.document.head.querySelectorAll('#tw-cdn-centros-costos, #bi-cdn-centros-costos');
    links.forEach(link => link.remove());
  }

  cargarDatos(): void {
    this.isLoading = true;
    const areaParam = this.filters.area === 'comercial' ? 'comercial' : undefined;
    this.service.obtenerCentrosCostos(this.filters.ano, this.filters.mes, areaParam).subscribe({
      next: (res) => {
        this.todosCentros = res.data || [];
        this.extraerFiltrosUnicos();
        this.calcularKpis();
        this.inicializarPaginacion();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar centros de costos:', err);
        Swal.fire({
          title: 'Error de conexión',
          text: err.error?.message || 'No se pudieron cargar los datos de centros de costos desde Siesa.',
          icon: 'error'
        });
        this.todosCentros = [];
        this.centrosFiltrados = [];
        this.currentCentros = [];
        this.calcularKpis();
        this.isLoading = false;
      }
    });
  }

  setArea(area: string): void {
    if (this.filters.area === area) return;
    this.filters.area = area;
    this.filters.centroCosto = '';
    this.cargarDatos();
  }

  onFechaChange(): void {
    this.cargarDatos();
  }

  extraerFiltrosUnicos(): void {
    this.centrosCostosUnicos = [...new Set(this.todosCentros.map(d => d.desc_ccosto))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  calcularKpis(): void {
    let pres = 0;
    let real = 0;
    let dif = 0;
    let verde = 0;
    let amarillo = 0;
    let rojo = 0;

    this.todosCentros.forEach(item => {
      pres += (Number(item.presupuesto) || 0);
      real += (Number(item.real) || 0);
      dif += (Number(item.diferencia) || 0);

      if (item.semaforo === 'verde') verde++;
      else if (item.semaforo === 'amarillo') amarillo++;
      else if (item.semaforo === 'rojo') rojo++;
    });

    this.kpis = {
      totalPresupuesto: pres,
      totalReal: real,
      totalDiferencia: dif,
      porcentajeGlobal: pres > 0 ? (real * 100) / pres : 0,
      conteoVerde: verde,
      conteoAmarillo: amarillo,
      conteoRojo: rojo
    };
  }

  inicializarPaginacion(): void {
    if (this.paginationSub) {
      this.paginationSub.unsubscribe();
    }

    this.paginationSub = this.paginationService.initializePaginator(
      this.paginatorId,
      this.todosCentros,
      25,
      this.filters,
      this.filterCentros
    ).subscribe((state: PaginationState) => {
      this.currentCentros = state.currentData || [];
      this.totalCentros = state.totalItems;
    });
  }

  filterCentros = (item: CentroCosto, filtros: any): boolean => {
    const texto = (filtros.busqueda || '').trim().toLowerCase();

    const cumpleBusqueda = !texto || (
      (item.cuenta && item.cuenta.toLowerCase().includes(texto)) ||
      (item.codigo_auxiliar && item.codigo_auxiliar.toLowerCase().includes(texto)) ||
      (item.desc_auxiliar && item.desc_auxiliar.toLowerCase().includes(texto)) ||
      (item.desc_ccosto && item.desc_ccosto.toLowerCase().includes(texto)) ||
      (item.responsable && item.responsable.toLowerCase().includes(texto))
    );

    const cumpleCentroCosto = !filtros.centroCosto || item.desc_ccosto === filtros.centroCosto;
    const cumpleSemaforo = !filtros.semaforo || item.semaforo === filtros.semaforo;

    return cumpleBusqueda && cumpleCentroCosto && cumpleSemaforo;
  };

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.todosCentros,
      undefined,
      this.filters,
      this.filterCentros
    );
  }

  limpiarFiltros(): void {
    this.filters.busqueda = '';
    this.filters.centroCosto = '';
    this.filters.semaforo = '';
    this.applyFilters();
  }

  getSemaforoClass(semaforo: string): string {
    switch (semaforo) {
      case 'verde':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
      case 'amarillo':
        return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'rojo':
        return 'bg-rose-100 text-rose-800 border border-rose-300';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-300';
    }
  }

  getSemaforoBadgeDot(semaforo: string): string {
    switch (semaforo) {
      case 'verde': return 'bg-emerald-500';
      case 'amarillo': return 'bg-amber-500';
      case 'rojo': return 'bg-rose-500';
      default: return 'bg-gray-400';
    }
  }

  getSemaforoLabel(semaforo: string): string {
    switch (semaforo) {
      case 'verde': return 'Bajo Control';
      case 'amarillo': return 'En Alerta';
      case 'rojo': return 'Excedido';
      default: return 'Normal';
    }
  }

  getStartIndex(): number {
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    if (!state || state.totalItems === 0) return 0;
    return (state.currentPage - 1) * state.pageSize + 1;
  }

  getEndIndex(): number {
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    if (!state || state.totalItems === 0) return 0;
    return Math.min(state.currentPage * state.pageSize, state.totalItems);
  }
}