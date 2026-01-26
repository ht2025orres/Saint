import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface OrdenCompra {
  id: number;
  numero_orden: string;
  pv_asociado?: string;
  cliente: string;
  fecha_registro: string;
  usuario_registro: string;
  estado: 'PENDIENTE' | 'PROCESADA' | 'RECHAZADA';
  archivo_url: string;
  observaciones?: string;
}

export interface Cliente {
  id: number;
  razon_social: string;
  nombre?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrdenCompraService {
  private apiLaravelUrl = environment.URL_API_LARAVEL;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getUsuarioActual(): number {
    return this.authService.user?.id || 0;
  }

  obtenerOrdenes(params?: any): Observable<{ success: boolean; data: OrdenCompra[] }> {
    return this.http.get<{ success: boolean; data: OrdenCompra[] }>(
      `${this.apiLaravelUrl}/ordenes-compra`,
      {
        params: {
          ...params,
          usuario_id: this.getUsuarioActual()
        }
      }
    );
  }

  obtenerClientes(): Observable<{ success: boolean; data: Cliente[] }> {
    return this.http.get<{ success: boolean; data: Cliente[] }>(
      `${this.apiLaravelUrl}/clientes`,
      {
        params: { usuario_id: this.getUsuarioActual() }
      }
    );
  }

  registrarOrden(formData: FormData): Observable<{ success: boolean; data: OrdenCompra }> {
    formData.append('usuario_id', this.getUsuarioActual().toString());

    return this.http.post<{ success: boolean; data: OrdenCompra }>(
      `${this.apiLaravelUrl}/ordenes-compra`,
      formData
    );
  }

  procesarOrden(id: number): Observable<{
    success: boolean;
    message: string;
    data: { orden: OrdenCompra; pv_encontrado: string }
  }> {
    return this.http.put<any>(
      `${this.apiLaravelUrl}/ordenes-compra/${id}/procesar`,
      {
        usuario_id: this.getUsuarioActual()
      }
    );
  }

  rechazarOrden(
    id: number,
    motivo: string
  ): Observable<{ success: boolean; message: string; data: OrdenCompra }> {
    return this.http.put<any>(
      `${this.apiLaravelUrl}/ordenes-compra/${id}/rechazar`,
      {
        motivo,
        usuario_id: this.getUsuarioActual()
      }
    );
  }

  obtenerDetalleOrden(id: number): Observable<{ success: boolean; data: OrdenCompra }> {
    return this.http.get<{ success: boolean; data: OrdenCompra }>(
      `${this.apiLaravelUrl}/ordenes-compra/${id}`,
      {
        params: { usuario_id: this.getUsuarioActual() }
      }
    );
  }

  eliminarOrden(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiLaravelUrl}/ordenes-compra/${id}`,
      {
        body: { usuario_id: this.getUsuarioActual() }
      }
    );
  }
}