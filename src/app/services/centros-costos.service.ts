import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface CentroCosto {
  cuenta: string;
  desc_auxiliar: string;
  desc_ccosto: string;
  presupuesto: string;
  real: string;
  diferencia: string;
  porcentaje: number;
  responsable: string;
  semaforo: 'verde' | 'amarillo' | 'rojo';
}

export interface FiltrosCentroCosto {
  ano?: number;
  mes?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CentrosCostosService {
  private apiLaravelUrl = environment.URL_API_LARAVEL;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getUsuarioActual(): number {
    return this.authService.user?.id || 0;
  }

  obtenerCentrosCostos(filtros?: FiltrosCentroCosto): Observable<{ success: boolean; data: CentroCosto[] }> {
    return this.http.get<{ success: boolean; data: CentroCosto[] }>(
      `${this.apiLaravelUrl}/centros-costos`,
      {
        params: {
          ...filtros,
          usuario_id: this.getUsuarioActual()
        } as any
      }
    );
  }
}
