import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CentroCosto {
  cuenta: string;
  desc_auxiliar: string;
  desc_ccosto: string;
  presupuesto: number;
  real: number;
  diferencia: number;
  porcentaje: number;
  responsable: string;
  semaforo: 'verde' | 'amarillo' | 'rojo';
}

export interface Proceso {
  id: number;
  nombre: string;
  responsable?: string;
  descripcion?: string;
  orden: number;
  activo: boolean;
  presupuesto: number;
  real: number;
  diferencia: number;
  porcentaje: number;
  semaforo: string;
  total_grupos: number;
  grupos: Grupo[];
}

export interface Grupo {
  id: number;
  nombre: string;
  descripcion?: string;
  orden: number;
  activo: boolean;
  presupuesto: number;
  real: number;
  diferencia: number;
  porcentaje: number;
  semaforo: string;
  total_conceptos: number;
  conceptos: Concepto[];
}

export interface Concepto {
  id: number;
  nombre: string;
  descripcion?: string;
  orden: number;
  activo: boolean;
  presupuesto: number;
  real: number;
  diferencia: number;
  porcentaje: number;
  semaforo: string;
  total_cuentas: number;
  cuentas: ConceptoCuenta[];
  detalle: CentroCosto[];
}

export interface ConceptoCuenta {
  id: number;
  cuenta: string;
  descripcion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CentrosCostosService {
  private apiUrl = `${environment.URL_API_LARAVEL}/centros-costos`;

  constructor(private http: HttpClient) {}

  obtenerJerarquia(ano: number, mes: number): Observable<{ success: boolean; data: Proceso[] }> {
    return this.http.get<{ success: boolean; data: Proceso[] }>(this.apiUrl, {
      params: { ano: ano.toString(), mes: mes.toString() }
    });
  }

  // ==================== PROCESOS ====================

  listarProcesos(): Observable<{ success: boolean; data: Proceso[] }> {
    return this.http.get<{ success: boolean; data: Proceso[] }>(`${this.apiUrl}/procesos`);
  }

  crearProceso(data: Partial<Proceso>): Observable<{ success: boolean; data: Proceso }> {
    return this.http.post<{ success: boolean; data: Proceso }>(`${this.apiUrl}/procesos`, data);
  }

  actualizarProceso(id: number, data: Partial<Proceso>): Observable<{ success: boolean; data: Proceso }> {
    return this.http.put<{ success: boolean; data: Proceso }>(`${this.apiUrl}/procesos/${id}`, data);
  }

  eliminarProceso(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/procesos/${id}`);
  }

  // ==================== GRUPOS ====================

  listarGrupos(procesoId?: number): Observable<{ success: boolean; data: Grupo[] }> {
    const params = procesoId ? { proceso_id: procesoId.toString() } : {};
    return this.http.get<{ success: boolean; data: Grupo[] }>(`${this.apiUrl}/grupos`, { params });
  }

  crearGrupo(data: Partial<Grupo>): Observable<{ success: boolean; data: Grupo }> {
    return this.http.post<{ success: boolean; data: Grupo }>(`${this.apiUrl}/grupos`, data);
  }

  actualizarGrupo(id: number, data: Partial<Grupo>): Observable<{ success: boolean; data: Grupo }> {
    return this.http.put<{ success: boolean; data: Grupo }>(`${this.apiUrl}/grupos/${id}`, data);
  }

  eliminarGrupo(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/grupos/${id}`);
  }

  // ==================== CONCEPTOS ====================

  listarConceptos(grupoId?: number): Observable<{ success: boolean; data: Concepto[] }> {
    const params = grupoId ? { grupo_id: grupoId.toString() } : {};
    return this.http.get<{ success: boolean; data: Concepto[] }>(`${this.apiUrl}/conceptos`, { params });
  }

  crearConcepto(data: Partial<Concepto>): Observable<{ success: boolean; data: Concepto }> {
    return this.http.post<{ success: boolean; data: Concepto }>(`${this.apiUrl}/conceptos`, data);
  }

  actualizarConcepto(id: number, data: Partial<Concepto>): Observable<{ success: boolean; data: Concepto }> {
    return this.http.put<{ success: boolean; data: Concepto }>(`${this.apiUrl}/conceptos/${id}`, data);
  }

  eliminarConcepto(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/conceptos/${id}`);
  }

  importarConceptos(grupoId: number, archivo: File): Observable<{ success: boolean; message: string; total: number }> {
    const formData = new FormData();
    formData.append('grupo_id', grupoId.toString());
    formData.append('archivo', archivo);
    return this.http.post<{ success: boolean; message: string; total: number }>(
      `${this.apiUrl}/conceptos/importar`,
      formData
    );
  }
}