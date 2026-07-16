import {
  Component, Input, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import {
  ProyectoService,
  Proyecto, Actividad, Tarea,
  EstadoProyecto, EstadoActividad, EstadoTarea,
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

interface TareaEnriquecida extends Tarea {
  actividadTitulo:       string;
  actividadId:           number | null;
  actividadSemaforo:     string | null;
  actividadResponsables: number[] | null;
  esGeneral:             boolean;
}

// ─── Componente ─────────────────────────────────────────────────────────────

@Component({
  selector:    'app-proyectos',
  templateUrl: './proyectos.component.html',
})
export class ProyectosComponent implements OnInit, OnDestroy {

  @Input() usuarioId            = 0;
  @Input() puedeGestionarModulo = false;
  @Input() vistaMode: 'member' | undefined;

  // ── Estado del listado ───────────────────────────────────────────
  proyectos:          Proyecto[]  = [];
  proyectosPaginados: Proyecto[]  = [];
  loading             = false;
  filtroEstado: FiltroEstado = 'todos';
  filtroTipoProyecto: 'todos' | 'normales' | 'informes' = 'todos';
  mostrarPlantillas: boolean = false;
  busqueda            = '';
  vista: VistaProyectos = 'tarjetas';
  dropdownEstadoOpen: boolean = false;
  dropdownTipoOpen: boolean = false;

  // ── Detalle de proyecto ──────────────────────────────────────────
  showDetalle        = false;
  loadingDetalle     = false;
  detalle: Proyecto | null = null;
  tareasPlanasFiltradas: TareaEnriquecida[] = [];
  vistaDetalle: VistaDetalle = 'tareas';
  calculandoFechas     = false;
  aplicandoPlantilla   = false;

  // ── Modales ──────────────────────────────────────────────────────
  showModalProyecto   = false;
  proyectoParaEditar: Proyecto | null = null;
  savingProyecto      = false;

  showModalPlantilla  = false;
  plantillas: Proyecto[] = [];
  loadingPlantillas   = false;

  showModalPermisos   = false;
  showModalCalcularFechas = false;

  showModalActividad  = false;
  actividadParaEditar: Actividad | null = null;
  actividadProyecto: Proyecto | null = null;
  savingActividad     = false;

  showModalTarea      = false;
  tareaParaEditar: Tarea | null = null;
  tareaActividadId: number | null = null;
  savingTarea         = false;

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
    
    // Suscripción a cambios globales para recarga automática
    this._subs.add(
      this.proyServ.refresh$.subscribe(() => {
        this.cargarProyectos();
        if (this.showDetalle && this.detalle) {
          this._refreshDetalle(true);
        }
      })
    );
  }

  ngOnDestroy(): void { this._subs.unsubscribe(); }

  // ════════════════════════════════════════════════════════════════
  // GETTERS DERIVADOS
  // ════════════════════════════════════════════════════════════════

  get proyectosFiltrados(): Proyecto[] {
    const q = this.busqueda.toLowerCase().trim();
    let filtrados = this.proyectos.filter(p =>
      (!q || p.titulo.toLowerCase().includes(q) ||
       (p.descripcion ?? '').toLowerCase().includes(q)),
    );

    if (this.filtroTipoProyecto === 'normales') {
      filtrados = filtrados.filter(p => !p.es_proyecto_informe);
    } else if (this.filtroTipoProyecto === 'informes') {
      filtrados = filtrados.filter(p => p.es_proyecto_informe);
    }

    // Si el filtro es "todos", excluimos los completados y ordenamos el resto:
    // 1. en_ejecucion (más importantes primero)
    // 2. pendiente
    // 3. pausado
    if (this.filtroEstado === 'todos') {
      filtrados = filtrados.filter(p => p.estado !== 'completado');

      const orden: Record<string, number> = {
        'en_ejecucion': 1,
        'pendiente':    2,
        'pausado':      3
      };

      return filtrados.sort((a, b) => {
        const pesoA = orden[a.estado] ?? 99;
        const pesoB = orden[b.estado] ?? 99;
        return pesoA - pesoB;
      });
    }

    return filtrados;
  }

  get usuariosDisponibles(): UsuarioCache[] {
    return this.state.usuariosResponsables;
  }

  actualizarTareasPlanas(proyecto: Proyecto | null = this.detalle): void {
    if (!proyecto) {
      this.tareasPlanasFiltradas = [];
      return;
    }
    const tareas: TareaEnriquecida[] = [];

    for (const act of (proyecto.actividades ?? [])) {
      for (const t of (act.tareas ?? [])) {
        const enr = { ...t } as TareaEnriquecida;
        enr.actividadTitulo       = act.titulo;
        enr.actividadId           = act.id;
        enr.actividadSemaforo     = act.semaforo ?? null;
        enr.actividadResponsables = act.responsables ?? null;
        enr.esGeneral             = false;
        tareas.push(enr);
      }
    }
    for (const t of (proyecto.tareas_sin_actividad ?? [])) {
      const enr = { ...t } as TareaEnriquecida;
      enr.actividadTitulo       = 'Sin actividad';
      enr.actividadId           = null;
      enr.actividadSemaforo     = null;
      enr.actividadResponsables = null;
      enr.esGeneral             = true;
      tareas.push(enr);
    }

    const ahora = new Date();
    const sorted = [...tareas].sort((a, b) => this._prioridadTarea(a, ahora) - this._prioridadTarea(b, ahora));
    this.tareasPlanasFiltradas = sorted;
    this.cdr.detectChanges();
  }

  // Permisos sobre proyecto
  puedeEditarProyecto(p: Proyecto): boolean {
    if (this.puedeGestionarModulo) return true;
    if (p.usuario_creador_id === this.usuarioId) return true;
    return p.mis_permisos?.puede_editar ?? false;
  }

  puedeGestionarPermisos(p: Proyecto): boolean {
    if (this.puedeGestionarModulo) return true;
    if (p.usuario_creador_id === this.usuarioId) return true;
    return p.mis_permisos?.puede_gestionar_permisos ?? false;
  }

  puedeCrearEnProyecto(p: Proyecto | null): boolean {
    if (!p) return false;
    if (this.puedeGestionarModulo) return true;
    if (p.usuario_creador_id === this.usuarioId) return true;
    return p.mis_permisos?.puede_crear ?? false;
  }

  esAdminProyecto(p: Proyecto): boolean {
    if (this.puedeGestionarModulo) return true;
    return p.usuario_creador_id === this.usuarioId || (p.mis_permisos?.puede_gestionar_permisos ?? false);
  }

  puedeEliminarProyecto(p: Proyecto): boolean {
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_eliminar ?? false);
  }

  calcularProgreso(act: Actividad): number {
    return this.state.calcularProgreso(act.tareas_completadas ?? 0, act.total_tareas ?? 0);
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · LISTADO DE PROYECTOS
  // ════════════════════════════════════════════════════════════════

  cargarProyectos(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const filtros = {
      estado:       this.filtroEstado === 'todos' ? undefined : this.filtroEstado as EstadoProyecto,
      es_plantilla: this.mostrarPlantillas,
    };

    this.proyServ.getProyectos(this.usuarioId, filtros).subscribe({
      next: (res) => {
        this.proyectos = res.data ?? [];
        this.onBusquedaChange();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.state.showToast('Error al cargar proyectos', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  cambiarFiltro(f: FiltroEstado): void {
    this.filtroEstado = f;
    this.cargarProyectos();
  }

  cambiarFiltroTipo(tipo: 'todos' | 'normales' | 'informes'): void {
    this.filtroTipoProyecto = tipo;
    this._initPaginadores();
    this.cdr.markForCheck();
  }

  toggleMostrarPlantillas(): void {
    this.mostrarPlantillas = !this.mostrarPlantillas;
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
        next:  () => { this.state.showToast('Estado actualizado', 'success'); },
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
        next:  () => { this.state.showToast('Proyecto eliminado'); },
        error: () => this.state.showToast('No se pudo eliminar', 'error'),
      }),
    );
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · PLANTILLAS
  // ════════════════════════════════════════════════════════════════

  crearPlantillaDesdeProyecto(p: Proyecto): void {
    Swal.fire({
      title: '¿Crear plantilla?',
      text: `Se creará una nueva plantilla basada en "${p.titulo}"`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, crear',
    }).then(r => {
      if (!r.isConfirmed) return;
      this.proyServ.crearPlantilla(p.id, this.usuarioId).subscribe({
        next: (res) => {
          this.state.showToast('Plantilla creada exitosamente');
          this.cdr.markForCheck();
        },
        error: () => this.state.showToast('Error al crear plantilla', 'error'),
      });
    });
  }

  abrirModalPlantillas(): void {
    this.showModalPlantilla = true;
    this.loadingPlantillas  = true;
    this.plantillas         = [];
    this.cdr.markForCheck();

    this.proyServ.getPlantillas(this.usuarioId).subscribe({
      next: (res) => {
        this.plantillas = res.data ?? [];
        this.loadingPlantillas = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingPlantillas = false;
        this.state.showToast('Error al cargar plantillas', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  abrirModalPermisos(): void {
    if (!this.detalle) return;
    this.showModalPermisos = true;
    this.cdr.markForCheck();
  }

  aplicarPlantillaAProyecto(plantilla: Proyecto): void {
    if (!this.detalle) return;
    
    Swal.fire({
      title: '¿Aplicar plantilla?',
      text: `Se agregarán las tareas y actividades de "${plantilla.titulo}" al proyecto "${this.detalle.titulo}". Las tareas actuales no se borrarán.`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, aplicar',
    }).then(r => {
      if (!r.isConfirmed || !this.detalle) return;
      
      this.aplicandoPlantilla = true;
      this.cdr.markForCheck();
      
      this.proyServ.aplicarPlantilla(this.detalle.id, plantilla.id, this.usuarioId).subscribe({
        next: () => {
          this.aplicandoPlantilla = false;
          this.showModalPlantilla = false;
          this.state.showToast('Plantilla aplicada exitosamente');
          this._refreshDetalle();
          this.cdr.markForCheck();
        },
        error: () => {
          this.aplicandoPlantilla = false;
          this.state.showToast('Error al aplicar plantilla', 'error');
          this.cdr.markForCheck();
        },
      });
    });
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · MODAL PROYECTO
  // ════════════════════════════════════════════════════════════════

  abrirModalProyecto(p: Proyecto | null = null): void {
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
      es_plantilla:         form.es_plantilla,
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

  seleccionarProyecto(p: Proyecto): void {
    this.showDetalle   = true;
    this.loadingDetalle = true;
    this.detalle        = null;
    this.cdr.markForCheck();

    this.proyServ.getDetalleCompleto(p.id, this.usuarioId).subscribe({
      next: (res: any) => {
        this.detalle = { ...res.data };
        this.actualizarTareasPlanas();
        this.loadingDetalle = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingDetalle = false;
        this.state.showToast('Error al cargar detalle del proyecto', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  cerrarDetalle(): void {
    this.showDetalle        = false;
    this.detalle            = null;
    this.cdr.markForCheck();
  }

  calcularFechasTareas(): void {
    if (!this.detalle) return;
    this.showModalCalcularFechas = true;
    this.cdr.markForCheck();
  }

  public _refreshDetalle(silent: boolean = false): void {
    if (!this.detalle) return;
    const proyId = this.detalle.id;

    if (!silent) {
      this.loadingDetalle = true;
      this.cdr.detectChanges();
    }
    
    // Delay para asegurar que el backend haya procesado la transacción
    setTimeout(() => {
      this.proyServ.getDetalleCompleto(proyId, this.usuarioId).subscribe({
        next: (res: any) => {
          if (res.data) {
            this.detalle = res.data;
            this.actualizarTareasPlanas(res.data);
          }
          this.loadingDetalle = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadingDetalle = false;
          this.cdr.detectChanges();
        }
      });
    }, silent ? 150 : 0); // Aumentamos un poco el delay a 500ms
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · MODAL ACTIVIDAD
  // ════════════════════════════════════════════════════════════════

  abrirModalActividad(data: any = null): void {
    console.log('Abriendo modal actividad con data:', data);
    // Si viene un objeto con proyecto_id (desde los nuevos botones de modal)
    if (data && data.proyecto_id !== undefined && !data.id) {
      this.actividadParaEditar = null;
    } else {
      // Comportamiento normal (edición o creación simple)
      this.actividadParaEditar = data;
    }
    this.showModalActividad  = true;
    this.cdr.detectChanges(); // Forzar detección de cambios inmediata
  }

  onGuardarActividad(form: ActividadForm): void {
    this.savingActividad = true;
    this.cdr.markForCheck();

    const body = { 
      proyecto_id:          this.detalle!.id,
      titulo:               form.titulo,
      descripcion:          form.descripcion,
      estado:               form.estado as EstadoActividad,
      fecha_limite_entrega: form.fecha_limite_entrega,
      responsables:         form.responsables,
      usuario_id:           this.usuarioId,
      titulo_reapertura:      form.titulo_reapertura,
      descripcion_reapertura: form.descripcion_reapertura
    };

    const req$ = this.actividadParaEditar
      ? this.proyServ.actualizarActividad(this.actividadParaEditar.id, body)
      : this.proyServ.crearActividad(body);

    req$.subscribe({
      next: (res: any) => {
        this.savingActividad    = false;
        this.showModalActividad = false;
        this.state.showToast(res.message ?? 'Actividad guardada');
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingActividad = false;
        this.state.showToast('No se pudo guardar la actividad', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  // ════════════════════════════════════════════════════════════════
  // SECCIÓN · MODAL TAREA
  // ════════════════════════════════════════════════════════════════

  abrirModalTarea(data: any = null, actividadId: number | null = null): void {
    console.log('Abriendo modal tarea con data:', data);
    // Si viene un objeto con actividad_id (desde los nuevos botones de modal)
    if (data && data.actividad_id !== undefined && !data.id) {
      this.tareaParaEditar = null;
      this.tareaActividadId = data.actividad_id;
    } else {
      // Comportamiento normal (edición o creación simple)
      this.tareaParaEditar  = data;
      this.tareaActividadId = data ? data.actividad_id ?? null : actividadId;
    }
    this.showModalTarea   = true;
    this.cdr.detectChanges();
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
      usuario_id:           this.usuarioId,
      titulo_reapertura:      form.titulo_reapertura,
      descripcion_reapertura: form.descripcion_reapertura
    };

    const req$ = this.tareaParaEditar
      ? this.proyServ.actualizarTarea(this.tareaParaEditar.id, body)
      : this.proyServ.crearTarea(body);

    req$.subscribe({
      next: (res: any) => {
        this.savingTarea  = false;
        this.showModalTarea = false;
        this.state.showToast(res.message ?? 'Tarea guardada');
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingTarea = false;
        this.state.showToast('No se pudo guardar la tarea', 'error');
        this.cdr.markForCheck();
      },
    });
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

  private _prioridadTarea(t: Tarea, ahora: Date): number {
    if (t.estado === 'completado') return 1000;
    if (t.semaforo === 'rojo')     return 1;
    if (t.semaforo === 'amarillo') return 2;
    return 10;
  }
}
