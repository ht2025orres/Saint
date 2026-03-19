import { Component, OnInit, Inject, HostListener, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  ProyectoService,
  Proyecto, Actividad, Tarea,
  SeguimientoMensual, SeguimientoSemana, SeguimientoTarea,
  ConfiguracionSemaforo, PermisoGranular, MisPermisos, Semaforo, NivelTarea,
  SeguimientoAnual,
  VistaMes, TareaConsolidada, EstadoTarea,
  Informe, InformeTarea, EstadoInforme, TipoInforme, NivelImpacto,
  Compromiso, FlujoDiario,
} from 'src/app/services/proyectos.service';
import { UserService }      from 'src/app/services/user.service';
import { AuthService }      from 'src/app/services/auth.service';
import { PaginationService } from 'src/app/shared/pagination/pagination.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import { forkJoin } from 'rxjs';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface UsuarioOpcion { id: number; nombre: string; }

interface CargaPersonaFlujo {
  usuario_id: number;
  nombre: string;
  total: number;
  completados: number;
  en_ejecucion: number;
  pendientes: number;
  compromisos: Compromiso[];
}

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
  tareasInforme:  (InformeTarea & { nombreUsuario: string })[];
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
  countInforme:      number;
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
  @ViewChild('richEditor')           richEditorRef!:     ElementRef;
  @ViewChild('filtroInformeContainer') filtroInformeRef!: ElementRef;

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

  vista: 'proyectos' | 'seguimientos' | 'informes' = 'proyectos';
  vistaProyectos: 'tarjetas' | 'lista' = 'tarjetas';
  vistaTareas = true;

  proyectos:  Proyecto[] = [];
  loading     = false;
  filtroEstado = 'todos';
  busquedaProyectos = '';

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN 3 · MODAL: PROYECTO
  // ════════════════════════════════════════════════════════════════

  showModalProyecto  = false;
  modalProyectoTitle = '';
  proyectoForm: any  = {};
  selectedProyecto: Proyecto | null = null;
  proyectosPaginados: Proyecto[] = [];
  calculandoFechas = false;

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
  // ── Modal: Asignar usuario a actividad ──────────────────────────────────────
  showModalAsignarActividad  = false;
  asignarActividadId: number | null = null;
  asignarActividadGuardando  = false;
  asignarActividadForm: { asignado_id: number | null; nivel: string; busqueda: string } =
  { asignado_id: null, nivel: 'viewer', busqueda: '' };
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
  usuariosMap: Map<number, string> = new Map();

  // ── EVIDENCIAS ──────────────────────────────────────────────────────────
  showModalEvidencia  = false;
  evidenciaEntidad: { tipo: 'tarea' | 'seguimiento_tarea'; id: number; titulo: string } | null = null;
  evidencias: any[]   = [];
  loadingEvidencias   = false;
  subiendoEvidencia   = false;
  showModalPreviewEvidencia = false;
  previewEvidencia: { url: string | SafeResourceUrl; tipo_mime: string; nombre_archivo: string } | null = null;
  loadingPreview = false;

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
  vistaCalendarioModo: 'mes' | 'semana' | 'dia' = 'mes';
  fechaCalendarioActiva: Date = new Date();
  calendarioDias: CalendarioDia[][] = [];

  filtroGlobalEstado: string = 'pendiente';
  filtroEstadosGlobal: string[] = ['pendiente'];
  showFiltroEstadosGlobal = false;
  showFiltroPersonas: boolean = false;

  vistaFlujo = false;
  loadingFlujo = false;
  flujoActivo: FlujoDiario | null = null;
  flujosHistorial: FlujoDiario[] = [];
  showHistorialFlujos = false;
  showModalFlujoDiario = false;
  flujoDiarioForm = { titulo: '', fecha: '' };
  showModalCompromisoFlujo = false;
  compromisoFlujoTitulo = 'Nuevo compromiso';
  compromisoForm = { id: null as number | null, titulo: '', descripcion: '', responsables: [] as number[] };

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

  responsablesSegSelec: UsuarioOpcion[] = [];
  showAsignarSegSelect: boolean = false;
  busquedaResponsableSeg: string = '';

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN 11 · INFORMES
  // ════════════════════════════════════════════════════════════════

  // ── Estado listado ────────────────────────────────────────────────────────
  informes: Informe[] = [];
  loadingInformes      = false;
  filtroEstadoInforme  = 'todos';
  busquedaInformes     = '';
  vistaInformes: 'tarjetas' | 'lista' = 'tarjetas';
 
  informesPaginados: Informe[] = [];
  misTareasInforme: InformeTarea[] = [];
  loadingMisTareasInforme = false;

  // Tareas de informes en vista mes
  tareasInformeMesList:   InformeTarea[] = [];
  tareasInformeFiltradas: InformeTarea[] = [];
  tareasInformePaginadas: InformeTarea[] = [];
  filtroEstadoInformeMes  = 'pendiente';
  showFiltroInformeMes    = false;
  readonly paginadorInformeMesId = 'informe-tareas-mes';
  
  // Modal detalle día (calendario)
  showDayModal     = false;
  selectedDayData: CalendarioDia | null = null;
  
  // Editor enriquecido (tab Documentos)
  tabDocumentosContent = '';
  showTableInsert      = false;
  tableInsertRows      = 3;
  tableInsertCols      = 3;
 
  // ── Modal detalle informe ─────────────────────────────────────────────────
  showDetalleInformeModal  = false;
  loadingDetalleInforme    = false;
  detalleInforme: Informe | null = null;
  tabInforme: 'tareas' | 'analisis' | 'plan' | 'documentos' = 'tareas';
 
  // ── Modal crear/editar informe ────────────────────────────────────────────
  showModalInforme  = false;
  modalInformeTitulo = '';
  selectedInforme: Informe | null = null;
  informeForm: any = {};
 
  // ── Inline task en detalle de informe ─────────────────────────────────────
  showInlineInformeTarea    = false;
  inlineInformeTareaGuardando = false;
  inlineInformeTareaForm: {
    titulo: string; descripcion: string; estado: string;
    fecha_limite_entrega: string; responsable_id: number | null;
  } = { titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', responsable_id: null };
 
  showInlineInformeTareaEstado     = false;
  showInlineInformeTareaResponsable = false;
  inlineInformeTareaResponsableBusqueda = '';
 
  // ── Edición inline de tarea de informe ────────────────────────────────────
  inlineEditInformeTareaId: number | null = null;
  inlineEditInformeTareaForm: {
    titulo: string; descripcion: string; estado: string;
    fecha_limite_entrega: string; responsable_id: number | null;
  } = { titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', responsable_id: null };
  showInlineEditInformeTareaEstado     = false;
  showInlineEditInformeTareaResponsable = false;
  inlineEditInformeTareaResponsableBusqueda = '';
 
  // ── Lookups ───────────────────────────────────────────────────────────────
  readonly tiposInforme: TipoInforme[] = [
    'Incidente', 'Hallazgo de Auditoría', 'Riesgo Tecnológico',
    'Vulnerabilidad de Seguridad', 'Mejora del Proceso',
  ];
  readonly nivelesImpacto: NivelImpacto[] = ['Crítico', 'Alto', 'Medio', 'Bajo'];

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
  inlineEditOriginalForm: { titulo: string; descripcion: string; estado: string; fecha_limite_entrega: string; asignado_id: number | null } | null = null;
  inlineEditInformeTareaOriginalForm: { titulo: string; descripcion: string; estado: string; fecha_limite_entrega: string; responsable_id: number | null } | null = null;
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
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
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
    const esOwner = t.usuario_id === this.usuarioId || (t.responsables ?? []).includes(this.usuarioId);
    return !!this.vistaMes && this.vistaMes.estado === 'activo'
      && (this.vistaMes.es_gestor || esOwner);
  }
  puedeEliminarSegTarea(t: SeguimientoTarea): boolean {
    const esOwner = t.usuario_id === this.usuarioId || (t.responsables ?? []).includes(this.usuarioId);
    return !!(this.vistaMes?.es_gestor || esOwner);
  }
  puedeCompletarSegTarea(t: SeguimientoTarea): boolean {
    const esOwner = t.usuario_id === this.usuarioId || (t.responsables ?? []).includes(this.usuarioId);
    return t.estado !== 'completado' && !!(this.vistaMes?.es_gestor || esOwner);
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · GETTERS DE DATOS DERIVADOS
  // ════════════════════════════════════════════════════════════════

  get proyectosFiltrados(): Proyecto[] {
    if (!this.busquedaProyectos.trim()) {
      return this.proyectos;
    }
    const busqueda = this.busquedaProyectos.toLowerCase().trim();
    return this.proyectos.filter(p => 
      p.titulo.toLowerCase().includes(busqueda) || 
      (p.descripcion && p.descripcion.toLowerCase().includes(busqueda))
    );
  }

  get responsablesSegFiltrados(): UsuarioOpcion[] {
    const q       = this.busquedaResponsableSeg.toLowerCase().trim();
    const ids     = new Set(this.responsablesSegSelec.map(r => r.id));
    const partic  = this.vistaMes?.participantes_info ?? [];
    return partic
      .filter(p => !ids.has(p.id) && (!q || p.nombre.toLowerCase().includes(q)))
      .slice(0, 8);
  }

  get selectedDaySegTareasPlanas(): SeguimientoTarea[] {
    return this.selectedDayTareasSeg.map(i => i.tarea);
  }

  // Método para obtener iniciales usando usuariosCache
  getInicialesResponsable(usuarioId: number): string {
    if (!usuarioId) return '??';
    
    const usuario = this.usuariosCache.find(u => u.id === usuarioId);
    if (!usuario) return '??';
    
    const nombreCompleto = usuario.nombre;
    if (!nombreCompleto) return '??';
    
    // Obtener primera letra del primer nombre y primer apellido
    const partes = nombreCompleto.split(' ').filter(p => p.length > 0);
    
    if (partes.length === 0) return '??';
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    
    // Primera letra del primer nombre + primera letra del segundo nombre (si existe)
    // o primera letra del primer apellido
    const primeraLetra = partes[0].charAt(0).toUpperCase();
    const segundaLetra = partes.length > 1 ? partes[1].charAt(0).toUpperCase() : '';
    
    return primeraLetra + segundaLetra;
  }

  // Método para obtener el color de fondo basado en el ID (para tener variedad de colores)
  getColorPorId(id: number): string {
    const colores = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500',
    ];
    return colores[id % colores.length];
  }

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

  get compromisosFiltrados(): Compromiso[] {
    return (this.flujoActivo?.compromisos ?? []).filter(c => this._compromisoVisible(c));
  }

  get compromisosCompletados(): number {
    return this.compromisosFiltrados.filter(c => c.estado === 'completado').length;
  }

  get compromisosEnEjecucion(): number {
    return this.compromisosFiltrados.filter(c => c.estado === 'en_ejecucion').length;
  }

  get compromisosPendientes(): number {
    return this.compromisosFiltrados.filter(c => c.estado === 'pendiente').length;
  }

  get compromisosDiaAnterior(): Array<{ id: number; titulo: string; estado: string; responsables: number[]; fecha_inicio?: string | null; fecha_completado?: string | null }> {
    return (this.flujoActivo?.snapshot_apertura?.compromisos ?? []).filter(c => {
      const coincideEstado = !this.filtroEstadosGlobal.length || this.filtroEstadosGlobal.includes(c.estado);
      const coincideUsuario = !this.filtroUsuariosSelec.length || (c.responsables ?? []).some(rid => this.filtroUsuariosSelec.includes(rid));
      return coincideEstado && coincideUsuario;
    });
  }

  get compromisosPorPersona(): CargaPersonaFlujo[] {
    return this._agruparCompromisosPorPersona(this.compromisosFiltrados);
  }

  get cargaAnteriorPorPersona(): CargaPersonaFlujo[] {
    const compromisosBase = (this.flujoActivo?.snapshot_apertura?.compromisos ?? []).map(compromiso => ({
      id: compromiso.id,
      flujo_id: this.flujoActivo?.id ?? 0,
      titulo: compromiso.titulo,
      descripcion: null,
      estado: compromiso.estado as Compromiso['estado'],
      responsables: compromiso.responsables ?? [],
      notas: null,
      fecha_inicio: compromiso.fecha_inicio ?? null,
      fecha_completado: compromiso.fecha_completado ?? null,
      created_at: compromiso.fecha_inicio ?? this.flujoActivo?.fecha ?? '',
      updated_at: compromiso.fecha_completado ?? compromiso.fecha_inicio ?? this.flujoActivo?.fecha ?? '',
    }));

    return this._agruparCompromisosPorPersona(compromisosBase.filter(c => this._compromisoVisible(c)));
  }

  get cargaMaximaComparativa(): number {
    return Math.max(
      ...this.compromisosPorPersona.map(p => p.total),
      ...this.cargaAnteriorPorPersona.map(p => p.total),
      1,
    );
  }

  get selectedDayTareasSeg(): { tarea: SeguimientoTarea; nombreUsuario: string }[] {
    if (!this.selectedDayData) return [];
    return this.vistaMes?.es_gestor
      ? this.selectedDayData.tareas
      : this.selectedDayData.tareas.filter(t => t.tarea.usuario_id === this.usuarioId);
  }
  get selectedDayTareasProyecto(): TareaConsolidada[] {
    return this.selectedDayData?.tareasExternas.filter(t => t.origen === 'proyecto') ?? [];
  }
  get selectedDayTareasGlpi(): TareaConsolidada[] {
    return this.selectedDayData?.tareasExternas.filter(t => t.origen === 'glpi') ?? [];
  }
  get selectedDayTareasInforme(): (InformeTarea & { nombreUsuario: string })[] {
    return this.selectedDayData?.tareasInforme ?? [];
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

    if (this.showFiltroEstadosGlobal && !target.closest('[data-filtro-estados-global]')) {
      this.showFiltroEstadosGlobal = false;
    }
    // Cerrar filtro de personas
    if (this.showFiltroPersonas && !target.closest('[data-filtro-personas]')) {
      this.showFiltroPersonas = false;
    }
    // Cerrar selector de responsables de seguimiento
    if (this.showAsignarSegSelect && !target.closest('[data-asignar-seg]')) {
      this.showAsignarSegSelect = false;
    }

    // ============================================================
    // Cerrar dropdowns del formulario de tarea de seguimiento
    // ============================================================
    if (!target.closest('.relative.group')) {
      this.showAsignarSelect = false;
      this.showEstadoSelect  = false;
      this.showFechaPicker   = false;
    }

    // ============================================================
    // Cerrar filtros de sección (vista mes)
    // ============================================================
    if (this.filtroSegRef  && !this.filtroSegRef.nativeElement.contains(target))  this.showFiltroSeg  = false;
    if (this.filtroProyRef && !this.filtroProyRef.nativeElement.contains(target)) this.showFiltroProy = false;
    if (this.filtroGlpiRef && !this.filtroGlpiRef.nativeElement.contains(target)) this.showFiltroGlpi = false;
    
    // Cerrar filtro de informes en vista mes
    if (this.filtroInformeRef && !this.filtroInformeRef.nativeElement.contains(target)) {
      this.showFiltroInformeMes = false;
    }

    // ============================================================
    // Cerrar dropdowns inline (creación y edición) - PROYECTOS
    // ============================================================
    
    // Dropdown de estado inline (creación)
    if (this.showInlineEstado && !target.closest('[data-inline-estado]')) {
      this.showInlineEstado = false;
    }
    
    // Dropdown de asignado inline (creación)
    if (this.showInlineAsignado && !target.closest('[data-inline-asignado]')) {
      this.showInlineAsignado = false;
    }

    // Dropdown de estado inline (edición)
    if (this.inlineEditShowEstado && !target.closest('[data-inline-edit-estado]')) {
      this.inlineEditShowEstado = false;
    }
    
    // Dropdown de asignado inline (edición)
    if (this.showInlineEditAsignado && !target.closest('[data-inline-edit-asignado]')) {
      this.showInlineEditAsignado = false;
    }

    // ============================================================
    // Cerrar dropdowns inline - INFORMES
    // ============================================================
    
    // Dropdown de estado inline (creación de tarea de informe)
    if (this.showInlineInformeTareaEstado && !target.closest('[data-inline-informe-estado]')) {
      this.showInlineInformeTareaEstado = false;
    }
    
    // Dropdown de responsable inline (creación de tarea de informe)
    if (this.showInlineInformeTareaResponsable && !target.closest('[data-inline-informe-responsable]')) {
      this.showInlineInformeTareaResponsable = false;
    }

    // Dropdown de estado inline (edición de tarea de informe)
    if (this.showInlineEditInformeTareaEstado && !target.closest('[data-inline-edit-informe-estado]')) {
      this.showInlineEditInformeTareaEstado = false;
    }
    
    // Dropdown de responsable inline (edición de tarea de informe)
    if (this.showInlineEditInformeTareaResponsable && !target.closest('[data-inline-edit-informe-responsable]')) {
      this.showInlineEditInformeTareaResponsable = false;
    }

    // ============================================================
    // GUARDAR/CANCELAR FILA DE CREACIÓN INLINE (PROYECTOS)
    // ============================================================
    if (this.showInlineTask) {
      const inlineTaskRow = document.querySelector('[data-inline-task-row]');
      // Si el clic fue fuera de la fila de creación
      if (inlineTaskRow && !inlineTaskRow.contains(target)) {
        // Si hay título, guardar; si no, cancelar
        if (this.inlineTaskForm.titulo?.trim()) {
          this.guardarTareaInline();
        } else {
          this.cancelarFilaInline();
        }
      }
    }

    // ============================================================
    // GUARDAR/CANCELAR FILA DE EDICIÓN INLINE (PROYECTOS)
    // ============================================================
    if (this.inlineEditingTaskId) {
      // querySelectorAll para encontrar TODOS los rows activos, no solo el primero
      const editRows = document.querySelectorAll('[data-inline-edit-row]');
      const isInsideAnyEditRow = Array.from(editRows).some(row => row.contains(target));
      
      if (!isInsideAnyEditRow
        && !target.closest('[data-inline-edit-estado]')
        && !target.closest('[data-inline-edit-asignado]')) {
        
        if (this.inlineEditForm.titulo?.trim() && this._inlineEditHasChanges()) {
          this.guardarEdicionInline();
        } else {
          this.cancelarEdicionInline();
        }
      }
    }

    // ============================================================
    // GUARDAR/CANCELAR FILA DE CREACIÓN INLINE (INFORMES)
    // ============================================================
    if (this.showInlineInformeTarea) {
      // Buscar específicamente la fila de creación de informe
      const inlineInformeTaskRow = document.querySelector('[data-inline-informe-task-row]');
      if (inlineInformeTaskRow && !inlineInformeTaskRow.contains(target)) {
        if (this.inlineInformeTareaForm.titulo?.trim()) {
          this.guardarInlineInformeTarea();
        } else {
          this.cancelarInlineInformeTarea();
        }
      }
    }

    // ============================================================
    // GUARDAR/CANCELAR FILA DE EDICIÓN INLINE (INFORMES)
    // ============================================================
    if (this.inlineEditInformeTareaId) {
      const informeEditRows = document.querySelectorAll('[data-inline-edit-informe-row]');
      const isInsideAnyInformeEditRow = Array.from(informeEditRows).some(row => row.contains(target));
      
      if (!isInsideAnyInformeEditRow
        && !target.closest('[data-inline-edit-informe-estado]')
        && !target.closest('[data-inline-edit-informe-responsable]')) {
        
        if (this.inlineEditInformeTareaForm.titulo?.trim() && this._inlineEditInformeHasChanges()) {
          this.guardarInlineEditInformeTarea();
        } else {
          this.cancelarInlineEditInformeTarea();
        }
      }
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
        
        // Limpiar búsqueda al cambiar filtros (opcional, puedes quitarlo si prefieres mantenerla)
        this.busquedaProyectos = '';
        
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

  cambiarVista(v: 'proyectos' | 'seguimientos' | 'informes'): void {
    // Si ya estamos en la misma vista, no hacer nada
    if (this.vista === v) return;
    
    // Limpiar estado según la vista actual ANTES de cambiar
    if (this.vista === 'seguimientos') {
      // Limpiar datos de seguimientos al salir de esa vista
      this.seguimientos = [];
      this.seguimientoActual = null;
      this.mesActual = new Date().getMonth() + 1;
      this.vistaMes = null;
      this.showDetalleMes = false;
      this.vistaCalendario = false;
      this.loadingSeguimientos = false;
    }
    
    // Cambiar la vista
    this.vista = v;
    
    // Inicializar la nueva vista
    if (v === 'proyectos') {
      // Reinicializar paginadores al volver a proyectos
      setTimeout(() => {
        this._inicializarPaginadorTarjetas();
        this._inicializarPaginadorLista();
      }, 0);
    } else if (v === 'seguimientos') {
      if (!this.seguimientos.length) {
        this.cargarSeguimientos(true);
      } else {
        this._abrirMesPorDefecto();
      }
    } else if (v === 'informes') {
      if (!this.informes.length) {
        this.cargarInformes();
      }
      this.cargarMisTareasInforme();
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

  calcularFechasTareas(): void {
    if (!this.detalleProyecto) return;

    // Primero aseguramos que los usuarios estén cargados para el buscador
    this._cargarUsuariosAsignables();

    Swal.fire({
      title: 'Calcular fechas de tareas',
      html: `
        <div class="text-left mb-4">
          <p class="text-sm text-gray-600 mb-3">
            Se distribuirán <strong>${this.detalleProyecto.total_tareas ?? 0}</strong> tareas en días laborales 
            (L-V, 7:00-16:00) hasta la fecha límite del proyecto.
          </p>
          
          <div class="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 text-sm text-yellow-700">
            <i class="bi bi-exclamation-triangle mr-1"></i>
            <strong>Importante:</strong> Esto sobreescribirá las fechas actuales de las tareas.
          </div>

          <div class="mb-2">
            <label for="responsable-busqueda" class="block text-sm font-medium text-gray-700 mb-1">
              <i class="bi bi-person-plus mr-1"></i>Buscar y asignar responsable (opcional)
            </label>
            
            <!-- Input con datalist para búsqueda -->
            <input type="text" 
                  id="responsable-busqueda"
                  list="responsables-list"
                  class="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Escribe para buscar un usuario...">
            
            <!-- Datalist con todos los usuarios -->
            <datalist id="responsables-list">
              ${this.usuariosAsignables.map(u => 
                `<option value="${u.nombre}" data-id="${u.id}">`
              ).join('')}
            </datalist>
            
            <!-- Campo oculto para almacenar el ID seleccionado -->
            <input type="hidden" id="responsable-id" value="0">
            
            <p class="text-xs text-gray-500 mt-2">
              <i class="bi bi-info-circle"></i> 
              Escribe el nombre del usuario. Si lo dejas vacío, no se asignará ningún responsable.
            </p>
            
            <!-- Tag para mostrar el usuario seleccionado -->
            <div id="responsable-seleccionado" class="mt-2 hidden">
              <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <i class="bi bi-person-check-fill"></i>
                <span id="responsable-nombre"></span>
                <button type="button" id="limpiar-responsable" class="text-blue-400 hover:text-red-500 transition">
                  <i class="bi bi-x"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Calcular',
      confirmButtonColor: '#2563eb',
      cancelButtonText: 'Cancelar',
      didOpen: () => {
        // Obtener elementos del DOM
        const inputBusqueda = document.getElementById('responsable-busqueda') as HTMLInputElement;
        const hiddenId = document.getElementById('responsable-id') as HTMLInputElement;
        const contenedorSeleccionado = document.getElementById('responsable-seleccionado');
        const spanNombre = document.getElementById('responsable-nombre');
        const btnLimpiar = document.getElementById('limpiar-responsable');
        
        // Mapa de nombres a IDs para búsqueda rápida
        const usuariosMap = new Map(
          this.usuariosAsignables.map(u => [u.nombre.toLowerCase(), u.id])
        );
        
        // Evento cuando cambia el input
        inputBusqueda?.addEventListener('input', (e: any) => {
          const valor = e.target.value.trim();
          
          if (!valor) {
            // Si está vacío, limpiar selección
            hiddenId.value = '0';
            contenedorSeleccionado?.classList.add('hidden');
            return;
          }
          
          // Buscar coincidencia exacta en el datalist (case insensitive)
          const idEncontrado = usuariosMap.get(valor.toLowerCase());
          
          if (idEncontrado) {
            // Coincidencia exacta encontrada
            hiddenId.value = idEncontrado.toString();
            
            // Mostrar el tag de selección
            if (spanNombre) spanNombre.textContent = valor;
            contenedorSeleccionado?.classList.remove('hidden');
          } else {
            // No hay coincidencia exacta, limpiar selección
            hiddenId.value = '0';
            contenedorSeleccionado?.classList.add('hidden');
          }
        });
        
        // Evento para limpiar la selección
        btnLimpiar?.addEventListener('click', () => {
          if (inputBusqueda) inputBusqueda.value = '';
          hiddenId.value = '0';
          contenedorSeleccionado?.classList.add('hidden');
        });
        
        // Prevenir que el datalist oculte opciones al hacer click en el botón limpiar
        btnLimpiar?.addEventListener('mousedown', (e) => e.preventDefault());
      },
      preConfirm: () => {
        const hiddenId = document.getElementById('responsable-id') as HTMLInputElement;
        if (!hiddenId) return { responsableId: null };
        
        const valorId = hiddenId.value; // Esto es un string
        
        // Si es "0" o está vacío, retornamos null
        if (!valorId || valorId === '0') {
          return { responsableId: null };
        }
        
        // Convertir a número
        const responsableId = parseInt(valorId, 10);
        
        // Validar que sea un número válido
        if (isNaN(responsableId) || responsableId <= 0) {
          return { responsableId: null };
        }
        
        return { responsableId };
      }
    }).then(result => {
      if (!result.isConfirmed) return;

      const responsableId = result.value?.responsableId;
      this.calculandoFechas = true;

      // Mostrar mensaje según si se asignó responsable o no
      const mensajeAsignacion = responsableId 
        ? ` y asignando a ${this.nombreUsuario(responsableId)}` 
        : ' (sin cambiar responsables)';

      // Toast de inicio
      this.showToast(`Calculando fechas${mensajeAsignacion}...`, 'success');

      this.proyectoService.calcularFechasTareas(
        this.detalleProyecto!.id, 
        this.usuarioId, 
        responsableId || undefined
      ).subscribe({
        next: (res: any) => {
          this.calculandoFechas = false;
          const mensajeExito = responsableId 
            ? `${res.data.tareas_actualizadas} tareas actualizadas y asignadas a ${this.nombreUsuario(responsableId)}`
            : `${res.data.tareas_actualizadas} tareas actualizadas`;
          
          this.showToast(mensajeExito, 'success');
          this.verDetalleProyecto(this.detalleProyecto!);
        },
        error: (err: any) => {
          this.calculandoFechas = false;
          this.showToast(err?.error?.message ?? 'No se pudo calcular las fechas', 'error');
        },
      });
    });
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

  abrirModalAsignarActividad(actividad: Actividad): void {
    this.asignarActividadId        = actividad.id;
    this.asignarActividadForm      = { asignado_id: null, nivel: 'colaborador', busqueda: '' };
    this.asignarActividadGuardando = false;
    this._cargarUsuariosAsignables();
    this.showModalAsignarActividad = true;
  }

  get asignarActividadUsuariosFiltrados(): UsuarioOpcion[] {
    const q = this.asignarActividadForm.busqueda.toLowerCase().trim();
    return (q
      ? this.usuariosAsignables.filter(u => u.nombre.toLowerCase().includes(q))
      : this.usuariosAsignables
    ).slice(0, 8);
  }

  confirmarAsignarActividad(): void {
    if (!this.asignarActividadId || !this.asignarActividadForm.asignado_id) return;
    this.asignarActividadGuardando = true;
    this.proyectoService.asignarUsuarioActividad(
      this.asignarActividadId,
      this.usuarioId,
      this.asignarActividadForm.asignado_id,
      this.asignarActividadForm.nivel as any
    ).subscribe({
      next: () => {
        this.showToast('Usuario asignado a la actividad y sus tareas', 'success');
        this.showModalAsignarActividad = false;
        this.asignarActividadGuardando = false;
      },
      error: () => {
        this.showToast('Error al asignar usuario', 'error');
        this.asignarActividadGuardando = false;
      },
    });
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
    this.inlineEditOriginalForm = { ...this.inlineEditForm };
    
    setTimeout(() => {
      const input = this.inlineEditRowRef?.nativeElement?.querySelector('input[data-edit-title]');
      input?.focus();
      if (input) { const len = input.value.length; input.setSelectionRange(len, len); }
    }, 50);
  }

  cancelarEdicionInline(): void {
    this.inlineEditingTaskId       = null;
    this.inlineEditShowEstado      = false;
    this.showInlineEditAsignado    = false;
    this.inlineEditAsignadoBusqueda = '';
    this.inlineEditOriginalForm    = null;
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
    this.vistaCalendarioModo = 'mes';
    this.fechaCalendarioActiva = new Date(seg.anio, mes - 1, 1);
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
    this.showFiltroEstadosGlobal = false;
    this.vistaFlujo = false;
    this.flujoActivo = null;
    this.flujosHistorial = [];
    this.showHistorialFlujos = false;
    this.showModalFlujoDiario = false;
    this.showModalCompromisoFlujo = false;
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
    const sorted = [...this.tareasSegPlanas]
      .filter(t => this.usuarioVisible(t.usuario_id)
                || (t.responsables ?? []).some(rid => this.usuarioVisible(rid)))
      .sort((a, b) => {
        if (!a.fecha_limite_entrega && !b.fecha_limite_entrega) return 0;
        if (!a.fecha_limite_entrega) return 1;
        if (!b.fecha_limite_entrega) return -1;
        return new Date(a.fecha_limite_entrega).getTime() - new Date(b.fecha_limite_entrega).getTime();
      });
    this.tareasSegFiltradas = this._filtrarPorEstado(sorted, estado);
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

  cambiarFiltroInformeMes(estado: string): void {
    this.filtroEstadoInformeMes = estado;
    const filtByUser = this.tareasInformeMesList
      .filter(t => !t.responsable_id || this.usuarioVisible(t.responsable_id));
    this.tareasInformeFiltradas = this._filtrarPorEstado(filtByUser, estado);
    this._initPaginador(this.paginadorInformeMesId, this.tareasInformeFiltradas,
      items => this.tareasInformePaginadas = items as InformeTarea[]);

    if (this.vistaCalendario) this._construirCalendarioMes();
  }

  cambiarFiltroGlobal(estado: string): void {
    this.filtroEstadosGlobal = estado === 'todos' ? [] : [estado];
    this._aplicarFiltrosGlobales();
  }

  toggleFiltroEstadoGlobalCheckbox(estado: string): void {
    if (estado === 'todos') {
      this.filtroEstadosGlobal = [];
      this._aplicarFiltrosGlobales();
      return;
    }

    const idx = this.filtroEstadosGlobal.indexOf(estado);
    if (idx >= 0) this.filtroEstadosGlobal.splice(idx, 1);
    else this.filtroEstadosGlobal.push(estado);

    this._aplicarFiltrosGlobales();
  }

  limpiarFiltroEstadosGlobal(): void {
    this.filtroEstadosGlobal = [];
    this._aplicarFiltrosGlobales();
  }

  esFiltroEstadoGlobalActivo(estado: string): boolean {
    if (estado === 'todos') return this.filtroEstadosGlobal.length === 0;
    return this.filtroEstadosGlobal.includes(estado);
  }

  aplicarFiltrosGlobales(): void {
    this._aplicarFiltrosGlobales();
    if (this.vistaCalendario) this._construirCalendarioMes();
  }

  abrirVistaFlujo(): void {
    this.vistaFlujo = true;
    this.vistaCalendario = false;
    this.cargarFlujoActivo();
  }

  abrirVistaCalendario(modo: 'mes' | 'semana' | 'dia' = 'mes', fecha?: Date): void {
    this.vistaCalendario = true;
    this.vistaFlujo = false;
    this.vistaCalendarioModo = modo;
    if (fecha) this.fechaCalendarioActiva = new Date(fecha);
    this._construirCalendarioMes();
  }

  cerrarVistaFlujo(): void {
    this.vistaFlujo = false;
  }

  cambiarModoCalendario(modo: 'mes' | 'semana' | 'dia'): void {
    this.vistaCalendarioModo = modo;
    if (!this.vistaCalendario) this.vistaCalendario = true;
  }

  navegarCalendario(delta: number): void {
    const base = new Date(this.fechaCalendarioActiva);
    if (this.vistaCalendarioModo === 'dia') base.setDate(base.getDate() + delta);
    else if (this.vistaCalendarioModo === 'semana') base.setDate(base.getDate() + (delta * 7));
    else base.setMonth(base.getMonth() + delta);

    this.fechaCalendarioActiva = base;

    if (this.vistaCalendarioModo === 'mes' && (base.getMonth() + 1 !== this.mesActual || base.getFullYear() !== (this.seguimientoActual?.anio ?? base.getFullYear()))) {
      this.mesActual = base.getMonth() + 1;
      this._cargarVistaMes();
      return;
    }

    this._construirCalendarioMes();
  }

  seleccionarFechaCalendario(dia: CalendarioDia, abrirDetalle = false, event?: Event): void {
    event?.stopPropagation();
    if (!dia.esMesActual) return;
    this.fechaCalendarioActiva = new Date(dia.fecha);
    if (abrirDetalle && (dia.tareas.length || dia.tareasExternas.length || dia.tareasInforme.length)) {
      this.abrirModalDia(dia);
    }
  }

  cargarFlujoActivo(): void {
    if (!this.seguimientoActual) return;
    this.loadingFlujo = true;
    this.proyectoService.getFlujoActivo(this.seguimientoActual.id, this.usuarioId).subscribe({
      next: (res) => {
        this.flujoActivo = res.data;
        this.loadingFlujo = false;
      },
      error: () => {
        this.flujoActivo = null;
        this.loadingFlujo = false;
        Swal.fire('Error', 'No se pudo cargar el flujo diario', 'error');
      },
    });
  }

  cargarHistorialFlujos(): void {
    if (!this.seguimientoActual) return;
    this.proyectoService.getFlujos(this.seguimientoActual.id, this.usuarioId).subscribe({
      next: (res) => {
        this.flujosHistorial = (res.data ?? []).filter(f => f.estado === 'cerrado');
      },
      error: () => Swal.fire('Error', 'No se pudo cargar el historial de flujos', 'error'),
    });
  }

  abrirModalNuevoFlujo(): void {
    if (!this.seguimientoActual) return;
    this.flujoDiarioForm = {
      titulo: `Flujo ${this.nombreMes(this.mesActual)} ${this.seguimientoActual.anio}`,
      fecha: new Date().toISOString().slice(0, 10),
    };
    this.showModalFlujoDiario = true;
  }

  cerrarModalNuevoFlujo(): void {
    this.showModalFlujoDiario = false;
  }

  guardarFlujoDiario(): void {
    if (!this.seguimientoActual) return;
    if (!this.flujoDiarioForm.titulo.trim()) {
      Swal.fire('Validación', 'El título del flujo es obligatorio', 'warning');
      return;
    }

    this.proyectoService.crearFlujo({
      seguimiento_id: this.seguimientoActual.id,
      titulo: this.flujoDiarioForm.titulo.trim(),
      fecha: this.flujoDiarioForm.fecha || new Date().toISOString().slice(0, 10),
      usuario_id: this.usuarioId,
    }).subscribe({
      next: (res: any) => {
        this.showModalFlujoDiario = false;
        Swal.fire('Éxito', res.message ?? 'Flujo creado', 'success');
        this.vistaFlujo = true;
        this.cargarFlujoActivo();
      },
      error: (err) => Swal.fire('Error', err?.error?.message ?? 'No se pudo crear el flujo', 'error'),
    });
  }

  abrirModalNuevoCompromiso(): void {
    if (!this.flujoActivo) return;
    this.compromisoFlujoTitulo = 'Nuevo compromiso';
    this.compromisoForm = { id: null, titulo: '', descripcion: '', responsables: [] };
    this.showModalCompromisoFlujo = true;
  }

  editarCompromiso(compromiso: Compromiso): void {
    this.compromisoFlujoTitulo = 'Editar compromiso';
    this.compromisoForm = {
      id: compromiso.id,
      titulo: compromiso.titulo,
      descripcion: compromiso.descripcion ?? '',
      responsables: [...(compromiso.responsables ?? [])],
    };
    this.showModalCompromisoFlujo = true;
  }

  cerrarModalCompromisoFlujo(): void {
    this.showModalCompromisoFlujo = false;
  }

  guardarCompromisoFlujo(): void {
    if (!this.flujoActivo) return;
    if (!this.compromisoForm.titulo.trim()) {
      Swal.fire('Validación', 'El título es obligatorio', 'warning');
      return;
    }
    if (!this.compromisoForm.responsables.length) {
      Swal.fire('Validación', 'Selecciona al menos un responsable', 'warning');
      return;
    }

    const payload = {
      titulo: this.compromisoForm.titulo.trim(),
      descripcion: this.compromisoForm.descripcion.trim(),
      responsables: this.compromisoForm.responsables,
      usuario_id: this.usuarioId,
    };

    const request = this.compromisoForm.id
      ? this.proyectoService.actualizarCompromiso(this.compromisoForm.id, payload)
      : this.proyectoService.crearCompromiso({ flujo_id: this.flujoActivo.id, ...payload });

    request.subscribe({
      next: (res: any) => {
        this.showModalCompromisoFlujo = false;
        this.showToast(res?.message ?? (this.compromisoForm.id ? 'Compromiso actualizado' : 'Compromiso creado'), 'success');
        this.cargarFlujoActivo();
      },
      error: (err) => Swal.fire('Error', err?.error?.message ?? 'No se pudo guardar el compromiso', 'error'),
    });
  }

  iniciarCompromiso(compromiso: Compromiso): void {
    this.proyectoService.iniciarCompromiso(compromiso.id, this.usuarioId).subscribe({
      next: () => {
        this.showToast('Compromiso iniciado', 'success');
        this.cargarFlujoActivo();
      },
      error: (err) => Swal.fire('Error', err?.error?.message ?? 'No se pudo iniciar el compromiso', 'error'),
    });
  }

  completarCompromiso(compromiso: Compromiso): void {
    this.proyectoService.completarCompromiso(compromiso.id, this.usuarioId).subscribe({
      next: () => {
        this.showToast('Compromiso completado', 'success');
        this.cargarFlujoActivo();
      },
      error: (err) => Swal.fire('Error', err?.error?.message ?? 'No se pudo completar el compromiso', 'error'),
    });
  }

  eliminarCompromiso(compromiso: Compromiso): void {
    Swal.fire({
      title: '¿Eliminar compromiso?',
      text: compromiso.titulo,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.proyectoService.eliminarCompromiso(compromiso.id, this.usuarioId).subscribe({
        next: () => {
          this.showToast('Compromiso eliminado', 'success');
          this.cargarFlujoActivo();
        },
        error: (err) => Swal.fire('Error', err?.error?.message ?? 'No se pudo eliminar el compromiso', 'error'),
      });
    });
  }

  cerrarFlujoActivo(): void {
    if (!this.flujoActivo) return;
    Swal.fire({
      title: '¿Cerrar flujo diario?',
      text: 'Se guardará el resumen final del día y ya no podrás agregar compromisos.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cerrar flujo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669',
    }).then((r) => {
      if (!r.isConfirmed || !this.flujoActivo) return;
      this.proyectoService.cerrarFlujo(this.flujoActivo.id, this.usuarioId).subscribe({
        next: () => {
          Swal.fire('Cerrado', 'El flujo diario fue cerrado correctamente', 'success');
          this.cargarFlujoActivo();
          this.cargarHistorialFlujos();
        },
        error: (err) => Swal.fire('Error', err?.error?.message ?? 'No se pudo cerrar el flujo', 'error'),
      });
    });
  }

  puedeGestionarCompromiso(compromiso: Compromiso): boolean {
    return !!this.vistaMes?.es_gestor || (compromiso.responsables ?? []).includes(this.usuarioId);
  }

  puedeIniciarCompromiso(compromiso: Compromiso): boolean {
    return compromiso.estado === 'pendiente' && this.puedeGestionarCompromiso(compromiso);
  }

  nombresResponsablesCompromiso(compromiso: Compromiso): string {
    return (compromiso.responsables ?? []).map(id => this.nombreUsuario(id)).join(', ');
  }

  getEstadoCompromisoLabel(estado: string): string {
    return ({
      pendiente: 'Pendiente',
      en_ejecucion: 'En ejecución',
      completado: 'Completado',
    })[estado] ?? estado;
  }

  getEstadoCompromisoClase(estado: string): string {
    return ({
      pendiente: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      en_ejecucion: 'bg-blue-50 text-blue-700 border-blue-200',
      completado: 'bg-green-100 text-green-700 border-green-200',
    })[estado] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  }

  porcentajeCargaPersona(persona: { total: number }, max = this.cargaMaximaComparativa): number {
    return Math.round((persona.total / Math.max(max, 1)) * 100);
  }

  get calendarioPlano(): CalendarioDia[] {
    return this.calendarioDias.flat();
  }

  get semanaCalendarioVisible(): CalendarioDia[] {
    const referencia = this.calendarioDiaActivo;
    if (!referencia) return [];

    const inicio = new Date(referencia.fecha);
    const dia = inicio.getDay();
    const diff = dia === 0 ? -6 : 1 - dia;
    inicio.setDate(inicio.getDate() + diff);
    inicio.setHours(0, 0, 0, 0);

    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);
    fin.setHours(23, 59, 59, 999);

    return this.calendarioPlano.filter(item => item.fecha >= inicio && item.fecha <= fin);
  }

  get calendarioDiaActivo(): CalendarioDia | null {
    const fechaActiva = this._fechaClave(this.fechaCalendarioActiva);
    return this.calendarioPlano.find(item => this._fechaClave(item.fecha) === fechaActiva) ?? this.calendarioPlano.find(item => item.esMesActual) ?? null;
  }

  get resumenCalendarioActivo(): { total: number; seguimiento: number; proyecto: number; glpi: number; informes: number } {
    const dias = this.vistaCalendarioModo === 'dia'
      ? (this.calendarioDiaActivo ? [this.calendarioDiaActivo] : [])
      : this.vistaCalendarioModo === 'semana'
        ? this.semanaCalendarioVisible
        : this.calendarioPlano.filter(dia => dia.esMesActual);

    return dias.reduce((acc, dia) => {
      acc.total += dia.tareas.length + dia.tareasExternas.length + dia.tareasInforme.length;
      acc.seguimiento += dia.tareas.length;
      acc.proyecto += dia.tareasExternas.filter(t => t.origen === 'proyecto').length;
      acc.glpi += dia.tareasExternas.filter(t => t.origen === 'glpi').length;
      acc.informes += dia.tareasInforme.length;
      return acc;
    }, { total: 0, seguimiento: 0, proyecto: 0, glpi: 0, informes: 0 });
  }

  formatearFechaCompromiso(fecha?: string | null): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · TAREAS DE SEGUIMIENTO (CRUD)
  // ════════════════════════════════════════════════════════════════

  abrirModalSegTarea(tarea?: SeguimientoTarea): void {
    this.selectedSegTarea = tarea ?? null;

    if (tarea) {
      // Resolver responsables desde el array o desde usuario_id
      const ids = tarea.responsables?.length
        ? tarea.responsables
        : [tarea.usuario_id];
      this.responsablesSegSelec = ids
        .map(id => this.usuariosCache.find(u => u.id === id) ?? { id, nombre: this.nombreUsuario(id) });
    } else {
      // Nueva tarea: gestor empieza vacío, no-gestor auto-asigna
      if (this.vistaMes?.es_gestor || this.seguimientoActual?.es_gestor) {
        this.responsablesSegSelec = [];
      } else {
        const yo = this.usuariosCache.find(u => u.id === this.usuarioId)
                ?? { id: this.usuarioId, nombre: this.nombreUsuario(this.usuarioId) };
        this.responsablesSegSelec = [yo];
      }
    }

    this.segTareaForm = tarea
      ? { titulo: tarea.titulo, descripcion: tarea.descripcion, estado: tarea.estado,
          notas: tarea.notas, fecha_limite_entrega: tarea.fecha_limite_entrega }
      : { seguimiento_id: this.seguimientoActual?.id, titulo: '', descripcion: '',
          estado: 'pendiente', notas: '', fecha_limite_entrega: '' };

    this.showAsignarSegSelect   = false;
    this.busquedaResponsableSeg = '';
    this.showModalSegTarea      = true;
  }

  abrirModalTareaRapida(seg: SeguimientoAnual): void {
    this.seguimientoActual = seg;
    this.selectedSegTarea  = null;

    if (seg.es_gestor) {
      this.responsablesSegSelec = [];
    } else {
      const yo = this.usuariosCache.find(u => u.id === this.usuarioId)
              ?? { id: this.usuarioId, nombre: this.nombreUsuario(this.usuarioId) };
      this.responsablesSegSelec = [yo];
    }

    this.segTareaForm = {
      seguimiento_id: seg.id, titulo: '', descripcion: '',
      estado: 'pendiente', notas: '', fecha_limite_entrega: '',
    };
    this.showAsignarSegSelect   = false;
    this.busquedaResponsableSeg = '';
    this.showModalSegTarea      = true;
  }

  abrirModalDia(dia: CalendarioDia, event?: Event): void {
    event?.stopPropagation();
    if (!dia.esMesActual) return;
    if (!dia.tareas.length && !dia.tareasExternas.length && !dia.tareasInforme.length) return;
    
    this.selectedDayData = dia;
    this.showDayModal = true;
    
    // Forzar detección de cambios después de un breve tiempo
    // para permitir que los datos asíncronos se carguen
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }
  
  cerrarModalDia(): void {
    this.showDayModal    = false;
    this.selectedDayData = null;
  }

  guardarSegTarea(): void {
    if (!this.segTareaForm.titulo?.trim()) {
      Swal.fire('Validación', 'El título es obligatorio', 'warning'); return;
    }
    if (!this.responsablesSegSelec.length && !(this.vistaMes?.es_gestor || this.seguimientoActual?.es_gestor)) {
      Swal.fire('Validación', 'Debes asignarte como responsable', 'warning'); return;
    }
    const body = {
      ...this.segTareaForm,
      usuario_id:   this.usuarioId,
      responsables: this.responsablesSegSelec.map(r => r.id),
    };
    const req$ = this.selectedSegTarea
      ? this.proyectoService.actualizarSeguimientoTarea(this.selectedSegTarea.id, body)
      : this.proyectoService.crearSeguimientoTarea(body);
    req$.subscribe({
      next: (res: any) => {
        Swal.fire('Éxito', res.message ?? 'Tarea guardada', 'success');
        this.showModalSegTarea    = false;
        this.responsablesSegSelec = [];
        if (this.showDetalleMes) this._cargarVistaMes();
      },
      error: () => Swal.fire('Error', 'No se pudo guardar la tarea', 'error'),
    });
  }

  agregarResponsableSeg(u: UsuarioOpcion): void {
    if (!this.responsablesSegSelec.find(r => r.id === u.id))
      this.responsablesSegSelec = [...this.responsablesSegSelec, u];
    this.busquedaResponsableSeg = '';
    this.showAsignarSegSelect   = false;
  }

  quitarResponsableSeg(id: number): void {
    this.responsablesSegSelec = this.responsablesSegSelec.filter(r => r.id !== id);
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

  completarInformeTareaEnMes(tarea: InformeTarea): void {
    Swal.fire({
      title: '¿Marcar como completada?', icon: 'question',
      showCancelButton: true, confirmButtonText: 'Sí', confirmButtonColor: '#16a34a',
    }).then(r => r.isConfirmed &&
      this.proyectoService.completarInformeTarea(tarea.id, this.usuarioId).subscribe({
        next:  () => { this.showToast('¡Tarea completada!', 'success'); this._cargarVistaMes(); },
        error: () => this.showToast('No se pudo completar', 'error'),
      })
    );
  }

  verNotasTarea(tarea: any): void { this.tareaSeleccionada = tarea; this.showModalVerNotas = true; }

  abrirModalEvidencia(tipo: 'tarea' | 'seguimiento_tarea', id: number, titulo: string): void {
    this.evidenciaEntidad   = { tipo, id, titulo };
    this.evidencias         = [];
    this.showModalEvidencia = true;
    this.loadingEvidencias  = true;
    this.proyectoService.getEvidencias(tipo, id).subscribe({
      next:  res => { this.evidencias = res.data; this.loadingEvidencias = false; },
      error: ()  => { this.loadingEvidencias = false; },
    });
  }

  subirEvidencia(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.evidenciaEntidad) return;
    this.subiendoEvidencia = true;
    const { tipo, id } = this.evidenciaEntidad;
    this.proyectoService.subirEvidencia(tipo, id, file, this.usuarioId).subscribe({
      next: (res) => {
        this.evidencias.unshift(res.data);
        this.subiendoEvidencia = false;
        this.showToast('Evidencia subida correctamente', 'success');
        (event.target as HTMLInputElement).value = '';
      },
      error: () => { this.subiendoEvidencia = false; this.showToast('Error al subir evidencia', 'error'); },
    });
  }

  verEvidencia(ev: any): void {
    this.loadingPreview = true;
    this.showModalPreviewEvidencia = true;
    this.previewEvidencia = null;

    this.proyectoService.getUrlEvidencia(ev.id).subscribe({
      next: res => {

        let url: string | SafeResourceUrl = res.url;

        if (ev.tipo_mime === 'application/pdf') {
          url = this.sanitizer.bypassSecurityTrustResourceUrl(res.url);
        }

        this.previewEvidencia = {
          url: url,
          tipo_mime: ev.tipo_mime,
          nombre_archivo: ev.nombre_archivo
        };

        this.loadingPreview = false;
      },
      error: () => {
        this.loadingPreview = false;
        this.showModalPreviewEvidencia = false;
        this.showToast('Archivo no disponible', 'error');
      },
    });
  }

  eliminarEvidencia(ev: any): void {
    Swal.fire({ title: '¿Eliminar evidencia?', text: 'Se eliminará del registro pero el archivo se conserva en el historial.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' })
      .then(r => r.isConfirmed && this.proyectoService.eliminarEvidencia(ev.id, this.usuarioId).subscribe({
        next:  () => { this.evidencias = this.evidencias.filter(e => e.id !== ev.id); this.showToast('Eliminada del registro', 'success'); },
        error: () => this.showToast('Error al eliminar', 'error'),
      }));
  }

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
    this.calendarioDias = this._generarSemanas(
      mes, anio, hoy,
      this._buildMapaSeguimiento(mes),
      this._buildMapaExternas(),
      this._buildMapaInforme(),
    );

    const fechaActiva = this.calendarioDiaActivo;
    if (!fechaActiva || fechaActiva.fecha.getMonth() !== mes - 1) {
      this.fechaCalendarioActiva = new Date(anio, mes - 1, 1);
    }
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
    
    // Si la fecha viene en formato ISO, extraemos los componentes directamente
    // para evitar cualquier ajuste de zona horaria
    if (value.includes('T')) {
      // Formato esperado: "2024-01-15T14:30:00.000Z" o similar
      const parts = value.split('T');
      if (parts.length === 2) {
        const datePart = parts[0]; // YYYY-MM-DD
        const timePart = parts[1].substring(0, 5); // HH:MM (primeros 5 caracteres)
        return `${datePart}T${timePart}`;
      }
    }
    
    // Fallback al método anterior si no tiene el formato esperado
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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
    return this._filtrarPorEstados(tareas, estado === 'todos' ? [] : [estado]);
  }

  private _filtrarPorEstados<T extends { estado: string }>(tareas: T[], estados: string[]): T[] {
    if (!estados.length) return tareas;
    return tareas.filter(t => estados.includes(t.estado));
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

        const tareasExtReqs   = uids.map(uid =>
          this.proyectoService.getTareasConsolidadas(uid, this.mesActual, anio, ['proyecto', 'glpi']));
        const tareasInfReqs   = uids.map(uid =>
          this.proyectoService.getMisInformeTareas(uid));
        
        forkJoin([...tareasExtReqs, ...tareasInfReqs]).subscribe({
          next: (resps: any[]) => {
            const mitad = uids.length;
            this.tareasExternasMes  = resps.slice(0, mitad)
              .reduce((acc, r) => acc.concat(r.data ?? []), [] as TareaConsolidada[]);
        
            const todasInforme: InformeTarea[] = resps.slice(mitad)
              .reduce((acc, r) => acc.concat(r.data ?? []), []);
            this.tareasInformeMesList = todasInforme.filter(t => {
              if (!t.fecha_limite_entrega) return false;
              const d = new Date(t.fecha_limite_entrega);
              return d.getMonth() + 1 === this.mesActual && d.getFullYear() === anio;
            });
        
            this.loadingVistaMes = false;
            this._inicializarPaginadoresExternos();
            this._inicializarPaginadorInformeMes();
            if (this.vistaFlujo) this.cargarFlujoActivo();
            if (this.vistaCalendario) this._construirCalendarioMes();
          },
          error: () => {
            this.loadingVistaMes = false;
            this._inicializarPaginadoresExternos();
            this._inicializarPaginadorInformeMes();
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

  get participantesFlujoModal(): UsuarioOpcion[] {
    return this._participantesOpcionesFlujo();
  }

  get coloresParticipantesFlujo(): Record<number, string> {
    return Object.fromEntries(this.participantesFlujoModal.map(p => [p.id, this.getColorPorId(p.id)]));
  }

  get inicialesParticipantesFlujo(): Record<number, string> {
    return Object.fromEntries(this.participantesFlujoModal.map(p => [p.id, this.getInicialesResponsable(p.id)]));
  }

  private _compromisoVisible(compromiso: { estado: string; responsables?: number[] }): boolean {
    const coincideEstado = !this.filtroEstadosGlobal.length || this.filtroEstadosGlobal.includes(compromiso.estado);
    const coincideUsuario = !this.filtroUsuariosSelec.length || (compromiso.responsables ?? []).some(rid => this.filtroUsuariosSelec.includes(rid));
    return coincideEstado && coincideUsuario;
  }

  private _agruparCompromisosPorPersona(compromisos: Compromiso[]): CargaPersonaFlujo[] {
    const mapa = new Map<number, CargaPersonaFlujo>();
    for (const compromiso of compromisos) {
      for (const rid of compromiso.responsables ?? []) {
        const actual = mapa.get(rid) ?? {
          usuario_id: rid,
          nombre: this.nombreUsuario(rid),
          total: 0,
          completados: 0,
          en_ejecucion: 0,
          pendientes: 0,
          compromisos: [],
        };

        actual.total += 1;
        if (compromiso.estado === 'completado') actual.completados += 1;
        else if (compromiso.estado === 'en_ejecucion') actual.en_ejecucion += 1;
        else actual.pendientes += 1;
        actual.compromisos.push(compromiso);
        mapa.set(rid, actual);
      }
    }

    return Array.from(mapa.values())
      .sort((a, b) => b.en_ejecucion - a.en_ejecucion || b.total - a.total || a.nombre.localeCompare(b.nombre));
  }

  _fechaClave(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }

  private _participantesOpcionesFlujo(): UsuarioOpcion[] {
    const participantes = this.vistaMes?.participantes_info ?? [];
    if (participantes.length) return participantes.map(p => ({ id: p.id, nombre: p.nombre }));
    return this.usuariosCache.filter(u => u.id === this.usuarioId);
  }

  private _escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private _aplicarFiltrosGlobales(): void {
    const estados = [...this.filtroEstadosGlobal];
    this.filtroGlobalEstado = estados[0] ?? 'todos';

    const sortedSeg = [...this.tareasSegPlanas]
      .filter(t => this.usuarioVisible(t.usuario_id)
                || (t.responsables ?? []).some(rid => this.usuarioVisible(rid)))
      .sort((a, b) => {
        if (!a.fecha_limite_entrega && !b.fecha_limite_entrega) return 0;
        if (!a.fecha_limite_entrega) return 1;
        if (!b.fecha_limite_entrega) return -1;
        return new Date(a.fecha_limite_entrega).getTime() - new Date(b.fecha_limite_entrega).getTime();
      });
    this.tareasSegFiltradas = this._filtrarPorEstados(sortedSeg, estados);
    this._initPaginador(this.paginadorSegId, this.tareasSegFiltradas, items => this.tareasSegPaginadas = items);

    this.tareasProyFiltradas = this._filtrarPorEstados(this.tareasExternasProyecto, estados);
    this._initPaginador(this.paginadorProyId, this.tareasProyFiltradas, items => this.tareasProyPaginadas = items);

    const estadosGlpi = estados.map(e => e === 'en_ejecucion' ? 'en_progreso' : e);
    this.tareasGlpiFiltradas = this._filtrarPorEstados(this.tareasExternasGlpi, estadosGlpi);
    this._initPaginador(this.paginadorGlpiId, this.tareasGlpiFiltradas, items => this.tareasGlpiPaginadas = items);

    const filtByUser = this.tareasInformeMesList
      .filter(t => !t.responsable_id || this.usuarioVisible(t.responsable_id));
    this.tareasInformeFiltradas = this._filtrarPorEstados(filtByUser, estados);
    this._initPaginador(this.paginadorInformeMesId, this.tareasInformeFiltradas,
      items => this.tareasInformePaginadas = items as InformeTarea[]);

    if (this.vistaCalendario) this._construirCalendarioMes();
  }

  private _inicializarPaginadorSeguimiento(): void {
    const sorted = [...this.tareasSegPlanas]
      .sort((a, b) => {
        if (!a.fecha_limite_entrega && !b.fecha_limite_entrega) return 0;
        if (!a.fecha_limite_entrega) return 1;
        if (!b.fecha_limite_entrega) return -1;
        return new Date(a.fecha_limite_entrega).getTime() - new Date(b.fecha_limite_entrega).getTime();
      });
    this.filtroEstadoSeg    = sorted.some(t => t.estado === 'pendiente') ? 'pendiente' : 'en_ejecucion';
    this.filtroEstadosGlobal = this.filtroEstadoSeg === 'pendiente' ? ['pendiente'] : ['en_ejecucion'];
    this._aplicarFiltrosGlobales();
  }

  private _inicializarPaginadoresExternos(): void {
    const todasProy = this.tareasExternasProyecto;
    this.filtroEstadoProy    = todasProy.some(t => t.estado === 'pendiente') ? 'pendiente' : 'en_ejecucion';

    const todasGlpi = this.tareasExternasGlpi;
    this.filtroEstadoGlpi    = todasGlpi.some(t => t.estado === 'pendiente') ? 'pendiente' : 'en_progreso';
    this._aplicarFiltrosGlobales();
  }

  private _inicializarPaginadorTarjetas(): void {
    const instanceId = 'proyectos-tarjetas';
    this.paginationService.initializePaginator(instanceId, this.proyectosFiltrados, 3, null, null)
      .subscribe(state => this.proyectosPaginados = state.currentData);
  }

  private _inicializarPaginadorLista(): void {
    const instanceId = 'proyectos-lista';
    this.paginationService.initializePaginator(instanceId, this.proyectosFiltrados, 10, null, null)
      .subscribe(state => this.proyectosPaginados = state.currentData);
  }

  private _inicializarPaginadorInformeMes(): void {
    this.filtroEstadoInformeMes  = this.tareasInformeMesList.some(t => t.estado === 'pendiente')
      ? 'pendiente' : 'todos';
    this._aplicarFiltrosGlobales();
  }
  
  private _buildMapaInforme(): Map<string, (InformeTarea & { nombreUsuario: string })[]> {
    const mapa = new Map<string, (InformeTarea & { nombreUsuario: string })[]>();
    this.tareasInformeMesList.forEach(t => {
      const uid = t.responsable_id;
      if (uid && !this.usuarioVisible(uid)) return;
      const fecha = (t as any).fecha_completado && t.estado === 'completado'
        ? (t as any).fecha_completado
        : t.fecha_limite_entrega;
      if (!fecha) return;
      const key  = new Date(fecha).toDateString();
      const item = { ...t, nombreUsuario: uid ? this.nombreUsuario(uid) : 'Sin asignar' };
      (mapa.get(key) ?? (mapa.set(key, []), mapa.get(key)!)).push(item);
    });
    return mapa;
  }

  // Método para manejar la búsqueda en tiempo real
  onBusquedaChange(): void {
    // Reinicializar paginadores con los proyectos filtrados
    setTimeout(() => {
      this._inicializarPaginadorTarjetas();
      this._inicializarPaginadorLista();
    }, 0);
  }

  private _inlineEditHasChanges(): boolean {
    if (!this.inlineEditOriginalForm) return false;
    const f = this.inlineEditForm;
    const o = this.inlineEditOriginalForm;
    return f.titulo !== o.titulo
      || f.descripcion !== o.descripcion
      || f.estado !== o.estado
      || f.fecha_limite_entrega !== o.fecha_limite_entrega
      || f.asignado_id !== o.asignado_id;
  }

  private _inlineEditInformeHasChanges(): boolean {
    if (!this.inlineEditInformeTareaOriginalForm) return false;
    const f = this.inlineEditInformeTareaForm;
    const o = this.inlineEditInformeTareaOriginalForm;
    return f.titulo !== o.titulo
      || f.descripcion !== o.descripcion
      || f.estado !== o.estado
      || f.fecha_limite_entrega !== o.fecha_limite_entrega
      || f.responsable_id !== o.responsable_id;
  }

  // Método para limpiar búsqueda
  limpiarBusqueda(): void {
    this.busquedaProyectos = '';
    this.onBusquedaChange();
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

          let fechaParaCalendario: string | null = null;

          // --- INICIO DE LA NUEVA LÓGICA PARA TICKETS (GLPI) ---
          if (t.origen === 'glpi') {
            console.log(`Procesando ticket GLPI: ${t.titulo} (estado: ${t.estado})`);
              // Si es un ticket de GLPI y está completado, usa la fecha de completado
              if (t.estado === 'completado' && t.fecha_completado) {
                console.log(`Ticket completado. Usando fecha_completado: ${t.fecha_completado}`);
                  fechaParaCalendario = t.fecha_completado;
              } 
              // Si no está completado (pendiente, en_progreso, etc.) o no tiene fecha de completado, usa la fecha límite
              else {
                  fechaParaCalendario = t.fecha_limite_entrega;
              }
          } 
          // --- FIN DE LA NUEVA LÓGICA PARA TICKETS ---
          
          // --- LÓGICA EXISTENTE PARA OTRAS ENTIDADES (Proyectos) ---
          else {
              // Para proyectos, se mantiene la lógica original (mostrar en fecha de completado si está completado, si no, en fecha límite)
              if (t.estado === 'completado' && t.fecha_completado) {
                  fechaParaCalendario = t.fecha_completado;
              } else {
                  fechaParaCalendario = t.fecha_limite_entrega;
              }
          }

          // Si no hay una fecha válida para colocar el ticket, lo omitimos del calendario
          if (!fechaParaCalendario) {
              return;
          }

          const key = new Date(fechaParaCalendario).toDateString();
          
          if (!mapa.has(key)) {
              mapa.set(key, []);
          }
          mapa.get(key)!.push(t);
      });
      
      return mapa;
  }

  private _generarSemanas(
    mes: number, anio: number, hoy: Date,
    mapaSeg:     Map<string, { tarea: SeguimientoTarea; nombreUsuario: string }[]>,
    mapaExt:     Map<string, TareaConsolidada[]>,
    mapaInforme: Map<string, (InformeTarea & { nombreUsuario: string })[]> = new Map(),
  ): CalendarioDia[][] {
    const primerDia = new Date(anio, mes - 1, 1);
    const offset    = (primerDia.getDay() + 6) % 7;
    const cursor    = new Date(primerDia);
    cursor.setDate(primerDia.getDate() - offset);
    const semanas: CalendarioDia[][] = [];
  
    const initEntry = () => ({
      total: 0, completadas: 0, semaforos: [] as string[],
      countSeguimiento: 0, countProyecto: 0, countGlpi: 0, countInforme: 0,
    });
  
    for (let s = 0; s < 6; s++) {
      const fila: CalendarioDia[] = [];
      for (let d = 0; d < 7; d++) {
        const key            = cursor.toDateString();
        const tareasDelDia   = mapaSeg.get(key)     ?? [];
        const externasDelDia = mapaExt.get(key)     ?? [];
        const informesDelDia = mapaInforme.get(key) ?? [];
        const agrupado       = new Map<number, ReturnType<typeof initEntry>>();
  
        tareasDelDia.forEach(({ tarea }) => {
          const r = agrupado.get(tarea.usuario_id) ?? initEntry();
          r.total++; r.countSeguimiento++;
          if (tarea.estado === 'completado') r.completadas++;
          if (tarea.semaforo) r.semaforos.push(tarea.semaforo);
          agrupado.set(tarea.usuario_id, r);
        });
  
        externasDelDia.forEach(t => {
          const r = agrupado.get(t.usuario_id) ?? initEntry();
          r.total++;
          if (t.origen === 'proyecto') r.countProyecto++;
          else if (t.origen === 'glpi') r.countGlpi++;
          if (t.estado === 'completado') r.completadas++;
          if (t.semaforo) r.semaforos.push(t.semaforo);
          agrupado.set(t.usuario_id, r);
        });
  
        informesDelDia.forEach(t => {
          const uid = t.responsable_id;
          if (!uid) return;
          const r = agrupado.get(uid) ?? initEntry();
          r.total++; r.countInforme++;
          if (t.estado === 'completado') r.completadas++;
          if ((t as any).semaforo) r.semaforos.push((t as any).semaforo);
          agrupado.set(uid, r);
        });
  
        fila.push({
          fecha:          new Date(cursor),
          esHoy:          key === hoy.toDateString(),
          esMesActual:    cursor.getMonth() === mes - 1,
          tareas:         tareasDelDia,
          tareasExternas: externasDelDia,
          tareasInforme:  informesDelDia,
          resumenPorUsuario: Array.from(agrupado.entries()).map(([uid, r]) => ({
            uid, iniciales: this._iniciales(uid), nombre: this.nombreUsuario(uid),
            total: r.total, completadas: r.completadas, semaforo: this._semaforoDominante(r.semaforos),
            countSeguimiento: r.countSeguimiento, countProyecto: r.countProyecto,
            countGlpi: r.countGlpi, countInforme: r.countInforme,
          })),
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      semanas.push(fila);
    }
    return semanas;
  }

  // ─── LISTADO ──────────────────────────────────────────────────────────────
 
  cargarInformes(): void {
    this.loadingInformes = true;
    const filtros = {
      estado: this.filtroEstadoInforme,
      busqueda: this.busquedaInformes.trim() || undefined,
    };
    this.proyectoService.getInformes(this.usuarioId, filtros).subscribe({
      next: res => {
        this.informes        = res.data;
        this.loadingInformes = false;
        this._inicializarPaginadoresInformes();
      },
      error: () => {
        this.loadingInformes = false;
        Swal.fire('Error', 'No se pudieron cargar los informes', 'error');
      },
    });
  }
 
  cargarMisTareasInforme(): void {
    this.loadingMisTareasInforme = true;
    this.proyectoService.getMisInformeTareas(this.usuarioId).subscribe({
      next: res => { this.misTareasInforme = res.data; this.loadingMisTareasInforme = false; },
      error: () => { this.loadingMisTareasInforme = false; },
    });
  }
 
  private _inicializarPaginadoresInformes(): void {
    this.paginationService
      .initializePaginator('informes-tarjetas', this.informes, 3, null, null)
      .subscribe(state => { if (this.vistaInformes === 'tarjetas') this.informesPaginados = state.currentData; });
    this.paginationService
      .initializePaginator('informes-lista', this.informes, 10, null, null)
      .subscribe(state => { if (this.vistaInformes === 'lista') this.informesPaginados = state.currentData; });
  }
 
  onBusquedaInformesChange(): void {
    clearTimeout((this as any)._informeSearchTimer);
    (this as any)._informeSearchTimer = setTimeout(() => this.cargarInformes(), 300);
  }
 
  // ─── MODAL CREAR / EDITAR INFORME ──────────────────────────────────────────
 
  abrirModalCrearInforme(): void {
    this.informeForm = {
      titulo: '', descripcion_hallazgo: '',
      tipo: 'Incidente', nivel_impacto: 'Medio',
      fecha_evento: new Date().toISOString().split('T')[0],
    };
    this.modalInformeTitulo = 'Nuevo Informe';
    this.selectedInforme    = null;
    this.showModalInforme   = true;
  }
 
  abrirModalEditarInforme(informe: Informe): void {
    this.informeForm = {
      titulo:               informe.titulo,
      descripcion_hallazgo: informe.descripcion_hallazgo,
      tipo:                 informe.tipo,
      nivel_impacto:        informe.nivel_impacto,
      fecha_evento:         informe.fecha_evento?.split('T')[0] ?? '',
    };
    this.modalInformeTitulo = 'Editar Informe';
    this.selectedInforme    = informe;
    this.showModalInforme   = true;
  }
 
  guardarInforme(): void {
    if (!this.informeForm.titulo?.trim()) {
      Swal.fire('Validación', 'El título es obligatorio', 'warning'); return;
    }
    const body = { ...this.informeForm, usuario_id: this.usuarioId };
    const req$ = this.selectedInforme
      ? this.proyectoService.actualizarInforme(this.selectedInforme.id, body)
      : this.proyectoService.crearInforme(body);
 
    req$.subscribe({
      next: (res: any) => {
        this.showModalInforme = false;
        this.showToast(res.message ?? 'Informe guardado', 'success');
        this.cargarInformes();
        // Si hay detalle abierto, refrescar
        if (this.detalleInforme && this.selectedInforme?.id === this.detalleInforme.id) {
          this._refreshDetalleInforme();
        }
      },
      error: () => Swal.fire('Error', 'No se pudo guardar el informe', 'error'),
    });
  }
 
  guardarAnalisisTecnico(): void {
    if (!this.detalleInforme) return;
    const body = {
      causa_raiz:         this.detalleInforme.causa_raiz,
      sistemas_afectados: this.detalleInforme.sistemas_afectados,
      impacto_negocio:    this.detalleInforme.impacto_negocio,
      usuario_id:         this.usuarioId,
    };
    this.proyectoService.actualizarInforme(this.detalleInforme.id, body).subscribe({
      next: () => this.showToast('Análisis guardado', 'success'),
      error: () => this.showToast('No se pudo guardar el análisis', 'error'),
    });
  }
 
  guardarPlanAccion(): void {
    if (!this.detalleInforme) return;
    const body = {
      accion_correctiva:    this.detalleInforme.accion_correctiva,
      accion_preventiva:    this.detalleInforme.accion_preventiva,
      control_tecnologico:  this.detalleInforme.control_tecnologico,
      fecha_implementacion: this.detalleInforme.fecha_implementacion,
      usuario_id:           this.usuarioId,
    };
    this.proyectoService.actualizarInforme(this.detalleInforme.id, body).subscribe({
      next: () => this.showToast('Plan de acción guardado', 'success'),
      error: () => this.showToast('No se pudo guardar el plan', 'error'),
    });
  }
 
  eliminarInforme(informe: Informe): void {
    Swal.fire({
      title: '¿Eliminar informe?',
      text: `Se eliminará "${informe.titulo}" y sus tareas asociadas`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar',
    }).then(r => r.isConfirmed && this.proyectoService.eliminarInforme(informe.id, this.usuarioId).subscribe({
      next: () => {
        this.showToast('Informe eliminado', 'success');
        this.cargarInformes();
        if (this.showDetalleInformeModal && this.detalleInforme?.id === informe.id) {
          this.cerrarDetalleInforme();
        }
      },
      error: () => this.showToast('No se pudo eliminar', 'error'),
    }));
  }
 
  // ─── DETALLE INFORME ───────────────────────────────────────────────────────
 
  verDetalleInforme(informe: Informe): void {
    this.showDetalleInformeModal = true;
    this.loadingDetalleInforme   = true;
    this.tabInforme              = 'tareas';
    this._cargarUsuariosAsignables();
    this.proyectoService.getInformeDetalle(informe.id, this.usuarioId).subscribe({
      next: res => {
        this.detalleInforme        = res.data;
        this.loadingDetalleInforme = false;
      },
      error: () => { this.loadingDetalleInforme = false; },
    });
  }
 
  cerrarDetalleInforme(): void {
    this.showDetalleInformeModal   = false;
    this.detalleInforme            = null;
    this.showInlineInformeTarea    = false;
    this.inlineEditInformeTareaId  = null;
  }
 
  private _refreshDetalleInforme(): void {
    if (!this.detalleInforme) return;
    this.proyectoService.getInformeDetalle(this.detalleInforme.id, this.usuarioId).subscribe({
      next: res => {
        if (!this.detalleInforme) return;
        this.detalleInforme.tareas             = res.data.tareas;
        this.detalleInforme.total_tareas       = res.data.total_tareas;
        this.detalleInforme.tareas_completadas = res.data.tareas_completadas;
        this.detalleInforme.tareas_vencidas    = res.data.tareas_vencidas;
        this.detalleInforme.progreso           = res.data.progreso;
        this.detalleInforme.estado             = res.data.estado;
        this.cargarInformes();
        this.cargarMisTareasInforme();
      },
      error: () => {},
    });
  }
 
  puedeGestionarInforme(informe: Informe | null): boolean {
    if (!informe) return false;
    return this.puedeGestionarModulo || informe.creado_por === this.usuarioId || !!informe.puede_gestionar;
  }
 
  // ─── INLINE CREATE TAREA INFORME ───────────────────────────────────────────
 
  abrirInlineInformeTarea(): void {
    this.cancelarInlineEditInformeTarea();
    this.inlineInformeTareaForm = {
      titulo: '', descripcion: '', estado: 'pendiente',
      fecha_limite_entrega: '', responsable_id: null,
    };
    this.showInlineInformeTarea              = true;
    this.showInlineInformeTareaEstado        = false;
    this.showInlineInformeTareaResponsable   = false;
    this.inlineInformeTareaResponsableBusqueda = '';
    setTimeout(() => {
      const el = document.querySelector('[data-inline-informe-title]') as HTMLInputElement;
      el?.focus();
    }, 50);
  }
 
  cancelarInlineInformeTarea(): void {
    this.showInlineInformeTarea              = false;
    this.showInlineInformeTareaEstado        = false;
    this.showInlineInformeTareaResponsable   = false;
    this.inlineInformeTareaResponsableBusqueda = '';
    this.inlineInformeTareaForm = { titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', responsable_id: null };
  }
 
guardarInlineInformeTarea(): void {
if (!this.inlineInformeTareaForm.titulo?.trim() || !this.detalleInforme) {
  this.cancelarInlineInformeTarea(); return;
}
if (this.inlineInformeTareaGuardando) return;
this.inlineInformeTareaGuardando = true;

const body = {
  ...this.inlineInformeTareaForm,
  informe_id: this.detalleInforme.id,
  usuario_id: this.usuarioId,
  estado: this.inlineInformeTareaForm.estado as any,
};

this.proyectoService.crearInformeTarea(body).subscribe({
      next: () => {
        this.inlineInformeTareaGuardando = false;
        this.inlineInformeTareaForm = {
          titulo: '', descripcion: '', estado: 'pendiente',
          fecha_limite_entrega: '', responsable_id: null,
        };
        this.showInlineInformeTareaEstado        = false;
        this.showInlineInformeTareaResponsable   = false;
        this.inlineInformeTareaResponsableBusqueda = '';
        this.showToast('Tarea creada', 'success');
        this._refreshDetalleInforme();
        setTimeout(() => {
          const el = document.querySelector('[data-inline-informe-title]') as HTMLInputElement;
          el?.focus();
        }, 60);
      },
      error: () => {
        this.inlineInformeTareaGuardando = false;
        this.showToast('No se pudo crear la tarea', 'error');
      },
    });
  }
 
  onInlineInformeTareaKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter')  { event.preventDefault(); this.guardarInlineInformeTarea(); }
    if (event.key === 'Escape') { event.preventDefault(); this.cancelarInlineInformeTarea(); }
  }
 
  // ─── INLINE EDIT TAREA INFORME ─────────────────────────────────────────────
 
  abrirInlineEditInformeTarea(tarea: InformeTarea): void {
    this.cancelarInlineInformeTarea();
    this.inlineEditInformeTareaId    = tarea.id;
    this.inlineEditInformeTareaForm  = {
      titulo:               tarea.titulo,
      descripcion:          tarea.descripcion ?? '',
      estado:               tarea.estado,
      fecha_limite_entrega: this._toDateTimeLocal(tarea.fecha_limite_entrega),
      responsable_id:       tarea.responsable_id,
    };
    this.inlineEditInformeTareaOriginalForm = { ...this.inlineEditInformeTareaForm };

    this.showInlineEditInformeTareaEstado        = false;
    this.showInlineEditInformeTareaResponsable   = false;
    this.inlineEditInformeTareaResponsableBusqueda = '';
  }
 
  cancelarInlineEditInformeTarea(): void {
    this.inlineEditInformeTareaId              = null;
    this.showInlineEditInformeTareaEstado      = false;
    this.showInlineEditInformeTareaResponsable = false;
    this.inlineEditInformeTareaResponsableBusqueda = '';
    this.inlineEditInformeTareaOriginalForm    = null;
  }
 
  guardarInlineEditInformeTarea(): void {
    if (!this.inlineEditInformeTareaId) return;
    if (!this.inlineEditInformeTareaForm.titulo?.trim()) {
      this.cancelarInlineEditInformeTarea(); return;
    }
    const id   = this.inlineEditInformeTareaId;
    const body = { 
      ...this.inlineEditInformeTareaForm,
      estado: this.inlineEditInformeTareaForm.estado as any,
      usuario_id: this.usuarioId 
    };
    this.cancelarInlineEditInformeTarea();
    this.proyectoService.actualizarInformeTarea(id, body).subscribe({
      next:  () => { this.showToast('Tarea actualizada', 'success'); this._refreshDetalleInforme(); },
      error: () => this.showToast('No se pudo actualizar', 'error'),
    });
  }
 
  onInlineEditInformeTareaKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter')  { event.preventDefault(); this.guardarInlineEditInformeTarea(); }
    if (event.key === 'Escape') { event.preventDefault(); this.cancelarInlineEditInformeTarea(); }
  }
 
  // ─── CRUD TAREAS INFORME ───────────────────────────────────────────────────
 
  completarInformeTarea(tarea: InformeTarea): void {
    Swal.fire({
      title: '¿Marcar como completada?', icon: 'question',
      showCancelButton: true, confirmButtonText: 'Sí', confirmButtonColor: '#16a34a',
    }).then(r => r.isConfirmed && this.proyectoService.completarInformeTarea(tarea.id, this.usuarioId).subscribe({
      next:  () => { this.showToast('¡Tarea completada!', 'success'); this._refreshDetalleInforme(); },
      error: () => this.showToast('No se pudo completar', 'error'),
    }));
  }
 
  completarMiInformeTarea(tarea: InformeTarea): void {
    Swal.fire({
      title: '¿Marcar como completada?', icon: 'question',
      showCancelButton: true, confirmButtonText: 'Sí', confirmButtonColor: '#16a34a',
    }).then(r => r.isConfirmed && this.proyectoService.completarInformeTarea(tarea.id, this.usuarioId).subscribe({
      next:  () => { this.showToast('¡Tarea completada!', 'success'); this.cargarMisTareasInforme(); },
      error: () => this.showToast('No se pudo completar', 'error'),
    }));
  }
 
  eliminarInformeTarea(tarea: InformeTarea): void {
    Swal.fire({
      title: '¿Eliminar tarea?', text: `"${tarea.titulo}"`, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar',
    }).then(r => r.isConfirmed && this.proyectoService.eliminarInformeTarea(tarea.id, this.usuarioId).subscribe({
      next:  () => { this.showToast('Tarea eliminada', 'success'); this._refreshDetalleInforme(); },
      error: () => this.showToast('No se pudo eliminar', 'error'),
    }));
  }
 
  // ─── HELPERS DE ESTILO INFORMES ────────────────────────────────────────────
 
  getImpactoBadgeClass(nivel: string): string {
    return ({
      'Crítico': 'bg-red-100 text-red-800 border border-red-300',
      'Alto':    'bg-rose-100 text-rose-700 border border-rose-200',
      'Medio':   'bg-orange-100 text-orange-700 border border-orange-200',
      'Bajo':    'bg-yellow-100 text-yellow-700 border border-yellow-200',
    })[nivel] ?? 'bg-gray-100 text-gray-700';
  }
 
  getTipoBadgeClass(tipo: string): string {
    return ({
      'Incidente':                  'bg-red-50 text-red-700 border border-red-200',
      'Hallazgo de Auditoría':      'bg-purple-50 text-purple-700 border border-purple-200',
      'Riesgo Tecnológico':         'bg-orange-50 text-orange-700 border border-orange-200',
      'Vulnerabilidad de Seguridad':'bg-rose-50 text-rose-700 border border-rose-200',
      'Mejora del Proceso':         'bg-teal-50 text-teal-700 border border-teal-200',
    })[tipo] ?? 'bg-gray-100 text-gray-700';
  }
 
  getEstadoInformeBadgeClass(estado: string): string {
    return ({
      abierto:    'bg-red-100 text-red-700 border border-red-200',
      en_proceso: 'bg-amber-100 text-amber-700 border border-amber-200',
      cerrado:    'bg-green-100 text-green-700 border border-green-200',
    })[estado] ?? 'bg-gray-100 text-gray-700';
  }
 
  getEstadoInformeIcon(estado: string): string {
    return ({ abierto: 'bi-exclamation-circle', en_proceso: 'bi-arrow-repeat', cerrado: 'bi-check-circle-fill' })[estado] ?? 'bi-circle';
  }
 
  // Nombre del responsable de tarea de informe
  nombreResponsableInformeTarea(tarea: InformeTarea): string {
    return this.nombreUsuario(tarea.responsable_id);
  }
 
  // Getter usuarios filtrados para inline de informe (crear)
  get inlineInformeTareaResponsablesFiltrados(): any[] {
    const q = this.inlineInformeTareaResponsableBusqueda.toLowerCase();
    return q
      ? this.usuariosAsignables.filter(u => u.nombre.toLowerCase().includes(q))
      : this.usuariosAsignables;
  }
 
  // Getter usuarios filtrados para inline de informe (editar)
  get inlineEditInformeTareaResponsablesFiltrados(): any[] {
    const q = this.inlineEditInformeTareaResponsableBusqueda.toLowerCase();
    return q
      ? this.usuariosAsignables.filter(u => u.nombre.toLowerCase().includes(q))
      : this.usuariosAsignables;
  }

  // ─── EDITOR ENRIQUECIDO ─────────────────────────────────────────────────
  // -- Editor enriquecido --------------------------------------------------------
  execCmd(cmd: string, value?: string): void {
    document.execCommand(cmd, false, value ?? '');
    this.richEditorRef?.nativeElement?.focus();
  }
  
  insertTable(): void {
    const r = this.tableInsertRows, c = this.tableInsertCols;
    let html = `<table style="border-collapse:collapse;width:100%;margin:8px 0"><tbody>`;
    for (let i = 0; i < r; i++) {
      html += '<tr>';
      for (let j = 0; j < c; j++) {
        html += `<td style="border:1px solid #d1d5db;padding:6px 10px;min-width:80px">&nbsp;</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    this.showTableInsert = false;
    this.richEditorRef?.nativeElement?.focus();
  }
  
  onEditorInput(event: Event): void {
    this.tabDocumentosContent = (event.target as HTMLElement).innerHTML;
  }
  
  initEditorContent(): void {
    this.tabDocumentosContent = (this.detalleInforme as any)?.documentos_html ?? '';
    setTimeout(() => {
      if (this.richEditorRef?.nativeElement) {
        this.richEditorRef.nativeElement.innerHTML = this.tabDocumentosContent;
      }
    }, 0);
  }
  
  guardarDocumentos(): void {
    if (!this.detalleInforme) return;
    this.proyectoService.actualizarInforme(this.detalleInforme.id, {
      documentos_html: this.tabDocumentosContent,
      usuario_id:      this.usuarioId,
    } as any).subscribe({
      next:  () => this.showToast('Documento guardado', 'success'),
      error: () => this.showToast('Error al guardar el documento', 'error'),
    });
  }
}
