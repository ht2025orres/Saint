import { Component, OnInit, ViewChild } from '@angular/core';
import { TerminacionEmpaqueService } from 'src/app/services/terminacion-empaque.service';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from './../../../services/auth.service';
import { ModalItemsComponent } from './modals/modal-items/modal-items.component';
import { ModalVerificacionComponent } from './modals/modal-verificacion/modal-verificacion.component';
import { ModalUbicacionesComponent } from './modals/modal-ubicaciones/modal-ubicaciones.component';

interface PvUI {
  numero_pv: string;
  progreso_pv: number | null;
  tieneAsignaciones: boolean | null;
  tieneItemsPendientesDistribuir: boolean | null;
  cliente: any | null;
  indicadoresCargados: boolean;
}

interface OpUI {
  codigo: number;
  pvs: PvUI[];
  pvsOriginal: PvUI[];
  tieneDisponibles: boolean | null;
  clientes: any[];
  expandir: boolean;
  cargando: boolean;
  detalleCargado: boolean;
  cargandoIndicadores: boolean;
  indicadoresCargados: boolean;
  recepcion_reciente: boolean;
  pvsPaged: PvUI[];
}

@Component({
  selector: 'app-distribucion-pv',
  templateUrl: './distribucion-pv.component.html',
  styleUrls: ['./distribucion-pv.component.css']
})
export class DistribucionPvComponent implements OnInit {
  @ViewChild('modalItems') modalItems!: ModalItemsComponent;
  @ViewChild('modalVerificacion') modalVerificacion!: ModalVerificacionComponent;
  @ViewChild('modalUbicaciones') modalUbicaciones!: ModalUbicacionesComponent;

  paginatorId = 'distribucion-pv-paginator';

  opSeleccionada: number | null = null;

  opsConPvs: OpUI[] = [];
  currentOps: any[] = [];

  filters = {
    busqueda: ''
  };

  pvFilters: { [opCodigo: number]: { busqueda: string } } = {};

  Math = Math;

  cargandoInicial = false;

  constructor(
    private terminacionEmpaqueService: TerminacionEmpaqueService,
    public paginationService: PaginationService,
    public AuthService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargandoInicial = true;

    this.terminacionEmpaqueService.obtenerOPsPendientes().subscribe({
      next: (ops) => {
        this.cargarListaOPs(ops);
        this.cargandoInicial = false;
      },
      error: () => {
        this.cargandoInicial = false;
        Swal.fire('Error', 'No se pudieron cargar las OPs', 'error');
      }
    });
  }

  ngAfterViewInit(): void {
    // Conectar callbacks de los modales al padre
    if (this.modalItems) {
      this.modalItems.onAsignacionGuardada = () => this.refrescarIndicadoresOP();
    }
    if (this.modalVerificacion) {
      this.modalVerificacion.onVerificacionGuardada = () => this.refrescarIndicadoresOP();
    }
  }

  private async refrescarIndicadoresOP(): Promise<void> {
    const op = this.opsConPvs.find(o => o.codigo === this.opSeleccionada);
    if (op) {
      op.indicadoresCargados = false;
      this.cargarIndicadoresAsync(op);
    }
  }

  tieneRolEmpacadores(): boolean {
    if (this.AuthService.hasPermission(33)) {
      return false;
    }
    return this.AuthService.hasPermission(21);
  }

  // ===== CARGA LIGERA DE OPs =====

  cargarListaOPs(ops: any[]): void {
    const opsOrdenadas = [...(ops || [])]
      .sort((a, b) => {
        const recA = typeof a === 'object' ? !!a.recepcion_reciente : true;
        const recB = typeof b === 'object' ? !!b.recepcion_reciente : true;

        if (recA !== recB) {
          return recA ? -1 : 1;
        }

        const codeA = typeof a === 'object' ? a.codigo : Number(a);
        const codeB = typeof b === 'object' ? b.codigo : Number(b);
        return codeA - codeB;
      });

    this.opsConPvs = opsOrdenadas.map((opData): OpUI => {
      const opCodigo = typeof opData === 'object' ? Number(opData.codigo) : Number(opData);
      const recReciente = typeof opData === 'object' ? !!opData.recepcion_reciente : true;

      if (!this.pvFilters[opCodigo]) {
        this.pvFilters[opCodigo] = { busqueda: '' };
      }
      return {
        codigo: opCodigo,
        recepcion_reciente: recReciente,
        pvs: [],
        pvsOriginal: [],
        tieneDisponibles: null,
        clientes: [],
        expandir: false,
        cargando: false,
        detalleCargado: false,
        cargandoIndicadores: false,
        indicadoresCargados: false,
        pvsPaged: []
      };
    }).filter(op => !Number.isNaN(op.codigo));

    this.inicializarPaginacion();

    // Auto-disparar OPs con recepciones recientes, SIN expandirlas en la UI
    this.opsConPvs.forEach(op => {
      if (op.recepcion_reciente) {
        if (!op.detalleCargado) {
          this.cargarPVsDeOP(op);
        }
      }
    });
  }

  getOpProgress(op: OpUI): number {
    if (!op.pvsOriginal || op.pvsOriginal.length === 0) return 0;
    const total = op.pvsOriginal.reduce((acc, pv) => acc + (pv.progreso_pv || 0), 0);
    return total / op.pvsOriginal.length;
  }

  isOpCompleta(op: OpUI): boolean {
    if (!op.indicadoresCargados) return false;
    return this.getOpProgress(op) >= 100;
  }

  // ===== EXPANDIR OP =====

  async toggleExpandirOP(op: OpUI): Promise<void> {
    if (op.expandir) {
      op.expandir = false;
      return;
    }

    op.expandir = true;

    if (!op.detalleCargado) {
      await this.cargarPVsDeOP(op);
    }
  }

  private async cargarPVsDeOP(opUI: OpUI): Promise<void> {
    opUI.cargando = true;

    try {
      const pvsResp: { pvs: any[], clientes: any[] } = await lastValueFrom(
        this.terminacionEmpaqueService.listarPVsPorOPDesdeApiLaravel(opUI.codigo)
      );

      opUI.pvs = pvsResp.pvs.map(pv => ({
        numero_pv: pv.numero_pv,
        progreso_pv: null,
        tieneAsignaciones: null,
        tieneItemsPendientesDistribuir: null,
        cliente: pv.cliente || null,
        indicadoresCargados: false
      }));
      opUI.pvsOriginal = [...opUI.pvs];
      opUI.clientes = pvsResp.clientes;
      opUI.detalleCargado = true;

      this.initPaginadorPV(opUI);
      opUI.cargando = false;
      this.refrescarPaginacionSinReinicio();

      if (opUI.recepcion_reciente) {
        this.cargarIndicadoresAsync(opUI);
      } else {
        opUI.indicadoresCargados = false;
      }

    } catch (error) {
      console.error(`Error cargando PVs de OP ${opUI.codigo}:`, error);
      Swal.fire('Error', `No se pudieron cargar las PVs de la OP ${opUI.codigo}`, 'error');
      opUI.cargando = false;
    }
  }

  cargarIndicadoresAsync(opUI: OpUI): void {
    if (opUI.indicadoresCargados || opUI.cargandoIndicadores) return;

    const pvCodigos = opUI.pvsOriginal.map(p => p.numero_pv);
    if (pvCodigos.length === 0) return;

    opUI.cargandoIndicadores = true;

    this.terminacionEmpaqueService.obtenerIndicadoresPVs(opUI.codigo, pvCodigos).subscribe({
      next: (res) => {
        if (res.success) {
          const indicadores = res.indicadores || {};
          opUI.pvsOriginal.forEach(pv => {
            const ind = indicadores[pv.numero_pv];
            if (ind) {
              pv.progreso_pv = ind.progreso_pv ?? 0;
              pv.tieneAsignaciones = ind.tieneAsignaciones ?? false;
              pv.tieneItemsPendientesDistribuir = ind.tiene_items_pendientes_distribuir ?? false;
            } else {
              pv.progreso_pv = 0;
              pv.tieneAsignaciones = false;
              pv.tieneItemsPendientesDistribuir = false;
            }
            pv.indicadoresCargados = true;
          });

          opUI.tieneDisponibles = res.op_tiene_disponibles ?? false;

          this.ordenarPVs(opUI);
          this.filtrarPVs(opUI);
        }

        opUI.cargandoIndicadores = false;
        opUI.indicadoresCargados = true;
        this.refrescarPaginacionSinReinicio();
      },
      error: (err) => {
        console.error(`Error cargando indicadores de OP ${opUI.codigo}:`, err);
        opUI.cargandoIndicadores = false;
      }
    });
  }

  // ===== DELEGACIÓN A MODALES =====

  verItemsDePV(opCodigo: number, pvNumero: string): void {
    this.opSeleccionada = opCodigo;
    this.modalItems.abrir(opCodigo, pvNumero);
  }

  abrirVerificacion(opCodigo: number, pvNumero: string): void {
    this.opSeleccionada = opCodigo;
    this.modalVerificacion.abrir(opCodigo, pvNumero);
  }

  abrirModalUbicacionesDistintas(): void {
    this.modalUbicaciones.abrir();
  }

  // ===== PAGINACIÓN =====

  inicializarPaginacion(): void {
    if (this.opsConPvs.length > 0) {
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.opsConPvs,
        10,
        this.filters,
        this.filterFunction
      ).subscribe(state => {
        this.currentOps = state.currentData;
      });
    }
  }

  initPaginadorPV(op: OpUI, pageSize = 5): void {
    const instanceId = 'pv_' + op.codigo;
    if (!this.pvFilters[op.codigo]) {
      this.pvFilters[op.codigo] = { busqueda: '' };
    }

    this.paginationService
      .initializePaginator(
        instanceId,
        op.pvsOriginal || [],
        pageSize,
        this.pvFilters[op.codigo],
        this.pvFilterFunction
      )
      .subscribe(state => {
        op.pvsPaged = state.currentData;
      });
  }

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.opsConPvs,
      undefined,
      this.filters,
      this.filterFunction,
      true
    );

    const state = this.paginationService.getPaginatorState(this.paginatorId);
    this.currentOps = state?.currentData || [];
  }

  filtrarPVs(op: OpUI): void {
    const instanceId = 'pv_' + op.codigo;
    if (!this.pvFilters[op.codigo]) {
      this.pvFilters[op.codigo] = { busqueda: '' };
    }

    this.paginationService.updatePaginator(
      instanceId,
      op.pvsOriginal || [],
      undefined,
      this.pvFilters[op.codigo],
      this.pvFilterFunction,
      true
    );
    const state = this.paginationService.getPaginatorState(instanceId);
    op.pvsPaged = state?.currentData || [];
  }

  private refrescarPaginacionSinReinicio(): void {
    this.opsConPvs.sort((a, b) => {
      if (a.recepcion_reciente !== b.recepcion_reciente) {
        return a.recepcion_reciente ? -1 : 1;
      }
      return a.codigo - b.codigo;
    });
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.opsConPvs,
      undefined,
      this.filters,
      this.filterFunction,
      true
    );

    const state = this.paginationService.getPaginatorState(this.paginatorId);
    this.currentOps = state?.currentData || [];
  }

  // ===== FILTER FUNCTIONS =====

  filterFunction: FilterFunction = (item: any, filtros) => {
    const texto = (filtros.busqueda || '').toLowerCase().trim();
    if (!texto) return true;
    return String(item.codigo ?? '').toLowerCase().includes(texto);
  };

  pvFilterFunction: FilterFunction = (pv: PvUI, filters: { busqueda: string }) => {
    const texto = (filters?.busqueda || '').toString().toLowerCase().trim();
    if (!texto) return true;
    const numero = (pv.numero_pv ?? pv).toString().toLowerCase();
    return numero.includes(texto);
  };

  // ===== ORDENAR PVs =====

  private ordenarPVs(op: OpUI): void {
    if (!op.pvsOriginal || !Array.isArray(op.pvsOriginal)) return;

    op.pvsOriginal.sort((a, b) => {
      if (a.tieneAsignaciones !== b.tieneAsignaciones) {
        return (b.tieneAsignaciones ? 1 : 0) - (a.tieneAsignaciones ? 1 : 0);
      }
      // Ordenar por el nuevo indicador de pendientes
      if (a.tieneItemsPendientesDistribuir !== b.tieneItemsPendientesDistribuir) {
        return (b.tieneItemsPendientesDistribuir ? 1 : 0) - (a.tieneItemsPendientesDistribuir ? 1 : 0);
      }
      return parseInt(a.numero_pv) - parseInt(b.numero_pv);
    });
  }

  tienePVsConAsignacionesPendientes(op: OpUI): boolean {
    if (!op.pvsOriginal || !Array.isArray(op.pvsOriginal)) return false;
    return op.pvsOriginal.some(pv => pv.tieneAsignaciones === true);
  }

  // ===== HELPERS DE CLIENTES =====

  obtenerNombresClientes(op: any): string {
    if (!op.clientes || op.clientes.length === 0) return '';
    return op.clientes.map((c: any) => c.nombre).join(', ');
  }

  tieneMultiplesClientes(op: any): boolean {
    return op.clientes && op.clientes.length > 1;
  }

  obtenerPrimerCliente(op: any): any {
    return op.clientes && op.clientes.length > 0 ? op.clientes[0] : null;
  }

  obtenerCantidadClientes(op: any): number {
    return op.clientes ? op.clientes.length : 0;
  }
}
