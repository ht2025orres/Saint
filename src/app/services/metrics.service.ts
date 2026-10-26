// src/app/services/metrics.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ProcessMetric } from '../models/process-metric.model';

export interface ProduccionFlujoData {
  producido: number;
  terminado: number;
  empacado: number;
  wip_terminacion: number;
  wip_empaque: number;
  total_wip: number;
  eficiencia_terminacion: number;
  eficiencia_empaque: number;
  eficiencia_global: number;
  ops_activas: number;
  periodo: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class MetricsService {
  private apiUrl = `${environment.URL_API_LARAVEL}/produccion/flujo-planta`;

  constructor(private http: HttpClient) {}

  getFlujoPlanta(periodo: string = 'mes_actual'): Observable<ProduccionFlujoData> {
    return this.http.get<{ success: boolean; data: ProduccionFlujoData }>(`${this.apiUrl}?periodo=${periodo}`).pipe(
      map(res => res.data),
      catchError(() => of({
        producido: 3200,
        terminado: 2900,
        empacado: 2750,
        wip_terminacion: 300,
        wip_empaque: 150,
        total_wip: 450,
        eficiencia_terminacion: 91,
        eficiencia_empaque: 95,
        eficiencia_global: 86,
        ops_activas: 12,
        periodo: 'mes_actual',
        timestamp: new Date().toISOString()
      }))
    );
  }

  getProcessMetrics(): Observable<ProcessMetric[]> {
    return this.getFlujoPlanta().pipe(
      map(data => [
        {
          proceso: 'Producción',
          icono: 'fas fa-industry',
          color: '#1976d2',
          salida: data.producido
        },
        {
          proceso: 'Terminación',
          icono: 'fas fa-cut',
          color: '#4caf50',
          entrada: data.producido,
          salida: data.terminado,
          porcentajeAvance: data.eficiencia_terminacion
        },
        {
          proceso: 'Empaque',
          icono: 'fas fa-box-open',
          color: '#ff9800',
          entrada: data.terminado,
          salida: data.empacado,
          porcentajeAvance: data.eficiencia_empaque
        }
      ])
    );
  }
}
