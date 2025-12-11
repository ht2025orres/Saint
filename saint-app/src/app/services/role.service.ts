import { Role } from './../models/Role';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class RoleService {

  private urlEndPoint = `${environment.URL_LOGIN}/v1/roles`;

  constructor(private http: HttpClient) { }

  getAll(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.urlEndPoint}`);
  }
}
