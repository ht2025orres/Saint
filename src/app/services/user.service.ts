import { Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { User } from '../models/User';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private urlEndPoint = `${environment.URL_LOGIN}/v1/users`;
  private apiLaravelUrl = environment.URL_API_LARAVEL_LOCAL;

  constructor(private http: HttpClient) { }

  getUserByRoles(roles: number[]): Observable<User[]> {
    return this.http.post<User[]>(`${this.apiLaravelUrl}/users/by-roles`, {
      roles: roles
    });
  }

  searchUser(word: string) {
    return this.http.get<User[]>(`${this.urlEndPoint}/search/${word}`)
  }

  listUserSheetBySize(size: number): Observable<User[]> {
    return this.http.get(`${this.urlEndPoint}/size/` + size)
      .pipe(
        tap((response: any) =>
          (response.content as User[]).forEach(ficha => console.log(ficha)))
      );
  }

  getAllPaginator(page: number): Observable<User[]> {
    return this.http.get(`${this.urlEndPoint}/page/` + page)
      .pipe(
        tap((response: any) =>
          (response.content as User[]).forEach(user => console.log(user)))
      );
  }

  getAlluser(): Observable<User[]> {
    return this.http.get<User[]>(`${this.urlEndPoint}`);
  }

  disableUser(user: User) {
    return this.http.put(`${this.apiLaravelUrl}/users/disable/${user.id}`, {});
  }

  enableUser(user: User) {
    return this.http.put(`${this.apiLaravelUrl}/users/enable/${user.id}`, {});
  }

  getById(id: any): Observable<User> {
    return this.http.get<User>(`${this.urlEndPoint}/${id}`);
  }

  saveUser(userCurrent: User): Observable<any> {
    if (userCurrent.id != null) {
      return this.http.put(`${this.urlEndPoint}`, userCurrent);
    }
    return this.http.post(`${this.urlEndPoint}`, userCurrent);
  }

  getUsersByIds(ids: number[]): Observable<User[]> {
    // Asumiendo que tu API soporta GET con query parameters
    return this.http.get<User[]>(`${this.urlEndPoint}/by-ids`, {
      params: { ids: ids.join(',') }
    });
  }

  // ======================================================================
  // ===== NUEVO CÓDIGO PARA GESTIÓN DE PERFILES / MÓDULOS / PERMISOS =====
  // ======================================================================

  // Listado de usuarios (list-users)
  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/list-users`, { headers: { 'X-Requires-User-Email': 'true' } });
  }

  // Asignar/Quitar perfil (usado por UI)
  assignPerfil(user_id: number, perfil_id: number) {
    return this.http.post(`${this.apiLaravelUrl}/asignacion/assign/perfil`, { user_id, perfil_id }, { headers: { 'X-Requires-User-Email': 'true' } });
  }
  removePerfil(user_id: number, perfil_id: number) {
    return this.http.post(`${this.apiLaravelUrl}/asignacion/remove/perfil`, { user_id, perfil_id }, { headers: { 'X-Requires-User-Email': 'true' } });
  }

  // Duplicar permisos/roles
  duplicatePermissions(source_user_id: number, target_user_id: number) {
    return this.http.post(`${this.apiLaravelUrl}/duplicate/access`, { source_user_id, target_user_id }, { headers: { 'X-Requires-User-Email': 'true' } });
  }

  // Obtener permisos efectivos (directos + heredados)
  getEffectivePermissions(userId: number) {
    return this.http.get<any>(`${this.apiLaravelUrl}/user/${userId}/effective-permissions`, { headers: { 'X-Requires-User-Email': 'true' } });
  }

  // Asignar permiso directo (usa PermissionsService normalmente)

  // ======================================================================
  // ===== FIN NUEVO CÓDIGO ===============================================
  // ======================================================================

}
