import { Component, OnInit, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  ProyectoService,
  Proyecto, Actividad, Tarea,
  SeguimientoMensual, SeguimientoSemana, SeguimientoTarea,
  ConfiguracionSemaforo, PermisoGranular, MisPermisos, Semaforo, NivelTarea,
} from 'src/app/services/proyectos.service';
import { UserService } from 'src/app/services/user.service';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';

interface UsuarioOpcion { id: number; nombre: string; }

interface CalendarioDia {
  fecha:        Date;
  esHoy:        boolean;
  esMesActual:  boolean;
  tareas:       { tarea: SeguimientoTarea; nombreUsuario: string }[];
  resumenPorUsuario: { uid: number; iniciales: string; nombre: string; total: number; completadas: number; semaforo: string }[];
}

// Plantillas de rol → permisos predefinidos
const PLANTILLAS_ROL: Record<string, Omit<PermisoGranular, 'usuario_id' | 'nombre'>> = {
  gestor:      { puede_crear: true,  puede_editar: true,  puede_eliminar: true,  puede_asignar: true,  puede_cambiar_fechas: true,  puede_gestionar_permisos: true  },
  admin:       { puede_crear: true,  puede_editar: true,  puede_eliminar: true,  puede_asignar: true,  puede_cambiar_fechas: true,  puede_gestionar_permisos: false },
  editor:      { puede_crear: true,  puede_editar: true,  puede_eliminar: false, puede_asignar: true,  puede_cambiar_fechas: false, puede_gestionar_permisos: false },
  colaborador: { puede_crear: false, puede_editar: true,  puede_eliminar: false, puede_asignar: false, puede_cambiar_fechas: false, puede_gestionar_permisos: false },
  lector:      { puede_crear: false, puede_editar: false, puede_eliminar: false, puede_asignar: false, puede_cambiar_fechas: false, puede_gestionar_permisos: false },
};

@Component({
  selector: 'app-proyectos',
  templateUrl: './proyectos.component.html',
  styleUrls: ['./proyectos.component.css'],
})
export class ProyectosComponent implements OnInit {

  // ── USUARIO ───────────────────────────────────────────────────────────────
  get usuarioId(): number          { return this.authService.user?.id ?? 0; }
  get esAdminSistema(): boolean    { return this.authService.hasRole('Administrador del sistema'); }
  get esGestorProyectos(): boolean { return this.authService.hasRole('Gestor de Proyectos'); }
  get puedeGestionarModulo(): boolean { return this.esAdminSistema || this.esGestorProyectos; }

  readonly plantillasRol = Object.keys(PLANTILLAS_ROL);

  // ── ESTADO GENERAL ────────────────────────────────────────────────────────
  vista: 'proyectos' | 'seguimientos' = 'proyectos';
  proyectos: Proyecto[] = [];
  loading    = false;
  filtroEstado = 'todos';

  // ── MODAL PROYECTO ────────────────────────────────────────────────────────
  showModalProyecto  = false;
  modalProyectoTitle = '';
  proyectoForm: any  = {};
  selectedProyecto: Proyecto | null = null;

  // ── MODAL ACTIVIDAD ───────────────────────────────────────────────────────
  showModalActividad  = false;
  modalActividadTitle = '';
  actividadForm: any  = {};
  selectedActividad: Actividad | null = null;

  // ── MODAL TAREA ───────────────────────────────────────────────────────────
  showModalTarea    = false;
  modalTareaTitle   = '';
  tareaForm: any    = {};
  selectedTarea: Tarea | null = null;
  nivelTareaActual: NivelTarea = 'sin_acceso';

  // ── DETALLE PROYECTO ──────────────────────────────────────────────────────
  showDetalleModal     = false;
  loadingDetalle       = false;
  detalleProyecto: Proyecto | null = null;
  actividadExpandidaId: number | null = null;

  // ── MODAL PERMISOS GRANULARES ─────────────────────────────────────────────
  showModalPermisos  = false;
  permisosEntidad:   { tipo: 'proyecto' | 'actividad' | 'tarea'; id: number } | null = null;
  permisosActuales:  PermisoGranular[] = [];
  nuevaAsignacion:   PermisoGranular = this._nuevoPermisovacio();
  busquedaUsuario    = '';
  usuariosFiltrados: UsuarioOpcion[] = [];
  usuariosCache:     UsuarioOpcion[] = [];
  loadingUsuarios    = false;

  // ── MODAL SEGUIMIENTO ─────────────────────────────────────────────────────
  showModalSeguimiento     = false;
  seguimientoForm: any     = {};
  participantesSeleccionados: UsuarioOpcion[] = [];
  busquedaParticipante     = '';
  usuariosParticipantes:   UsuarioOpcion[] = [];
  loadingParticipantes     = false;

  // ── CONFIG SEMÁFORO ───────────────────────────────────────────────────────
  showModalConfig = false;
  configForm: Record<string, ConfiguracionSemaforo> = {};

  // ── SEGUIMIENTOS ──────────────────────────────────────────────────────────
  seguimientos: SeguimientoMensual[] = [];
  loadingSeguimientos  = false;
  detalleSeguimiento: SeguimientoMensual | null = null;
  showDetalleSeguimiento = false;
  loadingDetalleSeg    = false;
  showModalSegTarea    = false;
  segTareaForm: any    = {};
  selectedSegTarea: SeguimientoTarea | null = null;
  semanaActual: SeguimientoSemana | null = null;

  // ── FILTROS SEGUIMIENTO ───────────────────────────────────────────────────
  filtroSemanasSelec:  number[] = [];
  filtroUsuariosSelec: number[] = [];
  vistaCalendario = false;
  calendarioDias: CalendarioDia[][] = [];

  meses = [
    { v: 1, l: 'Enero' },  { v: 2, l: 'Febrero' },  { v: 3, l: 'Marzo' },
    { v: 4, l: 'Abril' },  { v: 5, l: 'Mayo' },     { v: 6, l: 'Junio' },
    { v: 7, l: 'Julio' },  { v: 8, l: 'Agosto' },   { v: 9, l: 'Septiembre' },
    { v: 10, l: 'Octubre' },{ v: 11, l: 'Noviembre' },{ v: 12, l: 'Diciembre' },
  ];
  diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  constructor(
    private proyectoService: ProyectoService,
    private userService: UserService,
    public  authService: AuthService,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  ngOnInit(): void {
    this.loadAssets();
    this.cargarProyectos();
  }

  private loadAssets(): void {
    const addLink = (href: string) => {
      const l = this.document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      this.document.head.appendChild(l);
    };
    addLink('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');
    addLink('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css');
  }

  // ════════════════════════════════════════════════════════════════════════
  // HELPERS DE PERMISOS — reemplaza el bloque completo en el componente
  // ════════════════════════════════════════════════════════════════════════

  /** Gestión total: puede asignar permisos a otros */
  esAdminProyecto(p: Proyecto): boolean {
    if (this.puedeGestionarModulo) return true;
    return p.mis_permisos?.puede_gestionar_permisos ?? false;
  }

  /** Puede crear actividades / tareas dentro del proyecto */
  puedeCrearEnProyecto(p: Proyecto): boolean {
    if (this.puedeGestionarModulo) return true;
    return p.mis_permisos?.puede_crear ?? false;
  }

  /** Puede editar título / descripción / estado */
  puedeEditarProyecto(p: Proyecto): boolean {
    if (this.puedeGestionarModulo) return true;
    return p.mis_permisos?.puede_editar ?? false;
  }

  /** Puede eliminar el proyecto, actividades y tareas */
  puedeEliminarProyecto(p: Proyecto): boolean {
    if (this.puedeGestionarModulo) return true;
    return p.mis_permisos?.puede_eliminar ?? false;
  }

  /** Puede modificar fechas límite */
  puedeCambiarFechas(p: Proyecto): boolean {
    if (this.puedeGestionarModulo) return true;
    return p.mis_permisos?.puede_cambiar_fechas ?? false;
  }

  /**
   * Puede completar una tarea específica:
   * - gestor/admin del módulo
   * - admin del proyecto
   * - creador de la tarea
   * - está en responsables
   * - tiene permiso puede_editar heredado
   */
  puedeCompletarTarea(tarea: Tarea): boolean {
    if (this.puedeGestionarModulo) return true;
    if (!this.detalleProyecto) return false;
    if (this.esAdminProyecto(this.detalleProyecto)) return true;
    if (tarea.creado_por === this.usuarioId) return true;
    return (tarea.responsables ?? []).includes(this.usuarioId);
  }

  // ════════════════════════════════════════════════════════════════════════
  // SEMÁFORO / ESTADO
  // ════════════════════════════════════════════════════════════════════════

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
    const map: Record<string, string> = {
      rojo:     'bg-red-50 text-red-700 border border-red-200',
      amarillo: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
      verde:    'bg-green-50 text-green-700 border border-green-200',
      gris:     'bg-gray-50 text-gray-600 border border-gray-200',
    };
    return map[semaforo] ?? 'bg-gray-50 text-gray-600 border border-gray-200';
  }

  getEstadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente:    'bg-gray-100 text-gray-700 border border-gray-300',
      en_ejecucion: 'bg-blue-100 text-blue-700 border border-blue-200',
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
      pendiente: 'bi-clock', en_ejecucion: 'bi-play-circle', completado: 'bi-check-circle-fill',
      pausado: 'bi-pause-circle', cancelado: 'bi-x-circle', bloqueado: 'bi-lock',
      activo: 'bi-play-circle', cerrado: 'bi-lock-fill',
    };
    return map[estado] ?? 'bi-circle';
  }

  calcularProgresoActividad(actividad: Actividad): number {
    const total = actividad.total_tareas ?? 0;
    if (total === 0) return 0;
    return Math.round(((actividad.tareas_completadas ?? 0) / total) * 100);
  }

  // ════════════════════════════════════════════════════════════════════════
  // PROYECTOS
  // ════════════════════════════════════════════════════════════════════════

  cargarProyectos(): void {
    this.loading = true;
    const filtros = this.filtroEstado === 'todos' ? { activos: true } : { estado: this.filtroEstado };
    this.proyectoService.getProyectos(this.usuarioId, filtros).subscribe({
      next:  (res) => { this.proyectos = res.data; this.loading = false; },
      error: ()    => { this.loading = false; Swal.fire('Error', 'No se pudieron cargar los proyectos', 'error'); },
    });
  }

  abrirModalCrearProyecto(): void {
    this.proyectoForm      = { titulo: '', descripcion: '', fecha_limite_entrega: '' };
    this.modalProyectoTitle = 'Nuevo Proyecto';
    this.selectedProyecto  = null;
    this.showModalProyecto = true;
  }

  abrirModalEditarProyecto(proyecto: Proyecto): void {
    this.proyectoForm = {
      titulo: proyecto.titulo, descripcion: proyecto.descripcion,
      fecha_limite_entrega: proyecto.fecha_limite_entrega, estado: proyecto.estado,
    };
    this.modalProyectoTitle = 'Editar Proyecto';
    this.selectedProyecto  = proyecto;
    this.showModalProyecto = true;
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

  verDetalleProyecto(proyecto: Proyecto): void {
    this.loadingDetalle   = true;
    this.showDetalleModal = true;
    this.proyectoService.getDetalleCompleto(proyecto.id, this.usuarioId).subscribe({
      next:  (res) => { this.detalleProyecto = res.data; this.loadingDetalle = false; },
      error: ()    => { this.loadingDetalle = false; Swal.fire('Error', 'No se pudo cargar el detalle', 'error'); },
    });
  }

  cerrarDetalle(): void { this.showDetalleModal = false; this.detalleProyecto = null; this.actividadExpandidaId = null; }
  toggleActividad(id: number): void { this.actividadExpandidaId = this.actividadExpandidaId === id ? null : id; }

  // ════════════════════════════════════════════════════════════════════════
  // ACTIVIDADES
  // ════════════════════════════════════════════════════════════════════════

  abrirModalCrearActividad(proyecto: Proyecto): void {
    this.actividadForm      = { proyecto_id: proyecto.id, titulo: '', descripcion: '', fecha_limite_entrega: '' };
    this.modalActividadTitle = 'Nueva Actividad';
    this.selectedActividad  = null;
    this.showModalActividad = true;
  }

  abrirModalEditarActividad(actividad: Actividad): void {
    this.actividadForm       = { titulo: actividad.titulo, descripcion: actividad.descripcion, estado: actividad.estado, fecha_limite_entrega: actividad.fecha_limite_entrega };
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

  // ════════════════════════════════════════════════════════════════════════
  // TAREAS
  // ════════════════════════════════════════════════════════════════════════

  abrirModalCrearTarea(actividad: Actividad): void {
    this.tareaForm        = { actividad_id: actividad.id, titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', notas: '' };
    this.modalTareaTitle  = 'Nueva Tarea';
    this.selectedTarea    = null;
    this.nivelTareaActual = 'admin';
    this.showModalTarea   = true;
  }

  abrirModalEditarTarea(tarea: Tarea, nivel: NivelTarea): void {
    this.tareaForm = { titulo: tarea.titulo, descripcion: tarea.descripcion, estado: tarea.estado, fecha_limite_entrega: tarea.fecha_limite_entrega, notas: tarea.notas };
    this.modalTareaTitle  = 'Editar Tarea';
    this.selectedTarea    = tarea;
    this.nivelTareaActual = nivel;
    this.showModalTarea   = true;
  }

  guardarTarea(): void {
    if (!this.tareaForm.titulo?.trim()) { Swal.fire('Validación', 'El título es obligatorio', 'warning'); return; }
    const body = { ...this.tareaForm, usuario_id: this.usuarioId };
    const req$ = this.selectedTarea
      ? this.proyectoService.actualizarTarea(this.selectedTarea.id, body)
      : this.proyectoService.crearTarea(body);
    req$.subscribe({
      next:  (res: any) => { Swal.fire('Éxito', res.message ?? 'Operación exitosa', 'success'); this.cerrarModalTarea(); if (this.detalleProyecto) this.verDetalleProyecto(this.detalleProyecto); },
      error: ()         => Swal.fire('Error', 'No se pudo guardar la tarea', 'error'),
    });
  }

  cerrarModalTarea(): void { this.showModalTarea = false; this.selectedTarea = null; }

  completarTarea(tarea: Tarea): void {
    Swal.fire({ title: '¿Marcar como completada?', icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, completar', confirmButtonColor: '#16a34a' })
      .then(r => r.isConfirmed && this.proyectoService.completarTarea(tarea.id, this.usuarioId).subscribe({
        next:  () => { Swal.fire('¡Completada!', 'La tarea fue marcada como completada.', 'success'); if (this.detalleProyecto) this.verDetalleProyecto(this.detalleProyecto); },
        error: () => Swal.fire('Error', 'No se pudo completar la tarea', 'error'),
      }));
  }

  eliminarTarea(tarea: Tarea): void {
    Swal.fire({ title: '¿Eliminar tarea?', text: `"${tarea.titulo}"`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' })
      .then(r => r.isConfirmed && this.proyectoService.eliminarTarea(tarea.id, this.usuarioId).subscribe({
        next:  () => { Swal.fire('Eliminada', 'Tarea eliminada', 'success'); if (this.detalleProyecto) this.verDetalleProyecto(this.detalleProyecto); },
        error: () => Swal.fire('Error', 'No se pudo eliminar', 'error'),
      }));
  }

  // ════════════════════════════════════════════════════════════════════════
  // PERMISOS GRANULARES
  // ════════════════════════════════════════════════════════════════════════

  abrirModalPermisos(tipo: 'proyecto' | 'actividad' | 'tarea', id: number): void {
    this.permisosEntidad   = { tipo, id };
    this.permisosActuales  = [];
    this.nuevaAsignacion   = this._nuevoPermisovacio();
    this.busquedaUsuario   = '';
    this.usuariosFiltrados = [];
    this.showModalPermisos = true;
    this._cargarPermisosEntidad(tipo, id);
    this._cargarUsuariosCache();
  }

  private _cargarPermisosEntidad(tipo: 'proyecto' | 'actividad' | 'tarea', id: number): void {
    this.proyectoService.getPermisosEntidad(tipo, id, this.usuarioId).subscribe({
      next: (res) => {
        this.permisosActuales = res.data.map(p => ({
          ...p,
          nombre: this.usuariosCache.find(u => u.id === p.usuario_id)?.nombre,
        }));
      },
    });
  }

  private _cargarUsuariosCache(): void {
    if (this.usuariosCache.length) return;
    this.loadingUsuarios = true;
    this.userService.getAll().subscribe({
      next: (usuarios: any[]) => {
        this.usuariosCache   = usuarios.map(u => ({ id: u.id, nombre: u.nombre_completo || `${u.firstName} ${u.lastName}`.trim() }));
        this.permisosActuales = this.permisosActuales.map(p => ({ ...p, nombre: this.usuariosCache.find(u => u.id === p.usuario_id)?.nombre ?? p.nombre }));
        this.loadingUsuarios  = false;
      },
      error: () => { this.loadingUsuarios = false; },
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

  seleccionarUsuarioPermiso(usuario: UsuarioOpcion): void {
    this.nuevaAsignacion.usuario_id = usuario.id;
    this.nuevaAsignacion.nombre     = usuario.nombre;
    this.busquedaUsuario   = usuario.nombre;
    this.usuariosFiltrados = [];
  }

  aplicarPlantilla(permiso: PermisoGranular, plantilla: string): void {
    const tpl = PLANTILLAS_ROL[plantilla];
    if (!tpl) return;
    Object.assign(permiso, tpl);
  }

  agregarPermiso(): void {
    if (!this.nuevaAsignacion.usuario_id) return;
    const existe = this.permisosActuales.find(p => p.usuario_id === this.nuevaAsignacion.usuario_id);
    if (existe) {
      Object.assign(existe, { ...this.nuevaAsignacion });
    } else {
      this.permisosActuales = [...this.permisosActuales, { ...this.nuevaAsignacion }];
    }
    this.nuevaAsignacion = this._nuevoPermisovacio();
    this.busquedaUsuario = '';
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

  cerrarModalPermisos(): void { this.showModalPermisos = false; this.permisosEntidad = null; }

  private _nuevoPermisovacio(): PermisoGranular {
    return { usuario_id: 0, nombre: '', puede_crear: false, puede_editar: false, puede_eliminar: false, puede_asignar: false, puede_cambiar_fechas: false, puede_gestionar_permisos: false };
  }

  // ════════════════════════════════════════════════════════════════════════
  // CONFIG SEMÁFORO
  // ════════════════════════════════════════════════════════════════════════

  abrirModalConfig(): void {
    this.proyectoService.getConfigSemaforo().subscribe({
      next: (res) => { this.configForm = {}; res.data.forEach(c => this.configForm[c.tipo] = { ...c }); this.showModalConfig = true; },
      error: () => Swal.fire('Error', 'No se pudo cargar la configuración', 'error'),
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

  // ════════════════════════════════════════════════════════════════════════
  // SEGUIMIENTOS
  // ════════════════════════════════════════════════════════════════════════

  cargarSeguimientos(): void {
    this.loadingSeguimientos = true;
    this.proyectoService.getSeguimientos(this.usuarioId).subscribe({
      next:  (res) => { this.seguimientos = res.data; this.loadingSeguimientos = false; },
      error: ()    => { this.loadingSeguimientos = false; Swal.fire('Error', 'No se pudieron cargar los seguimientos', 'error'); },
    });
  }

  cambiarVista(v: 'proyectos' | 'seguimientos'): void {
    this.vista = v;
    if (v === 'seguimientos' && !this.seguimientos.length) this.cargarSeguimientos();
  }

  abrirModalCrearSeguimiento(): void {
    const hoy = new Date();
    this.seguimientoForm            = { mes: hoy.getMonth() + 1, anio: hoy.getFullYear(), titulo: '' };
    this.participantesSeleccionados = [];
    this.busquedaParticipante       = '';
    this.showModalSeguimiento       = true;
    this._cargarUsuariosParticipantes();
  }

  private _cargarUsuariosParticipantes(): void {
    if (this.usuariosCache.length) { this.usuariosParticipantes = [...this.usuariosCache]; return; }
    this.loadingParticipantes = true;
    this.userService.getAll().subscribe({
      next: (usuarios: any[]) => {
        this.usuariosCache         = usuarios.map(u => ({ id: u.id, nombre: u.nombre_completo || `${u.firstName} ${u.lastName}`.trim() }));
        this.usuariosParticipantes = [...this.usuariosCache];
        this.loadingParticipantes  = false;
      },
      error: () => { this.loadingParticipantes = false; },
    });
  }

  filtrarParticipantes(): void {
    const q          = this.busquedaParticipante.toLowerCase().trim();
    const yaAgregados = new Set(this.participantesSeleccionados.map(p => p.id));
    this.usuariosParticipantes = this.usuariosCache
      .filter(u => u.id !== this.usuarioId && !yaAgregados.has(u.id) && (!q || u.nombre.toLowerCase().includes(q)))
      .slice(0, 10);
  }

  agregarParticipante(usuario: UsuarioOpcion): void {
    if (!this.participantesSeleccionados.find(p => p.id === usuario.id)) {
      this.participantesSeleccionados = [...this.participantesSeleccionados, usuario];
    }
    this.busquedaParticipante = '';
    this.filtrarParticipantes();
  }

  quitarParticipante(id: number): void {
    this.participantesSeleccionados = this.participantesSeleccionados.filter(p => p.id !== id);
    this.filtrarParticipantes();
  }

  guardarSeguimiento(): void {
    if (!this.seguimientoForm.mes || !this.seguimientoForm.anio) { Swal.fire('Validación', 'Mes y año son requeridos', 'warning'); return; }
    const participantes = this.participantesSeleccionados.map(p => p.id);
    this.proyectoService.crearSeguimiento({ ...this.seguimientoForm, usuario_id: this.usuarioId, participantes }).subscribe({
      next:  (res: any) => { Swal.fire('Éxito', res.message ?? 'Seguimiento creado', 'success'); this.showModalSeguimiento = false; this.cargarSeguimientos(); },
      error: ()         => Swal.fire('Error', 'No se pudo crear el seguimiento', 'error'),
    });
  }

  verDetalleSeguimiento(seguimiento: SeguimientoMensual): void {
    this.loadingDetalleSeg      = true;
    this.showDetalleSeguimiento = true;
    this.filtroSemanasSelec     = [];
    this.filtroUsuariosSelec    = [];
    this.vistaCalendario        = false;
    this.proyectoService.getDetalleSeguimiento(seguimiento.id, this.usuarioId).subscribe({
      next:  (res) => { this.detalleSeguimiento = res.data; this.loadingDetalleSeg = false; this._construirCalendario(); },
      error: ()    => { this.loadingDetalleSeg = false; Swal.fire('Error', 'No se pudo cargar el detalle', 'error'); },
    });
  }

  cerrarDetalleSeguimiento(): void { this.showDetalleSeguimiento = false; this.detalleSeguimiento = null; this.calendarioDias = []; }

  cerrarSeguimiento(seg: SeguimientoMensual): void {
    Swal.fire({ title: '¿Cerrar seguimiento?', text: 'Ya no se podrán agregar ni editar tareas.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, cerrar' })
      .then(r => r.isConfirmed && this.proyectoService.cerrarSeguimiento(seg.id, this.usuarioId).subscribe({
        next:  () => { Swal.fire('Cerrado', 'Seguimiento cerrado', 'success'); this.cargarSeguimientos(); if (this.detalleSeguimiento?.id === seg.id) this.cerrarDetalleSeguimiento(); },
        error: () => Swal.fire('Error', 'No se pudo cerrar', 'error'),
      }));
  }

  nombreMes(mes: number): string { return this.meses.find(m => m.v === mes)?.l ?? String(mes); }

  // ─── FILTROS SEGUIMIENTO ──────────────────────────────────────────────────

  toggleSemanaFiltro(semanaId: number): void {
    const idx = this.filtroSemanasSelec.indexOf(semanaId);
    idx >= 0 ? this.filtroSemanasSelec.splice(idx, 1) : this.filtroSemanasSelec.push(semanaId);
    this._construirCalendario();
  }

  semanaVisible(semanaId: number): boolean {
    return this.filtroSemanasSelec.length === 0 || this.filtroSemanasSelec.includes(semanaId);
  }

  toggleUsuarioFiltro(uid: number): void {
    const idx = this.filtroUsuariosSelec.indexOf(uid);
    idx >= 0 ? this.filtroUsuariosSelec.splice(idx, 1) : this.filtroUsuariosSelec.push(uid);
    this._construirCalendario();
  }

  usuarioVisible(uid: number): boolean {
    return this.filtroUsuariosSelec.length === 0 || this.filtroUsuariosSelec.includes(uid);
  }

  get semanasParaMostrar(): any[] {
    return (this.detalleSeguimiento?.semanas ?? []).filter((s: any) => this.semanaVisible(s.id));
  }

  get participantesDelSeguimiento(): { id: number; nombre: string }[] {
    return this.detalleSeguimiento?.participantes_info ?? [];
  }

  // ─── CALENDARIO ───────────────────────────────────────────────────────────

  public _construirCalendario(): void {
    if (!this.detalleSeguimiento) return;

    const mes  = this.detalleSeguimiento.mes;
    const anio = this.detalleSeguimiento.anio;
    const hoy  = new Date();

    const primerDia   = new Date(anio, mes - 1, 1);
    const offsetLunes = (primerDia.getDay() + 6) % 7;
    const inicioGrid  = new Date(primerDia);
    inicioGrid.setDate(primerDia.getDate() - offsetLunes);

    // Construir mapa fecha → lista de tareas (con usuario)
    const mapa = new Map<string, { tarea: SeguimientoTarea; nombreUsuario: string }[]>();

    (this.detalleSeguimiento.semanas ?? []).forEach((semana: any) => {
      if (!this.semanaVisible(semana.id)) return;

      const agregar = (t: SeguimientoTarea) => {
        if (!this.usuarioVisible(t.usuario_id) || !t.fecha_limite_entrega) return;
        const key = new Date(t.fecha_limite_entrega).toDateString();
        if (!mapa.has(key)) mapa.set(key, []);
        mapa.get(key)!.push({ tarea: t, nombreUsuario: this.nombreUsuario(t.usuario_id) });
      };

      if (this.esTareasAgrupadas(semana.tareas)) {
        Object.values(semana.tareas as Record<string, SeguimientoTarea[]>).forEach(lista => lista.forEach(agregar));
      } else {
        ((semana.tareas ?? []) as SeguimientoTarea[]).forEach(agregar);
      }
    });

    // Generar 6 semanas (42 días)
    this.calendarioDias = [];
    let cursor = new Date(inicioGrid);

    for (let sem = 0; sem < 6; sem++) {
      const fila: CalendarioDia[] = [];
      for (let dia = 0; dia < 7; dia++) {
        const tareasDelDia = mapa.get(cursor.toDateString()) ?? [];

        // Agrupar por usuario para la vista compacta del gestor
        const agrupado = new Map<number, { total: number; completadas: number; semaforos: string[] }>();
        tareasDelDia.forEach(({ tarea }) => {
          const r = agrupado.get(tarea.usuario_id) ?? { total: 0, completadas: 0, semaforos: [] };
          r.total++;
          if (tarea.estado === 'completado') r.completadas++;
          if (tarea.semaforo) r.semaforos.push(tarea.semaforo);
          agrupado.set(tarea.usuario_id, r);
        });

        const resumenPorUsuario = Array.from(agrupado.entries()).map(([uid, r]) => ({
          uid,
          iniciales:  this._iniciales(uid),
          nombre:     this.nombreUsuario(uid),
          total:      r.total,
          completadas: r.completadas,
          semaforo:   this._semaforoDominante(r.semaforos),
        }));

        fila.push({
          fecha:        new Date(cursor),
          esHoy:        cursor.toDateString() === hoy.toDateString(),
          esMesActual:  cursor.getMonth() === mes - 1,
          tareas:       tareasDelDia,
          resumenPorUsuario,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      this.calendarioDias.push(fila);
    }
  }

  /** Calcula las iniciales de un usuario dado su id */
  private _iniciales(uid: number): string {
    const nombre = this.nombreUsuario(uid);
    return nombre
      .split(' ')
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  /** Retorna el semáforo más urgente de una lista */
  private _semaforoDominante(semaforos: string[]): string {
    if (semaforos.includes('rojo'))    return 'rojo';
    if (semaforos.includes('amarillo')) return 'amarillo';
    if (semaforos.includes('verde'))   return 'verde';
    return 'gris';
  }

  // ─── TAREAS DE SEGUIMIENTO ────────────────────────────────────────────────

  abrirModalSegTarea(semana: SeguimientoSemana, tarea?: SeguimientoTarea): void {
    this.semanaActual     = semana;
    this.selectedSegTarea = tarea ?? null;
    this.segTareaForm     = tarea
      ? { titulo: tarea.titulo, descripcion: tarea.descripcion, estado: tarea.estado, notas: tarea.notas, fecha_limite_entrega: tarea.fecha_limite_entrega }
      : { titulo: '', descripcion: '', estado: 'pendiente', notas: '', fecha_limite_entrega: '' };
    this.showModalSegTarea = true;
  }

  guardarSegTarea(): void {
    if (!this.segTareaForm.titulo?.trim()) { Swal.fire('Validación', 'El título es obligatorio', 'warning'); return; }
    if (!this.semanaActual) return;
    const req$ = this.selectedSegTarea
      ? this.proyectoService.actualizarSeguimientoTarea(this.selectedSegTarea.id, { ...this.segTareaForm, usuario_id: this.usuarioId })
      : this.proyectoService.crearSeguimientoTarea({ ...this.segTareaForm, semana_id: this.semanaActual.id, usuario_id: this.usuarioId });
    req$.subscribe({
      next:  (res: any) => { Swal.fire('Éxito', res.message ?? 'Tarea guardada', 'success'); this.showModalSegTarea = false; if (this.detalleSeguimiento) this.verDetalleSeguimiento(this.detalleSeguimiento); },
      error: () => Swal.fire('Error', 'No se pudo guardar la tarea', 'error'),
    });
  }

  completarSegTarea(tarea: SeguimientoTarea): void {
    Swal.fire({ title: '¿Marcar como completada?', icon: 'question', showCancelButton: true, confirmButtonText: 'Sí', confirmButtonColor: '#16a34a' })
      .then(r => r.isConfirmed && this.proyectoService.completarSeguimientoTarea(tarea.id, this.usuarioId).subscribe({
        next:  () => { if (this.detalleSeguimiento) this.verDetalleSeguimiento(this.detalleSeguimiento); },
        error: () => Swal.fire('Error', 'No se pudo completar', 'error'),
      }));
  }

  eliminarSegTarea(tarea: SeguimientoTarea): void {
    Swal.fire({ title: '¿Eliminar tarea?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' })
      .then(r => r.isConfirmed && this.proyectoService.eliminarSeguimientoTarea(tarea.id, this.usuarioId).subscribe({
        next:  () => { if (this.detalleSeguimiento) this.verDetalleSeguimiento(this.detalleSeguimiento); },
        error: () => Swal.fire('Error', 'No se pudo eliminar', 'error'),
      }));
  }

  // ─── Helpers seguimiento ──────────────────────────────────────────────────
  esTareasAgrupadas(tareas: any): tareas is { [k: string]: SeguimientoTarea[] } { return tareas != null && !Array.isArray(tareas); }
  tareasDeUsuario(tareas: any, uid: string): SeguimientoTarea[] { return tareas?.[uid] ?? []; }
  idsUsuariosEnSemana(tareas: any): string[] { return tareas ? Object.keys(tareas) : []; }
  nombreUsuario(uid: string | number): string { return this.usuariosCache.find(u => u.id === +uid)?.nombre ?? `Usuario #${uid}`; }
}