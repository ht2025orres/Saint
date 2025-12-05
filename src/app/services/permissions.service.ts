import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private base = `${environment.URL_API_LARAVEL_LOCAL}/permisos`;

  constructor(private http: HttpClient) { }

  // CRUD
  list(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/permissions`, { headers: { 'X-Requires-User-Email': 'true' } });
  }

  create(payload: { module_id: number; name: string; description?: string }) {
    return this.http.post(`${this.base}/permissions`, payload, { headers: { 'X-Requires-User-Email': 'true' } });
  }

  update(id: number, payload: { module_id: number; name: string; description?: string }) {
    return this.http.put(`${this.base}/permissions/${id}`, payload, { headers: { 'X-Requires-User-Email': 'true' } });
  }

  delete(id: number) {
    return this.http.delete(`${this.base}/permissions/${id}`, { headers: { 'X-Requires-User-Email': 'true' } });
  }

  // Asignaciones
  assignToUser(user_id: number, permission_id: number, allow: 'ALLOW' | 'DENY') {
    return this.http.post(`${this.base}/assign/permission-to-user`, { user_id, permission_id, allow }, { headers: { 'X-Requires-User-Email': 'true' } });
  }

  removeFromUser(user_id: number, permission_id: number) {
    return this.http.post(`${this.base}/remove/permission-from-user`, { user_id, permission_id }, { headers: { 'X-Requires-User-Email': 'true' } });
  }

  assignToPerfil(perfil_id: number, permission_id: number, allow: 'ALLOW' | 'DENY') {
    return this.http.post(`${this.base}/assign/permission-to-perfil`, { perfil_id, permission_id, allow }, { headers: { 'X-Requires-User-Email': 'true' } });
  }

  removeFromPerfil(perfil_id: number, permission_id: number) {
    return this.http.post(`${this.base}/remove/permission-from-perfil`, { perfil_id, permission_id }, { headers: { 'X-Requires-User-Email': 'true' } });
  }

  // Obtener permisos efectivos / debug (si está en otro controlador)
  getEffectivePermissions(userId: number) {
    return this.http.get<any>(`${this.base}/user/${userId}/effective-permissions`, { headers: { 'X-Requires-User-Email': 'true' } });
  }
}
