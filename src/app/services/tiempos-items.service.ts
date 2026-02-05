import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface TiempoItem {
  tipo_prenda: string;
  id_talla: string;
  descripcion_talla: string;
  cantidad_modelos: number;
  existencia_total: number;
  tiempo_estandar: number | null;
  tiempo_optimo: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class TiemposItemsService {
  private apiLaravelUrl = environment.URL_API_LARAVEL;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getUsuarioActual(): number {
    return this.authService.user?.id || 0;
  }

  obtenerTiempos(params?: any): Observable<{ success: boolean; data: TiempoItem[] }> {
    return this.http.get<{ success: boolean; data: TiempoItem[] }>(
      `${this.apiLaravelUrl}/tiempos-items`,
      {
        params: {
          ...params,
          usuario_id: this.getUsuarioActual()
        }
      }
    );
  }

  actualizarTiempos(
    tipoPrenda: string,
    idTalla: string,
    tiempoEstandar: number,
    tiempoOptimo: number
  ): Observable<{ success: boolean; data: TiempoItem }> {
    return this.http.post<{ success: boolean; data: TiempoItem }>(
      `${this.apiLaravelUrl}/tiempos-items`,
      {
        tipo_prenda: tipoPrenda,
        id_talla: idTalla,
        tiempo_estandar: tiempoEstandar,
        tiempo_optimo: tiempoOptimo,
        usuario_id: this.getUsuarioActual()
      }
    );
  }
}