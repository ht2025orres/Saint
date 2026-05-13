import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/User';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private apiLaravelUrl = environment.URL_API_LARAVEL;

  constructor(private http: HttpClient) { }

  getUserByRoles(roles: number[]): Observable<User[]> {
    return this.http.post<User[]>(`${this.apiLaravelUrl}/users/by-roles`, {
      roles: roles
    });
  }

  getUsersByPermission(permissionId: number): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiLaravelUrl}/users/permission/${permissionId}`);
  }

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiLaravelUrl}/users`);
  }

  /** Lista básica de usuarios (id + nombre). Sin restricción de admin. */
  getAllBasic(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/users/basic`);
  }

  getById(id: any): Observable<User> {
    return this.http.get<User>(`${this.apiLaravelUrl}/users/${id}`);
  }

  saveUser(userCurrent: User): Observable<any> {
    if (userCurrent.id != null) {
      return this.http.put(`${this.apiLaravelUrl}/users/${userCurrent.id}`, userCurrent);
    }
    return this.http.post(`${this.apiLaravelUrl}/users`, userCurrent);
  }

  disableUser(user: User) {
    return this.http.put(`${this.apiLaravelUrl}/users/disable/${user.id}`, {});
  }

  enableUser(user: User) {
    return this.http.put(`${this.apiLaravelUrl}/users/enable/${user.id}`, {});
  }

  assignPerfil(userId: number, perfilId: number): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/users/${userId}/assign-perfil`, { perfil_id: perfilId });
  }

  duplicatePermissions(sourceId: number, targetId: number): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/users/duplicate-permissions`, { source_id: sourceId, target_id: targetId });
  }

  getAuditLogs(params: any): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/audit/permissions`, { params });
  }
}