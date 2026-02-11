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

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiLaravelUrl}/users`);
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
}