import { Component, OnInit, Inject, HostListener, ViewChild, ElementRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  ProyectoService,
  Proyecto, Actividad, Tarea,
  SeguimientoMensual, SeguimientoSemana, SeguimientoTarea,
  ConfiguracionSemaforo, PermisoGranular, MisPermisos, Semaforo, NivelTarea,
  SeguimientoAnual,
  VistaMes, TareaConsolidada, EstadoTarea,
} from 'src/app/services/proyectos.service';
import { UserService }      from 'src/app/services/user.service';
import { AuthService }      from 'src/app/services/auth.service';
import { PaginationService } from 'src/app/shared/pagination/pagination.service';
import Swal from 'sweetalert2';
import { forkJoin } from 'rxjs';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface UsuarioOpcion { id: number; nombre: string; }

interface TareaEnriched extends Tarea {
  actividadTitulo: string;
  actividadId: number | null;
  actividadSemaforo: string | null;
  esGeneral: boolean;
}

interface CalendarioDia {
  fecha:        Date;
  esHoy:        boolean;
  esMesActual:  boolean;
  tareas:       { tarea: SeguimientoTarea; nombreUsuario: string }[];
  tareasExternas: TareaConsolidada[];
  resumenPorUsuario: ResumenUsuarioDia[];
}

interface ResumenUsuarioDia {
  uid:              number;
  iniciales:        string;
  nombre:           string;
  total:            number;
  completadas:      number;
  semaforo:         string;
  countSeguimiento: number;
  countProyecto:    number;
  countGlpi:        number;
}

// ─── Plantillas de permisos ───────────────────────────────────────────────────

const PLANTILLAS_ROL: Record<string, Omit<PermisoGranular, 'usuario_id' | 'nombre'>> = {
  gestor:      { puede_crear: true,  puede_editar: true,  puede_eliminar: true,  puede_asignar: true,  puede_cambiar_fechas: true,  puede_gestionar_permisos: true  },
  admin:       { puede_crear: true,  puede_editar: true,  puede_eliminar: true,  puede_asignar: true,  puede_cambiar_fechas: true,  puede_gestionar_permisos: false },
  editor:      { puede_crear: true,  puede_editar: true,  puede_eliminar: false, puede_asignar: true,  puede_cambiar_fechas: false, puede_gestionar_permisos: false },
  colaborador: { puede_crear: false, puede_editar: true,  puede_eliminar: false, puede_asignar: false, puede_cambiar_fechas: false, puede_gestionar_permisos: false },
  lector:      { puede_crear: false, puede_editar: false, puede_eliminar: false, puede_asignar: false, puede_cambiar_fechas: false, puede_gestionar_permisos: false },
};

// ─── Componente ──────────────────────────────────────────────────────────────

@Component({
  selector: 'app-proyectos',
  templateUrl: './proyectos.component.html',
  styleUrls: ['./proyectos.component.css'],
})
export class ProyectosComponent implements OnInit {

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN 1 · CONSTANTES Y LOOKUPS
  // ════════════════════════════════════════════════════════════════

  @ViewChild('filtroSegContainer')  filtroSegRef!:    ElementRef;
  @ViewChild('filtroProyContainer') filtroProyRef!:   ElementRef;
  @ViewChild('filtroGlpiContainer') filtroGlpiRef!:   ElementRef;
  @ViewChild('inlineTaskRow')       inlineTaskRowRef!: ElementRef;
  @ViewChild('inlineEditRow')       inlineEditRowRef!: ElementRef;

  readonly plantillasRol = Object.keys(PLANTILLAS_ROL);

  readonly paginadorSegId  = 'seguimiento-tareas';
  readonly paginadorProyId = 'proyecto-tareas';
  readonly paginadorGlpiId = 'glpi-tareas';

  readonly meses = [
    { v: 1,  l: 'Enero' },     { v: 2,  l: 'Febrero' },   { v: 3,  l: 'Marzo' },
    { v: 4,  l: 'Abril' },     { v: 5,  l: 'Mayo' },      { v: 6,  l: 'Junio' },
    { v: 7,  l: 'Julio' },     { v: 8,  l: 'Agosto' },    { v: 9,  l: 'Septiembre' },
    { v: 10, l: 'Octubre' },   { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
  ];

  readonly diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN 2 · ESTADO GENERAL
  // ════════════════════════════════════════════════════════════════

  vista: 'proyectos' | 'seguimientos' = 'proyectos';
  vistaProyectos: 'tarjetas' | 'lista' = 'tarjetas';
  vistaTareas = true;

  proyectos:  Proyecto[] = [];
  loading     = false;
  filtroEstado = 'todos';

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN 3 · MODAL: PROYECTO
  // ════════════════════════════════════════════════════════════════

  showModalProyecto  = false;
  modalProyectoTitle = '';
  proyectoForm: any  = {};
  selectedProyecto: Proyecto | null = null;
  proyectosPaginados: Proyecto[] = [];

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN 4 · DETALLE PROYECTO
  // ════════════════════════════════════════════════════════════════

  showDetalleModal      = false;
  loadingDetalle        = false;
  detalleProyecto: Proyecto | null = null;
  actividadExpandidaId: number | null = null;

  filtroEstadoTarea = 'todos';
  filtroTipoTarea   = 'todas';

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN 5 · MODAL: ACTIVIDAD
  // ════════════════════════════════════════════════════════════════

  showModalActividad  = false;
  modalActividadTitle = '';
  actividadForm: any  = {};
  selectedActividad: Actividad | null = null;
  actividadesProyecto: any[] = [];

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN 6 · MODAL: TAREA
  // ════════════════════════════════════════════════════════════════

  showModalTarea   = false;
  modalTareaTitle  = '';
  tareaForm: any   = {};
  selectedTarea: Tarea | null = null;
  nivelTareaActual: NivelTarea = 'sin_acceso';

  usuariosAsignables: UsuarioOpcion[] = [];
  busquedaAsignable  = '';
  responsablesSelec: UsuarioOpcion[] = [];

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN 7 · MODAL: PERMISOS GRANULARES
  // ════════════════════════════════════════════════════════════════

  showModalPermisos = false;
  permisosEntidad:  { tipo: 'proyecto' | 'actividad' | 'tarea'; id: number } | null = null;
  permisosActuales: PermisoGranular[] = [];
  nuevaAsignacion:  PermisoGranular   = this._nuevoPermisoVacio();

  busquedaUsuario    = '';
  usuariosFiltrados: UsuarioOpcion[] = [];
  usuariosCache:     UsuarioOpcion[] = [];
  loadingUsuarios    = false;

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN 8 · MODAL: CONFIGURACIÓN SEMÁFOROS
  // ════════════════════════════════════════════════════════════════

  showModalConfig = false;
  configForm: Record<string, ConfiguracionSemaforo> = {};

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN 9 · SEGUIMIENTOS ANUALES
  // ════════════════════════════════════════════════════════════════

  seguimientos: SeguimientoAnual[] = [];
  loadingSeguimientos = false;

  showModalSeguimiento = false;
  seguimientoForm: any = {};
  participantesSeleccionados: UsuarioOpcion[] = [];
  busquedaParticipante     = '';
  usuariosParticipantes:   UsuarioOpcion[] = [];
  loadingParticipantes     = false;

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN 10 · VISTA MES (seguimiento mensual)
  // ════════════════════════════════════════════════════════════════

  vistaMes: VistaMes | null = null;
  showDetalleMes            = false;
  loadingVistaMes           = false;
  mesActual                 = new Date().getMonth() + 1;
  seguimientoActual: SeguimientoAnual | null = null;

  tareasExternasMes: TareaConsolidada[] = [];
  loadingTareasExternas = false;

  vistaCalendario   = false;
  calendarioDias: CalendarioDia[][] = [];

  filtroUsuariosSelec: number[] = [];
  filtroTextoUsuario  = '';

  filtroEstadoSeg:  string = 'pendiente';
  filtroEstadoProy: string = 'pendiente';
  filtroEstadoGlpi: string = 'pendiente';

  tareasSegFiltradas:  SeguimientoTarea[]   = [];
  tareasProyFiltradas: TareaConsolidada[]   = [];
  tareasGlpiFiltradas: TareaConsolidada[]   = [];

  tareasSegPaginadas:  SeguimientoTarea[]   = [];
  tareasProyPaginadas: TareaConsolidada[]   = [];
  tareasGlpiPaginadas: TareaConsolidada[]   = [];

  showFiltroSeg  = false;
  showFiltroProy = false;
  showFiltroGlpi = false;

  showAsignarSelect = false;
  showEstadoSelect  = false;
  showFechaPicker   = false;
  fechaTemp = '';
  horaTemp  = '';

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · INLINE TASK (crear tarea en línea, estilo ClickUp)
  // ════════════════════════════════════════════════════════════════

  showInlineTask      = false;
  inlineTaskGuardando = false;
  /** Incluye descripcion y estado además de titulo/fecha */
  inlineTaskForm: {
    titulo: string;
    descripcion: string;
    estado: string;
    fecha_limite_entrega: string;
    actividad_id: number | null;
    proyecto_id: number | null;
    asignado_id: number | null;
  } = { titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', actividad_id: null, proyecto_id: null, asignado_id: null };

  /** Dropdown de estado en la fila de creación inline */
  showInlineEstado = false;
  /** Dropdown de asignado en la fila de creación inline */
  showInlineAsignado = false;
  inlineAsignadoBusqueda = '';

  /** Tarea sobre la que está el hover (para mostrar botones de acción) */
  hoveredTaskId: number | null = null;

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · INLINE EDIT (editar tarea en línea)
  // ════════════════════════════════════════════════════════════════

  inlineEditingTaskId: number | null = null;
  inlineEditForm: { titulo: string; descripcion: string; estado: string; fecha_limite_entrega: string; asignado_id: number | null } = {
    titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', asignado_id: null,
  };
  /** Dropdown de estado en la fila de edición inline */
  inlineEditShowEstado = false;
  /** Dropdown de asignado en la fila de edición inline */
  showInlineEditAsignado = false;
  inlineEditAsignadoBusqueda = '';

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · TOAST NOTIFICATIONS
  // ════════════════════════════════════════════════════════════════

  toasts: { id: number; message: string; type: 'success' | 'error' }[] = [];
  private _toastCounter = 0;

  // ════════════════════════════════════════════════════════════════

  showModalSegTarea  = false;
  segTareaForm: any  = {};
  selectedSegTarea: SeguimientoTarea | null = null;

  showModalVerNotas    = false;
  tareaSeleccionada: any = null;

  detalleSeguimiento: SeguimientoMensual | null = null;
  showDetalleSeguimiento = false;
  loadingDetalleSeg      = false;
  semanaActual: SeguimientoSemana | null = null;
  filtroSemanasSelec: number[] = [];

  // ════════════════════════════════════════════════════════════════
  // CONSTRUCTOR & LIFECYCLE
  // ════════════════════════════════════════════════════════════════

  constructor(
    public  paginationService: PaginationService,
    private proyectoService: ProyectoService,
    private userService: UserService,
    public  authService: AuthService,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  ngOnInit(): void {
    this._loadAssets();
    this.cargarProyectos();
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · GETTERS DE AUTENTICACIÓN / PERMISOS
  // ════════════════════════════════════════════════════════════════

  get usuarioId(): number           { return this.authService.user?.id ?? 0; }
  get esAdminSistema(): boolean     { return this.authService.hasRole('-Administrador del sistema'); }
  get esGestorProyectos(): boolean  { return this.authService.hasRole('Gestor de Proyectos'); }
  get puedeGestionarModulo(): boolean { return this.esAdminSistema || this.esGestorProyectos; }

  esAdminProyecto(p: Proyecto): boolean {
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_gestionar_permisos ?? false);
  }
  puedeCrearEnProyecto(p: Proyecto): boolean {
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_crear ?? false);
  }
  puedeEditarProyecto(p: Proyecto): boolean {
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_editar ?? false);
  }
  puedeEliminarProyecto(p: Proyecto): boolean {
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_eliminar ?? false);
  }
  puedeCambiarFechas(p: Proyecto): boolean {
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_cambiar_fechas ?? false);
  }
  puedeCompletarTarea(tarea: Tarea): boolean {
    if (this.puedeGestionarModulo || !this.detalleProyecto) return !!this.puedeGestionarModulo;
    return this.esAdminProyecto(this.detalleProyecto)
      || tarea.creado_por === this.usuarioId
      || (tarea.responsables ?? []).includes(this.usuarioId);
  }

  puedeEditarSegTarea(t: SeguimientoTarea): boolean {
    return !!this.vistaMes && this.vistaMes.estado === 'activo'
      && (this.vistaMes.es_gestor || t.usuario_id === this.usuarioId);
  }
  puedeEliminarSegTarea(t: SeguimientoTarea): boolean {
    return !!(this.vistaMes?.es_gestor || t.usuario_id === this.usuarioId);
  }
  puedeCompletarSegTarea(t: SeguimientoTarea): boolean {
    return t.estado !== 'completado'
      && !!(this.vistaMes?.es_gestor || t.usuario_id === this.usuarioId);
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · GETTERS DE DATOS DERIVADOS
  // ════════════════════════════════════════════════════════════════

  get tareasSegPlanas(): SeguimientoTarea[] {
    if (!this.vistaMes) return [];
    if (this._esTareasAgrupadas(this.vistaMes.tareas)) {
      return Object.values(this.vistaMes.tareas as Record<string, SeguimientoTarea[]>)
        .reduce((acc, lista) => acc.concat(lista), [] as SeguimientoTarea[]);
    }
    return this.vistaMes.tareas as SeguimientoTarea[];
  }

  get tareasSegAgrupadasPaginadas(): { [uid: string]: SeguimientoTarea[] } {
    const result: { [uid: string]: SeguimientoTarea[] } = {};
    for (const t of this.tareasSegPaginadas) {
      const uid = t.usuario_id.toString();
      (result[uid] ??= []).push(t);
    }
    return result;
  }

  get tareasExternasProyecto(): TareaConsolidada[] {
    return this.tareasExternasMes.filter(t => t.origen === 'proyecto' && this.usuarioVisible(t.usuario_id));
  }

  get tareasExternasGlpi(): TareaConsolidada[] {
    return this.tareasExternasMes.filter(t => t.origen === 'glpi' && this.usuarioVisible(t.usuario_id));
  }

  get tareasPlanas(): TareaEnriched[] {
    if (!this.detalleProyecto) return [];
    const tareas: TareaEnriched[] = [];

    // Usar objetos envoltorio que mantienen la referencia original
    for (const actividad of (this.detalleProyecto.actividades ?? [])) {
      for (const tarea of (actividad.tareas ?? [])) {
        // NO USAR SPREAD OPERATOR - mantener referencia original
        const tareaEnriquecida = tarea as TareaEnriched;
        tareaEnriquecida.actividadTitulo = actividad.titulo;
        tareaEnriquecida.actividadId = actividad.id;
        tareaEnriquecida.actividadSemaforo = actividad.semaforo;
        tareaEnriquecida.esGeneral = false;
        tareas.push(tareaEnriquecida);  // <-- Referencia ORIGINAL
      }
    }
    
    for (const tarea of (this.detalleProyecto.tareas_sin_actividad ?? [])) {
      // NO USAR SPREAD OPERATOR
      const tareaEnriquecida = tarea as TareaEnriched;
      tareaEnriquecida.actividadTitulo = 'Sin actividad';
      tareaEnriquecida.actividadId = null;
      tareaEnriquecida.actividadSemaforo = null;
      tareaEnriquecida.esGeneral = true;
      tareas.push(tareaEnriquecida);  // <-- Referencia ORIGINAL
    }

    const ahora = new Date();
    return tareas.sort((a, b) => {
      const pA = this._prioridadTarea(a, ahora), pB = this._prioridadTarea(b, ahora);
      if (pA !== pB) return pA - pB;
      return (a.fecha_limite_entrega ? new Date(a.fecha_limite_entrega).getTime() : Infinity)
          - (b.fecha_limite_entrega ? new Date(b.fecha_limite_entrega).getTime() : Infinity);
    });
  }

  get tareasPlanasFiltradas(): any[] {
    let filtradas = this.tareasPlanas;
    if (this.filtroEstadoTarea !== 'todos')       filtradas = filtradas.filter(t => t.estado === this.filtroEstadoTarea);
    if (this.filtroTipoTarea === 'conActividad')   filtradas = filtradas.filter(t => !t.esGeneral);
    if (this.filtroTipoTarea === 'sinActividad')   filtradas = filtradas.filter(t => t.esGeneral);

    const ahora = new Date();
    return filtradas.sort((a, b) => {
      if (a.esGeneral && !b.esGeneral) return -1;
      if (!a.esGeneral && b.esGeneral) return  1;
      const pA = this._prioridadTarea(a, ahora), pB = this._prioridadTarea(b, ahora);
      if (pA !== pB) return pA - pB;
      return (a.fecha_limite_entrega ? new Date(a.fecha_limite_entrega).getTime() : Infinity)
           - (b.fecha_limite_entrega ? new Date(b.fecha_limite_entrega).getTime() : Infinity);
    });
  }

  get participantesDelMes(): { id: number; nombre: string }[] {
    return this.vistaMes?.participantes_info ?? [];
  }

  get participantesDelSeguimiento(): { id: number; nombre: string }[] {
    return this.detalleSeguimiento?.participantes_info ?? [];
  }

  get semanasParaMostrar(): any[] {
    return (this.detalleSeguimiento?.semanas ?? []).filter((s: any) => this.semanaVisible(s.id));
  }

  get usuariosAsignablesFiltrados(): UsuarioOpcion[] {
    const q   = this.busquedaAsignable.toLowerCase().trim();
    const ids = new Set(this.responsablesSelec.map(r => r.id));
    return this.usuariosAsignables
      .filter(u => !ids.has(u.id) && (!q || u.nombre.toLowerCase().includes(q)))
      .slice(0, 6);
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · HELPERS DE ESTILO / DISPLAY
  // ════════════════════════════════════════════════════════════════

  getSemaforoClass(semaforo?: Semaforo | string): string {
    return ({ rojo: 'bg-red-500', amarillo: 'bg-yellow-400', verde: 'bg-green-500', gris: 'bg-gray-300' })[semaforo ?? 'gris'] ?? 'bg-gray-300';
  }
  getSemaforoBorderClass(semaforo?: Semaforo): string {
    return ({ rojo: 'border-red-500', amarillo: 'border-yellow-400', verde: 'border-green-500', gris: 'border-gray-300' })[semaforo ?? 'gris'] ?? 'border-gray-300';
  }
  getSemaforoLabel(semaforo?: Semaforo): string {
    return ({ rojo: 'Urgente – revisar inmediatamente', amarillo: 'Próximo vencimiento', verde: 'A tiempo', gris: 'Sin fecha límite' })[semaforo ?? 'gris'] ?? '';
  }
  getSemaforoResumenClass(semaforo: string): string {
    return ({ rojo: 'bg-red-50 text-red-700 border border-red-200', amarillo: 'bg-yellow-50 text-yellow-700 border border-yellow-200', verde: 'bg-green-50 text-green-700 border border-green-200', gris: 'bg-gray-50 text-gray-600 border border-gray-200' })[semaforo] ?? 'bg-gray-50 text-gray-600 border border-gray-200';
  }
  getEstadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente:    'bg-gray-100 text-gray-700 border border-gray-300',
      en_ejecucion: 'bg-blue-100 text-blue-700 border border-blue-200',
      en_proceso:   'bg-blue-100 text-blue-700 border border-blue-200',
      completado:   'bg-green-100 text-green-700 border border-green-200',
      pausado:      'bg-yellow-100 text-yellow-700 border border-yellow-200',
      cancelado:    'bg-red-100 text-red-700 border border-red-200',
      bloqueado:    'bg-orange-100 text-orange-700 border border-orange-200',
      activo:       'bg-blue-100 text-blue-700 border border-blue-200',
      cerrado:      'bg-gray-100 text-gray-600 border border-gray-300',
    };
    return map[estado] ?? 'bg-gray-100 text-gray-700';
  }
  getEstadoIcon(estado: string): string {
    const map: Record<string, string> = {
      pendiente:    'bi-clock',
      en_ejecucion: 'bi-play-circle',
      en_proceso:   'bi-play-circle',
      completado:   'bi-check-circle-fill',
      pausado:      'bi-pause-circle',
      cancelado:    'bi-x-circle',
      bloqueado:    'bi-lock',
      activo:       'bi-play-circle',
      cerrado:      'bi-lock-fill',
    };
    return map[estado] ?? 'bi-circle';
  }
  getOrigenBadgeClass(origen: string): string {
    return ({ seguimiento: 'bg-indigo-100 text-indigo-700 border-indigo-200', proyecto: 'bg-teal-100 text-teal-700 border-teal-200', glpi: 'bg-orange-100 text-orange-700 border-orange-200' })[origen] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  }
  getOrigenIcon(origen: string): string {
    return ({ seguimiento: 'bi-calendar3', proyecto: 'bi-kanban', glpi: 'bi-ticket-perforated' })[origen] ?? 'bi-circle';
  }

  nombreMes(mes: number): string { return this.meses.find(m => m.v === mes)?.l ?? String(mes); }

  nombreUsuario(uid: string | number): string {
    return this.usuariosCache.find(u => u.id === +uid)?.nombre ?? `Usuario #${uid}`;
  }

  getNombreAsignado(usuarioId: string): string {
    const p = this.vistaMes?.participantes_info?.find(p => p.id === +usuarioId);
    return p ? p.nombre : 'Yo mismo';
  }

  calcularProgresoActividad(actividad: Actividad): number {
    const total = actividad.total_tareas ?? 0;
    return total === 0 ? 0 : Math.round(((actividad.tareas_completadas ?? 0) / total) * 100);
  }

  /** Etiqueta corta para el estado (usada en botones inline) */
  getEstadoLabel(estado: string): string {
    return ({ pendiente: 'Pendiente', en_ejecucion: 'En ejecución', completado: 'Completado', bloqueado: 'Bloqueado' })[estado] ?? estado;
  }

  /** Nombre del usuario asignado en inline (creación) */
  get inlineAsignadoNombre(): string {
    if (!this.inlineTaskForm.asignado_id) return '';
    return this.usuariosAsignables.find(u => u.id === this.inlineTaskForm.asignado_id)?.nombre ?? '';
  }

  /** Nombre del usuario asignado en inline (edición) */
  get inlineEditAsignadoNombre(): string {
    if (!this.inlineEditForm.asignado_id) return '';
    return this.usuariosAsignables.find(u => u.id === this.inlineEditForm.asignado_id)?.nombre ?? '';
  }

  /** Usuarios filtrados para el picker inline (creación) */
  get inlineUsuariosFiltrados(): UsuarioOpcion[] {
    const q = this.inlineAsignadoBusqueda.toLowerCase();
    return q ? this.usuariosAsignables.filter(u => u.nombre.toLowerCase().includes(q)) : this.usuariosAsignables;
  }

  /** Usuarios filtrados para el picker inline (edición) */
  get inlineEditUsuariosFiltrados(): UsuarioOpcion[] {
    const q = this.inlineEditAsignadoBusqueda.toLowerCase();
    return q ? this.usuariosAsignables.filter(u => u.nombre.toLowerCase().includes(q)) : this.usuariosAsignables;
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · HOST LISTENER
  // ════════════════════════════════════════════════════════════════

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as HTMLElement;

    // Cerrar dropdowns del formulario de tarea de seguimiento
    if (!target.closest('.relative.group')) {
      this.showAsignarSelect = false;
      this.showEstadoSelect  = false;
      this.showFechaPicker   = false;
    }

    // Cerrar filtros de sección
    if (this.filtroSegRef  && !this.filtroSegRef.nativeElement.contains(target))  this.showFiltroSeg  = false;
    if (this.filtroProyRef && !this.filtroProyRef.nativeElement.contains(target)) this.showFiltroProy = false;
    if (this.filtroGlpiRef && !this.filtroGlpiRef.nativeElement.contains(target)) this.showFiltroGlpi = false;

    // Cerrar dropdown de estado inline (creación)
    if (this.showInlineEstado && !target.closest('[data-inline-estado]')) {
      this.showInlineEstado = false;
    }
    // Cerrar dropdown de asignado inline (creación)
    if (this.showInlineAsignado && !target.closest('[data-inline-asignado]')) {
      this.showInlineAsignado = false;
    }

    // Cerrar dropdown de estado inline (edición)
    if (this.inlineEditShowEstado && !target.closest('[data-inline-edit-estado]')) {
      this.inlineEditShowEstado = false;
    }
    // Cerrar dropdown de asignado inline (edición)
    if (this.showInlineEditAsignado && !target.closest('[data-inline-edit-asignado]')) {
      this.showInlineEditAsignado = false;
    }

    // Guardar/cerrar fila de CREACIÓN inline al hacer clic fuera
    if (this.showInlineTask && this.inlineTaskRowRef?.nativeElement
        && !this.inlineTaskRowRef.nativeElement.contains(target)) {
      this.guardarTareaInline();
    }

    // Guardar fila de EDICIÓN inline al hacer clic fuera
    if (this.inlineEditingTaskId && this.inlineEditRowRef?.nativeElement
        && !this.inlineEditRowRef.nativeElement.contains(target)) {
      this.guardarEdicionInline();
    }
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · PROYECTOS (listado)
  // ════════════════════════════════════════════════════════════════

  cargarProyectos(): void {
      this.loading = true;
      const filtros = this.filtroEstado === 'todos' ? { activos: true } : { estado: this.filtroEstado };
      this.proyectoService.getProyectos(this.usuarioId, filtros).subscribe({
          next: res => {
              this.proyectos = this._ordenarProyectos(res.data);
              this.loading = false;
              
              // Inicializar paginadores para ambas vistas
              this._inicializarPaginadorTarjetas();
              this._inicializarPaginadorLista();
          },
          error: () => {
              this.loading = false; 
              Swal.fire('Error', 'No se pudieron cargar los proyectos', 'error');
          },
      });
  }

  cambiarVista(v: 'proyectos' | 'seguimientos'): void {
      this.vista = v;
      if (v === 'proyectos') {
          // Reinicializar paginadores al volver a proyectos
          setTimeout(() => {
              this._inicializarPaginadorTarjetas();
              this._inicializarPaginadorLista();
          }, 0);
      } else if (v === 'seguimientos') {
          if (!this.seguimientos.length) this.cargarSeguimientos(true);
          else this._abrirMesPorDefecto();
      } else {
          this.seguimientoActual = null;
          this.mesActual = new Date().getMonth() + 1;
          this.vistaMes = null;
          this.showDetalleMes = false;
          this.vistaCalendario = false;
      }
  }

  cambiarEstadoProyecto(proyecto: Proyecto, nuevoEstado: string): void {
    Swal.fire({ title: '¿Cambiar estado?', text: `"${proyecto.titulo}" → ${nuevoEstado}`, icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, cambiar' })
      .then(r => r.isConfirmed && this.proyectoService.cambiarEstadoProyecto(proyecto.id, nuevoEstado, this.usuarioId).subscribe({
        next:  () => { Swal.fire('Actualizado', 'Estado cambiado', 'success'); this.cargarProyectos(); },
        error: () => Swal.fire('Error', 'No se pudo cambiar el estado', 'error'),
      }));
  }

  eliminarProyecto(proyecto: Proyecto): void {
    Swal.fire({ title: '¿Eliminar proyecto?', text: `Se eliminará "${proyecto.titulo}" y todo su contenido`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' })
      .then(r => r.isConfirmed && this.proyectoService.eliminarProyecto(proyecto.id, this.usuarioId).subscribe({
        next:  () => { Swal.fire('Eliminado', 'Proyecto eliminado', 'success'); this.cargarProyectos(); },
        error: () => Swal.fire('Error', 'No se pudo eliminar', 'error'),
      }));
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · MODAL PROYECTO
  // ════════════════════════════════════════════════════════════════

  abrirModalCrearProyecto(): void {
    this.proyectoForm       = { titulo: '', descripcion: '', fecha_limite_entrega: '' };
    this.modalProyectoTitle = 'Nuevo Proyecto';
    this.selectedProyecto   = null;
    this.showModalProyecto  = true;
  }

  abrirModalEditarProyecto(proyecto: Proyecto): void {
    this.proyectoForm = {
      titulo: proyecto.titulo,
      descripcion: proyecto.descripcion,
      fecha_limite_entrega: this._toDateTimeLocal(proyecto.fecha_limite_entrega),
      estado: proyecto.estado,
    };
    this.modalProyectoTitle = 'Editar Proyecto';
    this.selectedProyecto   = proyecto;
    this.showModalProyecto  = true;
  }

  guardarProyecto(): void {
    if (!this.proyectoForm.titulo?.trim()) { Swal.fire('Validación', 'El título es obligatorio', 'warning'); return; }
    const body = { ...this.proyectoForm, usuario_id: this.usuarioId };
    const req$ = this.selectedProyecto
      ? this.proyectoService.actualizarProyecto(this.selectedProyecto.id, body)
      : this.proyectoService.crearProyecto(body);
    req$.subscribe({
      next:  (res: any) => { Swal.fire('Éxito', res.message ?? 'Operación exitosa', 'success'); this.cerrarModalProyecto(); this.cargarProyectos(); },
      error: ()         => Swal.fire('Error', 'No se pudo guardar el proyecto', 'error'),
    });
  }

  cerrarModalProyecto(): void { this.showModalProyecto = false; this.selectedProyecto = null; }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · DETALLE PROYECTO
  // ════════════════════════════════════════════════════════════════

  verDetalleProyecto(proyecto: any): void {
    this.showDetalleModal = true;
    this.loadingDetalle   = true;
    this._cargarUsuariosAsignables();
    this.proyectoService.obtenerDetalleProyecto(proyecto.id, this.usuarioId).subscribe({
      next: (res: any) => {
        this.detalleProyecto = res.data;
        this.detalleProyecto.actividades           = res.data.actividades ?? [];
        this.detalleProyecto.tareas_sin_actividad  = res.data.tareas_sin_actividad ?? [];
        this.loadingDetalle = false;
      },
      error: () => { this.loadingDetalle = false; },
    });
  }

  cerrarDetalle(): void {
    this.showDetalleModal        = false;
    this.detalleProyecto         = null;
    this.actividadExpandidaId    = null;
    this.inlineEditingTaskId     = null;
    this.showInlineTask          = false;
  }

  toggleActividad(id: number): void {
    this.actividadExpandidaId = this.actividadExpandidaId === id ? null : id;
    // Cancelar edición inline al colapsar/expandir
    this.cancelarEdicionInline();
    this.cancelarFilaInline();
  }

  limpiarFiltrosTareas(): void {
    this.filtroEstadoTarea = 'todos';
    this.filtroTipoTarea   = 'todas';
  }

  async moverTarea(tarea: any): Promise<void> {
    const actividades = this.detalleProyecto.actividades.map(a => ({ id: a.id, titulo: a.titulo }));
    const { value: actividadId } = await Swal.fire({
      title: 'Mover tarea', input: 'select', showCancelButton: true,
      inputOptions: { null: 'Sin actividad', ...actividades.reduce((acc, a) => ({ ...acc, [a.id]: a.titulo }), {}) },
      inputPlaceholder: 'Selecciona una actividad',
      confirmButtonText: 'Mover', cancelButtonText: 'Cancelar',
    });
    if (actividadId !== undefined) {
      this.proyectoService.actualizarTarea(tarea.id, {
        actividad_id: actividadId === 'null' ? null : Number(actividadId),
        usuario_id: this.usuarioId,
      }).subscribe({
        next:  () => { Swal.fire('Movida', 'Tarea movida correctamente', 'success'); this.verDetalleProyecto(this.detalleProyecto); },
        error: () => Swal.fire('Error', 'No se pudo mover la tarea', 'error'),
      });
    }
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · MODAL ACTIVIDAD
  // ════════════════════════════════════════════════════════════════

  abrirModalCrearActividad(proyecto: Proyecto): void {
    this.actividadForm       = { proyecto_id: proyecto.id, titulo: '', descripcion: '', fecha_limite_entrega: '' };
    this.modalActividadTitle = 'Nueva Actividad';
    this.selectedActividad   = null;
    this.showModalActividad  = true;
  }

  abrirModalEditarActividad(actividad: Actividad): void {
    this.actividadForm = {
      titulo: actividad.titulo, descripcion: actividad.descripcion,
      estado: actividad.estado, fecha_limite_entrega: this._toDateTimeLocal(actividad.fecha_limite_entrega),
    };
    this.modalActividadTitle = 'Editar Actividad';
    this.selectedActividad   = actividad;
    this.showModalActividad  = true;
  }

  guardarActividad(): void {
    if (!this.actividadForm.titulo?.trim()) { Swal.fire('Validación', 'El título es obligatorio', 'warning'); return; }
    const body = { ...this.actividadForm, usuario_id: this.usuarioId };
    const req$ = this.selectedActividad
      ? this.proyectoService.actualizarActividad(this.selectedActividad.id, body)
      : this.proyectoService.crearActividad(body);
    req$.subscribe({
      next:  (res: any) => { Swal.fire('Éxito', res.message ?? 'Operación exitosa', 'success'); this.cerrarModalActividad(); if (this.detalleProyecto) this.verDetalleProyecto(this.detalleProyecto); },
      error: ()         => Swal.fire('Error', 'No se pudo guardar la actividad', 'error'),
    });
  }

  cerrarModalActividad(): void { this.showModalActividad = false; this.selectedActividad = null; }

  eliminarActividad(actividad: Actividad): void {
    Swal.fire({ title: '¿Eliminar actividad?', text: `Se eliminará "${actividad.titulo}" y sus tareas`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' })
      .then(r => r.isConfirmed && this.proyectoService.eliminarActividad(actividad.id, this.usuarioId).subscribe({
        next:  () => { Swal.fire('Eliminada', 'Actividad eliminada', 'success'); if (this.detalleProyecto) this.verDetalleProyecto(this.detalleProyecto); },
        error: () => Swal.fire('Error', 'No se pudo eliminar', 'error'),
      }));
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · MODAL TAREA (modal completo – tres puntos)
  // ════════════════════════════════════════════════════════════════

  abrirModalCrearTarea(actividad: Actividad): void {
    this.tareaForm = { actividad_id: actividad.id, titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', notas: '', responsables: [] };
    this.actividadesProyecto = this.detalleProyecto.actividades || [];
    this.responsablesSelec   = [];
    this.busquedaAsignable   = '';
    this.modalTareaTitle     = 'Nueva Tarea';
    this.selectedTarea       = null;
    this.nivelTareaActual    = 'admin';
    this._cargarUsuariosAsignables();
    this.showModalTarea = true;
  }

  abrirModalCrearTareaGeneral(): void {
    if (!this.detalleProyecto) return;
    this.tareaForm = { proyecto_id: this.detalleProyecto.id, actividad_id: null, titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', notas: '', responsables: [] };
    this.actividadesProyecto = this.detalleProyecto.actividades || [];
    this.responsablesSelec   = [];
    this.busquedaAsignable   = '';
    this.modalTareaTitle     = 'Nueva tarea general';
    this.selectedTarea       = null;
    this.nivelTareaActual    = 'admin';
    this._cargarUsuariosAsignables();
    this.showModalTarea = true;
  }

  abrirModalEditarTarea(tarea: Tarea, nivel: NivelTarea): void {
    this.tareaForm = {
      titulo: tarea.titulo, descripcion: tarea.descripcion, estado: tarea.estado,
      fecha_limite_entrega: this._toDateTimeLocal(tarea.fecha_limite_entrega),
      notas: tarea.notas, responsables: [...(tarea.responsables ?? [])],
    };
    this.responsablesSelec = (tarea.responsables ?? [])
      .map(id => this.usuariosCache.find(u => u.id === id))
      .filter((u): u is UsuarioOpcion => !!u);
    this.busquedaAsignable = '';
    this.modalTareaTitle   = 'Editar Tarea';
    this.selectedTarea     = tarea;
    this.nivelTareaActual  = nivel;
    this._cargarUsuariosAsignables();
    this.showModalTarea = true;
  }

  guardarTarea(): void {
    if (!this.tareaForm.titulo?.trim()) { Swal.fire('Validación', 'El título es obligatorio', 'warning'); return; }
    const body = {
      ...this.tareaForm,
      responsables: this.responsablesSelec.map(r => r.id),
      usuario_id:   this.usuarioId,
      nivel_usuario: this.nivelTareaActual,
    };
    if (!body.actividad_id) body.proyecto_id = this.detalleProyecto.id;

    const req$ = this.selectedTarea
      ? this.proyectoService.actualizarTarea(this.selectedTarea.id, body) as any
      : this.proyectoService.crearTarea(body) as any;
    req$.subscribe({
      next:  (res: any) => {
        this.cerrarModalTarea();
        this.showToast(res.message ?? 'Tarea guardada', 'success');
        this._refreshTareasEnBackground();
      },
      error: () => Swal.fire('Error', 'No se pudo guardar la tarea', 'error'),
    });
  }

  cerrarModalTarea(): void {
    this.showModalTarea    = false;
    this.selectedTarea     = null;
    this.responsablesSelec = [];
    this.busquedaAsignable = '';
  }

  completarTarea(tarea: Tarea): void {
    Swal.fire({ title: '¿Marcar como completada?', icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, completar', confirmButtonColor: '#16a34a' })
      .then(r => r.isConfirmed && this.proyectoService.completarTarea(tarea.id, this.usuarioId).subscribe({
        next:  () => {
          this.showToast('¡Tarea completada!', 'success');
          this._refreshTareasEnBackground();
        },
        error: () => Swal.fire('Error', 'No se pudo completar la tarea', 'error'),
      }));
  }

  eliminarTarea(tarea: Tarea): void {
    Swal.fire({ title: '¿Eliminar tarea?', text: `"${tarea.titulo}"`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' })
      .then(r => r.isConfirmed && this.proyectoService.eliminarTarea(tarea.id, this.usuarioId).subscribe({
        next:  () => {
          this.showToast('Tarea eliminada', 'success');
          this._refreshTareasEnBackground();
        },
        error: () => Swal.fire('Error', 'No se pudo eliminar', 'error'),
      }));
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · INLINE CREATE (fila de creación en línea)
  // ════════════════════════════════════════════════════════════════

  abrirFilaInline(actividadId: number | null): void {
    if (!this.detalleProyecto) return;
    // Cancelar edición inline si hay una activa
    this.cancelarEdicionInline();
    this.inlineTaskForm = {
      titulo:               '',
      descripcion:          '',
      estado:               'pendiente',
      fecha_limite_entrega: '',
      actividad_id:         actividadId,
      proyecto_id:          this.detalleProyecto.id,
      asignado_id:          null,
    };
    this.showInlineTask        = true;
    this.showInlineEstado      = false;
    this.showInlineAsignado    = false;
    this.inlineAsignadoBusqueda = '';
    setTimeout(() => {
      const input = this.inlineTaskRowRef?.nativeElement?.querySelector('input[data-inline-title]');
      input?.focus();
    }, 50);
  }

  cancelarFilaInline(): void {
    this.showInlineTask          = false;
    this.showInlineEstado        = false;
    this.showInlineAsignado      = false;
    this.inlineAsignadoBusqueda  = '';
    this.inlineTaskForm = { titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', actividad_id: null, proyecto_id: null, asignado_id: null };
  }

  /**
   * Guarda la tarea inline.
   * – Si el título está vacío cierra la fila sin guardar.
   * – Si hay contenido, guarda en segundo plano y mantiene la fila
   *   abierta para que el usuario pueda crear la siguiente de inmediato.
   */
  guardarTareaInline(): void {
    if (!this.inlineTaskForm.titulo?.trim()) {
      this.cancelarFilaInline();
      return;
    }
    if (this.inlineTaskGuardando) return;
    this.inlineTaskGuardando = true;

    const { actividad_id, proyecto_id, asignado_id } = this.inlineTaskForm;
    const body: any = {
      ...this.inlineTaskForm,
      usuario_id:    this.usuarioId,
      responsables:  asignado_id ? [asignado_id] : [],
      nivel_usuario: 'admin',
    };

    this.proyectoService.crearTarea(body).subscribe({
      next: () => {
        this.inlineTaskGuardando = false;
        // Limpiar forma pero MANTENER fila abierta para la próxima tarea
        this.inlineTaskForm = {
          titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '',
          actividad_id, proyecto_id, asignado_id: null,
        };
        this.showInlineEstado       = false;
        this.showInlineAsignado     = false;
        this.inlineAsignadoBusqueda = '';
        this.showToast('Tarea guardada', 'success');
        this._refreshTareasEnBackground();
        // Re-enfocar el input para entrada consecutiva
        setTimeout(() => {
          const input = this.inlineTaskRowRef?.nativeElement?.querySelector('input[data-inline-title]');
          input?.focus();
        }, 60);
      },
      error: () => {
        this.inlineTaskGuardando = false;
        this.showToast('No se pudo guardar la tarea', 'error');
      },
    });
  }

  onInlineTitleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter')  { event.preventDefault(); this.guardarTareaInline(); }
    if (event.key === 'Escape') { event.preventDefault(); this.cancelarFilaInline(); }
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · INLINE EDIT (edición en línea con el lápiz)
  // ════════════════════════════════════════════════════════════════

  abrirEdicionInline(tarea: any): void {
    // Cancelar creación inline si está activa
    this.cancelarFilaInline();
    this.inlineEditingTaskId      = tarea.id;
    this.inlineEditShowEstado     = false;
    this.showInlineEditAsignado   = false;
    this.inlineEditAsignadoBusqueda = '';
    this.inlineEditForm = {
      titulo:               tarea.titulo,
      descripcion:          tarea.descripcion ?? '',
      estado:               tarea.estado,
      fecha_limite_entrega: this._toDateTimeLocal(tarea.fecha_limite_entrega),
      asignado_id:          tarea.asignado_id ?? tarea.responsable_id ?? null,
    };
    setTimeout(() => {
      const input = this.inlineEditRowRef?.nativeElement?.querySelector('input[data-edit-title]');
      input?.focus();
      // Colocar cursor al final
      if (input) { const len = input.value.length; input.setSelectionRange(len, len); }
    }, 50);
  }

  cancelarEdicionInline(): void {
    this.inlineEditingTaskId       = null;
    this.inlineEditShowEstado      = false;
    this.showInlineEditAsignado    = false;
    this.inlineEditAsignadoBusqueda = '';
    this.inlineEditForm = { titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', asignado_id: null };
  }

  /** Guarda la edición inline (sin modal). Usada también al hacer clic fuera. */
  guardarEdicionInline(): void {
    if (!this.inlineEditingTaskId) return;
    if (!this.inlineEditForm.titulo?.trim()) {
      this.cancelarEdicionInline();
      return;
    }
    const id   = this.inlineEditingTaskId;
    const body = {
      ...this.inlineEditForm,
      estado:        this.inlineEditForm.estado as EstadoTarea,
      usuario_id:    this.usuarioId,
      nivel_usuario: 'admin',
      responsables:  this.inlineEditForm.asignado_id ? [this.inlineEditForm.asignado_id] : [],
    };

    this.cancelarEdicionInline(); // cerrar inmediatamente (optimistic UI)

    this.proyectoService.actualizarTarea(id, body).subscribe({
      next:  () => {
        this.showToast('Tarea actualizada', 'success');
        this._refreshTareasEnBackground();
      },
      error: () => this.showToast('No se pudo actualizar la tarea', 'error'),
    });
  }

  onInlineEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter')  { event.preventDefault(); this.guardarEdicionInline(); }
    if (event.key === 'Escape') { event.preventDefault(); this.cancelarEdicionInline(); }
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · TOAST NOTIFICATIONS
  // ════════════════════════════════════════════════════════════════

  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    const id = ++this._toastCounter;
    this.toasts.push({ id, message, type });
    setTimeout(() => this.toasts = this.toasts.filter(t => t.id !== id), 3500);
  }

  agregarResponsable(u: UsuarioOpcion): void {
    if (!this.responsablesSelec.find(r => r.id === u.id)) this.responsablesSelec = [...this.responsablesSelec, u];
    this.busquedaAsignable = '';
  }
  quitarResponsable(id: number): void {
    this.responsablesSelec = this.responsablesSelec.filter(r => r.id !== id);
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · MODAL PERMISOS GRANULARES
  // ════════════════════════════════════════════════════════════════

  abrirModalPermisos(tipo: 'proyecto' | 'actividad' | 'tarea', id: number): void {
    this.permisosEntidad   = { tipo, id };
    this.permisosActuales  = [];
    this.nuevaAsignacion   = this._nuevoPermisoVacio();
    this.busquedaUsuario   = '';
    this.usuariosFiltrados = [];
    this.showModalPermisos = true;
    this._cargarPermisosEntidad(tipo, id);
    this._cargarUsuariosCache();
  }

  seleccionarUsuarioPermiso(usuario: UsuarioOpcion): void {
    this.nuevaAsignacion.usuario_id = usuario.id;
    this.nuevaAsignacion.nombre     = usuario.nombre;
    this.busquedaUsuario   = usuario.nombre;
    this.usuariosFiltrados = [];
  }

  aplicarPlantilla(permiso: PermisoGranular, plantilla: string): void {
    const tpl = PLANTILLAS_ROL[plantilla];
    if (tpl) Object.assign(permiso, tpl);
  }

  agregarPermiso(): void {
    if (!this.nuevaAsignacion.usuario_id) return;
    const existe = this.permisosActuales.find(p => p.usuario_id === this.nuevaAsignacion.usuario_id);
    if (existe) { Object.assign(existe, { ...this.nuevaAsignacion }); }
    else         { this.permisosActuales = [...this.permisosActuales, { ...this.nuevaAsignacion }]; }
    this.nuevaAsignacion   = this._nuevoPermisoVacio();
    this.busquedaUsuario   = '';
    this.usuariosFiltrados = [];
  }

  quitarPermiso(usuarioId: number): void {
    this.permisosActuales = this.permisosActuales.filter(p => p.usuario_id !== usuarioId);
  }

  guardarPermisos(): void {
    if (!this.permisosEntidad) return;
    const { tipo, id } = this.permisosEntidad;
    this.proyectoService.sincronizarPermisosEntidad(tipo, id, this.usuarioId, this.permisosActuales).subscribe({
      next:  () => { Swal.fire('Guardado', 'Permisos actualizados correctamente', 'success'); this.showModalPermisos = false; },
      error: () => Swal.fire('Error', 'No se pudieron guardar los permisos', 'error'),
    });
  }

  filtrarUsuarios(): void {
    const q = this.busquedaUsuario.toLowerCase().trim();
    if (!q) { this.usuariosFiltrados = []; return; }
    const yaAsignados = new Set(this.permisosActuales.map(p => p.usuario_id));
    this.usuariosFiltrados = this.usuariosCache
      .filter(u => !yaAsignados.has(u.id) && u.nombre.toLowerCase().includes(q))
      .slice(0, 8);
  }

  cerrarModalPermisos(): void { this.showModalPermisos = false; this.permisosEntidad = null; }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · CONFIGURACIÓN SEMÁFOROS
  // ════════════════════════════════════════════════════════════════

  abrirModalConfig(): void {
    this.proyectoService.getConfigSemaforo().subscribe({
      next:  res => { this.configForm = {}; res.data.forEach(c => this.configForm[c.tipo] = { ...c }); this.showModalConfig = true; },
      error: ()  => Swal.fire('Error', 'No se pudo cargar la configuración', 'error'),
    });
  }

  guardarConfig(tipo: string): void {
    const form = this.configForm[tipo];
    if (form.horas_alta >= form.horas_media || form.horas_media >= form.horas_baja) {
      Swal.fire('Validación', 'Las horas deben ser: Urgente < Próximo < A tiempo', 'warning'); return;
    }
    this.proyectoService.updateConfigSemaforo(tipo, form).subscribe({
      next:  () => Swal.fire('Guardado', 'Configuración actualizada', 'success'),
      error: () => Swal.fire('Error', 'No se pudo guardar', 'error'),
    });
  }

  cerrarModalConfig(): void { this.showModalConfig = false; }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · SEGUIMIENTOS ANUALES
  // ════════════════════════════════════════════════════════════════

  cargarSeguimientos(autoOpenMes = false): void {
    this.loadingSeguimientos = true;
    this.proyectoService.getSeguimientos(this.usuarioId).subscribe({
      next:  res => {
        this.seguimientos        = res.data;
        this.loadingSeguimientos = false;
        if (autoOpenMes) this._abrirMesPorDefecto();
      },
      error: ()  => {
        this.loadingSeguimientos = false;
        Swal.fire('Error', 'No se pudieron cargar los seguimientos', 'error');
      },
    });
  }

  abrirModalCrearSeguimiento(): void {
    this.seguimientoForm            = { anio: new Date().getFullYear(), titulo: '' };
    this.participantesSeleccionados = [];
    this.busquedaParticipante       = '';
    this.showModalSeguimiento       = true;
    this._cargarUsuariosParticipantes();
  }

  filtrarParticipantes(): void {
    const q  = this.busquedaParticipante.toLowerCase().trim();
    const ya = new Set(this.participantesSeleccionados.map(p => p.id));
    this.usuariosParticipantes = this.usuariosCache
      .filter(u => u.id !== this.usuarioId && !ya.has(u.id) && (!q || u.nombre.toLowerCase().includes(q)))
      .slice(0, 10);
  }

  agregarParticipante(u: UsuarioOpcion): void {
    if (!this.participantesSeleccionados.find(p => p.id === u.id)) this.participantesSeleccionados = [...this.participantesSeleccionados, u];
    this.busquedaParticipante = '';
    this.filtrarParticipantes();
  }

  quitarParticipante(id: number): void {
    this.participantesSeleccionados = this.participantesSeleccionados.filter(p => p.id !== id);
  }

  guardarSeguimiento(): void {
    if (!this.seguimientoForm.anio) { Swal.fire('Validación', 'El año es requerido', 'warning'); return; }
    this.proyectoService.crearSeguimiento({
      ...this.seguimientoForm,
      usuario_id: this.usuarioId,
      participantes: this.participantesSeleccionados.map(p => p.id),
    }).subscribe({
      next:  (res: any) => { Swal.fire('Éxito', res.message, 'success'); this.showModalSeguimiento = false; this.cargarSeguimientos(); },
      error: () => Swal.fire('Error', 'No se pudo crear el seguimiento', 'error'),
    });
  }

  cerrarSeguimiento(seg: SeguimientoAnual): void {
    Swal.fire({ title: '¿Cerrar seguimiento?', text: 'Ya no se podrán agregar tareas.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, cerrar' })
      .then(r => r.isConfirmed && this.proyectoService.cerrarSeguimiento(seg.id, this.usuarioId).subscribe({
        next:  () => { Swal.fire('Cerrado', 'Seguimiento cerrado', 'success'); this.cargarSeguimientos(); this.cerrarDetalleMes(); },
        error: () => Swal.fire('Error', 'No se pudo cerrar', 'error'),
      }));
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · VISTA MES
  // ════════════════════════════════════════════════════════════════

  abrirMes(seg: SeguimientoAnual, mes: number): void {
    this.seguimientoActual   = seg;
    this.mesActual           = mes;
    this.vistaMes            = null;
    this.showDetalleMes      = true;
    this.vistaCalendario     = false;
    this.filtroUsuariosSelec = [];
    this.filtroTextoUsuario  = '';
    this._cargarVistaMes();
  }

  navegarMes(delta: number): void {
    this.mesActual = ((this.mesActual - 1 + delta + 12) % 12) + 1;
    this._cargarVistaMes();
  }

  cerrarDetalleMes(): void {
    this.showDetalleMes = false;
    this.vistaMes       = null;
    this.calendarioDias = [];
  }

  toggleUsuarioFiltro(uid: number): void {
    const i = this.filtroUsuariosSelec.indexOf(uid);
    i >= 0 ? this.filtroUsuariosSelec.splice(i, 1) : this.filtroUsuariosSelec.push(uid);
  }

  usuarioVisible(uid: number): boolean {
    if (this.filtroUsuariosSelec.length && !this.filtroUsuariosSelec.includes(uid)) return false;
    const q = this.filtroTextoUsuario.toLowerCase().trim();
    return !q || this.nombreUsuario(uid).toLowerCase().includes(q);
  }

  participantesFiltrados(): { id: number; nombre: string }[] {
    const q = this.filtroTextoUsuario.toLowerCase().trim();
    return q ? this.participantesDelSeguimiento.filter(p => p.nombre.toLowerCase().includes(q)) : this.participantesDelSeguimiento;
  }

  cambiarFiltroSeg(estado: string): void {
    this.filtroEstadoSeg    = estado;
    this.tareasSegFiltradas = this._filtrarPorEstado(this.tareasSegPlanas, estado);
    this._initPaginador(this.paginadorSegId, this.tareasSegFiltradas, items => this.tareasSegPaginadas = items);
  }

  cambiarFiltroProy(estado: string): void {
    this.filtroEstadoProy    = estado;
    this.tareasProyFiltradas = this._filtrarPorEstado(this.tareasExternasProyecto, estado);
    this._initPaginador(this.paginadorProyId, this.tareasProyFiltradas, items => this.tareasProyPaginadas = items);
  }

  cambiarFiltroGlpi(estado: string): void {
    this.filtroEstadoGlpi    = estado;
    this.tareasGlpiFiltradas = this._filtrarPorEstado(this.tareasExternasGlpi, estado);
    this._initPaginador(this.paginadorGlpiId, this.tareasGlpiFiltradas, items => this.tareasGlpiPaginadas = items);
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · TAREAS DE SEGUIMIENTO (CRUD)
  // ════════════════════════════════════════════════════════════════

  abrirModalSegTarea(tarea?: SeguimientoTarea): void {
    this.selectedSegTarea = tarea ?? null;
    this.segTareaForm = tarea
      ? { titulo: tarea.titulo, descripcion: tarea.descripcion, estado: tarea.estado, notas: tarea.notas, fecha_limite_entrega: tarea.fecha_limite_entrega, usuario_asignado_id: tarea.usuario_id }
      : { seguimiento_id: this.seguimientoActual?.id, titulo: '', descripcion: '', estado: 'pendiente', notas: '', fecha_limite_entrega: '', usuario_asignado_id: this.vistaMes?.es_gestor ? '' : this.usuarioId };
    this.showModalSegTarea = true;
  }

  abrirModalTareaRapida(seg: SeguimientoAnual): void {
    this.seguimientoActual = seg;
    this.selectedSegTarea  = null;
    this.segTareaForm      = {
      seguimiento_id: seg.id, titulo: '', descripcion: '',
      estado: 'pendiente', notas: '', fecha_limite_entrega: '',
      usuario_asignado_id: seg.es_gestor ? '' : this.usuarioId,
    };
    this.showModalSegTarea = true;
  }

  guardarSegTarea(): void {
    if (!this.segTareaForm.titulo?.trim()) { Swal.fire('Validación', 'El título es obligatorio', 'warning'); return; }
    const body = { ...this.segTareaForm, usuario_id: this.usuarioId };
    const req$ = this.selectedSegTarea
      ? this.proyectoService.actualizarSeguimientoTarea(this.selectedSegTarea.id, body)
      : this.proyectoService.crearSeguimientoTarea(body);
    req$.subscribe({
      next:  (res: any) => { Swal.fire('Éxito', res.message ?? 'Tarea guardada', 'success'); this.showModalSegTarea = false; if (this.showDetalleMes) this._cargarVistaMes(); },
      error: () => Swal.fire('Error', 'No se pudo guardar la tarea', 'error'),
    });
  }

  completarSegTarea(tarea: SeguimientoTarea): void {
    Swal.fire({ title: '¿Marcar como completada?', icon: 'question', showCancelButton: true, confirmButtonText: 'Sí', confirmButtonColor: '#16a34a' })
      .then(r => r.isConfirmed && this.proyectoService.completarSeguimientoTarea(tarea.id, this.usuarioId).subscribe({
        next:  () => this._cargarVistaMes(),
        error: () => Swal.fire('Error', 'No se pudo completar', 'error'),
      }));
  }

  eliminarSegTarea(tarea: SeguimientoTarea): void {
    Swal.fire({ title: '¿Eliminar tarea?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' })
      .then(r => r.isConfirmed && this.proyectoService.eliminarSeguimientoTarea(tarea.id, this.usuarioId).subscribe({
        next:  () => this._cargarVistaMes(),
        error: () => Swal.fire('Error', 'No se pudo eliminar', 'error'),
      }));
  }

  verNotasTarea(tarea: any): void { this.tareaSeleccionada = tarea; this.showModalVerNotas = true; }

  toggleFechaPicker(): void {
    this.showFechaPicker = !this.showFechaPicker;
    if (this.segTareaForm.fecha_limite_entrega) {
      const d = new Date(this.segTareaForm.fecha_limite_entrega);
      this.fechaTemp = d.toISOString().split('T')[0];
      this.horaTemp  = d.toTimeString().slice(0, 5);
    } else {
      const ahora = new Date();
      this.fechaTemp = ahora.toISOString().split('T')[0];
      this.horaTemp  = ahora.toTimeString().slice(0, 5);
    }
    this.showAsignarSelect = false;
    this.showEstadoSelect  = false;
  }

  cerrarFechaPicker(): void {
    if (this.fechaTemp && this.horaTemp) this.segTareaForm.fecha_limite_entrega = `${this.fechaTemp}T${this.horaTemp}`;
    this.showFechaPicker = false;
  }

  actualizarFecha(): void {
    if (this.fechaTemp && this.horaTemp) this.segTareaForm.fecha_limite_entrega = `${this.fechaTemp}T${this.horaTemp}`;
  }

  quitarFecha(): void {
    this.segTareaForm.fecha_limite_entrega = '';
    this.fechaTemp = '';
    this.horaTemp  = '';
    this.showFechaPicker = false;
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · DETALLE SEGUIMIENTO MENSUAL (flujo legacy)
  // ════════════════════════════════════════════════════════════════

  verDetalleSeguimiento(seguimiento: SeguimientoMensual): void {
    this.loadingDetalleSeg      = true;
    this.showDetalleSeguimiento = true;
    this.filtroSemanasSelec     = [];
    this.filtroUsuariosSelec    = [];
    this.filtroTextoUsuario     = '';
    this.vistaCalendario        = false;
    this.proyectoService.getDetalleSeguimiento(seguimiento.id, this.usuarioId).subscribe({
      next:  res => { this.detalleSeguimiento = res.data; this.loadingDetalleSeg = false; this._construirCalendario(); },
      error: ()  => { this.loadingDetalleSeg = false; Swal.fire('Error', 'No se pudo cargar el detalle', 'error'); },
    });
  }

  cerrarDetalleSeguimiento(): void {
    this.showDetalleSeguimiento = false;
    this.detalleSeguimiento     = null;
    this.calendarioDias         = [];
  }

  toggleSemanaFiltro(semanaId: number): void {
    const idx = this.filtroSemanasSelec.indexOf(semanaId);
    idx >= 0 ? this.filtroSemanasSelec.splice(idx, 1) : this.filtroSemanasSelec.push(semanaId);
    this._construirCalendario();
  }

  semanaVisible(semanaId: number): boolean {
    return this.filtroSemanasSelec.length === 0 || this.filtroSemanasSelec.includes(semanaId);
  }

  obtenerTareasSemanaVisibles(semana: SeguimientoSemana): SeguimientoTarea[] {
    if (this._esTareasAgrupadas(semana.tareas)) {
      return (Object.values(semana.tareas ?? {}) as SeguimientoTarea[][])
        .reduce((acc, lista) => acc.concat(lista), [] as SeguimientoTarea[])
        .filter(t => this._puedeVerTareaSeguimiento(t));
    }
    return ((semana.tareas ?? []) as SeguimientoTarea[]).filter(t => this._puedeVerTareaSeguimiento(t));
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · CALENDARIO
  // ════════════════════════════════════════════════════════════════

  _construirCalendarioMes(): void {
    if (!this.vistaMes) return;
    const { mes, anio } = this.vistaMes;
    const hoy = new Date();
    const mapaSeg = this._buildMapaSeguimiento(mes);
    const mapaExt = this._buildMapaExternas();
    this.calendarioDias = this._generarSemanas(mes, anio, hoy, mapaSeg, mapaExt);
  }

  public _construirCalendario(): void {
    if (!this.detalleSeguimiento) return;
    const { mes, anio } = this.detalleSeguimiento;
    const hoy = new Date();
    const mapaSeg = new Map<string, { tarea: SeguimientoTarea; nombreUsuario: string }[]>();
    for (const semana of (this.detalleSeguimiento.semanas ?? []) as any[]) {
      if (!this.semanaVisible(semana.id)) continue;
      const agregar = (t: SeguimientoTarea) => {
        if (!this._puedeVerTareaSeguimiento(t) || !t.fecha_limite_entrega) return;
        const key = new Date(t.fecha_limite_entrega).toDateString();
        (mapaSeg.get(key) ?? (mapaSeg.set(key, []), mapaSeg.get(key)!)).push({ tarea: t, nombreUsuario: this.nombreUsuario(t.usuario_id) });
      };
      if (this._esTareasAgrupadas(semana.tareas)) Object.values(semana.tareas as Record<string, SeguimientoTarea[]>).forEach(l => l.forEach(agregar));
      else ((semana.tareas ?? []) as SeguimientoTarea[]).forEach(agregar);
    }
    this.calendarioDias = this._generarSemanas(mes, anio, hoy, mapaSeg, new Map());
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · HELPERS TEMPLATE
  // ════════════════════════════════════════════════════════════════

  esTareasAgrupadas(tareas: any): tareas is { [k: string]: SeguimientoTarea[] } {
    return tareas != null && !Array.isArray(tareas);
  }
  idsUsuariosEnMes(tareas: any): string[]        { return tareas ? Object.keys(tareas) : []; }
  tareasDeUsuarioEnMes(tareas: any, uid: string): SeguimientoTarea[] { return tareas?.[uid] ?? []; }
  tareasDeUsuario(tareas: any, uid: string): SeguimientoTarea[]      { return tareas?.[uid] ?? []; }
  idsUsuariosEnSemana(tareas: any): string[]     { return tareas ? Object.keys(tareas) : []; }

  _totalTareasAgrupadas(tareas: any): number {
    return this._esTareasAgrupadas(tareas)
      ? Object.values(tareas as Record<string, SeguimientoTarea[]>).reduce((acc, l) => acc + l.length, 0)
      : (tareas as SeguimientoTarea[]).length;
  }

  objectKeys(obj: any): string[] { return Object.keys(obj); }

  // ════════════════════════════════════════════════════════════════
  // MÉTODOS PRIVADOS
  // ════════════════════════════════════════════════════════════════

  /**
   * Refresca tareas/actividades del proyecto en segundo plano
   * SIN mostrar spinner ni resetear estado del modal.
   */
  private _refreshTareasEnBackground(): void {
    if (!this.detalleProyecto) return;
    this.proyectoService.obtenerDetalleProyecto(this.detalleProyecto.id, this.usuarioId).subscribe({
      next: (res: any) => {
        if (!this.detalleProyecto) return;
        // Actualizar solo datos de tareas (no tocar actividadExpandidaId, scroll, etc.)
        if (!this.inlineEditingTaskId) {
          this.detalleProyecto.actividades          = res.data.actividades ?? [];
          this.detalleProyecto.tareas_sin_actividad = res.data.tareas_sin_actividad ?? [];
        }
        // Siempre actualizar contadores y progreso
        this.detalleProyecto.total_tareas       = res.data.total_tareas;
        this.detalleProyecto.total_actividades  = res.data.total_actividades;
        this.detalleProyecto.tareas_completadas = res.data.tareas_completadas;
        this.detalleProyecto.tareas_vencidas    = res.data.tareas_vencidas;
        this.detalleProyecto.progreso           = res.data.progreso;
      },
      error: () => {} // silencioso
    });
  }

  private _ordenarProyectos(proyectos: Proyecto[]): Proyecto[] {
    const SIN_FECHA = Number.MAX_SAFE_INTEGER;
    const fecha = (p: Proyecto) =>
      p.fecha_limite_entrega ? new Date(p.fecha_limite_entrega).getTime() : SIN_FECHA;
    return [...proyectos].sort((a, b) => {
      const aEjecucion = a.estado === 'en_ejecucion';
      const bEjecucion = b.estado === 'en_ejecucion';
      if (aEjecucion && !bEjecucion) return -1;
      if (!aEjecucion && bEjecucion) return  1;
      return fecha(a) - fecha(b);
    });
  }

  private _loadAssets(): void {
    const addLink = (href: string) => {
      const l = this.document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      this.document.head.appendChild(l);
    };
    addLink('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');
    addLink('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css');
  }

  private _toDateTimeLocal(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  private _prioridadTarea(tarea: any, ahora: Date): number {
    if (tarea.estado === 'completado') return 3;
    if (tarea.fecha_limite_entrega && new Date(tarea.fecha_limite_entrega) < ahora) return 1;
    return 2;
  }

  private _nuevoPermisoVacio(): PermisoGranular {
    return { usuario_id: 0, nombre: '', puede_crear: false, puede_editar: false, puede_eliminar: false, puede_asignar: false, puede_cambiar_fechas: false, puede_gestionar_permisos: false };
  }

  private _esTareasAgrupadas(tareas: any): tareas is Record<string, SeguimientoTarea[]> {
    return tareas != null && !Array.isArray(tareas);
  }

  private _puedeVerTareaSeguimiento(tarea: SeguimientoTarea): boolean {
    const esGestor = this.detalleSeguimiento?.es_gestor === true || this.puedeGestionarModulo;
    return (esGestor || tarea.usuario_id === this.usuarioId) && this.usuarioVisible(tarea.usuario_id);
  }

  private _iniciales(uid: number): string {
    return this.nombreUsuario(uid).split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
  }

  private _semaforoDominante(s: string[]): string {
    if (s.includes('rojo'))     return 'rojo';
    if (s.includes('amarillo')) return 'amarillo';
    if (s.includes('verde'))    return 'verde';
    return 'gris';
  }

  private _filtrarPorEstado<T extends { estado: string }>(tareas: T[], estado: string): T[] {
    return estado === 'todos' ? tareas : tareas.filter(t => t.estado === estado);
  }

  private _initPaginador<T>(id: string, items: T[], cb: (page: T[]) => void): void {
    this.paginationService.initializePaginator(id, items, 5, null, null)
      .subscribe(state => cb(state.currentData));
  }

  private _abrirMesPorDefecto(): void {
    if (!this.seguimientos.length) return;
    const anioActual = new Date().getFullYear();
    this.mesActual   = new Date().getMonth() + 1;
    const seg = this.seguimientos.find(s => s.anio === anioActual) ?? this.seguimientos[0];
    if (seg) this.abrirMes(seg, this.mesActual);
  }

  private _cargarVistaMes(): void {
    if (!this.seguimientoActual) return;
    this.loadingVistaMes   = true;
    this.tareasExternasMes = [];
    const anio = this.seguimientoActual.anio;

    this.proyectoService.getVistaMes(this.seguimientoActual.id, this.mesActual, this.usuarioId).subscribe({
      next: (mes) => {
        this.vistaMes = mes.data;
        (mes.data.participantes_info ?? []).forEach((p: any) => {
          if (!this.usuariosCache.find(u => u.id === p.id)) this.usuariosCache.push({ id: p.id, nombre: p.nombre });
        });
        this._inicializarPaginadorSeguimiento();

        const uids: number[] = this.vistaMes.es_gestor
          ? (this.vistaMes.participantes_info ?? []).map((p: any) => p.id)
          : [this.usuarioId];

        if (!uids.length) {
          this.loadingVistaMes = false;
          this._inicializarPaginadoresExternos();
          if (this.vistaCalendario) this._construirCalendarioMes();
          return;
        }

        forkJoin(
          uids.map(uid => this.proyectoService.getTareasConsolidadas(uid, this.mesActual, anio, ['proyecto', 'glpi']))
        ).subscribe({
          next: (resps: any[]) => {
            this.tareasExternasMes = resps.reduce((acc, r) => acc.concat(r.data ?? []), [] as TareaConsolidada[]);
            this.loadingVistaMes   = false;
            this._inicializarPaginadoresExternos();
            if (this.vistaCalendario) this._construirCalendarioMes();
          },
          error: () => {
            this.loadingVistaMes = false;
            this._inicializarPaginadoresExternos();
            Swal.fire('Error', 'No se pudo cargar tareas externas', 'error');
          },
        });
      },
      error: () => {
        this.loadingVistaMes = false;
        Swal.fire('Error', 'No se pudo cargar el mes', 'error');
      },
    });
  }

  private _inicializarPaginadorSeguimiento(): void {
    const todasSeg = this.tareasSegPlanas;
    this.filtroEstadoSeg    = todasSeg.some(t => t.estado === 'pendiente') ? 'pendiente' : 'en_ejecucion';
    this.tareasSegFiltradas = this._filtrarPorEstado(todasSeg, this.filtroEstadoSeg);
    this._initPaginador(this.paginadorSegId, this.tareasSegFiltradas, items => this.tareasSegPaginadas = items);
  }

  private _inicializarPaginadoresExternos(): void {
    const todasProy = this.tareasExternasProyecto;
    this.filtroEstadoProy    = todasProy.some(t => t.estado === 'pendiente') ? 'pendiente' : 'en_ejecucion';
    this.tareasProyFiltradas = this._filtrarPorEstado(todasProy, this.filtroEstadoProy);
    this._initPaginador(this.paginadorProyId, this.tareasProyFiltradas, items => this.tareasProyPaginadas = items);

    const todasGlpi = this.tareasExternasGlpi;
    this.filtroEstadoGlpi    = todasGlpi.some(t => t.estado === 'pendiente') ? 'pendiente' : 'en_progreso';
    this.tareasGlpiFiltradas = this._filtrarPorEstado(todasGlpi, this.filtroEstadoGlpi);
    this._initPaginador(this.paginadorGlpiId, this.tareasGlpiFiltradas, items => this.tareasGlpiPaginadas = items);
  }

  private _inicializarPaginadorTarjetas(): void {
      const instanceId = 'proyectos-tarjetas';
      this.paginationService.initializePaginator(instanceId, this.proyectos, 3, null, null)
          .subscribe(state => this.proyectosPaginados = state.currentData);
  }

  private _inicializarPaginadorLista(): void {
      const instanceId = 'proyectos-lista';
      this.paginationService.initializePaginator(instanceId, this.proyectos, 10, null, null)
          .subscribe(state => this.proyectosPaginados = state.currentData);
  }

  private _cargarPermisosEntidad(tipo: 'proyecto' | 'actividad' | 'tarea', id: number): void {
    this.proyectoService.getPermisosEntidad(tipo, id, this.usuarioId).subscribe({
      next: res => {
        this.permisosActuales = res.data.map(p => ({
          ...p,
          nombre: this.usuariosCache.find(u => u.id === p.usuario_id)?.nombre,
        }));
      },
    });
  }

  private _cargarUsuariosAsignables(): void {
    if (this.usuariosCache.length) { this.usuariosAsignables = [...this.usuariosCache]; return; }
    this.userService.getAll().subscribe({
      next: (us: any[]) => {
        this.usuariosCache      = us.map(u => ({ id: u.id, nombre: u.nombre_completo || `${u.firstName} ${u.lastName}`.trim() }));
        this.usuariosAsignables = [...this.usuariosCache];
      },
    });
  }

  private _cargarUsuariosCache(): void {
    if (this.usuariosCache.length) return;
    this.loadingUsuarios = true;
    this.userService.getAll().subscribe({
      next: (usuarios: any[]) => {
        this.usuariosCache    = usuarios.map(u => ({ id: u.id, nombre: u.nombre_completo || `${u.firstName} ${u.lastName}`.trim() }));
        this.permisosActuales = this.permisosActuales.map(p => ({ ...p, nombre: this.usuariosCache.find(u => u.id === p.usuario_id)?.nombre ?? p.nombre }));
        this.loadingUsuarios  = false;
      },
      error: () => { this.loadingUsuarios = false; },
    });
  }

  private _cargarUsuariosParticipantes(): void {
    if (this.usuariosCache.length) { this.usuariosParticipantes = [...this.usuariosCache]; return; }
    this.loadingParticipantes = true;
    this.userService.getAll().subscribe({
      next: (us: any[]) => {
        this.usuariosCache         = us.map(u => ({ id: u.id, nombre: u.nombre_completo || `${u.firstName} ${u.lastName}`.trim() }));
        this.usuariosParticipantes = [...this.usuariosCache];
        this.loadingParticipantes  = false;
      },
      error: () => { this.loadingParticipantes = false; },
    });
  }

  private _buildMapaSeguimiento(mes: number): Map<string, { tarea: SeguimientoTarea; nombreUsuario: string }[]> {
    const mapa = new Map<string, { tarea: SeguimientoTarea; nombreUsuario: string }[]>();
    const agregar = (t: SeguimientoTarea) => {
      if (!this.usuarioVisible(t.usuario_id)) return;
      const fecha = t.estado === 'completado' ? t.fecha_completado : t.fecha_limite_entrega;
      if (!fecha) return;
      const key = new Date(fecha).toDateString();
      (mapa.get(key) ?? (mapa.set(key, []), mapa.get(key)!)).push({ tarea: t, nombreUsuario: this.nombreUsuario(t.usuario_id) });
    };
    if (this._esTareasAgrupadas(this.vistaMes?.tareas)) {
      Object.values(this.vistaMes!.tareas as Record<string, SeguimientoTarea[]>).forEach(l => l.forEach(agregar));
    } else {
      ((this.vistaMes?.tareas ?? []) as SeguimientoTarea[]).forEach(agregar);
    }
    return mapa;
  }

  private _buildMapaExternas(): Map<string, TareaConsolidada[]> {
    const mapa = new Map<string, TareaConsolidada[]>();
    this.tareasExternasMes.forEach(t => {
      if (!this.usuarioVisible(t.usuario_id)) return;
      const fecha = t.estado === 'completado' ? t.fecha_completado : t.fecha_limite_entrega;
      if (!fecha) return;
      const key = new Date(fecha).toDateString();
      (mapa.get(key) ?? (mapa.set(key, []), mapa.get(key)!)).push(t);
    });
    return mapa;
  }

  private _generarSemanas(
    mes: number, anio: number, hoy: Date,
    mapaSeg: Map<string, { tarea: SeguimientoTarea; nombreUsuario: string }[]>,
    mapaExt: Map<string, TareaConsolidada[]>,
  ): CalendarioDia[][] {
    const primerDia  = new Date(anio, mes - 1, 1);
    const offset     = (primerDia.getDay() + 6) % 7;
    const cursor     = new Date(primerDia);
    cursor.setDate(primerDia.getDate() - offset);
    const semanas: CalendarioDia[][] = [];

    for (let s = 0; s < 6; s++) {
      const fila: CalendarioDia[] = [];
      for (let d = 0; d < 7; d++) {
        const key            = cursor.toDateString();
        const tareasDelDia   = mapaSeg.get(key) ?? [];
        const externasDelDia = mapaExt.get(key) ?? [];
        const agrupado       = new Map<number, { total: number; completadas: number; semaforos: string[]; countSeguimiento: number; countProyecto: number; countGlpi: number }>();

        tareasDelDia.forEach(({ tarea }) => {
          const r = agrupado.get(tarea.usuario_id) ?? { total: 0, completadas: 0, semaforos: [], countSeguimiento: 0, countProyecto: 0, countGlpi: 0 };
          r.total++; r.countSeguimiento++;
          if (tarea.estado === 'completado') r.completadas++;
          if (tarea.semaforo) r.semaforos.push(tarea.semaforo);
          agrupado.set(tarea.usuario_id, r);
        });

        externasDelDia.forEach(t => {
          const r = agrupado.get(t.usuario_id) ?? { total: 0, completadas: 0, semaforos: [], countSeguimiento: 0, countProyecto: 0, countGlpi: 0 };
          r.total++;
          if (t.origen === 'proyecto') r.countProyecto++;
          else if (t.origen === 'glpi') r.countGlpi++;
          if (t.estado === 'completado') r.completadas++;
          if (t.semaforo) r.semaforos.push(t.semaforo);
          agrupado.set(t.usuario_id, r);
        });

        fila.push({
          fecha:        new Date(cursor),
          esHoy:        key === hoy.toDateString(),
          esMesActual:  cursor.getMonth() === mes - 1,
          tareas:       tareasDelDia,
          tareasExternas: externasDelDia,
          resumenPorUsuario: Array.from(agrupado.entries()).map(([uid, r]) => ({
            uid, iniciales: this._iniciales(uid), nombre: this.nombreUsuario(uid),
            total: r.total, completadas: r.completadas, semaforo: this._semaforoDominante(r.semaforos),
            countSeguimiento: r.countSeguimiento, countProyecto: r.countProyecto, countGlpi: r.countGlpi,
          })),
        });

        cursor.setDate(cursor.getDate() + 1);
      }
      semanas.push(fila);
    }
    return semanas;
  }
}