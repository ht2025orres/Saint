import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { InventarioService } from 'src/app/services/inventario.service';
import { AuthService } from 'src/app/services/auth.service';
import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-bodegas',
  templateUrl: './bodegas.component.html',
  styleUrls: ['./bodegas.component.css']
})
export class BodegasComponent implements OnInit {
  paginatorId = 'bodega-list-paginator';

  isLoadingBodegas: boolean = false;
  isLoadingItems: boolean = false;

  // Vistas
  vistaActual: 'bodegas' | 'items' = 'bodegas';
  codigoBodega: string | null = null;
  nombreBodega: string | null = null;

  // Datos bodegas
  bodegas: any[] = [];
  currentBodegas: any[] = [];
  totalBodegas: number = 0;

  // Datos ítems
  items: any[] = [];
  currentItems: any[] = [];
  totalItems: number = 0;

  // Filtros - 🆕 Agregamos búsqueda exacta
  filters = { 
    busqueda: '',
    busquedaExacta: false  // Nueva propiedad
  };
  
  selectedItems: any[] = [];
  mostrarModal = false;
  zonaSeleccionada: number | null = null;
  
  zonas: any[] = [];
  
  sincronizando = false;

  constructor(
    public paginationService: PaginationService,
    private inventarioService: InventarioService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.inventarioService.sincronizarExistencias().subscribe({
      next: (response: any) => {
        console.log('Sincronización inicial completada:', response);
        this.sincronizando = false;
      },
      error: () => {
        this.sincronizando = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudo completar la sincronización',
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
      }
    });
    this.cargarBodegas();
    this.cargarZonas();
  }

  cargarZonas(): void {
    this.inventarioService.obtenerZonas().subscribe({
      next: (res) => {
        this.zonas = res['data'] || [];
      },
      error: (err) => {
        console.error('Error al cargar zonas:', err);
        this.zonas = [];
      }
    });
  }

  /** -------------------------
   *  BODEGAS
   ------------------------- */
  cargarBodegas(): void {
    this.isLoadingBodegas = true;

    this.inventarioService.obtenerResumenBodegas().subscribe({
      next: (res) => {
        let bodegas = res['data'] || [];

        if (!this.authService.hasAnyRole(['Admin (inventario)', 'Administrador del sistema'])) {
          const rolesGestores = [
            'Gestor de bodega (MP001)',
            'Gestor de bodega (MP003)',
            'Gestor de bodega (BT001)'
          ];

          const codigosPermitidos: string[] = [];

          rolesGestores.forEach(rol => {
            if (this.authService.hasRole(rol)) {
              const match = rol.match(/\((.*?)\)/);
              const codigo = match ? match[1] : null;
              if (codigo) codigosPermitidos.push(codigo);
            }
          });

          if (codigosPermitidos.length > 0) {
            bodegas = bodegas.filter((b: any) => codigosPermitidos.includes(b.codigo));
          } else {
            bodegas = [];
          }
        }

        this.bodegas = bodegas;
        this.totalBodegas = bodegas.length;
        this.inicializarPaginacionBodegas();
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar las bodegas', 'error');
      },
      complete: () => {
        this.isLoadingBodegas = false;
      }
    });
  }

  inicializarPaginacionBodegas(): void {
    if (this.bodegas.length > 0) {
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.bodegas,
        5,
        this.filters,
        this.filterBodegas
      ).subscribe(state => {
        this.currentBodegas = state.currentData;
      });
    }
  }

  // 🆕 Filtro actualizado para bodegas con búsqueda exacta
  filterBodegas: FilterFunction = (bodega: any, filtros) => {
    const texto = (filtros.busqueda || '').trim();
    if (!texto) return true;

    const textoLower = texto.toLowerCase();
    const codigoLower = (bodega.codigo || '').toLowerCase();

    if (filtros.busquedaExacta) {
      return codigoLower === textoLower;
    } else {
      return codigoLower.includes(textoLower);
    }
  };


  sincronizarBodegas() {
    Swal.fire({
      title: '¿Sincronizar con SIESA?',
      text: 'Se actualizará el estado de existencias de los items',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, sincronizar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.sincronizando = true;
        
        Swal.fire({
          title: 'Sincronizando...',
          text: 'Por favor espera',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        
        this.inventarioService.sincronizarExistencias().subscribe({
          next: (response: any) => {
            this.sincronizando = false;
            Swal.fire({
              title: '¡Sincronización completada!',
              text: 'Los datos se han actualizado correctamente',
              icon: 'success',
              timer: 1500,
              showConfirmButton: false
            }).then(() => {
              window.location.reload();
            });
          },
          error: () => {
            this.sincronizando = false;
            Swal.fire({
              title: 'Error',
              text: 'No se pudo completar la sincronización',
              icon: 'error',
              confirmButtonText: 'Aceptar'
            });
          }
        });
      }
    });
  }

  /** -------------------------
   *  ITEMS
   ------------------------- */
  verItemsDeBodega(codigoBodega: string, nombreBodega: string): void {
    this.isLoadingItems = true;
    this.codigoBodega = codigoBodega;
    this.nombreBodega = nombreBodega;
    this.vistaActual = 'items';
    this.filters.busqueda = '';

    this.inventarioService.obtenerItemsPorBodega(codigoBodega).subscribe({
      next: (res) => {
        console.log(res);
        this.items = res['data'] || [];
        this.totalItems = this.items.length;

        this.paginationService.initializePaginator(
          this.paginatorId,
          this.items,
          10,
          this.filters,
          this.filterItems
        ).subscribe(state => {
          this.currentItems = state.currentData;
        });
      },
      error: (err) => {
        console.error('Error al cargar ítems:', err);
        Swal.fire('Error', 'No se pudieron cargar los ítems', 'error');
      },
      complete: () => {
        this.isLoadingItems = false;
      }
    });
  }

  // 🆕 Filtro actualizado para items con búsqueda exacta
  filterItems: FilterFunction = (item: any, filtros) => {
    const texto = (filtros.busqueda || '').trim();
    if (!texto) return true;

    const textoLower = texto.toLowerCase();
    // console.log('Filtrando ítem:', item);
    if (filtros.busquedaExacta) {
      // Búsqueda exacta: coincidencia completa en cualquier campo
      const idItemLower = (item.id_item || '').toLowerCase();
      const descripcionLower = (item.descripcion || '').toLowerCase();
      const cantidadStr = String(item.cantidad || '');
      const id_color = String(item.id_color?.trim() || '');
      const zonaExacta = item.zonas?.some((z: any) => 
        (z.nombre || '').toLowerCase() === textoLower
      );

      return idItemLower === textoLower || 
             descripcionLower === textoLower || 
             cantidadStr === texto ||
             id_color === texto ||
             zonaExacta ;
    } else {
      // Búsqueda parcial: coincidencia en cualquier parte
      return item.id_item?.toLowerCase().includes(textoLower) ||
             item.descripcion?.toLowerCase().includes(textoLower) ||
             item.id_color?.toLowerCase().includes(textoLower) ||
             String(item.cantidad || '').includes(texto) ||
             item.zonas?.some((z: any) => z.nombre.toLowerCase().includes(textoLower));
    }
  };

  volverABodegas(): void {
    this.vistaActual = 'bodegas';
    this.codigoBodega = null;
    this.nombreBodega = null;
    this.filters.busqueda = '';
    this.selectedItems = [];
    this.inicializarPaginacionBodegas();
  }

  /** -------------------------
   *  GENERALES
   ------------------------- */
  applyFilters(): void {
    const data = this.vistaActual === 'bodegas' ? this.bodegas : this.items;

    this.paginationService.updatePaginator(
      this.paginatorId,
      data,
      undefined,
      this.filters,
      this.vistaActual === 'bodegas' ? this.filterBodegas : this.filterItems
    );
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

  toggleItem(item: any) {
    if (item.seleccionado) {
      if (!this.selectedItems.find(i => i.id_f400 === item.id_f400)) {
        this.selectedItems.push(item);
      }
    } else {
      this.selectedItems = this.selectedItems.filter(i => i.id_f400 !== item.id_f400);
    }
  }

  asignarZonaMasiva(zonaId: number) {
    const payload = this.selectedItems.map(i => ({
      codigo_item: i.id_item,
      codigo_bodega: this.codigoBodega,
      id_f400: i.id_f400,
      id_zona: zonaId
    }));

    this.inventarioService.asignarZonaItems(payload).subscribe({
      next: () => {
        Swal.fire('¡Éxito!', 'Zona asignada correctamente.', 'success');
        this.verItemsDeBodega(this.codigoBodega!, this.nombreBodega!);
        this.selectedItems = [];
      },
      error: () => Swal.fire('Error', 'No se pudo asignar la zona.', 'error')
    });
  }

  eliminarZonaDeItem(item: any, zona: any) {
    Swal.fire({
      title: '¿Eliminar zona?',
      text: `¿Deseas eliminar la zona "${zona.nombre}" del ítem ${item.id_item}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.inventarioService.eliminarZonaItem(
          item.id_item,
          this.codigoBodega!,
          zona.id,
          item.id_f400
        ).subscribe({
          next: () => {
            Swal.fire('¡Eliminado!', 'Zona eliminada correctamente.', 'success');
            this.verItemsDeBodega(this.codigoBodega!, this.nombreBodega!);
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar la zona.', 'error')
        });
      }
    });
  }

  verDetalleItem(item: any): void {
    console.log('Ver detalle del ítem:', item);
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.zonaSeleccionada = null;
  }

  confirmar() {
    if (this.zonaSeleccionada) {
      this.asignarZonaMasiva(this.zonaSeleccionada);
      this.cerrarModal();
    } else {
      Swal.fire('Atención', 'Debes seleccionar una zona', 'warning');
    }
  }

  get selectedCodigos(): string {
    return this.selectedItems.map(i => i.id_f400).join(', ');
  }

  getZonasNombres(zonas: any[]): string {
    if (!zonas || zonas.length === 0) return 'Sin zona';
    return zonas.map(z => z.nombre).join(', ');
  }
}