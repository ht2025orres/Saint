import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { TiemposItemsService, TiempoItem } from 'src/app/services/tiempos-items.service';
import Swal from 'sweetalert2';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-tiempos-items',
  templateUrl: './tiempos-items.component.html',
  styleUrls: ['./tiempos-items.component.css']
})
export class TiemposItemsComponent implements OnInit, OnDestroy {
  paginatorId = 'tiempos-items-paginator';

  isLoading = false;
  isGuardando = false;

  tiempos: TiempoItem[] = [];
  currentTiempos: TiempoItem[] = [];
  totalTiempos = 0;

  tiposPrendaUnicos: string[] = [];
  tallasUnicas: string[] = [];

  filters = {
    busqueda: '',
    tipoPrenda: '',
    talla: ''
  };

  mostrarModalEditar = false;
  tiempoEditar: TiempoItem | null = null;
  tiemposForm = {
    tipoPrenda: '',
    idTalla: '',
    tiempo_estandar: 0,
    tiempo_optimo: 0
  };

  constructor(
    public paginationService: PaginationService,
    private tiemposService: TiemposItemsService,
    public authService: AuthService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.cargarTiempos();
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

  cargarTiempos(): void {
    this.isLoading = true;
    this.tiemposService.obtenerTiempos().subscribe({
      next: (res) => {
        this.tiempos = res.data || [];
        this.totalTiempos = this.tiempos.length;
        this.extraerFiltrosUnicos();
        this.inicializarPaginacion();
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los tiempos', 'error');
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  extraerFiltrosUnicos(): void {
    this.tiposPrendaUnicos = [...new Set(this.tiempos.map(t => t.tipo_prenda))].sort();
    this.tallasUnicas = [...new Set(this.tiempos.map(t => t.id_talla))].sort();
  }

  inicializarPaginacion(): void {
    if (this.tiempos.length > 0) {
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.tiempos,
        25,
        this.filters,
        this.filterTiempos
      ).subscribe(state => {
        this.currentTiempos = state.currentData;
      });
    }
  }

  filterTiempos: FilterFunction = (tiempo: TiempoItem, filtros) => {
    const texto = (filtros.busqueda || '').trim().toLowerCase();

    let cumpleBusqueda = true;
    if (texto) {
      cumpleBusqueda = tiempo.tipo_prenda.toLowerCase().includes(texto) ||
        tiempo.id_talla.toLowerCase().includes(texto);
    }

    let cumpleTipo = true;
    if (filtros.tipoPrenda) {
      cumpleTipo = tiempo.tipo_prenda === filtros.tipoPrenda;
    }

    let cumpleTalla = true;
    if (filtros.talla) {
      cumpleTalla = tiempo.id_talla === filtros.talla;
    }

    return cumpleBusqueda && cumpleTipo && cumpleTalla;
  };

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.tiempos,
      undefined,
      this.filters,
      this.filterTiempos
    );
  }

  abrirModalEditar(tiempo: TiempoItem): void {
    this.tiempoEditar = tiempo;
    this.tiemposForm = {
      tipoPrenda: tiempo.tipo_prenda,
      idTalla: tiempo.id_talla,
      tiempo_estandar: tiempo.tiempo_estandar || 0,
      tiempo_optimo: tiempo.tiempo_optimo || 0
    };
    this.mostrarModalEditar = true;
  }

  cerrarModalEditar(): void {
    this.mostrarModalEditar = false;
    this.tiempoEditar = null;
    this.tiemposForm = {
      tipoPrenda: '',
      idTalla: '',
      tiempo_estandar: 0,
      tiempo_optimo: 0
    };
  }

  // calcularTiempoTotal(): void {
  //   this.tiemposForm.tiempo_total = 
  //     this.tiemposForm.tiempo_estandar + this.tiemposForm.tiempo_optimo;
  // }

  guardarTiempos(): void {
    if (!this.tiemposForm.tipoPrenda || !this.tiemposForm.idTalla) return;

    if (this.tiemposForm.tiempo_estandar < 0 || this.tiemposForm.tiempo_optimo < 0) {
      Swal.fire('Atención', 'Los tiempos no pueden ser negativos', 'warning');
      return;
    }

    this.isGuardando = true;

    this.tiemposService.actualizarTiempos(
      this.tiemposForm.tipoPrenda,
      this.tiemposForm.idTalla,
      this.tiemposForm.tiempo_estandar,
      this.tiemposForm.tiempo_optimo
    ).subscribe({
      next: () => {
        Swal.fire({
          title: '¡Éxito!',
          text: 'Tiempos guardados correctamente',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        this.cerrarModalEditar();
        this.cargarTiempos();
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudieron guardar los tiempos', 'error');
      },
      complete: () => {
        this.isGuardando = false;
      }
    });
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