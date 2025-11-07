import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Role } from '../models/Role';
import { Permiso } from '../models/Permiso';
import { UserPermiso } from '../models/UserPermiso';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SecurityControlService {
  private apiUrl = `${environment.URL_API_LARAVEL}/security`;

  constructor(private http: HttpClient) {}

  // ===== ROLES =====
  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/roles`);
  }

  createRol(data: Role): Observable<any> {
    return this.http.post(`${this.apiUrl}/roles`, data);
  }

  updateRol(id: number, data: Role): Observable<any> {
    return this.http.put(`${this.apiUrl}/roles/${id}`, data);
  }

  deleteRol(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/roles/${id}`);
  }

  // ===== PERMISOS =====
  getPermisos(): Observable<Permiso[]> {
    return this.http.get<Permiso[]>(`${this.apiUrl}/permisos`);
  }

  assignPermisoToRol(rolId: number, permisoId: number, tipo: 'allow' | 'deny'): Observable<any> {
    return this.http.post(`${this.apiUrl}/roles/${rolId}/permisos`, { permisoId, tipo });
  }

  // ===== PERMISOS POR USUARIO =====
  getUserPermisos(userId: number): Observable<UserPermiso[]> {
    return this.http.get<UserPermiso[]>(`${this.apiUrl}/usuarios/${userId}/permisos`);
  }

  assignUserPermiso(data: UserPermiso): Observable<any> {
    return this.http.post(`${this.apiUrl}/usuarios/${data.user_id}/permisos`, data);
  }
}
