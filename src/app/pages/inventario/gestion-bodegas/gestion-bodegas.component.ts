import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { InventarioService } from '../../../services/inventario.service';
import { PaginationService } from '../../../shared/pagination/pagination.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-gestion-bodegas',
  templateUrl: './gestion-bodegas.component.html',
})
export class GestionBodegasComponent implements OnInit, OnDestroy {
  @ViewChild('dropdownZonas') dropdownZonas!: ElementRef;

  @HostListener('document:click', ['$event'])
  clickout(event: any) {
    // Si el dropdown está abierto y el clic fue fuera de su contenedor
    if (this.mostrarFiltroZonas && this.dropdownZonas && !this.dropdownZonas.nativeElement.contains(event.target)) {
      this.mostrarFiltroZonas = false;
    }
  }

  bodegas: any[] = [];
  zonas: any[] = [];
  vistaActual: 'bodegas' | 'items' = 'bodegas';
  bodegaSeleccionada: any = null;
  
  cargandoBodegas = false;
  cargandoItems = false;
  sincronizando = false;
  migrando = false;
  
  filters = {
    busquedaBodega: '',
    busquedaItem: '',
    busquedaExacta: false,
    zonasSeleccionadas: [] as number[],
    filtroTipoItem: '' // Nuevo filtro: 'insumos' | 'telas'
  };

  busquedaZonaFiltro = '';
  mostrarFiltroZonas = false;

  // Paginación
  itemsRaw: any[] = [];
  itemsPaginados: any[] = [];
  private subscription: Subscription = new Subscription();
  private itemsSub: Subscription | null = null;
  instanceId = 'propuesta-items-bodega';

  // Selección masiva
  selectedItems: any[] = [];
  mostrarModalAsignacion = false; 
  mostrarModalGestionMasiva = false;
  modoGestionMasiva: 'asignar' | 'quitar' = 'asignar';
  guardandoAsignacion = false;

  constructor(
    private inventarioService: InventarioService,
    private paginationService: PaginationService,
    private eRef: ElementRef
  ) { }

  ngOnInit(): void {
    this.cargarBodegas();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.itemsSub?.unsubscribe();
    this.paginationService.destroyPaginator(this.instanceId);
  }

  cargarBodegas() {
    this.cargandoBodegas = true;
    this.subscription.add(
      this.inventarioService.getBodegas().subscribe(resp => {
        if (resp.success) {
          this.bodegas = resp.data;
        }
        this.cargandoBodegas = false;
      })
    );
  }

  sincronizarBodegas() {
    this.sincronizando = true;
    this.subscription.add(
      this.inventarioService.sincronizarBodegas().subscribe({
        next: (resp) => {
          if (resp.success) {
            Swal.fire('Éxito', 'Bodegas sincronizadas con SIESA', 'success');
            this.cargarBodegas();
          }
          this.sincronizando = false;
        },
        error: () => {
          Swal.fire('Error', 'No se pudo sincronizar las bodegas', 'error');
          this.sincronizando = false;
        }
      })
    );
  }

  migrarZonas() {
    Swal.fire({
      title: '¿Migrar zonas anteriores?',
      text: 'Se intentará mapear las zonas del sistema anterior a la nueva estructura de bodegas.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, migrar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.migrando = true;
        this.inventarioService.migrarZonasAnteriores().subscribe({
          next: (resp) => {
            if (resp.success) {
              Swal.fire('Migración completada', `${resp.summary.migradas} zonas migradas con éxito.`, 'success');
              this.cargarBodegas();
            }
            this.migrando = false;
          },
          error: () => {
            Swal.fire('Error', 'No se pudo completar la migración', 'error');
            this.migrando = false;
          }
        });
      }
    });
  }

  verItems(bodega: any) {
    this.bodegaSeleccionada = bodega;
    this.vistaActual = 'items';
    
    // Reiniciar estados locales
    this.itemsRaw = [];
    this.itemsPaginados = [];
    this.selectedItems = [];
    this.filters.zonasSeleccionadas = [];
    this.busquedaZonaFiltro = '';
    this.mostrarFiltroZonas = false;
    
    // Reiniciar paginador global para esta instancia
    this.paginationService.resetPaginator(this.instanceId);
    
    this.cargarItems();
    this.cargarZonas(bodega.codigo);
  }

  cargarItems(mantenerEstado = false) {
    this.cargandoItems = true;
    
    // Si no mantenemos estado, cancelamos suscripción previa
    if (!mantenerEstado && this.itemsSub) {
      this.itemsSub.unsubscribe();
      this.itemsSub = null;
    }

    const paginaActual = mantenerEstado ? this.paginationService.getCurrentPage(this.instanceId) : 1;

    this.subscription.add(
      this.inventarioService.getItemsPorBodega(this.bodegaSeleccionada.codigo).subscribe(resp => {
        if (resp.success) {
          this.itemsRaw = resp.data.map((i: any) => ({ 
            ...i, 
            seleccionado: this.selectedItems.some(si => si.id_f400 === i.id_f400) 
          }));
          
          if (!mantenerEstado || !this.itemsSub) {
            // Inicialización normal
            this.itemsSub = this.paginationService.initializePaginator(
              this.instanceId,
              this.itemsRaw,
              25,
              this.filters,
              this.filterFunction.bind(this)
            ).subscribe(state => {
              this.itemsPaginados = state.currentData;
            });
          } else {
            // Actualización preservando estado
            this.paginationService.updatePaginator(
              this.instanceId,
              this.itemsRaw,
              25,
              this.filters,
              this.filterFunction.bind(this)
            );
            // Restaurar página
            this.paginationService.goToPage(this.instanceId, paginaActual);
          }
        }
        this.cargandoItems = false;
      })
    );
  }

  filterFunction(item: any, filters: any): boolean {
    // 1. Filtro por Búsqueda de Texto
    let matchBusqueda = true;
    if (filters.busquedaItem) {
      const search = filters.busquedaItem.toLowerCase();
      const idStr = item.id_item?.toString().toLowerCase() || '';
      const refStr = item.referencia?.toLowerCase() || '';
      const descStr = item.descripcion?.toLowerCase() || '';

      if (filters.busquedaExacta) {
        matchBusqueda = idStr === search || refStr === search;
      } else {
        matchBusqueda = idStr.includes(search) ||
                        refStr.includes(search) ||
                        descStr.includes(search);
      }
    }

    // 2. Filtro por Zonas Seleccionadas
    let matchZonas = true;
    if (filters.zonasSeleccionadas && filters.zonasSeleccionadas.length > 0) {
      const hasNoZone = !item.zonas || item.zonas.length === 0;
      
      // Si "Sin Zona" (-1) está seleccionado
      if (filters.zonasSeleccionadas.includes(-1) && hasNoZone) {
        matchZonas = true;
      } else {
        matchZonas = item.zonas?.some((z: any) => filters.zonasSeleccionadas.includes(z.id)) || false;
      }
    }

    // 3. Filtro por Tipo de Ítem (Telas / Insumos)
    let matchTipo = true;
    if (filters.filtroTipoItem) {
      const esTela = item.referencia?.startsWith('1110');
      matchTipo = filters.filtroTipoItem === 'telas' ? esTela : !esTela;
    }

    return matchBusqueda && matchZonas && matchTipo;
  }

  get zonasFiltradasDropdown() {
    if (!this.busquedaZonaFiltro.trim()) return this.zonas;
    const search = this.busquedaZonaFiltro.toLowerCase();
    return this.zonas.filter(z => z.nombre.toLowerCase().includes(search));
  }

  toggleZonaFiltro(id: number) {
    const index = this.filters.zonasSeleccionadas.indexOf(id);
    if (index === -1) {
      this.filters.zonasSeleccionadas.push(id);
    } else {
      this.filters.zonasSeleccionadas.splice(index, 1);
    }
    this.applyFilters();
  }

  toggleTodasZonasFiltro() {
    if (this.filters.zonasSeleccionadas.length === this.zonas.length) {
      this.filters.zonasSeleccionadas = [];
    } else {
      this.filters.zonasSeleccionadas = this.zonas.map(z => z.id);
    }
    this.applyFilters();
  }

  limpiarFiltroZonas() {
    this.filters.zonasSeleccionadas = [];
    this.busquedaZonaFiltro = '';
    this.applyFilters();
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

  cargarZonas(codigoBodega: string) {
    this.inventarioService.getZonas(codigoBodega).subscribe(resp => {
      if (resp.success) {
        this.zonas = resp.data;
      }
    });
  }

  volverABodegas() {
    this.vistaActual = 'bodegas';
    this.itemsPaginados = [];
    this.selectedItems = [];
    this.filters.zonasSeleccionadas = [];
    this.busquedaZonaFiltro = '';
    this.mostrarFiltroZonas = false;
    
    // Limpiar suscripciones y paginador para liberar memoria y evitar estados sucios
    this.itemsSub?.unsubscribe();
    this.paginationService.destroyPaginator(this.instanceId);
    
    this.cargarBodegas();
  }

  get allSelected() {
    return this.itemsPaginados.length > 0 && this.itemsPaginados.every(i => i.seleccionado);
  }

  toggleItem(item: any) {
    const index = this.selectedItems.findIndex(i => i.id_f400 === item.id_f400);
    if (item.seleccionado && index === -1) {
      this.selectedItems.push(item);
    } else if (!item.seleccionado && index !== -1) {
      this.selectedItems.splice(index, 1);
    }
  }

  toggleAll() {
    const targetState = !this.allSelected;
    this.itemsPaginados.forEach(i => {
      i.seleccionado = targetState;
      this.toggleItem(i);
    });
  }

  abrirAsignacionMasiva() {
    if (this.selectedItems.length === 0) return;
    this.modoGestionMasiva = 'asignar';
    this.mostrarModalGestionMasiva = true;
  }

  abrirQuitarZonaMasiva() {
    if (this.selectedItems.length === 0) return;
    this.modoGestionMasiva = 'quitar';
    this.mostrarModalGestionMasiva = true;
  }

  procesarGestionMasiva(data: any) {
    this.guardandoAsignacion = true;
    
    if (data.mode === 'asignar') {
      const payload = {
        items: [] as any[]
      };

      this.selectedItems.forEach(item => {
        data.ids_zonas.forEach((idZona: number) => {
          payload.items.push({
            codigo_item: item.id_item,
            id_f400: item.id_f400,
            codigo_bodega: item.codigo_bodega,
            id_zona: idZona
          });
        });
      });

      this.inventarioService.asignarZonaItems(payload).subscribe({
        next: (resp) => {
          if (resp.success) {
            Swal.fire('Éxito', `${this.selectedItems.length} ítems actualizados`, 'success');
            this.mostrarModalGestionMasiva = false;
            this.selectedItems = [];
            this.cargarItems(true); // Mantener estado de filtros y página
          }
          this.guardandoAsignacion = false;
        },
        error: () => {
          Swal.fire('Error', 'No se pudo completar la asignación', 'error');
          this.guardandoAsignacion = false;
        }
      });
    } else {
      const payload = {
        items: [] as any[]
      };

      this.selectedItems.forEach(item => {
        data.ids_zonas.forEach((idZona: number) => {
          // Solo enviar para quitar si el item realmente tiene esa zona
          if (item.zonas?.some((z: any) => z.id === idZona)) {
            payload.items.push({
              codigo_item: item.id_item,
              codigo_bodega: item.codigo_bodega,
              id_f400: item.id_f400,
              id_zona: idZona
            });
          }
        });
      });

      if (payload.items.length === 0) {
        this.guardandoAsignacion = false;
        this.mostrarModalGestionMasiva = false;
        return;
      }

      this.inventarioService.eliminarZonasMasivo(payload).subscribe({
        next: (resp) => {
          if (resp.success) {
            Swal.fire('Éxito', `Zonas removidas de los ítems seleccionados`, 'success');
            this.mostrarModalGestionMasiva = false;
            this.selectedItems = [];
            this.cargarItems(true); // Mantener estado de filtros y página
          }
          this.guardandoAsignacion = false;
        },
        error: () => {
          Swal.fire('Error', 'No se pudo completar la eliminación', 'error');
          this.guardandoAsignacion = false;
        }
      });
    }
  }

  procesarAsignacionMasiva(data: any) {
    this.guardandoAsignacion = true;
    const payload = {
      items: this.selectedItems.map(i => ({
        codigo_item: i.id_item,
        id_f400: i.id_f400,
        codigo_bodega: i.codigo_bodega,
        id_zona: data.id_zona
      }))
    };

    this.inventarioService.asignarZonaItems(payload).subscribe({
      next: (resp) => {
        if (resp.success) {
          Swal.fire('Éxito', `${this.selectedItems.length} ítems asignados`, 'success');
          this.mostrarModalAsignacion = false;
          this.selectedItems = [];
          this.cargarItems(true); // Mantener estado de filtros y página
        }
        this.guardandoAsignacion = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo completar la asignación', 'error');
        this.guardandoAsignacion = false;
      }
    });
  }

  quitarZonaMasivo() {
    this.abrirQuitarZonaMasiva();
  }

  get bodegasFiltradas() {
    return this.bodegas.filter(b => 
      b.codigo.toLowerCase().includes(this.filters.busquedaBodega.toLowerCase()) ||
      b.nombre_bodega.toLowerCase().includes(this.filters.busquedaBodega.toLowerCase())
    );
  }
}
