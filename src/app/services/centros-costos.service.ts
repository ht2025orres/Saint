import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CentroCosto {
  cuenta: string;
  codigo_auxiliar?: string;
  desc_auxiliar: string;
  desc_ccosto: string;
  presupuesto: number;
  real: number;
  diferencia: number;
  porcentaje: number;
  responsable: string;
  semaforo: 'verde' | 'amarillo' | 'rojo';
}

@Injectable({
  providedIn: 'root'
})
export class CentrosCostosService {
  private apiUrl = `${environment.URL_API_LARAVEL}/centros-costos`;

  constructor(private http: HttpClient) {}

  obtenerCentrosCostos(ano: number, mes: number, area?: string, centroCosto?: string): Observable<{ success: boolean; data: CentroCosto[] }> {
    let params: any = { ano: ano.toString(), mes: mes.toString() };
    if (area) params.area = area;
    if (centroCosto) params.centro_costo = centroCosto;

    return this.http.get<{ success: boolean; data: CentroCosto[] }>(this.apiUrl, { params });
  }

  // Compatibilidad hacia atrás
  obtenerJerarquia(ano: number, mes: number): Observable<{ success: boolean; data: CentroCosto[] }> {
    return this.obtenerCentrosCostos(ano, mes);
  }
}