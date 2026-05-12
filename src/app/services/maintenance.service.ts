import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {

  private apiLaravelUrl = environment.URL_API_LARAVEL;

  constructor(private http: HttpClient) { }

  private getUrl(endpoint: string): string {
    return `${this.apiLaravelUrl}${endpoint}`.replace('/api/api/', '/api/');
  }

  getStatus(): Observable<any> {
    return this.http.get<any>(this.getUrl('/auth/maintenance-status'));
  }

  getHistory(): Observable<any[]> {
    return this.http.get<any[]>(this.getUrl('/maintenance/history'));
  }

  startMaintenance(reason: string, estimatedDurationMinutes: number): Observable<any> {
    return this.http.post<any>(this.getUrl('/maintenance/start'), {
      reason: reason,
      estimated_duration_minutes: estimatedDurationMinutes
    });
  }

  stopMaintenance(): Observable<any> {
    return this.http.post<any>(this.getUrl('/maintenance/stop'), {});
  }
}
