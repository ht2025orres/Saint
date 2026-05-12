import { Component, OnInit, OnDestroy, HostListener, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventarioService, ItemBodega } from 'src/app/services/inventario.service';
import { AuthService } from 'src/app/services/auth.service';
import { PaginationService } from 'src/app/shared/pagination/pagination.service';
import { Subscription, Subject } from 'rxjs'; // Import Subject
import { debounceTime } from 'rxjs/operators'; // Import debounceTime
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

interface FilterState {
  busqueda: string;
  busquedaExacta: boolean;
  filtroTipoItem: string;
  tipoMovimiento: string[];
  filtroConteoReciente: string; // '' | 'contados' | 'pendientes'
  ocultarExistenciaCero: boolean;
}

@Component({
  selector: 'app-inventario-ciclico-realizar-conteo',
  templateUrl: './inventario-ciclico-realizar-conteo.component.html',
  styleUrls: ['./inventario-ciclico-realizar-conteo.component.css']
})
export class InventarioCiclicoRealizarConteoComponent implements OnInit, OnDestroy {
  bodega: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';
  itemsRaw: ItemBodega[] = [];
  itemsPaginados: ItemBodega[] = [];
  loading = false;
  public error: boolean = false;

  showModalConteo = false;
  itemSeleccionado: any = null;

  filters: FilterState = {
    busqueda: '',
    busquedaExacta: false,
    filtroTipoItem: '',
    tipoMovimiento: ['entradas', 'salidas'],
    filtroConteoReciente: '',
    ocultarExistenciaCero: false,
  };

  // Mapa de items contados recientemente: id_f400 -> fecha último conteo
  itemsContadosMap: Map<number, string> = new Map();

  instanceId = 'ciclico-items';
  private itemsSub: Subscription | null = null;
  private filterSubject = new Subject<void>(); // Declare filterSubject
  private filterSubscription: Subscription | null = null; // Declare filterSubscription

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventarioService: InventarioService,
    private authService: AuthService,
    private paginationService: PaginationService
  ) { }

  ngOnInit(): void {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    this.fechaInicio = firstDay.toISOString().split('T')[0];
    this.fechaFin = now.toISOString().split('T')[0];

    this.bodega = this.route.snapshot.paramMap.get('bodega') || '';

    if (this.bodega !== 'MP001') {
      this.filters.filtroTipoItem = ''; // Reset filter if not MP001
    }

    if (this.bodega) {
      this.cargarItemsParaConteo();
      this.cargarItemsContadosRecientes();
    }

    // Subscribe to filter changes with debounceTime
    this.filterSubscription = this.filterSubject.pipe(
        debounceTime(300) // Wait for 300ms after the last event
    ).subscribe(() => {
        this.cargarItemsParaConteo();
    });
  }

  ngOnDestroy(): void {
    this.itemsSub?.unsubscribe();
    this.filterSubscription?.unsubscribe(); // Unsubscribe from filterSubject
    this.paginationService.destroyPaginator(this.instanceId);
  }

  onFilterChange(shouldFetchApi: boolean = true): void {
    if (shouldFetchApi) {
      this.filterSubject.next();
    } else {
      this.aplicarFiltrosParaConteo();
    }
  }

  cargarItemsParaConteo() {
    this.loading = true;
    this.error = false;

    if (this.itemsSub) {
      this.itemsSub.unsubscribe();
      this.itemsSub = undefined;
    }

    let tipoMovimientoParam: string = ''; // API will always return all, client-side filters.

    // The API call for getMovimientosCiclico does not support filtering by tipoMovimientoParam directly for 'entradas'/'salidas' based on user request.
    // All filtering for 'entradas' and 'salidas' will happen client-side in aplicarFiltrosParaConteo.
    // The 'todos' option effectively means no filter applied at all.


    const referenciaParam: string = this.filters.busqueda;

    this.inventarioService.getMovimientosCiclico(
      this.bodega,
      this.fechaInicio,
      this.fechaFin,
      tipoMovimientoParam,
      referenciaParam
    ).subscribe({
      next: (items: ItemBodega[]) => {
        this.itemsRaw = items.map(item => ({
          ...item,
          fecha_ultimo_movimiento_formatted: this.formatFecha(item.fecha_ultimo_movimiento),
          contadoReciente: this.itemsContadosMap.has(Number(item.id_f400)),
          ultimoConteo: this.itemsContadosMap.get(Number(item.id_f400)) || null
        }));
        this.aplicarFiltrosParaConteo();
        this.loading = false;
      },
      error: (err) => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  aplicarFiltrosParaConteo() {
    if (!this.itemsRaw) {
      this.itemsPaginados = [];
      return;
    }

    const filterFunction = (item: any): boolean => {
      let matchBusqueda = true;
      if (this.filters.busqueda) {
        const search = (this.filters.busqueda || '').toString().toLowerCase().trim();
        const idStr = (item.id_item || '').toString().toLowerCase().trim();
        const refStr = (item.referencia || '').toString().toLowerCase().trim();
        const descStr = (item.descripcion || '').toString().toLowerCase().trim();
        const idF400Str = (item.id_f400 || '').toString().toLowerCase().trim();

        if (this.filters.busquedaExacta) {
          matchBusqueda = idStr === search || 
                          refStr === search || 
                          idF400Str === search;
        } else {
          matchBusqueda = idStr.includes(search) ||
                          refStr.includes(search) ||
                          descStr.includes(search) ||
                          idF400Str.includes(search);
        }
      }

      const matchTipo = !this.filters.filtroTipoItem ||
        (this.filters.filtroTipoItem === 'telas' && item.referencia.startsWith('1110')) ||
        (this.filters.filtroTipoItem === 'insumos' && !item.referencia.startsWith('1110'));

      let matchMovimiento = false;
      const selectedMovementTypes = this.filters.tipoMovimiento;

      if (selectedMovementTypes.includes('todos')) {
        matchMovimiento = true;
      } else {
        const ultimoMovimiento = Number(item.ultimo_movimiento_naturaleza);
        if (selectedMovementTypes.includes('entradas') && ultimoMovimiento === 1) {
          matchMovimiento = true;
        }
        if (selectedMovementTypes.includes('salidas') && ultimoMovimiento === 2) {
          matchMovimiento = true;
        }
      }

      // 4. Filtro conteo reciente
      let matchConteo = true;
      if (this.filters.filtroConteoReciente === 'contados') {
        matchConteo = !!item.contadoReciente;
      } else if (this.filters.filtroConteoReciente === 'pendientes') {
        matchConteo = !item.contadoReciente;
      }

      // 5. Filtro existencia cero
      let matchStock = true;
      if (this.filters.ocultarExistenciaCero) {
        matchStock = Number(item.cantidad) !== 0;
      }

      return matchBusqueda && matchTipo && matchMovimiento && matchConteo && matchStock;
    };

    this.currentFilterFunction = filterFunction;

    if (!this.itemsSub) {
      this.itemsSub = this.paginationService.initializePaginator(
        this.instanceId,
        this.itemsRaw,
        25,
        this.filters,
        filterFunction
      ).subscribe(state => {
        this.itemsPaginados = state.currentData;
      });
    } else {
      this.paginationService.updatePaginator(
        this.instanceId,
        this.itemsRaw,
        25,
        this.filters,
        filterFunction
      );
    }
  }

  // To keep track of the current filter function for excel export
  private currentFilterFunction: ((item: any) => boolean) | null = null;

  descargarExcel() {
    if (!this.itemsRaw || this.itemsRaw.length === 0) {
      Swal.fire('Atención', 'No hay ítems cargados en esta bodega.', 'warning');
      return;
    }

    const itemsAExportar = this.currentFilterFunction 
      ? this.itemsRaw.filter(this.currentFilterFunction)
      : this.itemsRaw;

    if (itemsAExportar.length === 0) {
      Swal.fire('Atención', 'No hay ítems para descargar con los filtros actuales.', 'warning');
      return;
    }

    const dataToExport = itemsAExportar.map(item => ({
      'ID Ítem': item.id_item,
      'Referencia': item.referencia,
      'Descripción': item.descripcion,
      'ID Color': item.id_color || 'N/A',
      'Color': item.color || 'N/A',
      'Talla': item.id_talla || 'N/A',
      'Stock SIESA': (item.cantidad || 0).toString().replace('.', ','),
      'Unidad de Medida': item.unidad_medida,
      'Zonas': this.getItemZonas(item).join(', ') || 'Sin Zona',
      'Último Movimiento': item.fecha_ultimo_movimiento_formatted || 'N/A',
      'Estado Conteo': item.contadoReciente ? `Contado (${item.ultimoConteo})` : 'Pendiente'
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    
    // Auto-size columns slightly
    const colWidths = [
      { wch: 15 }, // ID
      { wch: 15 }, // Ref
      { wch: 40 }, // Desc
      { wch: 12 }, // ID Color
      { wch: 15 }, // Color
      { wch: 10 }, // Talla
      { wch: 12 }, // Stock
      { wch: 10 }, // UoM
      { wch: 20 }, // Zonas
      { wch: 20 }, // Ultimo Mov
      { wch: 20 }  // Estado
    ];
    ws['!cols'] = colWidths;

    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista para Conteo');
    
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Lista_Conteo_${this.bodega}_${fecha}.xlsx`);
  }

  // Methods for filter interaction
  showFiltroMovimientos = false;

  toggleFiltroMovimientos(event: Event) {
    event.stopPropagation();
    this.showFiltroMovimientos = !this.showFiltroMovimientos;
  }

  toggleMovimiento(tipo: string) {
    const index = this.filters.tipoMovimiento.indexOf(tipo);
    const todosIndex = this.filters.tipoMovimiento.indexOf('todos');

    if (tipo === 'todos') {
      if (todosIndex > -1) {
        // If 'todos' was selected, and now deselected, default to 'entradas' and 'salidas'
        this.filters.tipoMovimiento = ['entradas', 'salidas'];
      } else {
        // If 'todos' is selected, it overrides others
        this.filters.tipoMovimiento = ['todos'];
      }
      // When 'todos' is involved, it might imply a re-fetch if the API supported it differently, but for now
      // we just re-apply filters as API always returns all movements.
      this.cargarItemsParaConteo(); // This should trigger API call if 'todos' is truly special, otherwise client-side.
    } else {
      if (todosIndex > -1) {
        // If other types are selected while 'todos' was active, deselect 'todos' and select the new type.
        this.filters.tipoMovimiento = [tipo];
      } else {
        if (index > -1) {
          this.filters.tipoMovimiento.splice(index, 1);
        } else {
          this.filters.tipoMovimiento.push(tipo);
        }
      }
      if (this.filters.tipoMovimiento.length === 0) {
        // If no movement types are selected, default to 'entradas' and 'salidas' for client-side filtering
        this.filters.tipoMovimiento.push('entradas', 'salidas');
      }
      this.aplicarFiltrosParaConteo(); // Only apply client-side filters for 'entradas'/'salidas' changes
    }
  }

  isMovimientoSelected(tipo: string): boolean {
    return this.filters.tipoMovimiento.includes(tipo);
  }

  getFiltroMovimientoText(): string {
    const selected = this.filters.tipoMovimiento;
    if (selected.includes('todos')) {
      return 'Todos';
    } else if (selected.includes('entradas') && selected.includes('salidas')) {
      return 'Entradas y Salidas';
    } else if (selected.includes('entradas')) {
      return 'Solo Entradas';
    } else if (selected.includes('salidas')) {
      return 'Solo Salidas';
    } else {
      return 'Filtrar Movimiento';
    }
  }

  get isTodosSelected(): boolean {
    return this.filters.tipoMovimiento.includes('todos');
  }

  get isTipoItemFilterDisabled(): boolean {
    return this.bodega !== 'MP001';
  }

  @HostListener('document:click', ['$event'])
  onClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-movimientos-container') && this.showFiltroMovimientos) {
      this.showFiltroMovimientos = false;
    }
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

  getItemZonas(item: ItemBodega): string[] {
    return item.zonas ? item.zonas.map(zona => zona.nombre) : [];
  }

  volverAGestionBodegas(): void {
    this.router.navigate(['/inventario/gestion-bodegas']);
  }

  irAVerRegistros(): void {
    this.router.navigate(['/inventario/inventario-ciclico/ver'], { queryParams: { bodega: this.bodega } });
  }

  cargarItemsContadosRecientes(): void {
    this.inventarioService.getItemsContadosRecientes(this.bodega).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.itemsContadosMap = new Map();
          resp.data.forEach((item: any) => {
            this.itemsContadosMap.set(Number(item.id_f400), item.ultimo_conteo);
          });
          // Re-marcar items existentes
          if (this.itemsRaw.length > 0) {
            this.itemsRaw = this.itemsRaw.map(item => ({
              ...item,
              contadoReciente: this.itemsContadosMap.has(Number(item.id_f400)),
              ultimoConteo: this.itemsContadosMap.get(Number(item.id_f400)) || null
            }));
            this.aplicarFiltrosParaConteo();
          }
        }
      }
    });
  }
}
