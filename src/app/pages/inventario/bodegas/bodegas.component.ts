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

  // Filtros
  filters = { busqueda: '' };

  selectedItems: any[] = [];
  mostrarModal = false;
  zonaSeleccionada: number | null = null;

  // 🆕 Zonas dinámicas desde el backend
  zonas: any[] = [];

  constructor(
    public paginationService: PaginationService,
    private inventarioService: InventarioService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarBodegas();
    this.cargarZonas(); // 🆕 Cargar zonas al iniciar
  }

  /** -------------------------
   *  🆕 CARGAR ZONAS
   ------------------------- */
  cargarZonas(): void {
    this.inventarioService.obtenerZonas().subscribe({
      next: (res) => {
        this.zonas = res['data'] || [];
      },
      error: (err) => {
        console.error('Error al cargar zonas:', err);
        // No mostrar error al usuario, usar zonas por defecto
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

        // Si el usuario NO es admin, aplicamos filtrado por roles de gestor
        if (!this.authService.hasAnyRole(['Admin (inventario)', 'Administrador del sistema'])) {

          // Lista de roles posibles de gestor
          const rolesGestores = [
            'Gestor de bodega (MP001)',
            'Gestor de bodega (MP003)',
            'Gestor de bodega (BT001)'
          ];

          // Obtener todos los códigos de bodegas a las que tiene acceso
          const codigosPermitidos: string[] = [];

          rolesGestores.forEach(rol => {
            if (this.authService.hasRole(rol)) {
              const match = rol.match(/\((.*?)\)/);
              const codigo = match ? match[1] : null;
              if (codigo) codigosPermitidos.push(codigo);
            }
          });

          // Filtrar bodegas si tiene algún rol válido
          if (codigosPermitidos.length > 0) {
            bodegas = bodegas.filter((b: any) => codigosPermitidos.includes(b.codigo));
          } else {
            // Si no tiene permisos sobre ninguna bodega
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

  filterBodegas: FilterFunction = (bodega: any, filtros) => {
    const texto = (filtros.busqueda || '').toLowerCase().trim();
    return !texto || bodega.codigo?.toLowerCase().includes(texto);
  };

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

  filterItems: FilterFunction = (item: any, filtros) => {
    const texto = (filtros.busqueda || '').toLowerCase().trim();
    if (!texto) return true;

    return item.id_item?.toLowerCase().includes(texto) ||
           item.descripcion?.toLowerCase().includes(texto) ||
           item.zonas?.some((z: any) => z.nombre.toLowerCase().includes(texto));
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