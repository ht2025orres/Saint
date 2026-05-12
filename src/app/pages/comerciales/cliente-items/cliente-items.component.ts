import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, ItemSiesa, Solicitud } from '../../../services/comercial.service';
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

  activeTab: 'items' | 'solicitudes' = 'items';

  // Pagination
  readonly itemsPaginatorId = 'comerciales-items';
  readonly solicitudesPaginatorId = 'comerciales-cliente-solicitudes';
  private paginationSubs: Subscription[] = [];

  constructor(
    private comercialService: ComercialService,
    private route: ActivatedRoute,
    private router: Router,
    public paginationService: PaginationService
  ) {}

  ngOnInit(): void {
    this.clienteId = Number(this.route.snapshot.paramMap.get('id'));
    this.clienteNombre = this.route.snapshot.queryParamMap.get('nombre') || '';
    this.clienteNit = this.route.snapshot.queryParamMap.get('nit') || '';

    this.loadItems();
    this.loadSolicitudes();
  }

  ngOnDestroy(): void {
    this.paginationSubs.forEach(s => s.unsubscribe());
    this.paginationService.destroyPaginator(this.itemsPaginatorId);
    this.paginationService.destroyPaginator(this.solicitudesPaginatorId);
  }

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

  loadSolicitudes(): void {
    this.isLoadingSolicitudes = true;
    this.comercialService.listarSolicitudes({ cliente_id: this.clienteId }).subscribe({
      next: (res) => {
        this.solicitudes = res.data || [];
        this.initSolicitudesPaginator();
        this.isLoadingSolicitudes = false;
      },
      error: () => {
        this.isLoadingSolicitudes = false;
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

  private initSolicitudesPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.solicitudesPaginatorId, this.solicitudes, 10)
      .subscribe((state: PaginationState) => {
        this.pagedSolicitudes = state.currentData;
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
        error: () => {
          this.isLoading = false;
        }
      });
    } else if (this.searchTerm.length === 0) {
      this.isDeepSearch = false;
      this.applyFilters();
    }
  }

  deepSearch(): void {
    this.searchItems(true);
  }

  nuevaSolicitud(item?: ItemSiesa): void {
    const queryParams: any = {
      nombre: this.clienteNombre,
      nit: this.clienteNit
    };

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

    this.router.navigate(['/comerciales/solicitud/nuevo', this.clienteId], {
      queryParams
    });
  }

  goToSolicitud(solicitud: Solicitud): void {
    this.router.navigate(['/comerciales/solicitud', solicitud.id]);
  }

  goBack(): void {
    this.router.navigate(['/comerciales']);
  }

  getItemDesc(item: ItemSiesa): string {
    return item.f120_descripcion || item.descripcion || item.f120_descripcion_corta || '';
  }

  getItemRef(item: ItemSiesa): string {
    return item.f120_referencia || item.referencia || item.f120_id || '';
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
      'BORRADOR': 'Borrador', 'ENVIADO': 'Enviado', 'EN_COSTEO': 'En Costeo',
      'COSTEADO': 'Costeado', 'APROBADO': 'Aprobado', 'RECHAZADO': 'Rechazado',
    };
    return map[estado] || estado;
  }
}
