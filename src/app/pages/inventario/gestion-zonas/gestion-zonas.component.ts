import { Component, OnInit, OnDestroy } from '@angular/core';
import { InventarioService } from '../../../services/inventario.service';
import { PaginationService } from '../../../shared/pagination/pagination.service';
import { AuthService } from '../../../services/auth.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-gestion-zonas',
  templateUrl: './gestion-zonas.component.html',
  styleUrls: ['./gestion-zonas.component.css']
})
export class GestionZonasComponent implements OnInit, OnDestroy {
  bodegas: any[] = [];
  zonas: any[] = [];
  cargando = false;
  
  // Nueva lógica para asignación de items
  bodegaSeleccionada: string = '';
  itemsRaw: any[] = [];
  itemsPaginados: any[] = [];
  zonaSeleccionada: any = null;
  cargandoItems = false;
  
  filters = {
    busquedaItem: ''
  };

  // Control de modales
  mostrarModalZona = false;
  guardandoZona = false;
  
  // Selección masiva en zona
  selectedItems: any[] = [];
  mostrarModalMigrar = false;
  guardandoMigracion = false;
  
  colapsado = false;
  busquedaZonas: string = '';
  bodegaFiltro: string = '';

  private subscription: Subscription = new Subscription();
  instanceId = 'propuesta-items-zona';
  private itemsSub: Subscription | null = null;

  constructor(
    private inventarioService: InventarioService,
    private paginationService: PaginationService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.cargarBodegas();
    this.cargarZonas();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.itemsSub?.unsubscribe();
    this.paginationService.destroyPaginator(this.instanceId);
  }

  get zonasFiltradas() {
    return this.zonas.filter(z => {
      const matchBusqueda = z.nombre.toLowerCase().includes(this.busquedaZonas.toLowerCase());
      const matchBodega = !this.bodegaFiltro || z.codigo_bodega === this.bodegaFiltro;
      return matchBusqueda && matchBodega;
    });
  }

  cargarBodegas() {
    this.inventarioService.getBodegas().subscribe(resp => {
      if (resp.success) {
        this.bodegas = resp.data;
      }
    });
  }

  cargarZonas() {
    this.cargando = true;
    this.inventarioService.getZonas().subscribe(resp => {
      if (resp.success) {
        this.zonas = resp.data;
      }
      this.cargando = false;
    });
  }

  abrirModalNuevaZona() {
    this.mostrarModalZona = true;
  }

  crearZona(data: any) {
    this.guardandoZona = true;
    const userId = this.authService.user.id || 0;
    this.inventarioService.storeZona(data, userId).subscribe({
      next: (resp) => {
        if (resp.success) {
          Swal.fire('Éxito', 'Zona creada correctamente', 'success');
          this.mostrarModalZona = false;
          this.cargarZonas();
        }
        this.guardandoZona = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo crear la zona', 'error');
        this.guardandoZona = false;
      }
    });
  }

  getNombreBodega(codigo: string) {
    const bodega = this.bodegas.find(b => b.codigo === codigo);
    return bodega ? bodega.nombre_bodega : codigo;
  }

  seleccionarZona(zona: any) {
    this.zonaSeleccionada = zona;
    this.bodegaSeleccionada = zona.codigo_bodega;
    this.selectedItems = [];
    
    // Reiniciar paginador para evitar ver items de la zona anterior
    this.paginationService.resetPaginator(this.instanceId);
    this.itemsRaw = [];
    this.itemsPaginados = [];
    
    this.cargarItems();
  }

  cargarItems() {
    if (!this.bodegaSeleccionada) return;
    this.cargandoItems = true;
    
    // Limpiar suscripción previa si existe
    if (this.itemsSub) {
      this.itemsSub.unsubscribe();
      this.itemsSub = null;
    }

    this.inventarioService.getItemsPorBodega(this.bodegaSeleccionada).subscribe(resp => {
      if (resp.success) {
        // Filtrar SOLO items que ya pertenecen a esta zona
        this.itemsRaw = resp.data
            .filter((i: any) => i.zonas?.some((z: any) => z.id === this.zonaSeleccionada.id))
            .map((i: any) => ({ ...i, seleccionado: false }));

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
      this.cargandoItems = false;
    });
  }

  filterFunction(item: any, filters: any): boolean {
    if (!filters.busquedaItem) return true;
    const search = filters.busquedaItem.toLowerCase();
    return item.id_item?.toString().includes(search) ||
           item.referencia?.toLowerCase().includes(search) ||
           item.descripcion?.toLowerCase().includes(search);
  }

  applyFilters() {
    this.paginationService.updatePaginator(this.instanceId, this.itemsRaw, 25, this.filters, this.filterFunction.bind(this));
  }

  toggleItem(item: any) {
    const index = this.selectedItems.findIndex(i => i.id_f400 === item.id_f400);
    if (item.seleccionado && index === -1) {
      this.selectedItems.push(item);
    } else if (!item.seleccionado && index !== -1) {
      this.selectedItems.splice(index, 1);
    }
  }

  toggleAll(event: any) {
    const isChecked = event.target.checked;
    this.itemsPaginados.forEach(i => {
      i.seleccionado = isChecked;
      this.toggleItem(i);
    });
  }

  abrirModalMigrar() {
    if (this.selectedItems.length === 0) return;
    this.mostrarModalMigrar = true;
  }

  procesarMigracion(idZonaDestino: number) {
    this.guardandoMigracion = true;
    
    // Primero asignar a la nueva zona
    const payloadAsig = {
        items: this.selectedItems.map(i => ({
            codigo_item: i.id_item,
            id_f400: i.id_f400,
            codigo_bodega: i.codigo_bodega,
            id_zona: idZonaDestino
        }))
    };

    this.inventarioService.asignarZonaItems(payloadAsig).subscribe(resp => {
        if (resp.success) {
            // Luego quitar de la zona actual
            const payloadElim = {
                items: this.selectedItems.map(i => ({
                    codigo_item: i.id_item,
                    id_f400: i.id_f400,
                    codigo_bodega: i.codigo_bodega,
                    id_zona: this.zonaSeleccionada.id
                }))
            };
            
            this.inventarioService.eliminarZonasMasivo(payloadElim).subscribe(() => {
                Swal.fire('Éxito', 'Items movidos correctamente', 'success');
                this.mostrarModalMigrar = false;
                this.selectedItems = [];
                this.cargarItems();
                this.guardandoMigracion = false;
            });
        }
    });
  }

  quitarDeZonaMasivo() {
    if (this.selectedItems.length === 0) return;
    
    Swal.fire({
      title: '¿Sacar de esta zona?',
      text: `Se quitarán ${this.selectedItems.length} ítems de la zona ${this.zonaSeleccionada.nombre}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, quitar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const payload = {
            items: this.selectedItems.map(i => ({
                codigo_item: i.id_item,
                id_f400: i.id_f400,
                codigo_bodega: i.codigo_bodega,
                id_zona: this.zonaSeleccionada.id
            }))
        };

        this.inventarioService.eliminarZonasMasivo(payload).subscribe(resp => {
            if (resp.success) {
                Swal.fire('Eliminado', 'Items quitados de la zona', 'success');
                this.selectedItems = [];
                this.cargarItems();
            }
        });
      }
    });
  }
}
