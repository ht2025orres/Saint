import { Component, OnInit, OnDestroy, Inject, ChangeDetectorRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PlaneacionService, OP, OPSeleccionada, PVSeleccionada, ItemSiesa } from 'src/app/services/planeacion.service';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import Swal from 'sweetalert2';

interface ItemSiesaExtendido extends ItemSiesa {
  seleccionado: boolean;
}

interface PVExpandida {
  numero: number;
  seleccionada: boolean;
  items: ItemSiesaExtendido[];
  id: string;
}

interface OPExpandida extends OP {
  expandida: boolean;
  seleccionada: boolean;
  pvs: PVExpandida[];
  cargandoPVs: boolean;
  pvFilters: { busqueda: string };
}

interface ModalItems {
  mostrar: boolean;
  pv: PVExpandida | null;
  cargando: boolean;
}

@Component({
  selector: 'app-planeacion',
  templateUrl: './planeacion.component.html',
  styleUrls: ['./planeacion.component.css']
})
export class PlaneacionComponent implements OnInit, OnDestroy {
  paginatorId = 'planeacion-ops-paginator';
  itemsPaginatorId = 'planeacion-items-paginator';

  ops: OPExpandida[] = [];
  currentOPs: OPExpandida[] = [];
  currentItems: ItemSiesaExtendido[] = [];

  filters = { busqueda: '' };
  itemFilters = { busqueda: '' };

  cargando = false;
  observaciones = '';

  modalItems: ModalItems = {
    mostrar: false,
    pv: null,
    cargando: false
  };

  constructor(
    private planeacionService: PlaneacionService,
    public paginationService: PaginationService,
    private cdr: ChangeDetectorRef,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.cargarOPs();
  }

  ngOnDestroy(): void {
    const links = this.document.head.querySelectorAll('link[href*="tailwindcss"], link[href*="bootstrap-icons"]');
    links.forEach(link => link.remove());
  }

  private loadTailwind(): void {
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
    this.document.head.appendChild(link);

    const icons = this.document.createElement('link');
    icons.rel = 'stylesheet';
    icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
    this.document.head.appendChild(icons);
  }

  cargarOPs(): void {
    this.cargando = true;
    this.planeacionService.obtenerOPs().subscribe({
      next: (res) => {
        this.ops = res.data.map(op => ({
          ...op,
          expandida: false,
          seleccionada: false,
          pvs: [],
          cargandoPVs: false,
          pvFilters: { busqueda: '' }
        }));

        this.paginationService.initializePaginator(
          this.paginatorId,
          this.ops,
          10,
          this.filters,
          this.filterOPs
        ).subscribe(state => {
          this.currentOPs = state.currentData;
          this.cdr.detectChanges();
        });

        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        Swal.fire('Error', 'No se pudieron cargar las OPs', 'error');
      }
    });
  }

  toggleOP(op: OPExpandida): void {
    op.expandida = !op.expandida;
    if (op.expandida && op.pvs.length === 0) {
      this.cargarPVsDeOP(op);
    }
  }

  cargarPVsDeOP(op: OPExpandida, callback?: () => void): void {
    op.cargandoPVs = true;
    this.planeacionService.obtenerPVsDeOP(op.id).subscribe({
      next: (res) => {
        const pvs = res.data[op.id]?.pvs || [];
        op.pvs = pvs.map((pv: number) => ({
          numero: pv,
          seleccionada: false,
          items: [],
          id: `${op.id}-${pv}`
        }));
        op.cargandoPVs = false;
        this.inicializarPaginacionPVs(op);
        this.cdr.detectChanges();
        
        if (callback) {
          callback();
        }
      },
      error: () => {
        op.cargandoPVs = false;
        Swal.fire('Error', 'No se pudieron cargar las PVs', 'error');
      }
    });
  }

  inicializarPaginacionPVs(op: OPExpandida): void {
    const pvsPaginatorId = `pvs-${op.id}`;
    this.paginationService.initializePaginator(
      pvsPaginatorId,
      op.pvs,
      5,
      op.pvFilters,
      this.filterPVs
    ).subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  toggleSeleccionOP(op: OPExpandida): void {
    // Si la OP no tiene PVs cargadas, cargarlas primero
    if (op.pvs.length === 0 && !op.cargandoPVs) {
      this.cargarPVsDeOP(op, () => {
        this.aplicarSeleccionOP(op);
      });
    } else if (!op.cargandoPVs) {
      this.aplicarSeleccionOP(op);
    }
  }

  private aplicarSeleccionOP(op: OPExpandida): void {
    op.seleccionada = !op.seleccionada;
    
    // Seleccionar/deseleccionar todas las PVs y sus items
    op.pvs.forEach(pv => {
      pv.seleccionada = op.seleccionada;
      pv.items.forEach(item => item.seleccionado = op.seleccionada);
    });
    
    this.cdr.detectChanges();
  }

  toggleSeleccionPV(pv: PVExpandida): void {
    pv.seleccionada = !pv.seleccionada;
    
    // Actualizar items de esta PV
    pv.items.forEach(item => item.seleccionado = pv.seleccionada);
    
    // Actualizar estado de la OP padre
    const opPadre = this.ops.find(o => o.pvs.some(p => p.id === pv.id));
    if (opPadre) {
      this.actualizarEstadoOP(opPadre);
    }
    
    this.cdr.detectChanges();
  }

  private actualizarEstadoOP(op: OPExpandida): void {
    if (op.pvs.length === 0) {
      op.seleccionada = false;
      return;
    }
    
    const algunaPVSeleccionada = op.pvs.some(p => p.seleccionada);
    const todasSeleccionadas = op.pvs.every(p => p.seleccionada);
    
    // La OP está seleccionada si al menos una PV está seleccionada
    op.seleccionada = algunaPVSeleccionada;
  }

  abrirModalItems(pv: PVExpandida): void {
    this.modalItems = {
      mostrar: true,
      pv: pv,
      cargando: pv.items.length === 0 // Solo cargar si no hay items
    };

    // Si ya tiene items cargados, solo mostrar el modal
    if (pv.items.length > 0) {
      this.paginationService.initializePaginator(
        this.itemsPaginatorId,
        pv.items,
        10,
        this.itemFilters,
        this.filterItems
      ).subscribe(state => {
        this.currentItems = state.currentData;
        this.cdr.detectChanges();
      });
      return;
    }

    // Cargar items solo si no están cargados
    this.planeacionService.obtenerItemsDePV(pv.numero).subscribe({
      next: (res) => {
        const itemsData = res.items || [];
        
        pv.items = itemsData.map((item: any) => ({
          pv: Number(item.pv),
          codigo_item: item.codigo_item,
          referencia: item.referencia,
          descripcion: item.descripcion,
          cliente: item.cliente || '',
          cantidad: Number(item.cantidad),
          seleccionado: pv.seleccionada // Heredar estado de la PV
        }));
        
        this.paginationService.initializePaginator(
          this.itemsPaginatorId,
          pv.items,
          10,
          this.itemFilters,
          this.filterItems
        ).subscribe(state => {
          this.currentItems = state.currentData;
          this.cdr.detectChanges();
        });

        this.modalItems.cargando = false;
      },
      error: (error) => {
        console.error('Error cargando items:', error);
        this.modalItems.cargando = false;
        Swal.fire('Error', 'No se pudieron cargar los ítems', 'error');
      }
    });
  }

  cerrarModalItems(): void {
    // Actualizar el estado de la PV basado en los items
    if (this.modalItems.pv) {
      this.actualizarEstadoPVPorItems(this.modalItems.pv);
    }
    
    this.modalItems.mostrar = false;
    this.modalItems.pv = null;
    this.currentItems = [];
  }

  private actualizarEstadoPVPorItems(pv: PVExpandida): void {
    if (pv.items.length === 0) return;
    
    const algunItemSeleccionado = pv.items.some(i => i.seleccionado);
    
    // La PV está seleccionada si al menos un item está seleccionado
    pv.seleccionada = algunItemSeleccionado;
    
    // Actualizar estado de la OP padre
    const opPadre = this.ops.find(op => op.pvs.some(p => p.id === pv.id));
    if (opPadre) {
      this.actualizarEstadoOP(opPadre);
    }
  }

  toggleSeleccionItem(item: ItemSiesaExtendido): void {
    item.seleccionado = !item.seleccionado;
    
    if (this.modalItems.pv) {
      const algunItemSeleccionado = this.modalItems.pv.items.some(i => i.seleccionado);
      
      // Actualizar estado de la PV: seleccionada si al menos un item está seleccionado
      this.modalItems.pv.seleccionada = algunItemSeleccionado;
      
      // Actualizar estado de la OP
      const opPadre = this.ops.find(op => op.pvs.some(p => p.id === this.modalItems.pv!.id));
      if (opPadre) {
        this.actualizarEstadoOP(opPadre);
      }
    }
    
    this.cdr.detectChanges();
  }

  toggleTodosItems(): void {
    if (!this.modalItems.pv) return;
    
    const nuevoEstado = !this.modalItems.pv.seleccionada;
    this.modalItems.pv.seleccionada = nuevoEstado;
    this.modalItems.pv.items.forEach(item => item.seleccionado = nuevoEstado);
    
    const opPadre = this.ops.find(op => op.pvs.some(p => p.id === this.modalItems.pv!.id));
    if (opPadre) {
      this.actualizarEstadoOP(opPadre);
    }
    
    this.cdr.detectChanges();
  }

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.ops,
      undefined,
      this.filters,
      this.filterOPs
    );
  }

  applyItemFilters(): void {
    if (!this.modalItems.pv) return;

    this.paginationService.updatePaginator(
      this.itemsPaginatorId,
      this.modalItems.pv.items,
      undefined,
      this.itemFilters,
      this.filterItems
    );
  }

  applyPVFilters(op: OPExpandida): void {
    const pvsPaginatorId = `pvs-${op.id}`;
    this.paginationService.updatePaginator(
      pvsPaginatorId,
      op.pvs,
      undefined,
      op.pvFilters,
      this.filterPVs
    );
  }

  filterOPs: FilterFunction = (item, filtros) => {
    const texto = (filtros.busqueda || '').toLowerCase();
    if (!texto) return true;
    return item.codigo?.toString().toLowerCase().includes(texto);
  };

  filterPVs: FilterFunction = (item, filtros) => {
    const texto = (filtros.busqueda || '').toLowerCase();
    if (!texto) return true;
    return item.numero?.toString().toLowerCase().includes(texto);
  };

  filterItems: FilterFunction = (item, filtros) => {
    const texto = (filtros.busqueda || '').toLowerCase();
    if (!texto) return true;
    
    return (
      item.codigo_item?.toString().toLowerCase().includes(texto) ||
      item.referencia?.toString().toLowerCase().includes(texto) ||
      item.descripcion?.toString().toLowerCase().includes(texto)
    );
  };

  get totalOPsSeleccionadas(): number {
    return this.ops.filter(op => op.seleccionada).length;
  }

  get totalPVsSeleccionadas(): number {
    return this.ops.reduce((sum, op) => sum + op.pvs.filter(pv => pv.seleccionada).length, 0);
  }

  getPVsFiltradas(op: OPExpandida): PVExpandida[] {
    const pvsPaginatorId = `pvs-${op.id}`;
    const state = this.paginationService.getPaginatorState(pvsPaginatorId);
    return state ? state.currentData : op.pvs;
  }

  guardarPlaneacion(): void {
    const opsSeleccionadas: OPSeleccionada[] = this.ops
      .filter(op => op.seleccionada || op.pvs.some(pv => pv.seleccionada || pv.items.some(i => i.seleccionado)))
      .map(op => {
        const todasPVsSeleccionadas = op.pvs.length > 0 && op.pvs.every(pv => pv.seleccionada);

        if (todasPVsSeleccionadas) {
          return {
            numero: op.id,
            completa: true
          };
        }

        const pvsSeleccionadas: PVSeleccionada[] = op.pvs
          .filter(pv => pv.seleccionada || pv.items.some(i => i.seleccionado))
          .map(pv => {
            const todosItemsSeleccionados = pv.items.length > 0 && pv.items.every(i => i.seleccionado);

            if (todosItemsSeleccionados) {
              return {
                numero: pv.numero,
                completa: true
              };
            }

            const itemsSeleccionados = pv.items
              .filter(i => i.seleccionado)
              .map(i => i.codigo_item);

            return {
              numero: pv.numero,
              completa: false,
              items: itemsSeleccionados
            };
          });

        return {
          numero: op.id,
          completa: false,
          pvs: pvsSeleccionadas
        };
      });

    if (opsSeleccionadas.length === 0) {
      Swal.fire('Atención', 'Debe seleccionar al menos una OP', 'warning');
      return;
    }

    const planeacion = {
      ops: opsSeleccionadas,
      observaciones: this.observaciones
    };

    this.planeacionService.crearPlaneacion(planeacion).subscribe({
      next: (res) => {
        Swal.fire('Éxito', `Planeación ${res.data.codigo} creada exitosamente`, 'success');
        this.limpiarSelecciones();
      },
      error: () => Swal.fire('Error', 'No se pudo guardar la planeación', 'error')
    });
  }

  limpiarSelecciones(): void {
    this.ops.forEach(op => {
      op.seleccionada = false;
      op.pvs.forEach(pv => {
        pv.seleccionada = false;
        pv.items.forEach(item => item.seleccionado = false);
      });
    });
    this.observaciones = '';
    this.cdr.detectChanges();
  }
}