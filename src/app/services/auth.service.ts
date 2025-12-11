import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';
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

  constructor(
    private http: HttpClient,
    private inconsistenciasService: InconsistenciaService,
  ) {}


  public get user(): User {
    if (this._user != null) {
      return this._user;
    } else if (this._user == null && sessionStorage.getItem('user') != null) {
      this._user = JSON.parse(sessionStorage.getItem('user')) as User;
      return this._user;
    }
    return new User();
  }

  public get token(): string {
    if (this._token != null) {
      return this._token;
    } else if (this._token == null && sessionStorage.getItem('token') != null) {
      this._token = sessionStorage.getItem('token');
      return this._token;
    }
    return null;
  }

  checkUserEnabled(email: string): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/auth/check-enabled`, { email });
  }

  login(user: User): Observable<any> {

    // 1️⃣ Primero verificamos si el usuario está habilitado en Laravel
    return this.checkUserEnabled(user.email).pipe(
      switchMap((resp: any) => {

        if (!resp.enabled) {
          return throwError(() => ({
            error: {
              message: 'Usuario deshabilitado'
            }
          }));
        }

        // 2️⃣ Si está habilitado, procedemos con el login normal
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
      })
    );
  }

  saveUser(accessToken: string): void {
    const payload = this.getTokenData(accessToken);
    this._user = new User();
    this._user.firstName = this.getNormalizePayload(payload.first_name);
    this._user.lastName = this.getNormalizePayload(payload.last_name);
    this._user.email = payload.email;
    this._user.roles = payload.authorities;  /* Nombre athoriries que genera sprint security oauth2*/
    this._user.id = payload.id;
    console.log(payload);
    this.inconsistenciasService.info(payload.email).subscribe({
      next: (res) => {
        this._user.nombre_departamento_Sdp = res.info['nombre_departamento'];
        this._user.id_departamento_Sdp = res.info['id_departamento'];
        this._user.id_Sdp = res.info['id_usuario'];
        this._user.id_lider = res.info['lider_id'];
        this._user.lider_nombre = res.info['lider_nombres'] + ' ' + res.info['lider_apellidos'];
        sessionStorage.setItem('user', JSON.stringify(this._user)); /* Se convierte el objeto pages a string con JSON.stringify */
      },
      error: (err) => {
        console.error('Error obteniendo el proceso', err);
      }
    });
  }

  saveToken(accessToken: string): void {
    this._token = accessToken;
    sessionStorage.setItem('token', accessToken);
  }

  getTokenData(accessToken: string): any {
    if (accessToken != null) {
      return JSON.parse(atob(accessToken.split('.')[1]));
    }
    return null;
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
    this._user = null;
    sessionStorage.clear();
  }

  getNormalizePayload(payload: string): string {
    return payload.replace("Ã±","ñ")
  }

}
