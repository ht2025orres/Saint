import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, ItemSiesa, Solicitud } from '../../../services/comercial.service';
import { OrdenCompraService } from '../../../services/orden-compra.service';
import { PaginationService, PaginationState } from '../../../shared/pagination/pagination.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cliente-items',
  templateUrl: './cliente-items.component.html',
  styleUrls: ['./cliente-items.component.css']
})
export class ClienteItemsComponent implements OnInit, OnDestroy {
  clienteId!: number;
  clienteNombre = '';
  clienteNit = '';

  // Items
  items: ItemSiesa[] = [];
  filteredItems: ItemSiesa[] = [];
  pagedItems: ItemSiesa[] = [];
  searchTerm = '';
  isLoading = false;
  isDeepSearch = false;

  // Solicitudes del cliente
  solicitudes: Solicitud[] = [];
  pagedSolicitudes: Solicitud[] = [];
  isLoadingSolicitudes = false;

  // Órdenes del cliente
  ordenes: any[] = [];
  pagedOrdenes: any[] = [];
  isLoadingOrdenes = false;

  activeTab: 'items' | 'solicitudes' | 'ordenes' = 'items';

  // Pagination
  readonly itemsPaginatorId = 'comerciales-items';
  readonly solicitudesPaginatorId = 'comerciales-cliente-solicitudes';
  readonly ordenesPaginatorId = 'comerciales-cliente-ordenes';
  private paginationSubs: Subscription[] = [];

  constructor(
    private comercialService: ComercialService,
    private ordenCompraService: OrdenCompraService,
    private route: ActivatedRoute,
    private router: Router,
    public paginationService: PaginationService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.clienteId = Number(this.route.snapshot.paramMap.get('id'));
    this.clienteNombre = this.route.snapshot.queryParamMap.get('nombre') || '';
    this.clienteNit = this.route.snapshot.queryParamMap.get('nit') || '';

    const initialTab = this.route.snapshot.queryParamMap.get('tab');
    if (initialTab === 'solicitudes' || initialTab === 'ordenes') {
      this.activeTab = initialTab;
    }

    this.loadItems();
    this.loadSolicitudes();
    this.loadOrdenes();
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
    this.paginationService.destroyPaginator(this.itemsPaginatorId);
    this.paginationService.destroyPaginator(this.solicitudesPaginatorId);
    this.paginationService.destroyPaginator(this.ordenesPaginatorId);
  }

  // ==================== ITEMS ====================
  loadItems(): void {
    this.isLoading = true;
    this.comercialService.itemsCliente(this.clienteId).subscribe({
      next: (res) => {
        this.items = res.data || [];
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los ítems del cliente', 'error');
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    if (!this.searchTerm.trim()) {
      this.filteredItems = [...this.items];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredItems = this.items.filter(i =>
        (i.f120_descripcion || i.descripcion || '').toLowerCase().includes(term) ||
        (i.f120_referencia || i.referencia || '').toLowerCase().includes(term) ||
        (i.color || '').toLowerCase().includes(term) ||
        (i.talla || '').toLowerCase().includes(term)
      );
    }
    this.initItemsPaginator();
  }

  private initItemsPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.itemsPaginatorId, this.filteredItems, 25)
      .subscribe((state: PaginationState) => {
        this.pagedItems = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  searchItems(deep: boolean = false): void {
    if (this.searchTerm.length >= 2) {
      this.isLoading = true;
      this.isDeepSearch = deep;
      this.comercialService.buscarItemsCliente(this.clienteId, this.searchTerm, deep).subscribe({
        next: (res) => {
          this.filteredItems = res.data || [];
          this.initItemsPaginator();
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; }
      });
    } else if (this.searchTerm.length === 0) {
      this.isDeepSearch = false;
      this.applyFilters();
    }
  }

  deepSearch(): void { this.searchItems(true); }

  // ==================== SOLICITUDES ====================
  loadSolicitudes(): void {
    this.isLoadingSolicitudes = true;
    this.comercialService.listarSolicitudes({ 
      cliente_id: this.clienteId,
      cliente_nit: this.clienteNit,
      cliente_nombre: this.clienteNombre
    }).subscribe({
      next: (res) => {
        this.solicitudes = res.data || [];
        this.initSolicitudesPaginator();
        this.isLoadingSolicitudes = false;
      },
      error: () => { this.isLoadingSolicitudes = false; }
    });
  }

  private initSolicitudesPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.solicitudesPaginatorId, this.solicitudes, 10)
      .subscribe((state: PaginationState) => {
        this.pagedSolicitudes = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  // ==================== ORDENES ====================
  loadOrdenes(): void {
    this.isLoadingOrdenes = true;
    this.ordenCompraService.obtenerOrdenes({ cliente: this.clienteNombre }).subscribe({
      next: (res) => {
        this.ordenes = (res.data || []).filter((o: any) =>
          o.cliente?.toLowerCase().includes(this.clienteNombre.toLowerCase())
        );
        this.initOrdenesPaginator();
        this.isLoadingOrdenes = false;
      },
      error: () => { this.isLoadingOrdenes = false; }
    });
  }

  private initOrdenesPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.ordenesPaginatorId, this.ordenes, 10)
      .subscribe((state: PaginationState) => {
        this.pagedOrdenes = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  // ==================== NAVIGATION ====================
  nuevaSolicitud(item?: ItemSiesa): void {
    const queryParams: any = { nombre: this.clienteNombre, nit: this.clienteNit };
    if (item) {
      queryParams.pre_item = JSON.stringify({
        descripcion: this.getItemDesc(item),
        referencia: this.getItemRef(item),
        rowid_item_ext: item.f121_rowid || item.rowid_item_ext,
        rowid_item: item.f120_rowid,
        talla: item.talla,
        color: item.color
      });
    }
    this.router.navigate(['/comerciales/solicitud/nuevo', this.clienteId], { queryParams });
  }

  goToSolicitud(solicitud: Solicitud): void {
    this.router.navigate(['/comerciales/solicitud', solicitud.id]);
  }

  goBack(): void {
    this.router.navigate(['/comerciales']);
  }

  irACaptura(): void {
    this.router.navigate(['/comerciales/captura'], { 
      queryParams: { 
        cliente: this.clienteNombre, 
        nit: this.clienteNit,
        clienteId: this.clienteId
      } 
    });
  }

  // ==================== HELPERS ====================
  getItemDesc(item: ItemSiesa): string {
    return item.f120_descripcion || item.descripcion || item.f120_descripcion_corta || '';
  }

  getItemRef(item: ItemSiesa): string {
    return item.f120_referencia || item.referencia || item.f120_id || '';
  }

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
