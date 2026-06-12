import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ComercialService, ClienteSiesa, Solicitud } from '../../../services/comercial.service';
import { OrdenCompraService } from '../../../services/orden-compra.service';
import { PaginationService, PaginationState } from '../../../shared/pagination/pagination.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cliente-list',
  templateUrl: './cliente-list.component.html',
  styleUrls: ['./cliente-list.component.css']
})
export class ClienteListComponent implements OnInit, OnDestroy {
  // Tabs: clientes | solicitudes | ordenes
  viewMode: 'clientes' | 'solicitudes' | 'ordenes' = 'clientes';
  displayMode: 'cards' | 'list' = 'cards';

  // Clientes
  clientes: ClienteSiesa[] = [];
  filteredClientes: ClienteSiesa[] = [];
  pagedClientes: ClienteSiesa[] = [];
  searchTerm = '';
  isLoading = false;
  letterFilter = '';

  // Solicitudes
  solicitudes: Solicitud[] = [];
  filteredSolicitudes: Solicitud[] = [];
  pagedSolicitudes: Solicitud[] = [];
  solicitudSearch = '';
  solicitudEstadoFilter = '';
  isLoadingSolicitudes = false;

  // Órdenes de Compra
  ordenes: any[] = [];
  filteredOrdenes: any[] = [];
  pagedOrdenes: any[] = [];
  ordenSearch = '';
  ordenEstadoFilter = '';
  isLoadingOrdenes = false;
  estadisticasOC: any = null;

  // Pagination
  readonly clientesPaginatorId = 'comerciales-clientes';
  readonly solicitudesPaginatorId = 'comerciales-solicitudes-list';
  readonly ordenesPaginatorId = 'comerciales-ordenes-list';
  private paginationSubs: Subscription[] = [];

  constructor(
    private comercialService: ComercialService,
    private ordenCompraService: OrdenCompraService,
    private router: Router,
    private route: ActivatedRoute,
    public paginationService: PaginationService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    const mode = this.route.snapshot.data['mode'];
    if (mode === 'solicitudes') {
      this.viewMode = 'solicitudes';
      this.loadSolicitudes();
    } else {
      this.loadClientes();
    }
  }

  private loadTailwind(): void {
    if (!this.document.getElementById('tw-cdn-comerciales')) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      link.id = 'tw-cdn-comerciales';
      this.document.head.appendChild(link);
    }
    if (!this.document.getElementById('bi-cdn-comerciales')) {
      const icons = this.document.createElement('link');
      icons.rel = 'stylesheet';
      icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
      icons.id = 'bi-cdn-comerciales';
      this.document.head.appendChild(icons);
    }
  }

  ngOnDestroy(): void {
    this.paginationSubs.forEach(s => s.unsubscribe());
    this.paginationService.destroyPaginator(this.clientesPaginatorId);
    this.paginationService.destroyPaginator(this.solicitudesPaginatorId);
    this.paginationService.destroyPaginator(this.ordenesPaginatorId);
    // No removemos Tailwind ya que otros componentes lo usan
  }

  // ==================== TABS ====================
  switchView(mode: 'clientes' | 'solicitudes' | 'ordenes'): void {
    this.viewMode = mode;
    if (mode === 'solicitudes' && this.solicitudes.length === 0) this.loadSolicitudes();
    if (mode === 'ordenes' && this.ordenes.length === 0) this.loadOrdenes();
    if (mode === 'clientes' && this.clientes.length === 0) this.loadClientes();
  }

  // ==================== CLIENTES ====================
  loadClientes(): void {
    this.isLoading = true;
    this.comercialService.listarClientes().subscribe({
      next: (res) => {
        this.clientes = res.data || [];
        this.applyClienteFilters();
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los clientes', 'error');
        this.isLoading = false;
      }
    });
  }

  searchClientes(): void {
    if (this.searchTerm.length >= 2) {
      this.isLoading = true;
      this.comercialService.buscarClientes(this.searchTerm).subscribe({
        next: (res) => {
          this.clientes = res.data || [];
          this.applyClienteFilters();
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; }
      });
    } else if (this.searchTerm.length === 0) {
      this.loadClientes();
    }
  }

  applyClienteFilters(): void {
    let result = [...this.clientes];
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(c =>
        c.razon_social.toLowerCase().includes(term) ||
        c.nit?.toLowerCase().includes(term)
      );
    }
    if (this.letterFilter) {
      result = result.filter(c => c.razon_social.toUpperCase().startsWith(this.letterFilter));
    }
    this.filteredClientes = result;
    this.initClientesPaginator();
  }

  private initClientesPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.clientesPaginatorId, this.filteredClientes, 24)
      .subscribe((state: PaginationState) => {
        this.pagedClientes = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  setLetterFilter(letter: string): void {
    this.letterFilter = this.letterFilter === letter ? '' : letter;
    this.applyClienteFilters();
  }

  goToCliente(cliente: ClienteSiesa): void {
    this.router.navigate(['/comerciales/cliente', cliente.id], {
      queryParams: { nombre: cliente.razon_social, nit: cliente.nit }
    });
  }

  get alphabet(): string[] {
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  }

  // ==================== SOLICITUDES ====================
  loadSolicitudes(): void {
    this.isLoadingSolicitudes = true;
    this.comercialService.listarSolicitudes().subscribe({
      next: (res) => {
        this.solicitudes = res.data || [];
        this.applySolicitudFilters();
        this.isLoadingSolicitudes = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar las solicitudes', 'error');
        this.isLoadingSolicitudes = false;
      }
    });
  }

  applySolicitudFilters(): void {
    let result = [...this.solicitudes];
    if (this.solicitudSearch.trim()) {
      const term = this.solicitudSearch.toLowerCase();
      result = result.filter(c =>
        c.codigo?.toLowerCase().includes(term) ||
        c.cliente_nombre?.toLowerCase().includes(term)
      );
    }
    if (this.solicitudEstadoFilter) {
      result = result.filter(c => c.estado === this.solicitudEstadoFilter);
    }
    this.filteredSolicitudes = result;
    this.initSolicitudesPaginator();
  }

  private initSolicitudesPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.solicitudesPaginatorId, this.filteredSolicitudes, 10)
      .subscribe((state: PaginationState) => {
        this.pagedSolicitudes = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  goToSolicitud(solicitud: Solicitud): void {
    this.router.navigate(['/comerciales/solicitud', solicitud.id]);
  }

  nuevaSolicitud(): void {
    this.router.navigate(['/comerciales/solicitud/nuevo']);
  }

  // ==================== ORDENES DE COMPRA ====================
  loadOrdenes(): void {
    this.isLoadingOrdenes = true;
    this.ordenCompraService.obtenerOrdenes().subscribe({
      next: (res) => {
        this.ordenes = res.data || [];
        this.applyOrdenFilters();
        this.isLoadingOrdenes = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar las órdenes', 'error');
        this.isLoadingOrdenes = false;
      }
    });
    this.ordenCompraService.obtenerEstadisticas().subscribe({
      next: (res) => { this.estadisticasOC = res.data; },
      error: () => {}
    });
  }

  applyOrdenFilters(): void {
    let result = [...this.ordenes];
    if (this.ordenSearch.trim()) {
      const term = this.ordenSearch.toLowerCase();
      result = result.filter((o: any) =>
        o.numero_orden?.toLowerCase().includes(term) ||
        o.cliente?.toLowerCase().includes(term) ||
        (o.pv_asociado || '').toLowerCase().includes(term)
      );
    }
    if (this.ordenEstadoFilter) {
      result = result.filter((o: any) => o.estado === this.ordenEstadoFilter);
    }
    this.filteredOrdenes = result;
    this.initOrdenesPaginator();
  }

  private initOrdenesPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.ordenesPaginatorId, this.filteredOrdenes, 10)
      .subscribe((state: PaginationState) => {
        this.pagedOrdenes = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  irACaptura(): void {
    this.router.navigate(['/comerciales/captura']);
  }

  // ==================== HELPERS ====================
  getEstadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      'BORRADOR': 'bg-gray-100 text-gray-700',
      'ENVIADO': 'bg-blue-100 text-blue-700',
      'EN_COSTEO': 'bg-yellow-100 text-yellow-800',
      'COSTEADO': 'bg-purple-100 text-purple-700',
      'APROBADO': 'bg-green-100 text-green-700',
      'RECHAZADO': 'bg-red-100 text-red-700',
      'PENDIENTE': 'bg-yellow-100 text-yellow-800',
      'PROCESADA': 'bg-green-100 text-green-700',
      'RECHAZADA': 'bg-red-100 text-red-700',
    };
    return map[estado] || 'bg-gray-100 text-gray-700';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      'BORRADOR': 'Borrador', 'ENVIADO': 'Enviado', 'EN_COSTEO': 'En Costeo',
      'COSTEADO': 'Costeado', 'APROBADO': 'Aprobado', 'RECHAZADO': 'Rechazado',
      'PENDIENTE': 'Pendiente', 'PROCESADA': 'Procesada', 'RECHAZADA': 'Rechazada',
    };
    return map[estado] || estado;
  }
}
