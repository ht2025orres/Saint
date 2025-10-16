// services/bigbag.service.ts - VERSIÓN LIMPIA
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';
import { Operario } from '../models/Operario';

@Injectable({
  providedIn: 'root'
})
export class BigbagService {
  
  // private readonly baseApiUrl = "http://127.0.0.1:8000/api";
  private readonly baseApiUrl =  environment.URL_API_LARAVEL
  private readonly renuevaUrl = `${this.baseApiUrl}/renueva`;
  private readonly dashboardUrl = `${this.baseApiUrl}/dashboard-data`;
  private readonly activitiesUrl = `${this.baseApiUrl}/activities`;
  private readonly precintosAsignadosUrl = `${this.baseApiUrl}/precintos-asignados`;

  constructor(private http: HttpClient) {}

  // ===== MÉTODOS BIGBAG =====
  guardarRecepcion(formData: FormData): Observable<any> {
    return this.http.post<any>(
      `${this.renuevaUrl}/guardarRecepcion`,
      formData
    );
  }

  // ===== MÉTODOS DASHBOARD (SIMPLIFICADOS) =====
  getDatos(params?: HttpParams): Observable<any> {
    return this.http.get<any>(`${this.dashboardUrl}/datos`, { params });
  }

  crearDato(data: any): Observable<any> {
    return this.http.post(`${this.dashboardUrl}/datos`, data);
  }

  // ===== MÉTODOS PRECINTOS =====
  guardarPrecinto(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseApiUrl}/precintos`, data);
  }

  getPrecintosPorReporte(idReporte: number): Observable<any> {
    return this.http.get<any>(`${this.baseApiUrl}/precintos/${idReporte}`);
  }

  obtenerUsuarioOperario(): Observable<Operario[]> {
    return this.http.get<Operario[]>(`${this.baseApiUrl}/usuarios-operarios`);
  }

  obtenerColorConsecutivo(): Observable<any> {
    return this.http.get<any>(`${this.baseApiUrl}/color-consecutivo`);
  }

  actualizarConsecutivo(color: string, nuevoNumero: number): Observable<any> {
    return this.http.post<any>(
      `${this.baseApiUrl}/guardar-consecutivo/${color}/${nuevoNumero}`,
      {} 
    );
  }

  // ===== MÉTODOS PRECINTOS ASIGNADOS =====
  enviarUsuarioId(userId: number): Observable<any> {
    return this.http.post<any>(this.precintosAsignadosUrl, { user_id: userId });
  }

  enviarNovedadYFirma(data: any): Observable<any> {
    return this.http.post<any>(`${this.precintosAsignadosUrl}/novedad-firma`, data);
  }

  obtenerFirmaTemporalAsignados(precintoId: number): Observable<any> {
    return this.http.get<any>(`${this.precintosAsignadosUrl}/firma/${precintoId}`);
  }

  obtenerFirmaTemporal(precintoId: number): Observable<any> {
    return this.http.get<any>(`${this.baseApiUrl}/precintos-asignados/firma/${precintoId}`);
  }

  // ===== MÉTODOS ACTIVIDADES DE USUARIO =====
  getActividades(): Observable<any> {
    return this.http.get<any>(this.activitiesUrl);
  }

  getVersionActual(numRecepcion: string | number): Observable<any> {
    const params = new HttpParams()
      .set('action', 'version_actual')
      .set('num_recepcion', String(numRecepcion));

    return this.http.get<any>(this.activitiesUrl, { params });
  }

  getVersiones(numRecepcion: string | number): Observable<any> {
    const params = new HttpParams()
      .set('action', 'versiones')
      .set('num_recepcion', String(numRecepcion));

    return this.http.get<any>(this.activitiesUrl, { params });
  }

  // ===== MÉTODOS DOCUMENTOS =====
  obtenerDocumentos(): Observable<any> {
    return this.http.get(`${this.renuevaUrl}/recepcion`);
  }

  // ESTADO LOCAL (para recepciones)
  actualizarRecepcion(data: any): Observable<any> {
  return this.http.put(`${this.renuevaUrl}/recepcion`, data);
}
 

   obtenerFirmaDigital(recepcionId: number, tipoFirma: 'operario' | 'conductor'): Observable<any> {
    return this.http.get(`${this.renuevaUrl}/obtener-firma/${recepcionId}/${tipoFirma}`);
  }
}