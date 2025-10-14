// src/app/services/process-metrics.service.ts
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ProcessMetric } from '../models/process-metric.model';

@Injectable({
  providedIn: 'root'
})
export class MetricsService {

  getProcessMetrics(): Observable<ProcessMetric[]> {
    const mockData: ProcessMetric[] = [
      {
        proceso: 'Producción',
        icono: 'fas fa-industry',
        color: '#1976d2',
        salida: 3200 // lo producido y enviado a terminación
      },
      {
        proceso: 'Terminación',
        icono: 'fas fa-cut',
        color: '#4caf50',
        entrada: 3200,
        salida: 2900,
        porcentajeAvance: Math.round((2900 / 3200) * 100)
      },
      {
        proceso: 'Empaque',
        icono: 'fas fa-box-open',
        color: '#ff9800',
        entrada: 2900,
        salida: 2750,
        porcentajeAvance: Math.round((2750 / 2900) * 100)
      }
    ];
    return of(mockData);
  }
}
