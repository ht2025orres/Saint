import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Report } from './../models/report';
import { environment } from '../../environments/environment';
import { HttpParams } from '@angular/common/http';

// --- NUEVAS INTERFACES ---
export interface ResumenDiario {
  fecha: string;
  total_reportes: number;
  promedio_minutos: number;
  cumplimiento_dia: string;
}

export interface DashboardResumen {
  total: number;
  con_respuesta: number;
  cumplen: number;
  porcentaje_cumplimiento: number;
  resumen_diario: ResumenDiario[];
}

export interface DashboardData {
  reportes: any[];
  resumen: DashboardResumen;
}

// La respuesta ya no tiene "success" ni "data"
export interface DashboardResponse {
  reportes: any[];
  resumen: DashboardResumen;
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private apiUrl = `${environment.URL_API_LARAVEL}/report`;

  constructor(private http: HttpClient) {}

  // Crear un nuevo reporte de fichas tecnicas
  createReport(data: Report): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, data, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  // Cargue de evidencia si hay archivo en el buket de S3
  uploadEvidence(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file); // importante: debe llamarse 'file'

    return this.http.post(`${this.apiUrl}/upload-evidence`, formData);
  }

  // Obtener reportes por usuario
  getReportsByUser(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/list/${userId}`);
  }

  // listar todos los reportes 
  getReports(): Observable<any> {
    return this.http.get(`${this.apiUrl}/list`);
  }
  
  // Actualizar estado a "En Proceso"
 updateStatusToInProcess(reportId: number, userId: number): Observable<any> {
     return this.http.post(`${this.apiUrl}/update-status`, {
    report_id: reportId,
    user_id: userId
  });
  }

// ✅ Obtener URL firmada de evidencia subida al generar un reporte
getEvidenceByReport(id: number): Observable<string> {
  return this.http
    .get<{ url: string }>(`${this.apiUrl}/get-evidence/${id}`)
    .pipe(map(response => response.url));
}

// Obtener URL firmada de evidencia de respuesta subida al liberar un reporte
GetEvidenceLiberationByReport(id: number): Observable<string> {
  return this.http
    .get<{ url: string }>(`${this.apiUrl}/get-evidence-liberado/${id}`)
    .pipe(map(response => response.url));
}

// Actualizar estado a "Liberado"
liberarReporte(data: any): Observable<any> {
  return this.http.post(`${this.apiUrl}/liberar_reporte`, data);
}

// Cargar evidencia al liberar reporte
saveLiberationEvidence(formData: FormData): Observable<any> {
  return this.http.post(`${this.apiUrl}/save-liberation-evidence`, formData);
}

// Dasboard - de Reportes
getDashboardData(year: number, month: number): Observable<any> {
  return this.http
    .get<{ success: boolean; data: any }>(
      `${this.apiUrl}/report_dashboard/${year}/${month}`
    )
    .pipe(map((res) => res.data));
}
}
