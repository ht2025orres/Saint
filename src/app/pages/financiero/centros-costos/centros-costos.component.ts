import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PaginationService } from 'src/app/shared/pagination/pagination.service';
import { CentrosCostosService, Proceso, Grupo, Concepto, CentroCosto, ConceptoCuenta } from 'src/app/services/centros-costos.service';
import Swal from 'sweetalert2';

type Vista = 'procesos' | 'grupos' | 'conceptos' | 'detalle';

@Component({
  selector: 'app-centros-costos',
  templateUrl: './centros-costos.component.html',
  styleUrls: ['./centros-costos.component.css']
})
export class CentrosCostosComponent implements OnInit, OnDestroy {
  paginatorId = 'centros-costos-paginator';
  isLoading = false;

  vistaActual: Vista = 'procesos';
  
  procesos: Proceso[] = [];
  procesoSeleccionado: Proceso | null = null;
  
  grupos: Grupo[] = [];
  grupoSeleccionado: Grupo | null = null;
  
  conceptos: Concepto[] = [];
  conceptoSeleccionado: Concepto | null = null;

  detalles: CentroCosto[] = [];
  currentDetalles: CentroCosto[] = [];
  totalDetalles = 0;

  cuentasDisponibles: string[] = [];
  
  anoActual = new Date().getFullYear();
  mesActual = new Date().getMonth() + 1;

  filters = {
    busqueda: '',
    centroCosto: '',
    semaforo: '',
    ano: this.anoActual,
    mes: this.mesActual
  };

  centrosCostosUnicos: string[] = [];

  modalProceso = { visible: false, data: { nombre: '', responsable: '', descripcion: '', orden: 0 }, isEdit: false, id: 0 };
  modalGrupo = { visible: false, data: { proceso_id: 0, nombre: '', descripcion: '', orden: 0 }, isEdit: false, id: 0 };
  modalConcepto = { visible: false, data: { grupo_id: 0, nombre: '', descripcion: '', orden: 0, cuentas: [] as any[] }, isEdit: false, id: 0 };

  constructor(
    public paginationService: PaginationService,
    private service: CentrosCostosService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.cargarDatos();
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

  ngOnDestroy(): void {
    const links = this.document.head.querySelectorAll('link[href*="tailwindcss"], link[href*="bootstrap-icons"]');
    links.forEach(link => link.remove());
  }

  cargarDatos(): void {
    this.isLoading = true;
    this.service.obtenerJerarquia(this.filters.ano, this.filters.mes).subscribe({
      next: (res) => {
        this.procesos = res.data || [];
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los datos', 'error');
        this.isLoading = false;
      }
    });
  }

  onFechaChange(): void {
    this.cargarDatos();
  }

  // ==================== NAVEGACIÓN ====================

  verGrupos(proceso: Proceso): void {
    this.procesoSeleccionado = proceso;
    this.grupos = proceso.grupos || [];
    this.vistaActual = 'grupos';
  }

  verConceptos(grupo: Grupo): void {
    this.grupoSeleccionado = grupo;
    this.conceptos = grupo.conceptos || [];
    this.vistaActual = 'conceptos';
  }

  verDetalle(concepto: Concepto): void {
    this.conceptoSeleccionado = concepto;
    this.detalles = concepto.detalle || [];
    this.totalDetalles = this.detalles.length;
    this.vistaActual = 'detalle';
    this.extraerFiltrosUnicos();
    this.inicializarPaginacion();
  }

  volverAProcesos(): void {
    this.vistaActual = 'procesos';
    this.procesoSeleccionado = null;
    this.grupoSeleccionado = null;
    this.conceptoSeleccionado = null;
  }

  volverAGrupos(): void {
    if (this.procesoSeleccionado) {
      this.vistaActual = 'grupos';
      this.grupoSeleccionado = null;
      this.conceptoSeleccionado = null;
    }
  }

  volverAConceptos(): void {
    if (this.grupoSeleccionado) {
      this.vistaActual = 'conceptos';
      this.conceptoSeleccionado = null;
    }
  }

  // ==================== FILTROS Y PAGINACIÓN ====================

  extraerFiltrosUnicos(): void {
    this.centrosCostosUnicos = [...new Set(this.detalles.map(d => d.desc_ccosto))].filter(Boolean).sort();
    this.cuentasDisponibles = [...new Set(this.detalles.map(d => d.cuenta))].sort();
  }

  inicializarPaginacion(): void {
    if (this.detalles.length > 0) {
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.detalles,
        25,
        this.filters,
        this.filterDetalles
      ).subscribe(state => {
        this.currentDetalles = state.currentData;
      });
    }
  }

  filterDetalles = (detalle: CentroCosto, filtros: any) => {
    const texto = (filtros.busqueda || '').trim().toLowerCase();

    const cumpleBusqueda = !texto || (
      detalle.cuenta.toLowerCase().includes(texto) ||
      detalle.desc_auxiliar.toLowerCase().includes(texto) ||
      detalle.desc_ccosto.toLowerCase().includes(texto) ||
      detalle.responsable.toLowerCase().includes(texto)
    );

    const cumpleCentroCosto = !filtros.centroCosto || detalle.desc_ccosto === filtros.centroCosto;
    const cumpleSemaforo = !filtros.semaforo || detalle.semaforo === filtros.semaforo;

    return cumpleBusqueda && cumpleCentroCosto && cumpleSemaforo;
  };

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.detalles,
      undefined,
      this.filters,
      this.filterDetalles
    );
  }

  // ==================== CRUD PROCESOS ====================

  abrirModalProceso(proceso?: Proceso): void {
    if (proceso) {
      this.modalProceso = {
        visible: true,
        data: {
          nombre: proceso.nombre,
          responsable: proceso.responsable || '',
          descripcion: proceso.descripcion || '',
          orden: proceso.orden
        },
        isEdit: true,
        id: proceso.id
      };
    } else {
      this.modalProceso = {
        visible: true,
        data: { nombre: '', responsable: '', descripcion: '', orden: 0 },
        isEdit: false,
        id: 0
      };
    }
  }

  guardarProceso(): void {
    const obs = this.modalProceso.isEdit
      ? this.service.actualizarProceso(this.modalProceso.id, this.modalProceso.data)
      : this.service.crearProceso(this.modalProceso.data);

    obs.subscribe({
      next: () => {
        Swal.fire('Éxito', `Proceso ${this.modalProceso.isEdit ? 'actualizado' : 'creado'}`, 'success');
        this.cerrarModalProceso();
        this.cargarDatos();
      },
      error: () => Swal.fire('Error', 'No se pudo guardar el proceso', 'error')
    });
  }

  eliminarProceso(id: number): void {
    Swal.fire({
      title: '¿Eliminar proceso?',
      text: 'Se eliminarán todos los grupos y conceptos asociados',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.service.eliminarProceso(id).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Proceso eliminado', 'success');
            this.cargarDatos();
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  cerrarModalProceso(): void {
    this.modalProceso = { visible: false, data: { nombre: '', responsable: '', descripcion: '', orden: 0 }, isEdit: false, id: 0 };
  }

  // ==================== CRUD GRUPOS ====================

  abrirModalGrupo(grupo?: Grupo): void {
    if (grupo) {
      this.modalGrupo = {
        visible: true,
        data: {
          proceso_id: this.procesoSeleccionado!.id,
          nombre: grupo.nombre,
          descripcion: grupo.descripcion || '',
          orden: grupo.orden
        },
        isEdit: true,
        id: grupo.id
      };
    } else {
      this.modalGrupo = {
        visible: true,
        data: {
          proceso_id: this.procesoSeleccionado!.id,
          nombre: '',
          descripcion: '',
          orden: 0
        },
        isEdit: false,
        id: 0
      };
    }
  }

  guardarGrupo(): void {
    const obs = this.modalGrupo.isEdit
      ? this.service.actualizarGrupo(this.modalGrupo.id, this.modalGrupo.data)
      : this.service.crearGrupo(this.modalGrupo.data);

    obs.subscribe({
      next: () => {
        Swal.fire('Éxito', `Grupo ${this.modalGrupo.isEdit ? 'actualizado' : 'creado'}`, 'success');
        this.cerrarModalGrupo();
        this.cargarDatos();
      },
      error: () => Swal.fire('Error', 'No se pudo guardar el grupo', 'error')
    });
  }

  eliminarGrupo(id: number): void {
    Swal.fire({
      title: '¿Eliminar grupo?',
      text: 'Se eliminarán todos los conceptos asociados',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.service.eliminarGrupo(id).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Grupo eliminado', 'success');
            this.cargarDatos();
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  cerrarModalGrupo(): void {
    this.modalGrupo = { visible: false, data: { proceso_id: 0, nombre: '', descripcion: '', orden: 0 }, isEdit: false, id: 0 };
  }

  // ==================== CRUD CONCEPTOS ====================

  abrirModalConcepto(concepto?: Concepto): void {
    if (concepto) {
      this.modalConcepto = {
        visible: true,
        data: {
          grupo_id: this.grupoSeleccionado!.id,
          nombre: concepto.nombre,
          descripcion: concepto.descripcion || '',
          orden: concepto.orden,
          cuentas: concepto.cuentas || []
        },
        isEdit: true,
        id: concepto.id
      };
    } else {
      this.modalConcepto = {
        visible: true,
        data: {
          grupo_id: this.grupoSeleccionado!.id,
          nombre: '',
          descripcion: '',
          orden: 0,
          cuentas: []
        },
        isEdit: false,
        id: 0
      };
    }
  }

  guardarConcepto(): void {
    const obs = this.modalConcepto.isEdit
      ? this.service.actualizarConcepto(this.modalConcepto.id, this.modalConcepto.data)
      : this.service.crearConcepto(this.modalConcepto.data);

    obs.subscribe({
      next: () => {
        Swal.fire('Éxito', `Concepto ${this.modalConcepto.isEdit ? 'actualizado' : 'creado'}`, 'success');
        this.cerrarModalConcepto();
        this.cargarDatos();
      },
      error: () => Swal.fire('Error', 'No se pudo guardar el concepto', 'error')
    });
  }

  eliminarConcepto(id: number): void {
    Swal.fire({
      title: '¿Eliminar concepto?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.service.eliminarConcepto(id).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Concepto eliminado', 'success');
            this.cargarDatos();
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  cerrarModalConcepto(): void {
    this.modalConcepto = { visible: false, data: { grupo_id: 0, nombre: '', descripcion: '', orden: 0, cuentas: [] }, isEdit: false, id: 0 };
  }

  toggleCuenta(cuenta: string): void {
    const cuentas = this.modalConcepto.data.cuentas.map((c: any) => typeof c === 'string' ? c : c.cuenta);
    const index = cuentas.indexOf(cuenta);
    
    if (index > -1) {
      this.modalConcepto.data.cuentas.splice(index, 1);
    } else {
      this.modalConcepto.data.cuentas.push({ cuenta });
    }
  }

  isCuentaSeleccionada(cuenta: string): boolean {
    return this.modalConcepto.data.cuentas.some((c: any) => 
      (typeof c === 'string' ? c : c.cuenta) === cuenta
    );
  }

  // ==================== HELPERS ====================

  getSemaforoClass(semaforo: string): string {
    switch(semaforo) {
      case 'verde': return 'bg-green-100 text-green-800';
      case 'amarillo': return 'bg-yellow-100 text-yellow-800';
      case 'rojo': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getSemaforoIcon(semaforo: string): string {
    switch(semaforo) {
      case 'verde': return '🟢';
      case 'amarillo': return '🟡';
      case 'rojo': return '🔴';
      default: return '⚪';
    }
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
}