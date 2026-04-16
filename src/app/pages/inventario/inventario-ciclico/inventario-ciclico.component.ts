import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { InventarioService } from 'src/app/services/inventario.service';
import { AuthService } from 'src/app/services/auth.service';
import { PaginationService } from 'src/app/shared/pagination/pagination.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-inventario-ciclico',
  templateUrl: './inventario-ciclico.component.html',
  styleUrls: ['./inventario-ciclico.component.css']
})
export class InventarioCiclicoComponent implements OnInit, OnDestroy {
  bodega: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';
  itemsRaw: any[] = [];
  itemsPaginados: any[] = [];
  loading = false;

  // Filtros
  filters = {
    busqueda: ''
  };

  // Paginación
  instanceId = 'ciclico-items';
  private itemsSub: Subscription | null = null;

  // Modal
  showModalConteo = false;
  itemSeleccionado: any = null;

  constructor(
    private route: ActivatedRoute,
    private inventarioService: InventarioService,
    private authService: AuthService,
    private paginationService: PaginationService
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.bodega = params['bodega'] || '';
      if (this.bodega) {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        this.fechaInicio = firstDay.toISOString().split('T')[0];
        this.fechaFin = now.toISOString().split('T')[0];
        this.cargarMovimientos();
      }
    });
  }

  ngOnDestroy(): void {
    this.itemsSub?.unsubscribe();
    this.paginationService.destroyPaginator(this.instanceId);
  }

  cargarMovimientos() {
    if (!this.bodega || !this.fechaInicio || !this.fechaFin) return;
    
    this.loading = true;
    
    if (this.itemsSub) {
      this.itemsSub.unsubscribe();
      this.itemsSub = null;
    }

    this.inventarioService.getMovimientosCiclico(this.bodega, this.fechaInicio, this.fechaFin).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.itemsRaw = resp.data;
          
          this.itemsSub = this.paginationService.initializePaginator(
            this.instanceId,
            this.itemsRaw,
            25,
            this.filters,
            this.filterFunction.bind(this)
          ).subscribe(state => {
            this.itemsPaginados = state.currentData;
          });
        }
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        Swal.fire('Error', 'No se pudieron cargar los movimientos', 'error');
        this.loading = false;
      }
    });
  }

  filterFunction(item: any, filters: any): boolean {
    if (!filters.busqueda) return true;
    const search = filters.busqueda.toLowerCase();
    return item.id_item?.toString().toLowerCase().includes(search) ||
           item.referencia?.toLowerCase().includes(search) ||
           item.descripcion?.toLowerCase().includes(search);
  }

  applyFilters() {
    this.paginationService.updatePaginator(
      this.instanceId, 
      this.itemsRaw, 
      25, 
      this.filters, 
      this.filterFunction.bind(this)
    );
  }

  abrirModalConteo(item: any) {
    this.itemSeleccionado = item;
    this.showModalConteo = true;
  }

  formatFecha(fechaId: any): string {
    if (!fechaId) return 'Sin movimientos';
    const f = fechaId.toString();
    if (f.length !== 8) return f;
    const anio = f.substring(0, 4);
    const mes = f.substring(4, 6);
    const dia = f.substring(6, 8);
    return `${dia}/${mes}/${anio}`;
  }
}
