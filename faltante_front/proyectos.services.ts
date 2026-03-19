import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── TIPOS ─────────────────────────────────────────────────────────────────────

export type EstadoProyecto  = 'pendiente' | 'en_ejecucion' | 'completado' | 'pausado' | 'cancelado';
export type EstadoActividad = 'pendiente' | 'en_ejecucion' | 'completado';
export type EstadoTarea     = 'pendiente' | 'en_ejecucion' | 'completado' | 'bloqueado';
export type Semaforo        = 'rojo' | 'amarillo' | 'verde' | 'gris';
export type NivelDisplay    = 'gestor' | 'admin' | 'editor' | 'colaborador' | 'lector';
export type NivelTarea      = 'admin' | 'parcial' | 'basico' | 'sin_acceso';

export type OrigenTarea = 'seguimiento' | 'proyecto' | 'glpi';
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
  total_actividades?: number; total_tareas?: number;
  tareas_completadas?: number; tareas_vencidas?: number;
  tareas_sin_actividad?: Tarea[];
  progreso?: number; semaforo?: Semaforo;
  nivel_usuario?: NivelDisplay;
  mis_permisos?: MisPermisos;
  actividades?: Actividad[];
  created_at: string; updated_at: string;
}

export interface Actividad {
  id: number; proyecto_id: number; titulo: string; descripcion?: string;
  estado: EstadoActividad; orden: number; fecha_limite_entrega?: string;
  total_tareas?: number; tareas_completadas?: number; tareas_vencidas?: number;
  progreso?: number; semaforo?: Semaforo;
  mis_permisos?: MisPermisos;
  tareas?: Tarea[];
  created_at: string; updated_at: string;
}

export interface Tarea {
  id: number; actividad_id?: number; proyecto_id?: number; titulo: string; descripcion?: string;
  estado: EstadoTarea; fecha_limite_entrega?: string; fecha_completado?: string;
  notas?: string; responsables?: number[]; creado_por: number;
  semaforo?: Semaforo;
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

type ApiResponse<T> = { success: boolean; data: T };
type ApiMessage     = { success: boolean; message: string };

@Injectable({ providedIn: 'root' })
export class ProyectoService {
  private readonly api = environment.URL_API_LARAVEL;

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

  obtenerDetalleProyecto(id: number, usuarioId: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.api}/proyectos/${id}/detalle-completo`, { params: { usuario_id: usuarioId } });
  }

  calcularFechasTareas(proyectoId: number, usuarioId: number, responsables: number[]): Observable<any> {
    return this.http.post(`${this.api}/proyectos/${proyectoId}/calcular-fechas`, { usuario_id: usuarioId, responsables });
  }

  getProyectos(usuarioId: number, filtros?: { estado?: string; activos?: boolean }): Observable<ApiResponse<Proyecto[]>> {
    let params = new HttpParams().set('usuario_id', usuarioId);
    if (filtros?.estado)  params = params.set('estado', filtros.estado);
    if (filtros?.activos) params = params.set('activos', 'true');
    return this.http.get<ApiResponse<Proyecto[]>>(`${this.api}/proyectos`, { params });
  }

  crearProyecto(data: Partial<Proyecto> & { usuario_id: number }): Observable<ApiResponse<Proyecto> & ApiMessage> {
    return this.http.post<any>(`${this.api}/proyectos`, data);
  }

  actualizarProyecto(id: number, data: Partial<Proyecto> & { usuario_id: number }): Observable<ApiMessage> {
    return this.http.put<ApiMessage>(`${this.api}/proyectos/${id}`, data);
  }

  eliminarProyecto(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.api}/proyectos/${id}`, { params: { usuario_id: usuarioId } });
  }

  cambiarEstadoProyecto(id: number, estado: string, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/proyectos/${id}/cambiar-estado`, { estado, usuario_id: usuarioId });
  }

  getDetalleCompleto(id: number, usuarioId: number): Observable<ApiResponse<Proyecto>> {
    return this.http.get<ApiResponse<Proyecto>>(`${this.api}/proyectos/${id}/detalle-completo`, { params: { usuario_id: usuarioId } });
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
    return this.http.post<any>(`${this.api}/actividades`, data);
  }

  actualizarActividad(id: number, data: Partial<Actividad> & { usuario_id: number }): Observable<ApiMessage> {
    return this.http.put<ApiMessage>(`${this.api}/actividades/${id}`, data);
  }

  eliminarActividad(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.api}/actividades/${id}`, { params: { usuario_id: usuarioId } });
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
    return this.http.post<any>(`${this.api}/tareas`, data);
  }

  actualizarTarea(id: number, data: Partial<Tarea> & { usuario_id: number }): Observable<ApiMessage> {
    return this.http.put<ApiMessage>(`${this.api}/tareas/${id}`, data);
  }

  eliminarTarea(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.api}/tareas/${id}`, { params: { usuario_id: usuarioId } });
  }

  completarTarea(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/tareas/${id}/completar`, { usuario_id: usuarioId });
  }

  // ── SEGUIMIENTOS ──────────────────────────────────────────────────────────

  TraerIdSeguimientoDelAnio(anio: number): Observable<ApiResponse<number>> {
    return this.http.get<ApiResponse<number>>(`${this.api}/seguimiento/anio/${anio}`);
  }

  getSeguimientos(usuarioId: number): Observable<ApiResponse<SeguimientoAnual[]>> {
    return this.http.get<ApiResponse<SeguimientoAnual[]>>(`${this.api}/seguimientos`, { params: { usuario_id: usuarioId } });
  }

  getVistaMes(id: number, mes: number, usuarioId: number): Observable<ApiResponse<VistaMes>> {
    return this.http.get<ApiResponse<VistaMes>>(`${this.api}/seguimientos/${id}/mes/${mes}`, { params: { usuario_id: usuarioId } });
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
    return this.http.post<any>(`${this.api}/seguimiento-tareas`, data);
  }

  actualizarSeguimientoTarea(id: number, data: Partial<SeguimientoTarea> & { usuario_id: number }): Observable<ApiMessage> {
    return this.http.put<ApiMessage>(`${this.api}/seguimiento-tareas/${id}`, data);
  }

  completarSeguimientoTarea(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/seguimiento-tareas/${id}/completar`, { usuario_id: usuarioId });
  }

  eliminarSeguimientoTarea(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.api}/seguimiento-tareas/${id}`, { params: { usuario_id: usuarioId } });
  }

  // ── EVIDENCIAS ────────────────────────────────────────────────────────────

  getEvidencias(tipo: 'tarea' | 'seguimiento_tarea', id: number): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.api}/${tipo === 'tarea' ? 'tareas' : 'seguimiento-tareas'}/${id}/evidencias`,
      { params: { tipo } }
    );
  }

  subirEvidencia(tipo: 'tarea' | 'seguimiento_tarea', id: number, archivo: File, usuarioId: number): Observable<any> {
    const form = new FormData();
    form.append('archivo', archivo);
    form.append('tipo', tipo);
    form.append('usuario_id', String(usuarioId));
    return this.http.post<any>(
      `${this.api}/${tipo === 'tarea' ? 'tareas' : 'seguimiento-tareas'}/${id}/evidencias`, form
    );
  }

  getUrlEvidencia(evidenciaId: number): Observable<{ success: boolean; url: string }> {
    return this.http.get<any>(`${this.api}/evidencias/${evidenciaId}/url`);
  }

  eliminarEvidencia(evidenciaId: number, usuarioId: number): Observable<any> {
    return this.http.delete<any>(`${this.api}/evidencias/${evidenciaId}`, { params: { usuario_id: usuarioId } });
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
}