import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EmailLogService {

  private apiLaravelUrl = environment.URL_API_LARAVEL;

  constructor(private http: HttpClient) { }

  getAll(filters: any): Observable<any> {
    let params = new HttpParams();
    
    if (filters.to_email) {
      params = params.set('to_email', filters.to_email);
    }
    if (filters.subject) {
      params = params.set('subject', filters.subject);
    }
    if (filters.status) {
      params = params.set('status', filters.status);
    }
    if (filters.fecha_desde) {
      params = params.set('fecha_desde', filters.fecha_desde);
    }
    if (filters.fecha_hasta) {
      params = params.set('fecha_hasta', filters.fecha_hasta);
    }
    if (filters.page) {
      params = params.set('page', filters.page.toString());
    }
    if (filters.limit) {
      params = params.set('limit', filters.limit.toString());
    }
    if (filters.all !== undefined) {
      params = params.set('all', filters.all.toString());
    }

    return this.http.get(`${this.apiLaravelUrl}/email-logs`, { params });
  }

  getById(id: number): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/email-logs/${id}`);
  }

  resend(id: number): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/email-logs/${id}/resend`, {});
  }

  getStats(): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/email-logs/stats`);
  }
}
