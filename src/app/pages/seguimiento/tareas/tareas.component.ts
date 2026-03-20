import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription, forkJoin, Observable } from 'rxjs';
import { 
  ProyectoService, 
  VistaMes, 
  FlujoDiario, 
  Compromiso, 
  SeguimientoTarea,
  TareaConsolidada,
  InformeTarea,
  SeguimientoAnual,
  Tarea
} from 'src/app/services/proyectos.service';
import { SeguimientoStateService, UsuarioCache } from '../seguimiento-state.service';
import { PaginationService } from 'src/app/shared/pagination/pagination.service';
import { TareaForm } from '../modals/modal-tarea/modal-tarea.component';
import { InformeTareaForm } from '../modals/modal-informe-tarea/modal-informe-tarea.component';
import Swal from 'sweetalert2';

interface CalendarioDia {
  fecha: Date;
  esHoy: boolean;
  esMesActual: boolean;
  tareas: { tarea: SeguimientoTarea; nombreUsuario: string; iniciales: string; color: string }[];
  tareasExternas: (TareaConsolidada & { iniciales: string; color: string })[];
  tareasInforme: (InformeTarea & { nombreUsuario: string; iniciales: string; color: string })[];
  resumenPorUsuario: ResumenUsuarioDia[];
}

interface ResumenUsuarioDia {
  uid: number;
  iniciales: string;
  nombre: string;
  total: number;
  completadas: number;
  semaforo: string;
  countSeguimiento: number;
  countProyecto: number;
  countGlpi: number;
  countInforme: number;
}

@Component({
  selector: 'app-tareas',
  templateUrl: './tareas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TareasComponent implements OnInit, OnDestroy {
  @Input() usuarioId = 0;
  @Input() puedeGestionarModulo = false;

  // ── ESTADO ──────────────────────────────────────────────────────
  loading = false;
  mostrandoMes = false; // Nueva variable para controlar la vista de selección de meses
  vistaMes: VistaMes | null = null;
  seguimientoActual: SeguimientoAnual | null = null;
  
  mesActual = new Date().getMonth() + 1;
  anioActual = new Date().getFullYear();
  diaActual = new Date().getDate();

  vistaCalendario = true; // Por defecto calendario según solicitud
  vistaCalendarioModo: 'mes' | 'semana' | 'dia' = 'mes';

  readonly meses = [
    { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' },
    { v: 4, l: 'Abril' }, { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' },
    { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Septiembre' },
    { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
  ];

  // ── CALENDARIO ──────────────────────────────────────────────────
  calendarioDias: CalendarioDia[][] = [];
  readonly diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // ── FILTROS ─────────────────────────────────────────────────────
  filtroGlobalEstado = 'pendiente';
  filtroUsuariosSelec: number[] = [];
  showFiltroPersonas = false;

  // Tareas filtradas y paginadas
  tareasSegFiltradas: SeguimientoTarea[] = [];
  tareasProyFiltradas: TareaConsolidada[] = [];
  tareasInformeFiltradas: InformeTarea[] = [];
  tareasGlpiFiltradas: TareaConsolidada[] = [];

  // Modales
  showModalDia = false;
  diaSeleccionado: CalendarioDia | null = null;

  showModalTarea = false;
  tareaParaEditar: Tarea | null = null;
  savingTarea = false;

  showModalInformeTarea = false;
  informeTareaParaEditar: InformeTarea | null = null;
  savingInformeTarea = false;

  tareasSegPaginadas: SeguimientoTarea[] = [];
  tareasProyPaginadas: TareaConsolidada[] = [];
  tareasInformePaginadas: InformeTarea[] = [];
  tareasGlpiPaginadas: TareaConsolidada[] = [];

  readonly paginadorSegId = 'seg-tareas';
  readonly paginadorProyId = 'proy-tareas';
  readonly paginadorInfId = 'inf-tareas';
  readonly paginadorGlpiId = 'glpi-tareas';

  private _subs = new Subscription();

  constructor(
    private _proyectoService: ProyectoService,
    public state: SeguimientoStateService,
    private _cdr: ChangeDetectorRef,
    private _pagination: PaginationService
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this._subs.unsubscribe();
  }

  cargarDatos(): void {
    this.loading = true;
    this._cdr.markForCheck();

    this._proyectoService.getSeguimientosAnuales(this.usuarioId).subscribe({
      next: (res) => {
        const seg = res.data?.find(s => s.estado === 'activo');
        if (seg) {
          this.seguimientoActual = seg;
          this.anioActual = seg.anio;
          // No cargamos el mes automáticamente para mostrar la selección de meses
          this.loading = false;
          this._cdr.markForCheck();
        } else {
          this.loading = false;
          this._cdr.markForCheck();
        }
      },
      error: () => {
        this.loading = false;
        this._cdr.markForCheck();
      }
    });
  }

  seleccionarMes(m: number): void {
    if (!this.seguimientoActual) return;
    this.mesActual = m;
    this.mostrandoMes = true;
    this._cargarDetalleMes(this.seguimientoActual.id, m, this.anioActual);
  }

  irAtras(): void {
    this.mostrandoMes = false;
    this.vistaMes = null;
    this._cdr.markForCheck();
  }

  private _cargarDetalleMes(seguimientoId: number, mes: number, anio: number): void {
    this.loading = true;
    this._cdr.markForCheck();
    
    // Cargar vista mes y tareas consolidadas en paralelo
    forkJoin({
      vistaMes: this._proyectoService.getVistaMes(seguimientoId, mes, anio, this.usuarioId),
      consolidadas: this._proyectoService.getTareasConsolidadas(this.usuarioId, mes, anio, ['proyecto', 'glpi']),
      informes: this._proyectoService.getMisInformeTareas(this.usuarioId)
    }).subscribe({
      next: (res) => {
        this.vistaMes = res.vistaMes.data;
        const consolidadas = res.consolidadas.data || [];
        
        // Separar tareas consolidadas
        this.tareasProyFiltradas = consolidadas.filter(t => t.origen === 'proyecto');
        this.tareasGlpiFiltradas = consolidadas.filter(t => t.origen === 'glpi');
        
        // Tareas de seguimiento (desde vistaMes)
        if (this.vistaMes.tareas) {
          if (Array.isArray(this.vistaMes.tareas)) {
            this.tareasSegFiltradas = this.vistaMes.tareas;
          } else {
            this.tareasSegFiltradas = Object.values(this.vistaMes.tareas).reduce((acc, val) => acc.concat(val), [] as SeguimientoTarea[]);
          }
        } else {
          this.tareasSegFiltradas = [];
        }

        this.tareasInformeFiltradas = res.informes.data || [];

        this._aplicarFiltrosYPaginar();
        this._construirCalendario();
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error cargando detalle mes:', err);
        this.loading = false;
        this._cdr.markForCheck();
      }
    });
  }

  cambiarModoCalendario(modo: 'mes' | 'semana' | 'dia'): void {
    this.vistaCalendarioModo = modo;
    this._construirCalendario();
    this._cdr.markForCheck();
  }

  private _aplicarFiltrosYPaginar(): void {
    // Aquí aplicarías lógica de filtrado por estado y usuario si fuera necesario
    this._initPaginador(this.paginadorSegId, this.tareasSegFiltradas, items => this.tareasSegPaginadas = items);
    this._initPaginador(this.paginadorProyId, this.tareasProyFiltradas, items => this.tareasProyPaginadas = items);
    this._initPaginador(this.paginadorInfId, this.tareasInformeFiltradas, items => this.tareasInformePaginadas = items);
    this._initPaginador(this.paginadorGlpiId, this.tareasGlpiFiltradas, items => this.tareasGlpiPaginadas = items);
  }

  private _initPaginador(id: string, allItems: any[], callback: (items: any[]) => void): void {
    this._subs.add(
      this._pagination.initializePaginator(id, allItems, 5).subscribe(state => {
        callback(state.currentData);
        this._cdr.markForCheck();
      })
    );
  }

  // ── LÓGICA CALENDARIO ───────────────────────────────────────────
  private _construirCalendario(): void {
    if (!this.vistaMes) return;

    const fechaBase = new Date(this.anioActual, this.mesActual - 1, this.diaActual);
    
    if (this.vistaCalendarioModo === 'mes') {
      this._construirVistaMes(fechaBase);
    } else if (this.vistaCalendarioModo === 'semana') {
      this._construirVistaSemana(fechaBase);
    } else if (this.vistaCalendarioModo === 'dia') {
      this._construirVistaDia(fechaBase);
    }
  }

  private _construirVistaMes(fecha: Date): void {
    const primerDiaMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    let diaInicio = primerDiaMes.getDay(); // 0=Dom, 1=Lun...
    if (diaInicio === 0) diaInicio = 7;
    const primerDiaCal = new Date(primerDiaMes);
    primerDiaCal.setDate(primerDiaMes.getDate() - (diaInicio - 1));

    const semanas: CalendarioDia[][] = [];
    let fechaCorriente = new Date(primerDiaCal);

    for (let s = 0; s < 6; s++) {
      const semana: CalendarioDia[] = [];
      for (let d = 0; d < 7; d++) {
        semana.push(this._crearDiaCalendario(new Date(fechaCorriente), fecha.getMonth()));
        fechaCorriente.setDate(fechaCorriente.getDate() + 1);
      }
      semanas.push(semana);
      if (fechaCorriente.getMonth() !== fecha.getMonth() && s >= 3) break;
    }
    this.calendarioDias = semanas;
  }

  private _construirVistaSemana(fecha: Date): void {
    let diaSemana = fecha.getDay(); // 0=Dom
    if (diaSemana === 0) diaSemana = 7;
    const lunes = new Date(fecha);
    lunes.setDate(fecha.getDate() - (diaSemana - 1));

    const semana: CalendarioDia[] = [];
    let fechaCorriente = new Date(lunes);
    for (let d = 0; d < 7; d++) {
      semana.push(this._crearDiaCalendario(new Date(fechaCorriente), fecha.getMonth()));
      fechaCorriente.setDate(fechaCorriente.getDate() + 1);
    }
    this.calendarioDias = [semana];
  }

  private _construirVistaDia(fecha: Date): void {
    this.calendarioDias = [[this._crearDiaCalendario(new Date(fecha), fecha.getMonth())]];
  }

  private _crearDiaCalendario(fecha: Date, mesReferencia: number): CalendarioDia {
    const tareasDelDia = this._getTareasDelDia(fecha);
    
    return {
      fecha: new Date(fecha),
      esHoy: this._esHoy(fecha),
      esMesActual: fecha.getMonth() === mesReferencia,
      tareas: (tareasDelDia.seguimiento || []).map(t => ({ 
        tarea: t, 
        nombreUsuario: this.state.nombreUsuario(t.usuario_id),
        iniciales: this.state.getInicialesResponsable(t.usuario_id),
        color: this.state.getColorPorId(t.usuario_id)
      })),
      tareasExternas: [...(tareasDelDia.proyectos || []), ...(tareasDelDia.glpi || [])].map(t => ({
        ...t,
        iniciales: this.state.getInicialesResponsable(t.usuario_id),
        color: this.state.getColorPorId(t.usuario_id)
      })),
      tareasInforme: (tareasDelDia.informes || []).map(t => ({ 
        ...t, 
        nombreUsuario: this.state.nombreUsuario(t.responsable_id),
        iniciales: this.state.getInicialesResponsable(t.responsable_id),
        color: this.state.getColorPorId(t.responsable_id)
      })),
      resumenPorUsuario: []
    };
  }

  abrirDetalleDia(dia: CalendarioDia): void {
    if (this.vistaCalendarioModo === 'dia') return;
    this.diaSeleccionado = dia;
    this.showModalDia = true;
    this._cdr.markForCheck();
  }

  abrirTareaEspecifica(t: any, origen: string): void {
    if (origen === 'proyecto') {
      this.tareaParaEditar = t;
      this.showModalTarea = true;
    } else if (origen === 'informe') {
      this.informeTareaParaEditar = t;
      this.showModalInformeTarea = true;
    } else if (origen === 'seguimiento') {
      this.tareaParaEditar = {
        ...t,
        actividad_id: undefined,
        proyecto_id: undefined,
        creado_por: t.usuario_id
      } as any;
      this.showModalTarea = true;
    } else {
      this.state.showToast('Visualización de GLPI no implementada aún', 'info');
    }
    this._cdr.markForCheck();
  }

  onGuardarTarea(form: TareaForm): void {
    if (!this.tareaParaEditar) return;
    this.savingTarea = true;
    this._cdr.markForCheck();

    const body = { ...form, usuario_id: this.usuarioId };
    const isSeguimiento = !this.tareaParaEditar.proyecto_id;
    
    const obs$: Observable<any> = isSeguimiento 
      ? this._proyectoService.actualizarSeguimientoTarea(this.tareaParaEditar.id, body as any)
      : this._proyectoService.actualizarTarea(this.tareaParaEditar.id, body as any);

    obs$.subscribe({
      next: () => {
        this.savingTarea = false;
        this.showModalTarea = false;
        this.state.showToast('Tarea actualizada');
        if (this.seguimientoActual) {
          this._cargarDetalleMes(this.seguimientoActual.id, this.mesActual, this.anioActual);
        }
      },
      error: () => {
        this.savingTarea = false;
        this.state.showToast('Error al actualizar', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  onGuardarInformeTarea(form: InformeTareaForm): void {
    if (!this.informeTareaParaEditar) return;
    this.savingInformeTarea = true;
    this._cdr.markForCheck();

    const body = { ...form, usuario_id: this.usuarioId };
    this._proyectoService.actualizarInformeTarea(this.informeTareaParaEditar.id, body).subscribe({
      next: () => {
        this.savingInformeTarea = false;
        this.showModalInformeTarea = false;
        this.state.showToast('Tarea de informe actualizada');
        if (this.seguimientoActual) {
          this._cargarDetalleMes(this.seguimientoActual.id, this.mesActual, this.anioActual);
        }
      },
      error: () => {
        this.savingInformeTarea = false;
        this.state.showToast('Error al actualizar', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  private _getTareasDelDia(fecha: Date) {
    const format = (d: Date) => d.toISOString().split('T')[0];
    const fechaStr = format(fecha);

    const matchDate = (t: any) => {
      if (t.estado === 'completado' && t.fecha_completado) {
        return t.fecha_completado.startsWith(fechaStr);
      }
      return t.fecha_limite_entrega && t.fecha_limite_entrega.startsWith(fechaStr);
    };

    return {
      seguimiento: this.tareasSegFiltradas.filter(matchDate),
      proyectos: this.tareasProyFiltradas.filter(matchDate),
      glpi: this.tareasGlpiFiltradas.filter(matchDate),
      informes: this.tareasInformeFiltradas.filter(matchDate)
    };
  }

  navegar(delta: number): void {
    if (this.vistaCalendarioModo === 'mes') {
      const nuevaFecha = new Date(this.anioActual, this.mesActual - 1 + delta, 1);
      this.anioActual = nuevaFecha.getFullYear();
      this.mesActual = nuevaFecha.getMonth() + 1;
    } else if (this.vistaCalendarioModo === 'semana') {
      const nuevaFecha = new Date(this.anioActual, this.mesActual - 1, this.diaActual + (delta * 7));
      this.anioActual = nuevaFecha.getFullYear();
      this.mesActual = nuevaFecha.getMonth() + 1;
      this.diaActual = nuevaFecha.getDate();
    } else {
      const nuevaFecha = new Date(this.anioActual, this.mesActual - 1, this.diaActual + delta);
      this.anioActual = nuevaFecha.getFullYear();
      this.mesActual = nuevaFecha.getMonth() + 1;
      this.diaActual = nuevaFecha.getDate();
    }
    
    if (this.seguimientoActual) {
      this._cargarDetalleMes(this.seguimientoActual.id, this.mesActual, this.anioActual);
    }
  }

  irHoy(): void {
    const hoy = new Date();
    this.diaActual = hoy.getDate();
    this.mesActual = hoy.getMonth() + 1;
    this.anioActual = hoy.getFullYear();
    if (this.seguimientoActual) {
      this._cargarDetalleMes(this.seguimientoActual.id, this.mesActual, this.anioActual);
    }
  }

  private _esHoy(d: Date): boolean {
    const hoy = new Date();
    return d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
  }

  toggleVistaCalendario(): void {
    this.vistaCalendario = !this.vistaCalendario;
    if (this.vistaCalendario) this._construirCalendario();
    this._cdr.markForCheck();
  }

  nombreMes(m: number): string {
    const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return nombres[m - 1] || '';
  }
}
