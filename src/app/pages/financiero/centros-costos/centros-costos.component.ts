import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { CentrosCostosService, CentroCosto } from 'src/app/services/centros-costos.service';
import Swal from 'sweetalert2';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-centros-costos',
  templateUrl: './centros-costos.component.html',
  styleUrls: ['./centros-costos.component.css']
})
export class CentrosCostosComponent implements OnInit, OnDestroy {
  paginatorId = 'centros-costos-paginator';

  isLoading = false;

  centros: CentroCosto[] = [];
  currentCentros: CentroCosto[] = [];
  totalCentros = 0;

  centrosCostosUnicos: string[] = [];
  cuentasUnicas: string[] = [];
  
  anoActual = new Date().getFullYear();
  mesActual = new Date().getMonth() + 1;

  filters = {
    busqueda: '',
    centroCosto: '',
    semaforo: '',
    ano: this.anoActual,
    mes: this.mesActual
  };

  constructor(
    public paginationService: PaginationService,
    private centrosCostosService: CentrosCostosService,
    public authService: AuthService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.cargarCentrosCostos();
  }

  private loadTailwind(): void {
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
    this.document.head.appendChild(link);

    const icons = this.document.createElement('link');
    icons.rel = 'stylesheet';
    icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
    this.document.head.appendChild(icons);
  }

  ngOnDestroy(): void {
    const links = this.document.head.querySelectorAll('link[href*="tailwindcss"], link[href*="bootstrap-icons"]');
    links.forEach(link => link.remove());
  }

  cargarCentrosCostos(): void {
    this.isLoading = true;
    
    this.centrosCostosService.obtenerCentrosCostos({
      ano: this.filters.ano,
      mes: this.filters.mes
    }).subscribe({
      next: (res) => {
        this.centros = res.data || [];
        this.totalCentros = this.centros.length;
        this.extraerFiltrosUnicos();
        this.inicializarPaginacion();
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los centros de costo', 'error');
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  extraerFiltrosUnicos(): void {
    this.centrosCostosUnicos = [...new Set(this.centros.map(c => c.desc_ccosto).filter(d => d))].sort();
    this.cuentasUnicas = [...new Set(this.centros.map(c => c.cuenta))].sort();
  }

  inicializarPaginacion(): void {
    if (this.centros.length > 0) {
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.centros,
        25,
        this.filters,
        this.filterCentrosCostos
      ).subscribe(state => {
        this.currentCentros = state.currentData;
      });
    }
  }

  filterCentrosCostos: FilterFunction = (centro: CentroCosto, filtros) => {
    const texto = (filtros.busqueda || '').trim().toLowerCase();

    let cumpleBusqueda = true;
    if (texto) {
      cumpleBusqueda = centro.cuenta.toLowerCase().includes(texto) ||
        centro.desc_auxiliar.toLowerCase().includes(texto) ||
        centro.desc_ccosto.toLowerCase().includes(texto) ||
        centro.responsable.toLowerCase().includes(texto);
    }

    let cumpleCentroCosto = true;
    if (filtros.centroCosto) {
      cumpleCentroCosto = centro.desc_ccosto === filtros.centroCosto;
    }

    let cumpleSemaforo = true;
    if (filtros.semaforo) {
      cumpleSemaforo = centro.semaforo === filtros.semaforo;
    }

    return cumpleBusqueda && cumpleCentroCosto && cumpleSemaforo;
  };

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.centros,
      undefined,
      this.filters,
      this.filterCentrosCostos
    );
  }

  onFechaChange(): void {
    this.cargarCentrosCostos();
  }

  getSemaforoClass(semaforo: string): string {
    switch(semaforo) {
      case 'verde': return 'bg-green-100 text-green-800';
      case 'amarillo': return 'bg-yellow-100 text-yellow-800';
      case 'rojo': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getSemaforoIcon(semaforo: string): string {
    switch(semaforo) {
      case 'verde': return '🟢';
      case 'amarillo': return '🟡';
      case 'rojo': return '🔴';
      default: return '⚪';
    }
  }

  getStartIndex(): number {
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    return state ? state.paginator.number * state.paginator.size + 1 : 0;
  }

  getEndIndex(): number {
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    if (!state) return 0;
    const end = (state.paginator.number + 1) * state.paginator.size;
    return Math.min(end, state.paginator.totalElements);
  }
}
