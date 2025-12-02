import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class ModulesService {
  private base = `${environment.URL_API_LARAVEL_LOCAL}`;

  constructor(private http: HttpClient) { }

  // CRUD
  list(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/modules`, {headers: { 'X-Requires-User-Email': 'true' }});
  }

  create(payload: { name: string; description?: string }) {
    return this.http.post(`${this.base}/modules`, payload, {headers: { 'X-Requires-User-Email': 'true' }});
  }

  update(id: number, payload: { name: string; description?: string }) {
    return this.http.put(`${this.base}/modules/${id}`, payload, {headers: { 'X-Requires-User-Email': 'true' }});
  }

  delete(id: number) {
    return this.http.delete(`${this.base}/modules/${id}`, {headers: { 'X-Requires-User-Email': 'true' }});
  }

  // obtener módulos con permisos (si existe)
  getWithPermissions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/modules`, {headers: { 'X-Requires-User-Email': 'true' }});
  }
}
