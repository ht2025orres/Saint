import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ── TIPOS ─────────────────────────────────────────────────────────────────────

export type EstadoProyecto  = 'pendiente' | 'en_ejecucion' | 'completado' | 'pausado' | 'cancelado';
export type EstadoActividad = 'pendiente' | 'en_ejecucion' | 'completado';
export type EstadoTarea     = 'pendiente' | 'en_ejecucion' | 'completado' | 'bloqueado';
export type Semaforo        = 'rojo' | 'amarillo' | 'verde' | 'gris';
export type NivelDisplay    = 'gestor' | 'admin' | 'editor' | 'colaborador' | 'lector';
export type NivelTarea      = 'admin' | 'parcial' | 'basico' | 'sin_acceso';

export type OrigenTarea = 'seguimiento' | 'proyecto' | 'glpi' | 'compromiso';
export type FuenteTarea = OrigenTarea;

export type EstadoInforme      = 'abierto' | 'en_proceso' | 'cerrado';
export type EstadoInformeTarea = 'pendiente' | 'en_ejecucion' | 'completado';
export type TipoInforme =
  | 'Incidente'
  | 'Hallazgo de Auditoría'
  | 'Riesgo Tecnológico'
  | 'Vulnerabilidad de Seguridad'
  | 'Mejora del Proceso';
export type NivelImpacto = 'Crítico' | 'Alto' | 'Medio' | 'Bajo';

// ── INTERFACES ────────────────────────────────────────────────────────────────

export interface TareaConsolidada {
  id:                   number;
  origen:               OrigenTarea;
  origen_label:         string;
  origen_sub?:          string | null;
  titulo:               string;
  descripcion?:         string | null;
  estado:               string;
  fecha_limite_entrega?: string | null;
  fecha_completado?:    string | null;
  semaforo?:            Semaforo;
  notas?:               string | null;
  usuario_id:           number;
  prioridad?:           number;
  proyecto_nombre?:     string;
}

export interface TareasConsolidadasResponse {
  success: boolean;
  meta: {
    usuario_id: number;
    mes:        number;
    anio:       number;
    fuentes:    FuenteTarea[];
  };
  data: TareaConsolidada[];
}

export interface MisPermisos {
  puede_ver:                boolean;
  puede_crear:              boolean;
  puede_editar:             boolean;
  puede_eliminar:           boolean;
  puede_asignar:            boolean;
  puede_cambiar_fechas:     boolean;
  puede_gestionar_permisos: boolean;
}

export interface PermisoGranular extends MisPermisos {
  usuario_id: number;
  nombre?:    string;
}

export interface ConfiguracionSemaforo {
  id?:  number;
  tipo: 'proyecto' | 'actividad' | 'tarea';
  horas_alta: number; horas_media: number; horas_baja: number;
}

export interface Proyecto {
  id: number; titulo: string; descripcion?: string;
  estado: EstadoProyecto; fecha_limite_entrega?: string;
  usuario_creador_id: number;
  es_plantilla?: boolean;
  total_actividades?: number; total_tareas?: number;
  tareas_completadas?: number; tareas_vencidas?: number;
  tareas_sin_actividad?: Tarea[];
  progreso?: number; semaforo?: Semaforo;
  actividades?: Actividad[];
  mis_permisos?: MisPermisos;
  nivel_usuario?: string;
  created_at: string; updated_at: string;
}

export interface Actividad {
  id: number; proyecto_id: number; titulo: string; descripcion?: string;
  estado: EstadoActividad; orden: number; fecha_limite_entrega?: string;
  total_tareas?: number; tareas_completadas?: number; tareas_vencidas?: number;
  progreso?: number; semaforo?: Semaforo;
  mis_permisos?: MisPermisos;
  tareas?: Tarea[];
  responsables?: number[];
  created_at: string; updated_at: string;
}

export interface Tarea {
  id: number; actividad_id?: number; proyecto_id?: number; titulo: string; descripcion?: string;
  estado: EstadoTarea; fecha_limite_entrega?: string; fecha_completado?: string;
  notas?: string; responsables?: number[]; creado_por: number;
  semaforo?: Semaforo;
  origen?: string;
  evidencias_count?: number;
  created_at: string; updated_at: string;
}

export interface Informe {
  id: number;
  titulo: string;
  descripcion_hallazgo: string;
  tipo: TipoInforme;
  nivel_impacto: NivelImpacto;
  fecha_evento: string;
  causa_raiz?: string | null;
  sistemas_afectados?: string | null;
  impacto_negocio?: string | null;
  accion_correctiva?: string | null;
  accion_preventiva?: string | null;
  control_tecnologico?: string | null;
  fecha_implementacion?: string | null;
  estado: EstadoInforme;
  creado_por: number;
  created_at: string;
  updated_at: string;
  total_tareas?: number;
  tareas_completadas?: number;
  tareas_vencidas?: number;
  progreso?: number;
  puede_gestionar?: boolean;
  es_creador?: boolean;
  tareas?: InformeTarea[];
}

export interface InformeTarea {
  id: number;
  informe_id: number;
  responsable_id: number;
  titulo: string;
  descripcion?: string | null;
  estado: EstadoInformeTarea;
  fecha_limite_entrega?: string | null;
  fecha_completado?: string | null;
  semaforo?: string | null;
  creado_por: number;
  created_at: string;
  updated_at: string;
  informe_titulo?: string;
  origen?: string;
}

// ── SEGUIMIENTO ───────────────────────────────────────────────────────────────

export interface SeguimientoAnual {
  id: number;
  titulo: string;
  anio: number;
  usuario_gestor_id: number;
  estado: 'activo' | 'cerrado';
  es_gestor?: boolean;
  participantes_count?: number;
}

export interface VistaMes {
  id: number;
  mes: number;
  anio: number;
  titulo: string;
  estado: 'activo' | 'cerrado';
  es_gestor: boolean;
  usuario_gestor_id: number;
  tareas: { [uid: string]: SeguimientoTarea[] } | SeguimientoTarea[];
  participantes: number[];
  participantes_info: { id: number; nombre: string }[];
}

export interface SeguimientoMensual {
  id: number; titulo: string; mes: number; anio: number;
  usuario_gestor_id: number; estado: 'activo' | 'cerrado';
  es_gestor?: boolean;
  participantes?: number[];
  participantes_info?: { id: number; nombre: string }[];
  semanas?: SeguimientoSemana[];
}

export interface SeguimientoSemana {
  id: number; seguimiento_id: number; numero_semana: number;
  titulo: string; fecha_inicio: string; fecha_fin: string;
  tareas?: SeguimientoTarea[] | { [usuarioId: string]: SeguimientoTarea[] };
  es_gestor?: boolean;
}

export interface SeguimientoTarea {
  id: number; semana_id: number; usuario_id: number;
  titulo: string; descripcion?: string; estado: string;
  notas?: string; fecha_limite_entrega?: string; fecha_completado?: string;
  semaforo?: Semaforo;
  responsables?: number[];   // ← NUEVO
}

// ── INTERFACES FLUJOS DIARIOS ─────────────────────────────────────────────────
 
export interface Compromiso {
  id:           number;
  flujo_id:     number;
  titulo:       string;
  descripcion?: string | null;
  estado:       'pendiente' | 'en_ejecucion' | 'completado';
  responsables: number[];
  notas?:       string | null;
  fecha_inicio?: string | null;
  fecha_completado?: string | null;
  created_at:   string;
  updated_at:   string;
}
 
export interface SnapshotFlujo {
  fecha:              string;
  total:              number;
  completados:        number;
  en_ejecucion?:      number;
  pendientes?:        number;
  compromisos:        { id: number; titulo: string; estado: string; responsables: number[]; fecha_inicio?: string | null; fecha_completado?: string | null }[];
  carga_por_persona:  { usuario_id: number; nombre?: string; total: number; completados: number; en_ejecucion?: number; pendientes?: number }[];
}
 
export interface FlujoDiario {
  id:                  number;
  seguimiento_id:      number;
  titulo:              string;
  fecha:               string;
  usuario_gestor_id:   number;
  estado:              'activo' | 'cerrado';
  snapshot_cierre?:    SnapshotFlujo | null;
  snapshot_apertura?:  SnapshotFlujo | null;
  compromisos?:        Compromiso[];
  compromisos_pasados?: Compromiso[];
  created_at:          string;
  updated_at:          string;
}

export type ApiResponse<T> = { success: boolean; data: T };
export type ApiMessage     = { success: boolean; message: string };

@Injectable({ providedIn: 'root' })
export class ProyectoService {
  private readonly api = environment.URL_API_LARAVEL;

  // ── REACCIÓN GLOBAL ───────────────────────────────────────────────────────
  /** Emite cada vez que se crea, edita o elimina algo relevante (proyecto, actividad, tarea) */
  private _refresh$ = new Subject<void>();
  readonly refresh$ = this._refresh$.asObservable();

  notifyRefresh(): void {
    this._refresh$.next();
  }

  constructor(private http: HttpClient) {}

  // ── TAREAS CONSOLIDADAS ───────────────────────────────────────────────────

  getTareasConsolidadas(
    usuarioId: number,
    mes: number,
    anio: number,
    fuentes: FuenteTarea[] = ['seguimiento', 'proyecto'],
  ): Observable<TareasConsolidadasResponse> {
    const params = new HttpParams()
      .set('usuario_id', usuarioId)
      .set('mes', mes)
      .set('anio', anio)
      .set('fuentes', fuentes.join(','));
    return this.http.get<TareasConsolidadasResponse>(`${this.api}/tareas-consolidadas`, { params });
  }

  // ── SEMÁFOROS ─────────────────────────────────────────────────────────────

  getConfigSemaforo(): Observable<ApiResponse<ConfiguracionSemaforo[]>> {
    return this.http.get<ApiResponse<ConfiguracionSemaforo[]>>(`${this.api}/semaforo/configuracion`);
  }

  updateConfigSemaforo(tipo: string, data: Partial<ConfiguracionSemaforo>): Observable<ApiResponse<ConfiguracionSemaforo>> {
    return this.http.put<ApiResponse<ConfiguracionSemaforo>>(`${this.api}/semaforo/configuracion/${tipo}`, data);
  }

  // ── PROYECTOS ─────────────────────────────────────────────────────────────

  getDashboard(usuarioId: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.api}/proyectos/dashboard`, { params: { usuario_id: usuarioId } });
  }

  getDetalleCompleto(proyectoId: number, usuarioId: number): Observable<ApiResponse<Proyecto>> {
    return this.http.get<ApiResponse<Proyecto>>(`${this.api}/proyectos/${proyectoId}/detalle-completo`, {
      params: new HttpParams().set('usuario_id', usuarioId)
    });
  }

  calcularFechasTareas(proyectoId: number, usuarioId: number, responsables: number[]): Observable<any> {
    return this.http.post(`${this.api}/proyectos/${proyectoId}/calcular-fechas`, { usuario_id: usuarioId, responsables });
  }

  getProyectos(usuarioId: number, filtros?: { estado?: EstadoProyecto; activos?: boolean; es_plantilla?: boolean }): Observable<ApiResponse<Proyecto[]>> {
    let params = new HttpParams().set('usuario_id', usuarioId);
    if (filtros?.estado)  params = params.set('estado', filtros.estado);
    if (filtros?.activos) params = params.set('activos', 'true');
    if (filtros?.es_plantilla !== undefined) params = params.set('es_plantilla', filtros.es_plantilla ? 'true' : 'false');
    return this.http.get<ApiResponse<Proyecto[]>>(`${this.api}/proyectos`, { params });
  }

  getPlantillas(usuarioId: number): Observable<ApiResponse<Proyecto[]>> {
    const params = new HttpParams().set('usuario_id', usuarioId);
    return this.http.get<ApiResponse<Proyecto[]>>(`${this.api}/proyectos/plantillas`, { params });
  }

  crearPlantilla(proyectoId: number, usuarioId: number): Observable<ApiResponse<Proyecto>> {
    return this.http.post<ApiResponse<Proyecto>>(`${this.api}/proyectos/${proyectoId}/crear-plantilla`, { usuario_id: usuarioId });
  }

  aplicarPlantilla(proyectoId: number, plantillaId: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/proyectos/${proyectoId}/aplicar-plantilla`, {
      usuario_id: usuarioId,
      plantilla_id: plantillaId
    });
  }

  crearProyecto(data: Partial<Proyecto> & { usuario_id: number }): Observable<ApiResponse<Proyecto> & ApiMessage> {
    return this.http.post<any>(`${this.api}/proyectos`, data).pipe(tap(() => this.notifyRefresh()));
  }

  actualizarProyecto(id: number, data: Partial<Proyecto> & { usuario_id: number }): Observable<ApiMessage> {
    return this.http.put<ApiMessage>(`${this.api}/proyectos/${id}`, data).pipe(tap(() => this.notifyRefresh()));
  }

  eliminarProyecto(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.api}/proyectos/${id}`, { params: { usuario_id: usuarioId } }).pipe(tap(() => this.notifyRefresh()));
  }

  cambiarEstadoProyecto(id: number, estado: string, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/proyectos/${id}/cambiar-estado`, { estado, usuario_id: usuarioId }).pipe(tap(() => this.notifyRefresh()));
  }

  // ── PERMISOS ──────────────────────────────────────────────────────────────

  getPermisosEntidad(tipo: 'proyecto' | 'actividad' | 'tarea', id: number, usuarioId: number): Observable<ApiResponse<PermisoGranular[]>> {
    const url = tipo === 'proyecto' ? `proyectos/${id}/permisos` : tipo === 'actividad' ? `actividades/${id}/permisos` : `tareas/${id}/permisos`;
    return this.http.get<ApiResponse<PermisoGranular[]>>(`${this.api}/${url}`, { params: { usuario_id: usuarioId } });
  }

  sincronizarPermisosEntidad(tipo: 'proyecto' | 'actividad' | 'tarea', id: number, usuarioId: number, asignaciones: PermisoGranular[]): Observable<ApiMessage> {
    const url = tipo === 'proyecto' ? `proyectos/${id}/permisos` : tipo === 'actividad' ? `actividades/${id}/permisos` : `tareas/${id}/permisos`;
    return this.http.post<ApiMessage>(`${this.api}/${url}`, { usuario_id: usuarioId, asignaciones });
  }

  // ── ACTIVIDADES ───────────────────────────────────────────────────────────

  crearActividad(data: Partial<Actividad> & { usuario_id: number }): Observable<ApiResponse<Actividad> & ApiMessage> {
    return this.http.post<any>(`${this.api}/actividades`, data).pipe(tap(() => this.notifyRefresh()));
  }

  actualizarActividad(id: number, data: Partial<Actividad> & { usuario_id: number }): Observable<ApiMessage> {
    return this.http.put<ApiMessage>(`${this.api}/actividades/${id}`, data).pipe(tap(() => this.notifyRefresh()));
  }

  eliminarActividad(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.api}/actividades/${id}`, { params: { usuario_id: usuarioId } }).pipe(tap(() => this.notifyRefresh()));
  }

  asignarUsuarioActividad(
    actividadId: number,
    usuarioId: number,
    asignadoId: number,
    nivel: 'admin' | 'gestor' | 'colaborador' | 'visualizador' = 'colaborador'
  ): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(
      `${this.api}/actividades/${actividadId}/asignar-usuario`,
      { usuario_id: usuarioId, asignado_id: asignadoId, nivel }
    );
  }

  // ── TAREAS ────────────────────────────────────────────────────────────────

  crearTarea(data: Partial<Tarea> & { usuario_id: number; proyecto_id?: number }): Observable<ApiResponse<Tarea>> {
    return this.http.post<ApiResponse<Tarea>>(`${this.api}/tareas`, data).pipe(tap(() => this.notifyRefresh()));
  }

  actualizarTarea(id: number, data: Partial<Tarea> & { usuario_id: number }): Observable<ApiResponse<Tarea>> {
    return this.http.put<ApiResponse<Tarea>>(`${this.api}/tareas/${id}`, data).pipe(tap(() => this.notifyRefresh()));
  }

  eliminarTarea(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.api}/tareas/${id}`, { params: { usuario_id: usuarioId } }).pipe(tap(() => this.notifyRefresh()));
  }

  completarTarea(id: number, usuarioId: number, data?: FormData | { notas?: string }): Observable<ApiMessage> {
    if (data instanceof FormData) {
      if (!data.has('usuario_id')) data.append('usuario_id', String(usuarioId));
      return this.http.post<ApiMessage>(`${this.api}/tareas/${id}/completar`, data).pipe(tap(() => this.notifyRefresh()));
    }
    return this.http.post<ApiMessage>(`${this.api}/tareas/${id}/completar`, { ...data, usuario_id: usuarioId }).pipe(tap(() => this.notifyRefresh()));
  }

  // ── SEGUIMIENTO ───────────────────────────────────────────────────────────────

  obtenerInfoSeguimiento(anio: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.api}/seguimiento/anio/${anio}`);
  }

  getSeguimientosAnuales(usuarioId: number): Observable<ApiResponse<SeguimientoAnual[]>> {
    return this.http.get<ApiResponse<SeguimientoAnual[]>>(`${this.api}/seguimientos`, { params: { usuario_id: usuarioId } });
  }

  getVistaMes(id: number, mes: number, anio: number, usuarioId: number): Observable<ApiResponse<VistaMes>> {
    return this.http.get<ApiResponse<VistaMes>>(`${this.api}/seguimientos/${id}/mes/${mes}`, { params: { usuario_id: usuarioId, anio } });
  }

  getDetalleSeguimiento(id: number, usuarioId: number): Observable<ApiResponse<SeguimientoMensual>> {
    return this.http.get<ApiResponse<SeguimientoMensual>>(`${this.api}/seguimientos/${id}`, { params: { usuario_id: usuarioId } });
  }

  crearSeguimiento(data: { anio: number; titulo?: string; usuario_id: number; participantes?: number[] }): Observable<ApiResponse<SeguimientoAnual> & ApiMessage> {
    return this.http.post<any>(`${this.api}/seguimientos`, data);
  }

  sincronizarParticipantes(id: number, usuarioId: number, participantes: number[]): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/seguimientos/${id}/participantes`, { usuario_id: usuarioId, participantes });
  }

  cerrarSeguimiento(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/seguimientos/${id}/cerrar`, { usuario_id: usuarioId });
  }

  // ── TAREAS DE SEGUIMIENTO ─────────────────────────────────────────────────

  crearSeguimientoTarea(data: {
    semana_id?: number; seguimiento_id?: number; usuario_id: number;
    responsables?: number[];          // ← NUEVO (reemplaza usuario_asignado_id)
    titulo: string; descripcion?: string;
    estado?: string; notas?: string; fecha_limite_entrega?: string;
  }): Observable<ApiResponse<SeguimientoTarea> & ApiMessage> {
    return this.http.post<any>(`${this.api}/seguimiento-tareas`, data).pipe(tap(() => this.notifyRefresh()));
  }

  actualizarSeguimientoTarea(id: number, data: Partial<SeguimientoTarea> & { usuario_id: number }): Observable<ApiMessage> {
    return this.http.put<ApiMessage>(`${this.api}/seguimiento-tareas/${id}`, data).pipe(tap(() => this.notifyRefresh()));
  }

  completarSeguimientoTarea(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/seguimiento-tareas/${id}/completar`, { usuario_id: usuarioId }).pipe(tap(() => this.notifyRefresh()));
  }

  eliminarSeguimientoTarea(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.api}/seguimiento-tareas/${id}`, { params: { usuario_id: usuarioId } }).pipe(tap(() => this.notifyRefresh()));
  }

  // ── EVIDENCIAS ────────────────────────────────────────────────────────────

  getEvidencias(tipo: 'tarea' | 'seguimiento_tarea' | 'informe_tarea', id: number, historico = false, usuarioId?: number): Observable<ApiResponse<any[]>> {
    let params = new HttpParams().set('tipo', tipo);
    if (historico) params = params.set('historico', 'true');
    if (usuarioId) params = params.set('usuario_id', String(usuarioId));

    let endpoint = '';
    switch (tipo) {
      case 'tarea':             endpoint = 'tareas'; break;
      case 'seguimiento_tarea': endpoint = 'seguimiento-tareas'; break;
      case 'informe_tarea':     endpoint = 'informe-tareas'; break;
    }

    return this.http.get<ApiResponse<any[]>>(`${this.api}/${endpoint}/${id}/evidencias`, { params });
  }

  subirEvidencia(tipo: 'tarea' | 'seguimiento_tarea' | 'informe_tarea', id: number, archivo: File, usuarioId: number): Observable<any> {
    const form = new FormData();
    form.append('archivo', archivo);
    form.append('tipo', tipo);
    form.append('usuario_id', String(usuarioId));

    let endpoint = '';
    switch (tipo) {
      case 'tarea':             endpoint = 'tareas'; break;
      case 'seguimiento_tarea': endpoint = 'seguimiento-tareas'; break;
      case 'informe_tarea':     endpoint = 'informe-tareas'; break;
    }

    return this.http.post<any>(`${this.api}/${endpoint}/${id}/evidencias`, form);
  }

  getUrlEvidencia(evidenciaId: number): Observable<{ success: boolean; url: string }> {
    return this.http.get<any>(`${this.api}/evidencias/${evidenciaId}/url`);
  }

  eliminarEvidencia(evidenciaId: number, usuarioId: number): Observable<any> {
    return this.http.delete<any>(`${this.api}/evidencias/${evidenciaId}`, { params: { usuario_id: usuarioId } });
  }

  restaurarEvidencia(evidenciaId: number, usuarioId: number): Observable<any> {
    return this.http.post<any>(`${this.api}/evidencias/${evidenciaId}/restaurar`, { usuario_id: usuarioId });
  }

  // ── INFORMES ──────────────────────────────────────────────────────────────

  getInformes(
    usuarioId: number,
    filtros?: { estado?: string; busqueda?: string },
  ): Observable<ApiResponse<Informe[]>> {
    let params = new HttpParams().set('usuario_id', usuarioId);
    if (filtros?.estado && filtros.estado !== 'todos') params = params.set('estado', filtros.estado);
    if (filtros?.busqueda)                             params = params.set('busqueda', filtros.busqueda);
    return this.http.get<ApiResponse<Informe[]>>(`${this.api}/informes`, { params });
  }

  getInformeDetalle(id: number, usuarioId: number): Observable<ApiResponse<Informe>> {
    return this.http.get<ApiResponse<Informe>>(`${this.api}/informes/${id}`, { params: { usuario_id: usuarioId } });
  }

  crearInforme(data: Partial<Informe> & { usuario_id: number }): Observable<ApiResponse<Informe> & ApiMessage> {
    return this.http.post<any>(`${this.api}/informes`, data);
  }

  actualizarInforme(id: number, data: Partial<Informe> & { usuario_id: number }): Observable<ApiMessage> {
    return this.http.put<ApiMessage>(`${this.api}/informes/${id}`, data);
  }

  eliminarInforme(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.api}/informes/${id}`, { params: { usuario_id: usuarioId } });
  }

  // ── TAREAS DE INFORME ─────────────────────────────────────────────────────

  getInformeTareas(informeId: number, usuarioId: number): Observable<ApiResponse<InformeTarea[]>> {
    return this.http.get<ApiResponse<InformeTarea[]>>(`${this.api}/informes/${informeId}/tareas`, { params: { usuario_id: usuarioId } });
  }

  crearInformeTarea(data: Partial<InformeTarea> & { usuario_id: number }): Observable<ApiResponse<InformeTarea> & ApiMessage> {
    return this.http.post<any>(`${this.api}/informe-tareas`, data);
  }

  actualizarInformeTarea(id: number, data: Partial<InformeTarea> & { usuario_id: number }): Observable<ApiMessage> {
    return this.http.put<ApiMessage>(`${this.api}/informe-tareas/${id}`, data);
  }

  completarInformeTarea(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/informe-tareas/${id}/completar`, { usuario_id: usuarioId });
  }

  eliminarInformeTarea(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.api}/informe-tareas/${id}`, { params: { usuario_id: usuarioId } });
  }

  getMisInformeTareas(usuarioId: number): Observable<ApiResponse<InformeTarea[]>> {
    return this.http.get<ApiResponse<InformeTarea[]>>(`${this.api}/mis-tareas-informe`, { params: { usuario_id: usuarioId } });
  }

  // ── FLUJOS DIARIOS ────────────────────────────────────────────────────────────
 
  getFlujoActivo(seguimientoId: number, usuarioId: number, fecha?: string): Observable<ApiResponse<FlujoDiario | null>> {
    let params = new HttpParams().set('usuario_id', usuarioId);
    if (fecha) params = params.set('fecha', fecha);
    return this.http.get<any>(`${this.api}/seguimientos/${seguimientoId}/flujo-activo`, { params });
  }
 
  getFlujos(seguimientoId: number, usuarioId: number): Observable<ApiResponse<FlujoDiario[]>> {
    return this.http.get<ApiResponse<FlujoDiario[]>>(`${this.api}/seguimientos/${seguimientoId}/flujos`, { params: { usuario_id: usuarioId } });
  }
 
  crearFlujo(data: { seguimiento_id: number; titulo?: string; fecha: string; usuario_id: number }): Observable<ApiResponse<FlujoDiario> & ApiMessage> {
    return this.http.post<any>(`${this.api}/flujos-diarios`, data);
  }
 
  cerrarFlujo(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/flujos-diarios/${id}/cerrar`, { usuario_id: usuarioId });
  }
 
  crearCompromiso(data: { flujo_id: number; titulo: string; descripcion?: string; responsables: number[]; usuario_id: number }): Observable<ApiResponse<Compromiso> & ApiMessage> {
    return this.http.post<any>(`${this.api}/compromisos`, data);
  }
 
  actualizarCompromiso(id: number, data: { anio: number; mes: number; titulo?: string; usuario_id: number; responsables?: number[]; notas?: string }): Observable<ApiMessage> {
    return this.http.put<ApiMessage>(`${this.api}/compromisos/${id}`, data);
  }

  iniciarCompromiso(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/compromisos/${id}/iniciar`, { usuario_id: usuarioId });
  }
 
  completarCompromiso(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/compromisos/${id}/completar`, { usuario_id: usuarioId });
  }

  reabrirCompromiso(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/compromisos/${id}/reabrir`, { usuario_id: usuarioId });
  }
 
  eliminarCompromiso(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.api}/compromisos/${id}`, { params: { usuario_id: usuarioId } });
  }

  getSaturacionParticipantes(seguimientoId: number, usuarioId: number): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.api}/seguimientos/${seguimientoId}/saturacion`,
      { params: new HttpParams().set('usuario_id', usuarioId) }
    );
  }
}
