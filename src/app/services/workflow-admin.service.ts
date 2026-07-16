import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

const base_url = environment.URL_API_LARAVEL;

@Injectable({
  providedIn: 'root'
})
export class WorkflowAdminService {

  constructor(private http: HttpClient) { }

  // Estructura Completa Ágil
  fullStructure(): Observable<any> {
    return this.http.get(`${base_url}/admin/workflows/full-structure`);
  }

  // Módulos
  listModulos(): Observable<any> {
    return this.http.get(`${base_url}/admin/workflows/modulos`);
  }

  storeModulo(data: any): Observable<any> {
    return this.http.post(`${base_url}/admin/workflows/modulos`, data);
  }

  updateModulo(id: number, data: any): Observable<any> {
    return this.http.put(`${base_url}/admin/workflows/modulos/${id}`, data);
  }

  listPermissions(moduloId: number): Observable<any> {
    return this.http.get(`${base_url}/admin/workflows/modulos/${moduloId}/permisos`);
  }

  // Tipos
  listTipos(moduloId: number): Observable<any> {
    return this.http.get(`${base_url}/admin/workflows/modulos/${moduloId}/tipos`);
  }

  storeTipo(data: any): Observable<any> {
    return this.http.post(`${base_url}/admin/workflows/tipos`, data);
  }

  // Versiones
  listVersiones(tipoId: number): Observable<any> {
    return this.http.get(`${base_url}/admin/workflows/tipos/${tipoId}/versiones`);
  }

  storeVersion(data: any): Observable<any> {
    return this.http.post(`${base_url}/admin/workflows/versiones`, data);
  }

  publicarVersion(id: number): Observable<any> {
    return this.http.post(`${base_url}/admin/workflows/versiones/${id}/publicar`, {});
  }

  // Pasos
  storePasos(versionId: number, pasos: any[]): Observable<any> {
    return this.http.post(`${base_url}/admin/workflows/versiones/${versionId}/pasos`, { pasos });
  }

  getCamposModulo(codigo: string): Observable<any> {
    return this.http.get(`${base_url}/admin/workflows/modulos/${codigo}/campos`);
  }

  listInstancias(versionId: number): Observable<any[]> {
    return this.http.get<any[]>(`${base_url}/admin/workflows/versiones/${versionId}/instancias`);
  }
}
