import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { User } from '../models/User';
import { environment } from '../../environments/environment';
import { InconsistenciaService } from './inconsistencia.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiLaravelUrl = environment.URL_API_LARAVEL;
  private urlEndPoint = `${environment.URL_LOGIN}/oauth/token`;
  // tslint:disable-next-line:variable-name
  private _user: User;
  // tslint:disable-next-line:variable-name
  private _token: string;
  // tslint:disable-next-line:variable-name
  private _refreshToken: string;

  constructor(
    private http: HttpClient,
    private inconsistenciasService: InconsistenciaService,
    private router: Router
  ) {}


  public get user(): User {
    if (this._user != null) {
      return this._user;
    } else if (this._user == null) {
      const stored = sessionStorage.getItem('user');
      if (stored != null) {
        this._user = JSON.parse(stored) as User;
        return this._user;
      }
    }
    return new User();
  }

  public get token(): string {
    if (this._token != null) {
      return this._token;
    } else if (this._token == null) {
      const stored = sessionStorage.getItem('token');
      if (stored != null) {
        this._token = stored;
        return this._token;
      }
    }
    return null;
  }

  public get refreshTokenValue(): string {
    if (this._refreshToken != null) {
      return this._refreshToken;
    } else if (this._refreshToken == null) {
      const stored = sessionStorage.getItem('refresh_token');
      if (stored != null) {
        this._refreshToken = stored;
        return this._refreshToken;
      }
    }
    return null;
  }

  checkUserEnabled(email: string): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/auth/check-enabled`, { email });
  }

  login(user: User): Observable<any> {
    const credenciales = btoa('angularapp' + ':' + 'CF1p1092$#');

    const httpHeaders = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + credenciales
    });

    const params = new URLSearchParams();
    params.set('grant_type', 'password');
    params.set('username', user.email);
    params.set('password', user.password);

    return this.http.post<any>(this.urlEndPoint, params.toString(), {
      headers: httpHeaders
    });
  }

  saveUser(accessToken: string): void {
    const payload = this.getTokenData(accessToken);
    this._user = new User();
    this._user.firstName = this.getNormalizePayload(payload.first_name);
    this._user.lastName = this.getNormalizePayload(payload.last_name);
    this._user.email = payload.email;
    this._user.roles = payload.authorities;  /* Nombre athoriries que genera sprint security oauth2*/
    this._user.id = payload.id;
    sessionStorage.setItem('user', JSON.stringify(this._user));
    this.inconsistenciasService.info(payload.email).subscribe({
      next: (res) => {
        this._user.nombre_departamento_Sdp = res.info['nombre_departamento'];
        this._user.id_departamento_Sdp = res.info['id_departamento'];
        this._user.id_Sdp = res.info['id_usuario'];
        this._user.id_lider = res.info['lider_id'];
        this._user.lider_nombre = res.info['lider_nombres'] + ' ' + res.info['lider_apellidos'];
        sessionStorage.setItem('user', JSON.stringify(this._user));
      },
      error: (_) => {}
    });
  }

  saveToken(accessToken: string, refreshToken?: string): void {
    this._token = accessToken;
    sessionStorage.setItem('token', accessToken);
    if (refreshToken) {
      this._refreshToken = refreshToken;
      sessionStorage.setItem('refresh_token', refreshToken);
    }
  }

  refreshToken(): Observable<any> {
    const credenciales = btoa('angularapp' + ':' + 'CF1p1092$#');
    const httpHeaders = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + credenciales
    });

    const params = new URLSearchParams();
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', this.refreshTokenValue);

    return this.http.post<any>(this.urlEndPoint, params.toString(), {
      headers: httpHeaders
    }).pipe(
      tap(response => {
        this.saveToken(response.access_token, response.refresh_token);
      })
    );
  }

  getTokenData(accessToken: string): any {
    if (!accessToken) return null;

    const payload = accessToken.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');

    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));

    const decoded = new TextDecoder().decode(bytes);

    return JSON.parse(decoded);
  }

  isAuthenticated(): boolean { /*Metodo que evalua si un pages ya esta autenticado en el sitema */
    const payload = this.getTokenData(this.token);
    return payload != null && payload.email && payload.email.length > 0;
  }

  /** Intenta reparar mojibake típico de UTF-8 mal interpretado */
  private fixMojibake(input: string): string {
    if (!input) return input;

    // 1) Intenta reinterpretar Latin1 -> UTF8
    try {
      const fixed = decodeURIComponent(escape(input));
      if (fixed && fixed !== input) return fixed;
    } catch (_) {}

    // 2) Reemplazos manuales de los casos más comunes
    const replacements: [RegExp, string][] = [
      [/Ã¡/g, 'á'], [/Ã©/g, 'é'], [/Ã­/g, 'í'], [/Ã³/g, 'ó'], [/Ãº/g, 'ú'],
      [/Ã±/g, 'ñ'], [/Ã/g, 'Á'], [/Ã‰/g, 'É'], [/Ã/g, 'Í'], [/Ã“/g, 'Ó'],
      [/Ãš/g, 'Ú'], [/Ã‘/g, 'Ñ'], [/Ã¼/g, 'ü'], [/Ã /g, 'à'], [/Â´/g, '´'],
      [/Â°/g, '°'], [/Â/g, ''], [/\u00A0/g, ' '], [/\uFFFD/g, '']
    ];
    let out = input;
    for (const [re, val] of replacements) {
      out = out.replace(re, val);
    }
    out = out.replace(/³/g, 'ó').replace(/²/g, 'é').replace(/¹/g, 'í');
    return out;
  }

  /** Normaliza texto: corrige mojibake, quita tildes y unifica */
  private normalize(text: string): string {
    if (!text) return '';
    const fixed = this.fixMojibake(text);
    return fixed
      .normalize('NFD')                 // descompone letras + diacríticos
      .replace(/[\u0300-\u036f]/g, '')  // quita diacríticos
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Devuelve un Set con roles ya normalizados */
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

  hasOnlyRole(role: string): boolean {
    const normalizedRole = this.normalize(String(role));
    const roles = Array.from(this.getNormalizedUserRoles());
    return roles.length === 1 && roles[0] === normalizedRole;
  }

  logout(): void {
    this._token = null;
    this._refreshToken = null;
    this._user = null;
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  public get isImpersonating(): boolean {
    return sessionStorage.getItem('admin_token') !== null;
  }

  impersonate(username: string): Observable<any> {
    const httpHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + this.token
    });

    const body = { username: username };
    const urlImpersonate = `${this.apiLaravelUrl}/auth/impersonate`;

    return this.http.post<any>(urlImpersonate, body, {
      headers: httpHeaders
    }).pipe(
      tap(response => {
        // Guardamos la sesión del admin antes de cambiar
        sessionStorage.setItem('admin_token', this.token);
        sessionStorage.setItem('admin_refresh_token', this.refreshTokenValue);
        sessionStorage.setItem('admin_user', JSON.stringify(this.user));

        // Cargamos la sesión del usuario personificado
        this.saveToken(response.access_token, response.refresh_token);
        this.saveUser(response.access_token);
      })
    );
  }

  stopImpersonating(): void {
    const adminToken = sessionStorage.getItem('admin_token');
    const adminRefreshToken = sessionStorage.getItem('admin_refresh_token');
    const adminUser = sessionStorage.getItem('admin_user');

    if (adminToken && adminUser) {
      this.saveToken(adminToken, adminRefreshToken);
      this._user = JSON.parse(adminUser);
      sessionStorage.setItem('user', adminUser);
      
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_refresh_token');
      sessionStorage.removeItem('admin_user');

      // Redirect to the user list page after stopping impersonation
      this.router.navigate(['/users/page/0']);
    }
  }

  getNormalizePayload(payload: string): string {
    return payload.replace("Ã±","ñ")
  }

}
