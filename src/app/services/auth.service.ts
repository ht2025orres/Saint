import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { User } from '../models/User';
import { environment } from '../../environments/environment';
import { InconsistenciaService } from './inconsistencia.service';

@Injectable({
providedIn: 'root'
})
export class AuthService {
private urlEndPoint = `${environment.URL_API_LARAVEL}/login`;
private _user: User | null = null;
private _token: string | null = null;
private _refreshToken: string | null = null;

constructor(
private http: HttpClient,
private inconsistenciasService: InconsistenciaService
) {}

/** ===========================

* ```
      GETTERS
  ```
* =========================== */
  public get user(): User {
  if (this._user) return this._user;
  const stored = sessionStorage.getItem('user');
  this._user = stored ? JSON.parse(stored) as User : new User();
  return this._user;
  }

public get token(): string | null {
if (this._token) return this._token;
this._token = sessionStorage.getItem('token');
return this._token;
}

public get refreshToken(): string | null {
if (this._refreshToken) return this._refreshToken;
this._refreshToken = sessionStorage.getItem('refresh_token');
return this._refreshToken;
}

/** ===========================

* ```
      LOGIN
  ```
* =========================== */
  login(user: User): Observable<any> {
  const credenciales = btoa('angularapp' + ':' + 'CF1p1092$#');
  const headers = new HttpHeaders({
  'Content-Type': 'application/x-www-form-urlencoded',
  'Authorization': 'Basic ' + credenciales
  });


const params = new URLSearchParams();



params.set('email', user.email);
params.set('password', user.password);

return this.http.post<any>(this.urlEndPoint, params.toString(), { headers }).pipe(
  tap(response => {
    if (response.token) {
      this.saveToken(response.token);
      if (response.refresh_token) this.saveRefreshToken(response.refresh_token);
      this.saveUser(response);
    }
  }),
  catchError(err => {
    console.error('Error en login:', err);
    return throwError(() => err);
  })
);


}

/** ===========================

* ```
    REFRESH TOKEN
  ```
* =========================== */
  refreshAccessToken(): Observable<string> {
  const refreshToken = this.refreshToken;
  if (!refreshToken) return throwError(() => new Error('No refresh token available'));


const credenciales = btoa('angularapp' + ':' + 'CF1p1092$#');

const headers = new HttpHeaders({
  'Content-Type': 'application/x-www-form-urlencoded',
  'Authorization': 'Basic ' + credenciales
});

const params = new URLSearchParams();
params.set('grant_type', 'refresh_token');
params.set('refresh_token', refreshToken);

return this.http.post<any>(this.urlEndPoint, params.toString(), { headers }).pipe(
  tap(response => {
    this.saveToken(response.access_token);
    if (response.refresh_token) this.saveRefreshToken(response.refresh_token);
    this.saveUser(response);
  }),
  map(response => response.access_token),
  catchError(err => {
    console.error('Error al refrescar token:', err);
    this.logout();
    return throwError(() => err);
  })
);


}

/** ===========================

* ```
    GUARDADO EN SESIÓN
  ```
* =========================== */
  saveUser(response: any): void {
  const userData = response.user;
  if (!userData) return;


this._user = new User();


this._user.id = userData.id;
this._user.firstName = userData.name?.split(' ')[0] || '';
this._user.lastName = userData.name?.split(' ').slice(1).join(' ') || '';
this._user.email = userData.email;
this._user.roles = Array.isArray(userData.roles)
  ? userData.roles.map((r: any) => r.name)
  : [];

sessionStorage.setItem('user', JSON.stringify(this._user));


}

saveToken(token: string): void {
this._token = token;
sessionStorage.setItem('token', token);
}

saveRefreshToken(refreshToken: string): void {
this._refreshToken = refreshToken;
sessionStorage.setItem('refresh_token', refreshToken);
}

/** ===========================

* ```
    UTILIDADES JWT
  ```
* =========================== */
  getTokenData(accessToken: string): any {
  if (!accessToken) return null;
  try {
  return JSON.parse(atob(accessToken.split('.')[1]));
  } catch {
  return null;
  }
  }

isAuthenticated(): boolean {
return !!this.token && !!this.user?.email;
}

/** ===========================

* NORMALIZACIÓN DE ROLES
* =========================== */
  private normalize(text: string): string {
  return text
  ? text.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  : '';
  }

private getNormalizedUserRoles(): Set<string> {
const rolesArr = Array.isArray(this.user?.roles) ? this.user.roles : [];
return new Set(rolesArr.map(r => this.normalize(String(r))));
}

hasRole(role: string): boolean {
const normalizedRole = this.normalize(String(role));
return this.getNormalizedUserRoles().has(normalizedRole);
}

hasAnyRole(roles: string[]): boolean {
if (!Array.isArray(roles) || roles.length === 0) return false;
const normalizedUserRoles = this.getNormalizedUserRoles();
return roles.some(r => normalizedUserRoles.has(this.normalize(String(r))));
}

/** ===========================

* ```
    CIERRE DE SESIÓN
  ```
* =========================== */
  logout(): void {
  this._token = null;
  this._user = null;
  this._refreshToken = null;
  sessionStorage.clear();
  }
  }
