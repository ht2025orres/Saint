import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProyectoFinanciero {
  id: number;
  codigo_proyecto: string;
  nombre_proyecto: string | null;
  cliente: string | null;
  estado: string;
  facturacion_presupuestada: number;
  costo_presupuestado: number;
  admin_mano_obra_presupuestada: number;
  comision_presupuestada: number;
  facturacion_real: number;
  costo_real: number;
  admin_mano_obra_real: number;
  comision_real: number;
  margen_presupuestado: number;
  margen_real: number;
  variacion_facturacion: number;
  variacion_costos: number;
  observaciones: string | null;
  nota_adicional?: string | null;
  origen_siesa_docto: string | null;
  ultima_sincronizacion_siesa: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  proceso_codigo?: string;
  proceso_nombre?: string;
  proceso_sigla?: string;
  created_at: string;
  updated_at: string;
}

export interface ProyectoListResponse {
  success: boolean;
  totales: {
    total_proyectos: number;
    total_facturacion_presupuestada: number;
    total_costo_presupuestado: number;
    total_facturacion_real: number;
    total_costo_real: number;
  };
  paginacion: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  data: ProyectoFinanciero[];
  usuario_siesa?: string;
  puede_ver_todos?: boolean;
  proceso_defecto?: string;
  procesos_permitidos?: string[] | null;
}

export interface MovimientoProyectoDetalle {
  tipo_docto: string;
  consec_docto: string;
  fecha: string;
  referencia: string;
  descripcion: string;
  cantidad: number;
  valor_neto: number;
  costo_real: number;
  es_comision?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SeguimientoProyectosService {
  private apiUrl = environment.URL_API_LARAVEL;

  constructor(private http: HttpClient) { }

  getProyectos(params?: { 
    search?: string; 
    estado?: string; 
    margen?: string;
    ejecucion?: string;
    proceso?: string;
    page?: number; 
    per_page?: number; 
    fecha_inicio?: string; 
    fecha_fin?: string;
    todas_fechas?: boolean;
  }): Observable<ProyectoListResponse> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.estado) httpParams = httpParams.set('estado', params.estado);
    if (params?.margen) httpParams = httpParams.set('margen', params.margen);
    if (params?.ejecucion) httpParams = httpParams.set('ejecucion', params.ejecucion);
    if (params?.proceso) httpParams = httpParams.set('proceso', params.proceso);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
    if (params?.fecha_inicio) httpParams = httpParams.set('fecha_inicio', params.fecha_inicio);
    if (params?.fecha_fin) httpParams = httpParams.set('fecha_fin', params.fecha_fin);
    if (params?.todas_fechas !== undefined) httpParams = httpParams.set('todas_fechas', params.todas_fechas.toString());

    return this.http.get<ProyectoListResponse>(`${this.apiUrl}/seguimiento-proyectos`, { params: httpParams });
  }

  getProyecto(id: number): Observable<{ success: boolean; data: ProyectoFinanciero }> {
    return this.http.get<{ success: boolean; data: ProyectoFinanciero }>(`${this.apiUrl}/seguimiento-proyectos/${id}`);
  }

  getDetalleProyecto(codigo: string): Observable<{ success: boolean; data: MovimientoProyectoDetalle[] }> {
    return this.http.get<{ success: boolean; data: MovimientoProyectoDetalle[] }>(`${this.apiUrl}/seguimiento-proyectos/${codigo}/detalle`);
  }

  crearProyecto(data: Partial<ProyectoFinanciero>): Observable<{ success: boolean; data: ProyectoFinanciero; message: string }> {
    return this.http.post<{ success: boolean; data: ProyectoFinanciero; message: string }>(`${this.apiUrl}/seguimiento-proyectos`, data);
  }

  actualizarProyecto(id: number, data: Partial<ProyectoFinanciero>): Observable<{ success: boolean; data: ProyectoFinanciero; message: string }> {
    return this.http.put<{ success: boolean; data: ProyectoFinanciero; message: string }>(`${this.apiUrl}/seguimiento-proyectos/${id}`, data);
  }

  eliminarProyecto(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/seguimiento-proyectos/${id}`);
  }

  sincronizarSiesa(): Observable<{ success: boolean; total_sincronizados: number; proyectos: string[]; errores: any[] }> {
    return this.http.post<{ success: boolean; total_sincronizados: number; proyectos: string[]; errores: any[] }>(`${this.apiUrl}/seguimiento-proyectos/sincronizar-siesa`, {});
  }
}
