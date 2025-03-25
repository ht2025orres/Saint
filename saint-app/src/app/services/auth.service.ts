import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { User } from '../models/User';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private urlEndPoint = `${environment.URL_LOGIN}/oauth/token`;
  // tslint:disable-next-line:variable-name
  private _user: User;
  // tslint:disable-next-line:variable-name
  private _token: string;

  constructor(private http: HttpClient) {
  }


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
    return this.http.post<any>(this.urlEndPoint, params.toString(), { headers: httpHeaders });
  }

  saveUser(accessToken: string): void {
    const payload = this.getTokenData(accessToken);
    this._user = new User();
    this._user.firstName = this.getNormalizePayload(payload.first_name);
    this._user.lastName = this.getNormalizePayload(payload.last_name);
    this._user.email = payload.email;
    this._user.roles = payload.authorities;  /* Nombre athoriries que genera sprint security oauth2*/
    this._user.id = payload.id;
    sessionStorage.setItem('user', JSON.stringify(this._user)); /* Se convierte el objeto pages a string con JSON.stringify */
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

  hasRole(role: any): boolean {
    return this.user.roles.includes(role);
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
