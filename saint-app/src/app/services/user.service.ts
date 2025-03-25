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

  constructor(private http: HttpClient) { }


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


  getAll(): Observable<User[]> {
    return this.http.get<User[]>(`${this.urlEndPoint}`);
  }

  disableUser(user: User) {
    return this.http.put('', user);
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
}
