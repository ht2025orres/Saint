import {
  Component, OnInit, AfterViewInit, OnDestroy, HostListener,
  ChangeDetectorRef, ElementRef, HostBinding,
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, catchError, finalize, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

import { TaskPanelService } from '../../services/task-panel.service';
import { AuthService }      from '../../services/auth.service';
import { UserService }      from '../../services/user.service';
import {
  ProyectoService,
  TareaConsolidada,
} from '../../services/proyectos.service';

type DateShortcut = 'sin_fecha' | 'hoy' | 'manana' | 'exacta';

@Component({
  selector: 'app-task-panel',
  templateUrl: './task-panel.component.html',
  styleUrls: ['./task-panel.component.scss'],
})
export class TaskPanelComponent implements OnInit, AfterViewInit, OnDestroy {

  // ── Host: posición fija sin ocupar espacio ni interceptar clics ────────────
  @HostBinding('style.position')     readonly hostPos = 'fixed';
  @HostBinding('style.top')          readonly hostTop = '0';
  @HostBinding('style.left')         readonly hostLeft = '0';
  @HostBinding('style.width')        readonly hostW = '0';
  @HostBinding('style.height')       readonly hostH = '0';
  @HostBinding('style.overflow')     readonly hostOvf = 'visible';
  @HostBinding('style.zIndex')       readonly hostZ = '9999';
  @HostBinding('style.pointerEvents') readonly hostPE = 'none';

  private destroy$ = new Subject<void>();

  // ── Estado ──────────────────────────────────────────────────────────────────
  isOpen         = false;
  loading        = false;
  guardandoNueva = false;

  // ── Auth ────────────────────────────────────────────────────────────────────
  get esAdmin():  boolean { return this.authService.hasPermission(1); }
  get esGestor(): boolean {
    return this.authService.hasAnyPermission([39, 1]);
  }
  get userId():   number { return this.authService.user?.id ?? 0; }
  get userName(): string {
    const u = this.authService.user;
    return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '';
  }

  // ── Datos ───────────────────────────────────────────────────────────────────
  tareas: TareaConsolidada[] = [];
  usuarios: { id: number; nombre: string }[] = [];

  // ── Filtros ─────────────────────────────────────────────────────────────────
  filtroOrigen: 'todos' | 'seguimiento' | 'proyecto' | 'glpi' = 'todos';
  filtroEstado: 'todos' | 'pendiente' | 'en_ejecucion'        = 'todos';

  // ── Formulario nueva tarea ───────────────────────────────────────────────────
  showNuevaTarea     = false;
  nuevaTareaForm     = this._emptyNuevaForm();
  dateShortcut: DateShortcut = 'sin_fecha';
  showFechaExacta    = false;
  showAsignadoPicker = false;
  asignadoBusqueda   = '';

  // ── Edición inline ──────────────────────────────────────────────────────────
  editingTaskId: string | null = null;   // clave: "origen-id" para evitar colisión entre orígenes
  editForm: Partial<TareaConsolidada> & { fecha_limite_entrega?: string } = {};
  editOriginal: Partial<TareaConsolidada> = {};
  showEditEstado         = false;
  showEditAsignadoPicker = false;
  editAsignadoBusqueda   = '';

  // ── Reasignación (Gestor) ────────────────────────────────────────────────────
  delegandoTaskId   : string | null = null;   // clave: "origen-id"
  showDelegarPicker = false;
  delegarBusqueda   = '';

  constructor(
    public  panelService:    TaskPanelService,
    private authService:     AuthService,
    private userService:     UserService,
    private proyectoService: ProyectoService,
    private cdr:             ChangeDetectorRef,
    private el:              ElementRef,
  ) {}

  ngAfterViewInit(): void {
    document.body.appendChild(this.el.nativeElement);
  }

  ngOnInit(): void {
    this.panelService.isOpen$
      .pipe(takeUntil(this.destroy$))
      .subscribe(open => {
        this.isOpen = open;
        if (open) {
          this.cargarDatos();
          this.cargarUsuarios();
        } else {
          this.showNuevaTarea = false;
        }
        this.cdr.markForCheck();
      });

    // Suscripción a cambios globales para recarga automática
    this.proyectoService.refresh$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isOpen) {
          this.cargarDatos();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.el.nativeElement.parentNode === document.body) {
      document.body.removeChild(this.el.nativeElement);
    }
  }

  // ── Carga de usuarios ────────────────────────────────────────────────────────
  cargarUsuarios(): void {
    if (this.usuarios.length > 0) return;
    this.userService.getAll().pipe(takeUntil(this.destroy$)).subscribe(users => {
      this.usuarios = users.map(u => ({
        id: u.id!,
        nombre: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || `User ${u.id}`,
      }));
      this.cdr.markForCheck();
    });
  }

  // ── Carga de tareas ──────────────────────────────────────────────────────────
  cargarDatos(): void {
    if (!this.userId) return;
    this.loading = true;
    this.cdr.markForCheck();

    const now  = new Date();
    const mes  = now.getMonth() + 1;
    const anio = now.getFullYear();

    this.proyectoService
      .getTareasConsolidadas(this.userId, mes, anio, ['seguimiento', 'proyecto', 'glpi'])
      .pipe(
        catchError(() => of({ success: false, data: [], meta: null as any })),
        finalize(() => { this.loading = false; this.cdr.markForCheck(); }),
        takeUntil(this.destroy$),
      )
      .subscribe(resp => {
        if (resp.success) this.tareas = resp.data.filter(t => t.estado !== 'completado');
        this.cdr.markForCheck();
      });
  }

  // ── Base filtrada ─────────────────────────────────────────────────────────────
  private get _base(): TareaConsolidada[] {
    return this.tareas.filter(t => {
      const o = this.filtroOrigen === 'todos' || t.origen === this.filtroOrigen;
      const e = this.filtroEstado === 'todos' || t.estado === this.filtroEstado;
      return o && e;
    });
  }

  // ── Lista plana ordenada por proximidad ──────────────────────────────────────
  /**
   * Orden: vencidas (más reciente primero) → hoy → próximas (asc) → sin fecha
   * Sin headers de sección, todo en un flujo continuo como Google Tasks / ClickUp.
   */
  get tareasOrdenadas(): TareaConsolidada[] {
    const ahora = new Date();
    const hoyStr = ahora.toDateString();

    // Peso de grupo para ordenar categorías
    const grupo = (t: TareaConsolidada): number => {
      if (!t.fecha_limite_entrega) return 3; // sin fecha → al final
      const d = new Date(t.fecha_limite_entrega);
      const dStr = d.toDateString();
      if (dStr === hoyStr) return 1;         // hoy
      if (d < ahora)       return 0;         // vencida → primero
      return 2;                              // próxima
    };

    return [...this._base].sort((a, b) => {
      const ga = grupo(a), gb = grupo(b);
      if (ga !== gb) return ga - gb;

      // Dentro del mismo grupo:
      const da = a.fecha_limite_entrega ? new Date(a.fecha_limite_entrega).getTime() : 0;
      const db = b.fecha_limite_entrega ? new Date(b.fecha_limite_entrega).getTime() : 0;

      if (ga === 0) {
        // Vencidas: la más reciente al tope (desc)
        return db - da;
      }
      if (ga === 3) {
        // Sin fecha: orden por origen
        const peso: Record<string, number> = { seguimiento: 0, proyecto: 1, glpi: 2 };
        return (peso[a.origen] ?? 9) - (peso[b.origen] ?? 9);
      }
      // Hoy y próximas: más cercana primero (asc)
      return da - db;
    });
  }

  // ── Getters legacy (pueden mantenerse para compatibilidad o eliminarse) ───────
  get tareasVencidas(): TareaConsolidada[] {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return this._base.filter(t =>
      t.fecha_limite_entrega && new Date(t.fecha_limite_entrega) < hoy,
    );
  }
  get tareasSinFecha(): TareaConsolidada[] {
    return this._base.filter(t => !t.fecha_limite_entrega);
  }
  get tareasHoy(): TareaConsolidada[] {
    const hoy = new Date().toDateString();
    return this._base.filter(t =>
      t.fecha_limite_entrega &&
      new Date(t.fecha_limite_entrega).toDateString() === hoy,
    );
  }
  get tareasProximas(): TareaConsolidada[] {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return this._base.filter(t => {
      if (!t.fecha_limite_entrega) return false;
      const d = new Date(t.fecha_limite_entrega);
      return d > hoy && d.toDateString() !== new Date().toDateString();
    });
  }

  get totalVisible(): number { return this._base.length; }

  contarPorOrigen(o: string): number {
    return this.tareas.filter(t => t.origen === o).length;
  }

  // ── Helpers para el template ──────────────────────────────────────────────────
  esVencida(t: TareaConsolidada): boolean {
    if (!t.fecha_limite_entrega || t.estado === 'completado') return false;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return new Date(t.fecha_limite_entrega) < hoy;
  }

  esHoy(t: TareaConsolidada): boolean {
    if (!t.fecha_limite_entrega) return false;
    return new Date(t.fecha_limite_entrega).toDateString() === new Date().toDateString();
  }

  // ── ESC ──────────────────────────────────────────────────────────────────────
  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.editingTaskId)  { this.cancelarEdicion();    return; }
    if (this.showNuevaTarea) { this.cancelarNuevaTarea(); return; }
    if (this.isOpen)          this.panelService.close();
  }

  /**
   * Clic fuera del formulario activo → guardar (si hay título) o cancelar.
   * Funciona porque los contenedores de formulario tienen (click)="$event.stopPropagation()",
   * por lo que este handler solo se ejecuta cuando el clic ocurrió fuera de ellos.
   */
  @HostListener('document:click')
  onDocumentClick(): void {
    // Solo actuar si el panel está abierto
    if (!this.isOpen) return;

    if (this.showNuevaTarea) {
      if (this.nuevaTareaForm.titulo.trim()) {
        this.guardarNuevaTarea();
      } else {
        this.cancelarNuevaTarea();
      }
    }

    if (this.editingTaskId) {
      // guardarEdicion ya llama cancelarEdicion internamente si no hay cambios
      this.guardarEdicion();
    }
  }

  // ── Nueva tarea ──────────────────────────────────────────────────────────────
  private _emptyNuevaForm() {
    return {
      titulo:               '',
      descripcion:          '',
      fecha_limite_entrega: '',
      asignado_id:          [] as number[],
    };
  }

  abrirNuevaTarea(): void {
    this.showNuevaTarea     = true;
    this.nuevaTareaForm     = this._emptyNuevaForm();
    this.dateShortcut       = 'sin_fecha';
    this.showFechaExacta    = false;
    this.showAsignadoPicker = false;
    this.cargarUsuarios();
    setTimeout(() => (document.getElementById('panel-nueva-titulo') as HTMLInputElement)?.focus(), 60);
  }

  cancelarNuevaTarea(): void {
    this.showNuevaTarea     = false;
    this.nuevaTareaForm     = this._emptyNuevaForm();
    this.showAsignadoPicker = false;
    this.dateShortcut       = 'sin_fecha';
    this.showFechaExacta    = false;
  }

  setDateShortcut(s: DateShortcut): void {
    this.dateShortcut = s;
    const fmt = (d: Date) => d.toISOString().slice(0, 16);
    const hoy = new Date();
    const man = new Date(); man.setDate(man.getDate() + 1);
    if (s === 'hoy')       this.nuevaTareaForm.fecha_limite_entrega = fmt(hoy);
    if (s === 'manana')    this.nuevaTareaForm.fecha_limite_entrega = fmt(man);
    if (s === 'sin_fecha') this.nuevaTareaForm.fecha_limite_entrega = '';
    this.showFechaExacta = s === 'exacta';
  }

  guardarNuevaTarea(): void {
    if (!this.nuevaTareaForm.titulo.trim() || this.guardandoNueva) return;

    this.guardandoNueva = true;
    this.cdr.markForCheck();

    this.proyectoService.obtenerInfoSeguimiento(new Date().getFullYear())
      .pipe(
        catchError(err => {
          console.error('Error al obtener ID de seguimiento:', err);
          return of({ success: false, data: [] });
        }),
        switchMap(resp => {
          // La API ahora devuelve un array de seguimientos para ese año
          // Buscamos el primero que esté activo
          const seguimiento = Array.isArray(resp.data) 
            ? resp.data.find((s: any) => s.estado === 'activo') 
            : null;
          
          const seguimientoId = seguimiento?.id || 0;
          return this.proyectoService.crearSeguimientoTarea({
            usuario_id: this.userId,
            responsables: this.nuevaTareaForm.asignado_id?.length
              ? this.nuevaTareaForm.asignado_id
              : [this.userId],
            seguimiento_id: seguimientoId,
            titulo: this.nuevaTareaForm.titulo.trim(),
            descripcion: this.nuevaTareaForm.descripcion || undefined,
            fecha_limite_entrega: this.nuevaTareaForm.fecha_limite_entrega || undefined,
            estado: 'pendiente',
          });
        }),
        finalize(() => { this.guardandoNueva = false; this.cdr.markForCheck(); }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.showNuevaTarea = false;
          this.nuevaTareaForm = this._emptyNuevaForm();
          this.dateShortcut   = 'sin_fecha';
          this.showFechaExacta = false;
          this.cargarDatos();
        },
        error: (err) => console.error('Error al crear tarea:', err),
      });
  }

  onNuevaTareaKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.guardarNuevaTarea(); }
    if (e.key === 'Escape') this.cancelarNuevaTarea();
  }

  // ── Completar ────────────────────────────────────────────────────────────────
  completarTarea(tarea: TareaConsolidada): void {
    this.tareas = this.tareas.filter(t => t.id !== tarea.id);
    this.cdr.markForCheck();

    const obs$ = tarea.origen === 'seguimiento'
      ? this.proyectoService.completarSeguimientoTarea(tarea.id, this.userId)
      : this.proyectoService.completarTarea(tarea.id, this.userId);

    obs$.pipe(takeUntil(this.destroy$))
        .subscribe({ error: () => this.cargarDatos() });
  }

  // ── Edición inline ──────────────────────────────────────────────────────────
  editarTarea(tarea: TareaConsolidada): void {
    this.editingTaskId          = `${tarea.origen}-${tarea.id}`;
    this.editForm               = { ...tarea };
    this.editOriginal           = { ...tarea };
    this.showEditEstado         = false;
    this.showEditAsignadoPicker = false;
    this.delegandoTaskId        = null;
    this.showDelegarPicker      = false;
  }

  private _editHasChanges(): boolean {
    const f = this.editForm, o = this.editOriginal;
    return f.titulo               !== o.titulo
        || f.estado               !== o.estado
        || f.fecha_limite_entrega !== (o as any).fecha_limite_entrega
        || f.usuario_id           !== (o as any).usuario_id;
  }

  guardarEdicion(): void {
    if (!this.editForm.titulo?.trim() || !this._editHasChanges()) {
      this.cancelarEdicion(); return;
    }
    if (this.editForm.origen !== 'seguimiento') { this.cancelarEdicion(); return; }

    // El id numérico real está en editForm
    const tareaId = this.editForm.id as number;
    const asignadoCambiado = this.editForm.usuario_id !== this.editOriginal.usuario_id;

    if (asignadoCambiado && this.esGestor && !this.esAdmin) {
      this.tareas = this.tareas.filter(t =>
        !(t.origen === this.editForm.origen && t.id === tareaId)
      );
      this.cancelarEdicion();
      this.cdr.markForCheck();
    }

    this.proyectoService.actualizarSeguimientoTarea(tareaId, {
      titulo:               this.editForm.titulo,
      estado:               this.editForm.estado as any,
      fecha_limite_entrega: this.editForm.fecha_limite_entrega || undefined,
      usuario_id:           this.editForm.usuario_id,
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next:  () => { if (!asignadoCambiado || this.esAdmin) { this.cancelarEdicion(); this.cargarDatos(); } },
        error: () => this.cargarDatos(),
      });
  }

  cancelarEdicion(): void {
    this.editingTaskId          = null;
    this.editForm               = {};
    this.editOriginal           = {};
    this.showEditEstado         = false;
    this.showEditAsignadoPicker = false;
  }

  // ── Reasignación ─────────────────────────────────────────────────────────────
  confirmarDelegar(tarea: TareaConsolidada, destinoId: number): void {
    this.showDelegarPicker = false;
    this.delegandoTaskId   = null;

    if (destinoId === tarea.usuario_id) return;

    if (!this.esAdmin) {
      this.tareas = this.tareas.filter(t =>
        !(t.id === tarea.id && t.origen === tarea.origen)
      );
      this.cdr.markForCheck();
    }

    this.proyectoService.actualizarSeguimientoTarea(tarea.id, {
      usuario_id: destinoId,
    } as any).pipe(takeUntil(this.destroy$))
      .subscribe({
        next:  () => { if (this.esAdmin) this.cargarDatos(); },
        error: () => this.cargarDatos(),
      });
  }

  eliminarTarea(tarea: TareaConsolidada): void {
    if (tarea.origen !== 'seguimiento') return;
    if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;
    this.proyectoService.eliminarSeguimientoTarea(tarea.id, this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: () => this.cargarDatos() });
  }

  // ── Helpers de UI ────────────────────────────────────────────────────────────
  get usuariosFiltrados() {
    const q = this.asignadoBusqueda.toLowerCase();
    return this.usuarios.filter(u =>
      u.nombre.toLowerCase().includes(q) && u.id !== this.userId,
    );
  }

  get usuariosFiltradosDelegar() {
    const q = this.delegarBusqueda.toLowerCase();
    return this.usuarios.filter(u =>
      u.nombre.toLowerCase().includes(q) && u.id !== this.userId,
    );
  }

  get usuariosFiltradosEdit() {
    const q = this.editAsignadoBusqueda.toLowerCase();
    return this.usuarios.filter(u => u.nombre.toLowerCase().includes(q));
  }

  getAsignadoLabel(): string {
    const asignados = this.nuevaTareaForm.asignado_id;
    if (!asignados || asignados.length === 0) return 'Yo mismo';
    const nombres = this.usuarios
      .filter(u => asignados.includes(u.id))
      .map(u => u.nombre);
    return nombres.length ? nombres.join(', ') : 'Usuario';
  }

  getAsignadoEditLabel(): string {
    if (!this.editForm.usuario_id) return 'Sin asignar';
    if (this.editForm.usuario_id === this.userId) return 'Yo mismo';
    return this.usuarios.find(u => u.id === this.editForm.usuario_id)?.nombre ?? 'Usuario';
  }

  nombreUsuario(id?: number | null): string {
    if (!id) return '—';
    if (id === this.userId) return 'Yo';
    return this.usuarios.find(u => u.id === id)?.nombre ?? `#${id}`;
  }

  formatearFecha(f?: string | null): string {
    if (!f) return '';
    const d = new Date(f), hoy = new Date(), man = new Date();
    man.setDate(man.getDate() + 1);
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === man.toDateString()) return 'Mañana';
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  }

  getEstadoBootstrapClass(e?: string): string {
    return ({
      pendiente:    'btn-outline-warning',
      en_ejecucion: 'btn-outline-primary',
      completado:   'btn-outline-success',
    } as any)[e ?? ''] ?? 'btn-outline-secondary';
  }

  getEstadoLabel(e?: string): string {
    return ({
      pendiente:    'Pendiente',
      en_ejecucion: 'En ejecución',
      completado:   'Completado',
    } as any)[e ?? ''] ?? e ?? '';
  }

  getColorPorId(id?: number | null): string {
    const c = ['bg-purple-500','bg-blue-500','bg-green-500','bg-yellow-500','bg-red-500','bg-indigo-500','bg-teal-500','bg-orange-500'];
    return c[(id ?? 0) % c.length];
  }
}