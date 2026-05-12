import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ComercialService, ClienteSiesa, Solicitud } from '../../../services/comercial.service';
import { PaginationService, PaginationState } from '../../../shared/pagination/pagination.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cliente-list',
  templateUrl: './cliente-list.component.html',
  styleUrls: ['./cliente-list.component.css']
})
export class ClienteListComponent implements OnInit, OnDestroy {
  // Modo: 'clientes' o 'solicitudes'
  viewMode: 'clientes' | 'solicitudes' = 'clientes';

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

  // Pagination
  readonly clientesPaginatorId = 'comerciales-clientes';
  readonly solicitudesPaginatorId = 'comerciales-solicitudes-list';
  private paginationSubs: Subscription[] = [];

  constructor(
    private comercialService: ComercialService,
    private router: Router,
    private route: ActivatedRoute,
    public paginationService: PaginationService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadStyles();
    const mode = this.route.snapshot.data['mode'];
    if (mode === 'solicitudes') {
      this.viewMode = 'solicitudes';
      this.loadSolicitudes();
    } else {
      this.loadClientes();
    }
  }

  private loadStyles(): void {
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
    link.id = 'comerciales-icons';
    this.document.head.appendChild(link);
  }

  ngOnDestroy(): void {
    const el = this.document.getElementById('comerciales-icons');
    if (el) el.remove();
    this.paginationSubs.forEach(s => s.unsubscribe());
    this.paginationService.destroyPaginator(this.clientesPaginatorId);
    this.paginationService.destroyPaginator(this.solicitudesPaginatorId);
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
        error: () => {
          this.isLoading = false;
        }
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
      result = result.filter(c =>
        c.razon_social.toUpperCase().startsWith(this.letterFilter)
      );
    }

    this.filteredClientes = result;
    this.initClientesPaginator();
  }

  private initClientesPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.clientesPaginatorId, this.filteredClientes, 25)
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

  // ==================== VIEW TOGGLE ====================

  switchView(mode: 'clientes' | 'solicitudes'): void {
    this.viewMode = mode;
    if (mode === 'solicitudes' && this.solicitudes.length === 0) {
      this.loadSolicitudes();
    } else if (mode === 'clientes' && this.clientes.length === 0) {
      this.loadClientes();
    }
  }

  getEstadoBadge(estado: string): string {
    const map: Record<string, string> = {
      'BORRADOR': 'badge-borrador',
      'ENVIADO': 'badge-enviado',
      'EN_COSTEO': 'badge-en-costeo',
      'COSTEADO': 'badge-costeado',
      'APROBADO': 'badge-aprobado',
      'RECHAZADO': 'badge-rechazado',
    };
    return map[estado] || 'badge-default';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      'BORRADOR': 'Borrador',
      'ENVIADO': 'Enviado',
      'EN_COSTEO': 'En Costeo',
      'COSTEADO': 'Costeado',
      'APROBADO': 'Aprobado',
      'RECHAZADO': 'Rechazado',
    };
    return map[estado] || estado;
  }
}
