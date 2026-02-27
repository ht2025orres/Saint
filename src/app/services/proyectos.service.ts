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
  id: number; actividad_id: number; titulo: string; descripcion?: string;
  estado: EstadoTarea; fecha_limite_entrega?: string; fecha_completado?: string;
  notas?: string; responsables?: number[]; creado_por: number;
  semaforo?: Semaforo;
  created_at: string; updated_at: string;
}

// ── SEGUIMIENTO ───────────────────────────────────────────────────────────────

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
}

type ApiResponse<T> = { success: boolean; data: T };
type ApiMessage     = { success: boolean; message: string };

// ── SERVICIO ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ProyectoService {
  private readonly api = environment.URL_API_LARAVEL;

  constructor(private http: HttpClient) {}

  // ── CONFIG SEMÁFORO ────────────────────────────────────────────────────────

  getConfigSemaforo(): Observable<ApiResponse<ConfiguracionSemaforo[]>> {
    return this.http.get<ApiResponse<ConfiguracionSemaforo[]>>(`${this.api}/semaforo/configuracion`);
  }

  updateConfigSemaforo(tipo: string, data: Partial<ConfiguracionSemaforo>): Observable<ApiResponse<ConfiguracionSemaforo>> {
    return this.http.put<ApiResponse<ConfiguracionSemaforo>>(`${this.api}/semaforo/configuracion/${tipo}`, data);
  }

  // ── PROYECTOS ──────────────────────────────────────────────────────────────

  getDashboard(usuarioId: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.api}/proyectos/dashboard`, { params: { usuario_id: usuarioId } });
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

  getPermisosEntidad(tipo: 'proyecto' | 'actividad' | 'tarea', id: number, usuarioId: number): Observable<ApiResponse<PermisoGranular[]>> {
    const url = tipo === 'proyecto' ? `proyectos/${id}/permisos` : tipo === 'actividad' ? `actividades/${id}/permisos` : `tareas/${id}/permisos`;
    return this.http.get<ApiResponse<PermisoGranular[]>>(`${this.api}/${url}`, { params: { usuario_id: usuarioId } });
  }

  sincronizarPermisosEntidad(tipo: 'proyecto' | 'actividad' | 'tarea', id: number, usuarioId: number, asignaciones: PermisoGranular[]): Observable<ApiMessage> {
    const url = tipo === 'proyecto' ? `proyectos/${id}/permisos` : tipo === 'actividad' ? `actividades/${id}/permisos` : `tareas/${id}/permisos`;
    return this.http.post<ApiMessage>(`${this.api}/${url}`, { usuario_id: usuarioId, asignaciones });
  }

  // ── ACTIVIDADES ────────────────────────────────────────────────────────────

  crearActividad(data: Partial<Actividad> & { usuario_id: number }): Observable<ApiResponse<Actividad> & ApiMessage> {
    return this.http.post<any>(`${this.api}/actividades`, data);
  }

  actualizarActividad(id: number, data: Partial<Actividad> & { usuario_id: number }): Observable<ApiMessage> {
    return this.http.put<ApiMessage>(`${this.api}/actividades/${id}`, data);
  }

  eliminarActividad(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.api}/actividades/${id}`, { params: { usuario_id: usuarioId } });
  }

  // ── TAREAS ─────────────────────────────────────────────────────────────────

  crearTarea(data: Partial<Tarea> & { usuario_id: number }): Observable<ApiResponse<Tarea> & ApiMessage> {
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

  // ── SEGUIMIENTOS ───────────────────────────────────────────────────────────

  getSeguimientos(usuarioId: number): Observable<ApiResponse<SeguimientoMensual[]>> {
    return this.http.get<ApiResponse<SeguimientoMensual[]>>(`${this.api}/seguimientos`, { params: { usuario_id: usuarioId } });
  }

  getDetalleSeguimiento(id: number, usuarioId: number): Observable<ApiResponse<SeguimientoMensual>> {
    return this.http.get<ApiResponse<SeguimientoMensual>>(`${this.api}/seguimientos/${id}`, { params: { usuario_id: usuarioId } });
  }

  crearSeguimiento(data: { mes: number; anio: number; titulo?: string; usuario_id: number; participantes?: number[] }): Observable<ApiResponse<SeguimientoMensual> & ApiMessage> {
    return this.http.post<any>(`${this.api}/seguimientos`, data);
  }

  sincronizarParticipantes(id: number, usuarioId: number, participantes: number[]): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/seguimientos/${id}/participantes`, { usuario_id: usuarioId, participantes });
  }

  cerrarSeguimiento(id: number, usuarioId: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.api}/seguimientos/${id}/cerrar`, { usuario_id: usuarioId });
  }

  crearSeguimientoTarea(data: Partial<SeguimientoTarea> & { usuario_id: number }): Observable<ApiResponse<SeguimientoTarea> & ApiMessage> {
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
}