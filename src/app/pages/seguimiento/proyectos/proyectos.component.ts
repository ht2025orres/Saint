import {
  Component, Input, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import {
  ProyectoService,
  Proyecto, Actividad, Tarea, NivelTarea,
  MisPermisos, EstadoProyecto, EstadoActividad, EstadoTarea,
} from 'src/app/services/proyectos.service';
import { PaginationService } from 'src/app/shared/pagination/pagination.service';
import { SeguimientoStateService, UsuarioCache } from '../seguimiento-state.service';
import { ProyectoForm }   from '../modals/modal-proyecto/modal-proyecto.component';
import { ActividadForm }  from '../modals/modal-actividad/modal-actividad.component';
import { TareaForm }      from '../modals/modal-tarea/modal-tarea.component';

// ─── Tipos internos ─────────────────────────────────────────────────────────

type FiltroEstado = 'todos' | 'pendiente' | 'en_ejecucion' | 'completado' | 'pausado';
type VistaProyectos = 'tarjetas' | 'lista';
type VistaDetalle = 'tareas' | 'actividades';
type InlineState = 'idle' | 'creating' | 'saving';

interface InlineTaskForm {
  titulo:               string;
  descripcion:          string;
  estado:               EstadoTarea;
  fecha_limite_entrega: string;
  actividad_id:         number | null;
  asignado_id:          number | null;
}

interface InlineEditForm {
  titulo:               string;
  descripcion:          string;
  estado:               EstadoTarea;
  fecha_limite_entrega: string;
  asignado_id:          number | null;
}

interface TareaEnriquecida extends Tarea {
  actividadTitulo:   string;
  actividadId:       number | null;
  actividadSemaforo: string | null;
  esGeneral:         boolean;
}

// ─── Componente ─────────────────────────────────────────────────────────────

@Component({
  selector:    'app-proyectos',
  templateUrl: './proyectos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProyectosComponent implements OnInit, OnDestroy {

  @Input() usuarioId            = 0;
  @Input() puedeGestionarModulo = false;

  // ── Estado del listado ───────────────────────────────────────────
  proyectos:          Proyecto[]  = [];
  proyectosPaginados: Proyecto[]  = [];
  loading             = false;
  filtroEstado: FiltroEstado = 'todos';
  busqueda            = '';
  vista: VistaProyectos = 'tarjetas';

  // ── Detalle de proyecto ──────────────────────────────────────────
  showDetalle        = false;
  loadingDetalle     = false;
  detalle: Proyecto | null = null;
  vistaDetalle: VistaDetalle = 'tareas';
  actividadExpandidaId: number | null = null;
  filtroEstadoTarea    = 'todos';
  filtroTipoTarea      = 'todas';
  calculandoFechas     = false;

  // ── Modales ──────────────────────────────────────────────────────
  showModalProyecto   = false;
  proyectoParaEditar: Proyecto | null = null;
  savingProyecto      = false;

  showModalActividad  = false;
  actividadParaEditar: Actividad | null = null;
  actividadProyecto: Proyecto | null = null;
  savingActividad     = false;

  showModalTarea      = false;
  tareaParaEditar: Tarea | null = null;
  tareaActividadId: number | null = null;
  savingTarea         = false;

  // ── Inline Task (crear fila en línea) ────────────────────────────
  showInlineTask      = false;
  inlineState: InlineState = 'idle';
  inlineTaskForm: InlineTaskForm = this._emptyInlineTaskForm();
  showInlineEstado    = false;
  showInlineAsignado  = false;
  inlineBusqResp      = '';

  // ── Inline Edit (editar fila en línea) ───────────────────────────
  inlineEditId: number | null  = null;
  inlineEditForm: InlineEditForm = this._emptyInlineEditForm();
  inlineEditOriginal: InlineEditForm | null = null;
  showInlineEditEstado   = false;
  showInlineEditAsignado = false;
  inlineEditBusqResp     = '';

  // ── Responsables seleccionados para modal tarea ──────────────────
  responsablesSelec: UsuarioCache[] = [];

  private _subs = new Subscription();
  private readonly PAGINATOR_TARJETAS = 'proy-tarjetas';
  private readonly PAGINATOR_LISTA    = 'proy-lista';

  constructor(
    public  state:      SeguimientoStateService,
    private proyServ:   ProyectoService,
    private pagServ:    PaginationService,
    private cdr:        ChangeDetectorRef,
  ) {}

  // ════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.cargarProyectos();
  }

  ngOnDestroy(): void { this._subs.unsubscribe(); }

  // ════════════════════════════════════════════════════════════════
  // GETTERS DERIVADOS
  // ════════════════════════════════════════════════════════════════

  get proyectosFiltrados(): Proyecto[] {
    const q = this.busqueda.toLowerCase().trim();
    return this.proyectos.filter(p =>
      (!q || p.titulo.toLowerCase().includes(q) ||
       (p.descripcion ?? '').toLowerCase().includes(q)),
    );
  }

  get usuariosDisponibles(): UsuarioCache[] {
    return this.state.usuariosCache;
  }

  get tareasPlanas(): TareaEnriquecida[] {
    if (!this.detalle) return [];
    const tareas: TareaEnriquecida[] = [];

    for (const act of (this.detalle.actividades ?? [])) {
      for (const t of (act.tareas ?? [])) {
        const enr = t as TareaEnriquecida;
        enr.actividadTitulo   = act.titulo;
        enr.actividadId       = act.id;
        enr.actividadSemaforo = act.semaforo ?? null;
        enr.esGeneral         = false;
        tareas.push(enr);
      }
    }
    for (const t of (this.detalle.tareas_sin_actividad ?? [])) {
      const enr = t as TareaEnriquecida;
      enr.actividadTitulo   = 'Sin actividad';
      enr.actividadId       = null;
      enr.actividadSemaforo = null;
      enr.esGeneral         = true;
      tareas.push(enr);
    }
    return tareas;
  }

  get tareasPlanasFiltradas(): TareaEnriquecida[] {
    let lista = this.tareasPlanas;
    if (this.filtroEstadoTarea !== 'todos') lista = lista.filter(t => t.estado === this.filtroEstadoTarea);
    if (this.filtroTipoTarea === 'conActividad')  lista = lista.filter(t => !t.esGeneral);
    if (this.filtroTipoTarea === 'sinActividad')  lista = lista.filter(t =>  t.esGeneral);
    const ahora = new Date();
    return lista.sort((a, b) => this._prioridadTarea(a, ahora) - this._prioridadTarea(b, ahora));
  }

  // Inline asignado
  get inlineAsignadoNombre(): string {
    return this.state.usuariosCache.find(u => u.id === this.inlineTaskForm.asignado_id)?.nombre ?? '';
  }
  get inlineEditAsignadoNombre(): string {
    return this.state.usuariosCache.find(u => u.id === this.inlineEditForm.asignado_id)?.nombre ?? '';
  }
  get inlineUsuariosFiltrados(): UsuarioCache[] {
    const q = this.inlineBusqResp.toLowerCase();
    return q
      ? this.state.usuariosCache.filter(u => u.nombre.toLowerCase().includes(q)).slice(0, 8)
      : this.state.usuariosCache.slice(0, 8);
  }
  get inlineEditUsuariosFiltrados(): UsuarioCache[] {
    const q = this.inlineEditBusqResp.toLowerCase();
    return q
      ? this.state.usuariosCache.filter(u => u.nombre.toLowerCase().includes(q)).slice(0, 8)
      : this.state.usuariosCache.slice(0, 8);
  }

  // Permisos sobre proyecto
  esAdminProyecto(p: Proyecto): boolean {
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_gestionar_permisos ?? false);
  }
  puedeEditarProyecto(p: Proyecto): boolean {
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_editar ?? false);
  }
  puedeEliminarProyecto(p: Proyecto): boolean {
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_eliminar ?? false);
  }
  puedeCrearEnProyecto(p: Proyecto | null): boolean {
    if (!p) return false;
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_crear ?? false);
  }
  puedeCompletarTarea(t: Tarea): boolean {
    return this.puedeGestionarModulo || t.creado_por === this.usuarioId
      || (t.responsables ?? []).includes(this.usuarioId);
  }

  calcularProgreso(act: Actividad): number {
    return this.state.calcularProgreso(act.tareas_completadas ?? 0, act.total_tareas ?? 0);
  }

  // ════════════════════════════════════════════════════════════════
  // HOST LISTENER (clic fuera)
  // ════════════════════════════════════════════════════════════════

  @HostListener('document:click', ['$event'])
  onDocClick(event: Event): void {
    const target = event.target as HTMLElement;

    if (this.showInlineEstado && !target.closest('[data-inline-estado]'))
      this.showInlineEstado = false;
    if (this.showInlineAsignado && !target.closest('[data-inline-asignado]'))
      this.showInlineAsignado = false;
    if (this.showInlineEditEstado && !target.closest('[data-inline-edit-estado]'))
      this.showInlineEditEstado = false;
    if (this.showInlineEditAsignado && !target.closest('[data-inline-edit-asignado]'))
      this.showInlineEditAsignado = false;

    // Guardar/cancelar inline create al hacer clic fuera
    if (this.showInlineTask) {
      const row = document.querySelector('[data-inline-task-row]');
      if (row && !row.contains(target)) {
        this.inlineTaskForm.titulo?.trim()
          ? this.guardarTareaInline()
          : this.cancelarFilaInline();
      }
    }

    // Guardar/cancelar inline edit al hacer clic fuera
    if (this.inlineEditId) {
      const rows = document.querySelectorAll('[data-inline-edit-row]');
      const inside = Array.from(rows).some(r => r.contains(target));
      if (!inside
        && !target.closest('[data-inline-edit-estado]')
        && !target.closest('[data-inline-edit-asignado]')) {
        this.inlineEditForm.titulo?.trim() && this._inlineEditChanged()
          ? this.guardarEdicionInline()
          : this.cancelarEdicionInline();
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · LISTADO DE PROYECTOS
  // ════════════════════════════════════════════════════════════════

  cargarProyectos(): void {
    this.loading = true;
    this.cdr.markForCheck();
    const filtros = this.filtroEstado === 'todos' ? { activos: true } : { estado: this.filtroEstado };

    this.proyServ.getProyectos(this.usuarioId, filtros).subscribe({
      next: res => {
        this.proyectos = this._ordenarProyectos(res.data ?? []);
        this.loading   = false;
        this._initPaginadores();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudieron cargar los proyectos', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  cambiarFiltro(f: FiltroEstado): void {
    this.filtroEstado = f;
    this.cargarProyectos();
  }

  cambiarVista(v: VistaProyectos): void {
    this.vista = v;
    this._initPaginadores();
    this.cdr.markForCheck();
  }

  onBusquedaChange(): void {
    setTimeout(() => {
      this._initPaginadores();
      this.cdr.markForCheck();
    }, 0);
  }

  cambiarEstado(p: Proyecto, estado: string): void {
    Swal.fire({
      title: '¿Cambiar estado?',
      text: `"${p.titulo}" → ${this.state.getEstadoLabel(estado)}`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, cambiar',
    }).then(r => r.isConfirmed &&
      this.proyServ.cambiarEstadoProyecto(p.id, estado, this.usuarioId).subscribe({
        next:  () => { this.state.showToast('Estado actualizado', 'success'); this.cargarProyectos(); },
        error: () => this.state.showToast('No se pudo cambiar el estado', 'error'),
      }),
    );
  }

  eliminarProyecto(p: Proyecto): void {
    Swal.fire({
      title: '¿Eliminar proyecto?',
      text: `Se eliminará "${p.titulo}" y todo su contenido`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc2626', confirmButtonText: 'Sí, eliminar',
    }).then(r => r.isConfirmed &&
      this.proyServ.eliminarProyecto(p.id, this.usuarioId).subscribe({
        next:  () => { this.state.showToast('Proyecto eliminado'); this.cargarProyectos(); },
        error: () => this.state.showToast('No se pudo eliminar', 'error'),
      }),
    );
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · MODAL PROYECTO
  // ════════════════════════════════════════════════════════════════

  abrirCrearProyecto(): void {
    this.proyectoParaEditar = null;
    this.showModalProyecto  = true;
    this.cdr.markForCheck();
  }

  abrirEditarProyecto(p: Proyecto): void {
    this.proyectoParaEditar = p;
    this.showModalProyecto  = true;
    this.cdr.markForCheck();
  }

  onGuardarProyecto(form: ProyectoForm): void {
    this.savingProyecto = true;
    this.cdr.markForCheck();

    const body = { 
      titulo:               form.titulo,
      descripcion:          form.descripcion,
      estado:               form.estado as EstadoProyecto,
      fecha_limite_entrega: form.fecha_limite_entrega,
      usuario_id:           this.usuarioId 
    };

    const req$ = this.proyectoParaEditar
      ? this.proyServ.actualizarProyecto(this.proyectoParaEditar.id, body)
      : this.proyServ.crearProyecto(body);

    req$.subscribe({
      next: (res: any) => {
        this.savingProyecto  = false;
        this.showModalProyecto = false;
        this.state.showToast(res.message ?? 'Proyecto guardado');
        this.cargarProyectos();
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingProyecto = false;
        Swal.fire('Error', 'No se pudo guardar el proyecto', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · DETALLE PROYECTO
  // ════════════════════════════════════════════════════════════════

  verDetalle(p: Proyecto): void {
    this.showDetalle   = true;
    this.loadingDetalle = true;
    this.detalle        = null;
    this.cdr.markForCheck();

    this.proyServ.obtenerDetalleProyecto(p.id, this.usuarioId).subscribe({
      next: (res: any) => {
        this.detalle              = res.data;
        this.detalle!.actividades           = res.data.actividades ?? [];
        this.detalle!.tareas_sin_actividad  = res.data.tareas_sin_actividad ?? [];
        this.loadingDetalle = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingDetalle = false;
        this.cdr.markForCheck();
      },
    });
  }

  cerrarDetalle(): void {
    this.showDetalle        = false;
    this.detalle            = null;
    this.inlineEditId       = null;
    this.showInlineTask     = false;
    this.actividadExpandidaId = null;
    this.cdr.markForCheck();
  }

  toggleActividad(id: number): void {
    this.actividadExpandidaId = this.actividadExpandidaId === id ? null : id;
    this.cancelarEdicionInline();
    this.cancelarFilaInline();
    this.cdr.markForCheck();
  }

  limpiarFiltrosTareas(): void {
    this.filtroEstadoTarea = 'todos';
    this.filtroTipoTarea   = 'todas';
    this.cdr.markForCheck();
  }

  calcularFechasTareas(): void {
    if (!this.detalle) return;
    Swal.fire({
      title: 'Calcular fechas automáticas',
      text: `Se distribuirán ${this.detalle.total_tareas ?? 0} tareas en días laborales hasta la fecha límite.`,
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'Calcular', confirmButtonColor: '#2563eb',
    }).then(r => {
      if (!r.isConfirmed || !this.detalle) return;
      this.calculandoFechas = true;
      this.cdr.markForCheck();
      this.proyServ.calcularFechasTareas(this.detalle.id, this.usuarioId, []).subscribe({
        next: (res: any) => {
          this.calculandoFechas = false;
          this.state.showToast(`${res.data?.tareas_actualizadas ?? 0} tareas actualizadas`);
          this.verDetalle(this.detalle!);
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.calculandoFechas = false;
          this.state.showToast(err?.error?.message ?? 'Error al calcular fechas', 'error');
          this.cdr.markForCheck();
        },
      });
    });
  }

  private _refreshDetalle(): void {
    if (!this.detalle) return;
    this.proyServ.obtenerDetalleProyecto(this.detalle.id, this.usuarioId).subscribe({
      next: (res: any) => {
        if (!this.detalle) return;
        this.detalle.actividades          = res.data.actividades ?? [];
        this.detalle.tareas_sin_actividad = res.data.tareas_sin_actividad ?? [];
        this.detalle.total_tareas         = res.data.total_tareas;
        this.detalle.tareas_completadas   = res.data.tareas_completadas;
        this.detalle.tareas_vencidas      = res.data.tareas_vencidas;
        this.detalle.progreso             = res.data.progreso;
        this.cdr.markForCheck();
      },
    });
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · MODAL ACTIVIDAD
  // ════════════════════════════════════════════════════════════════

  abrirCrearActividad(): void {
    this.actividadParaEditar = null;
    this.actividadProyecto   = this.detalle;
    this.showModalActividad  = true;
    this.cdr.markForCheck();
  }

  abrirEditarActividad(a: Actividad): void {
    this.actividadParaEditar = a;
    this.actividadProyecto   = this.detalle;
    this.showModalActividad  = true;
    this.cdr.markForCheck();
  }

  onGuardarActividad(form: ActividadForm): void {
    this.savingActividad = true;
    this.cdr.markForCheck();

    const body = { 
      proyecto_id:          form.proyecto_id,
      titulo:               form.titulo,
      descripcion:          form.descripcion,
      estado:               form.estado as EstadoActividad,
      fecha_limite_entrega: form.fecha_limite_entrega,
      usuario_id:           this.usuarioId 
    };

    const req$ = this.actividadParaEditar
      ? this.proyServ.actualizarActividad(this.actividadParaEditar.id, body)
      : this.proyServ.crearActividad(body);

    req$.subscribe({
      next: (res: any) => {
        this.savingActividad    = false;
        this.showModalActividad = false;
        this.state.showToast(res.message ?? 'Actividad guardada');
        this._refreshDetalle();
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingActividad = false;
        this.state.showToast('No se pudo guardar la actividad', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  eliminarActividad(a: Actividad): void {
    Swal.fire({
      title: '¿Eliminar actividad?',
      text: `"${a.titulo}" y todas sus tareas`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc2626', confirmButtonText: 'Sí, eliminar',
    }).then(r => r.isConfirmed &&
      this.proyServ.eliminarActividad(a.id, this.usuarioId).subscribe({
        next:  () => { this.state.showToast('Actividad eliminada'); this._refreshDetalle(); },
        error: () => this.state.showToast('No se pudo eliminar', 'error'),
      }),
    );
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · MODAL TAREA
  // ════════════════════════════════════════════════════════════════

  abrirCrearTarea(actividadId: number | null = null): void {
    this.tareaParaEditar  = null;
    this.tareaActividadId = actividadId;
    this.showModalTarea   = true;
    this.cdr.markForCheck();
  }

  abrirEditarTarea(t: Tarea): void {
    this.tareaParaEditar  = t;
    this.tareaActividadId = t.actividad_id ?? null;
    this.showModalTarea   = true;
    this.cdr.markForCheck();
  }

  onGuardarTarea(form: TareaForm): void {
    this.savingTarea = true;
    this.cdr.markForCheck();

    const body = { 
      actividad_id:         form.actividad_id,
      proyecto_id:          form.proyecto_id,
      titulo:               form.titulo,
      descripcion:          form.descripcion,
      estado:               form.estado as EstadoTarea,
      notas:                form.notas,
      fecha_limite_entrega: form.fecha_limite_entrega,
      responsables:         form.responsables,
      usuario_id:           this.usuarioId 
    };

    const req$ = this.tareaParaEditar
      ? this.proyServ.actualizarTarea(this.tareaParaEditar.id, body)
      : this.proyServ.crearTarea(body);

    req$.subscribe({
      next: (res: any) => {
        this.savingTarea  = false;
        this.showModalTarea = false;
        this.state.showToast(res.message ?? 'Tarea guardada');
        this._refreshDetalle();
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingTarea = false;
        this.state.showToast('No se pudo guardar la tarea', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  eliminarTarea(t: Tarea): void {
    Swal.fire({
      title: '¿Eliminar tarea?',
      text: `"${t.titulo}"`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc2626', confirmButtonText: 'Sí, eliminar',
    }).then(r => r.isConfirmed &&
      this.proyServ.eliminarTarea(t.id, this.usuarioId).subscribe({
        next:  () => { this.state.showToast('Tarea eliminada'); this._refreshDetalle(); },
        error: () => this.state.showToast('No se pudo eliminar', 'error'),
      }),
    );
  }

  completarTarea(t: Tarea): void {
    const nuevoEstado: EstadoTarea = t.estado === 'completado' ? 'pendiente' : 'completado';
    this.proyServ.completarTarea(t.id, this.usuarioId).subscribe({
      next: () => {
        this.state.showToast(nuevoEstado === 'completado' ? 'Tarea completada' : 'Tarea pendiente');
        this._refreshDetalle();
      },
      error: () => this.state.showToast('Error al actualizar tarea', 'error'),
    });
  }

  moverTarea(t: Tarea): void {
    // Lógica para mover tarea entre actividades o proyectos si fuera necesario
    // Por ahora abrimos el modal de edición para que el usuario cambie la actividad
    this.abrirEditarTarea(t);
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · INLINE TAREAS (CREATE)
  // ════════════════════════════════════════════════════════════════

  abrirFilaInline(actId: number | null = null): void {
    this.cancelarEdicionInline();
    this.showInlineTask  = true;
    this.inlineTaskForm  = this._emptyInlineTaskForm();
    this.inlineTaskForm.actividad_id = actId;
    this.cdr.markForCheck();
    // Foco automático
    setTimeout(() => document.querySelector<HTMLInputElement>('[data-inline-title]')?.focus(), 50);
  }

  guardarTareaInline(): void {
    if (!this.inlineTaskForm.titulo.trim() || this.inlineState === 'saving') return;
    this.inlineState = 'saving';
    this.cdr.markForCheck();

    const body = {
      titulo:               this.inlineTaskForm.titulo,
      descripcion:          this.inlineTaskForm.descripcion,
      estado:               this.inlineTaskForm.estado as EstadoTarea,
      fecha_limite_entrega: this.inlineTaskForm.fecha_limite_entrega,
      actividad_id:         this.inlineTaskForm.actividad_id,
      proyecto_id:          this.detalle!.id,
      usuario_id:           this.usuarioId,
      responsables:         this.inlineTaskForm.asignado_id ? [this.inlineTaskForm.asignado_id] : [],
    };

    this.proyServ.crearTarea(body).subscribe({
      next: () => {
        this.state.showToast('Tarea creada');
        this._refreshDetalle();
        this.cancelarFilaInline();
      },
      error: () => {
        this.inlineState = 'idle';
        this.state.showToast('Error al crear tarea', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  cancelarFilaInline(): void {
    this.showInlineTask = false;
    this.inlineState    = 'idle';
    this.cdr.markForCheck();
  }

  onInlineKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter')  this.guardarTareaInline();
    if (ev.key === 'Escape') this.cancelarFilaInline();
  }

  private _emptyInlineTaskForm(): InlineTaskForm {
    return {
      titulo: '', descripcion: '', estado: 'pendiente',
      fecha_limite_entrega: '', actividad_id: null, asignado_id: this.usuarioId,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · INLINE TAREAS (EDIT)
  // ════════════════════════════════════════════════════════════════

  activarEdicionInline(t: Tarea): void {
    this.cancelarFilaInline();
    this.inlineEditId   = t.id;
    this.inlineEditForm = {
      titulo:               t.titulo,
      descripcion:          t.descripcion ?? '',
      estado:               t.estado ?? 'pendiente',
      fecha_limite_entrega: this._toLocal(t.fecha_limite_entrega),
      asignado_id:          (t.responsables && t.responsables.length > 0) ? t.responsables[0] : null,
    };
    this.inlineEditOriginal = { ...this.inlineEditForm };
    this.cdr.markForCheck();
    setTimeout(() => document.querySelector<HTMLInputElement>('[data-edit-title]')?.focus(), 50);
  }

  guardarEdicionInline(): void {
    if (!this.inlineEditId || !this.inlineEditForm.titulo.trim()) return;
    if (!this._inlineEditChanged()) return this.cancelarEdicionInline();

    const body = {
      titulo:               this.inlineEditForm.titulo,
      descripcion:          this.inlineEditForm.descripcion,
      estado:               this.inlineEditForm.estado as EstadoTarea,
      fecha_limite_entrega: this.inlineEditForm.fecha_limite_entrega,
      usuario_id:           this.usuarioId,
      responsables:         this.inlineEditForm.asignado_id ? [this.inlineEditForm.asignado_id] : [],
    };

    this.proyServ.actualizarTarea(this.inlineEditId, body).subscribe({
      next: () => {
        this.state.showToast('Tarea actualizada');
        this._refreshDetalle();
        this.cancelarEdicionInline();
      },
      error: () => this.state.showToast('Error al actualizar', 'error'),
    });
  }

  cancelarEdicionInline(): void {
    this.inlineEditId       = null;
    this.inlineEditOriginal = null;
    this.cdr.markForCheck();
  }

  onInlineEditKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter')  this.guardarEdicionInline();
    if (ev.key === 'Escape') this.cancelarEdicionInline();
  }

  private _inlineEditChanged(): boolean {
    if (!this.inlineEditOriginal) return false;
    return JSON.stringify(this.inlineEditForm) !== JSON.stringify(this.inlineEditOriginal);
  }

  private _emptyInlineEditForm(): InlineEditForm {
    return { titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', asignado_id: null };
  }

  // ════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ════════════════════════════════════════════════════════════════

  private _initPaginadores(): void {
    this.pagServ.initializePaginator(this.PAGINATOR_TARJETAS, this.proyectosFiltrados, 6).subscribe(s => {
      if (this.vista === 'tarjetas') { this.proyectosPaginados = s.currentData; this.cdr.markForCheck(); }
    });
    this.pagServ.initializePaginator(this.PAGINATOR_LISTA, this.proyectosFiltrados, 10).subscribe(s => {
      if (this.vista === 'lista') { this.proyectosPaginados = s.currentData; this.cdr.markForCheck(); }
    });
  }

  private _ordenarProyectos(list: Proyecto[]): Proyecto[] {
    return list.sort((a, b) => {
      if (a.semaforo === 'rojo' && b.semaforo !== 'rojo') return -1;
      if (a.semaforo !== 'rojo' && b.semaforo === 'rojo') return 1;
      return (b.progreso || 0) - (a.progreso || 0);
    });
  }

  private _prioridadTarea(t: Tarea, ahora: Date): number {
    if (t.estado === 'completado') return 1000;
    if (t.semaforo === 'rojo')     return 1;
    if (t.semaforo === 'amarillo') return 2;
    return 10;
  }

  private _toLocal(v?: string | null): string {
    if (!v) return '';
    const [d, t] = v.split('T');
    return `${d}T${t?.substring(0, 5) ?? ''}`;
  }
}
