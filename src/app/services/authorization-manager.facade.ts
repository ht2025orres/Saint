import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthorizationManagerFacade {
  private baseUrl = environment.URL_API_LARAVEL;
  private initUrl = `${this.baseUrl}/init-data`;

  constructor(private http: HttpClient) {}

  /**
   * Carga TODOS los datos del Authorization Manager en una sola
   * petición HTTP, evitando las 4 llamadas paralelas (forkJoin).
   * Retorna: { users, profiles, modules, permissions, procesos }
   */
  loadInitialData(): Observable<any> {
    return this.http.get<any>(this.initUrl, {
      headers: { 'X-Requires-User-Email': 'true' }
    });
  }

  /** Sincronizar los procesos asignados a un usuario */
  syncUserProcesos(userId: number, procesoIds: number[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/user/${userId}/sync-procesos`, {
      proceso_ids: procesoIds
    });
  }

  /** Ejecutar la sincronización manual de colaboradores con Siesa Nómina Web */
  syncSiesa(dryRun: boolean = false): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/colaboradores/sync-siesa`, { dry_run: dryRun });
  }

  /** Ejecutar la asignación masiva de procesos, perfiles, permisos o plataformas por cargo */
  bulkAssignByCargo(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/bulk-assign-by-cargo`, payload);
  }
}