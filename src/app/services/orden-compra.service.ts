import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface OrdenCompra {
  id: number;
  numero_orden: string;
  cliente: string;
  fecha_recepcion: string;
  total_productos: number;
  total_items: number;
  valor_total: number;
  estado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADA';
  archivo_url?: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  codigo?: string;
}

export interface ProductoDetectado {
  codigo: string;
  producto: string;
  cantidad: number;
}

export interface DocumentoProcesado {
  informacion_general: {
    cliente: string;
    fechaLlegada: string;
    numeroOrden: string;
    totalProductos: number;
    totalEstimado: number;
  };
  productos: ProductoDetectado[];
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

  /**
   * Obtiene la lista de órdenes de compra
   */
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

  /**
   * Obtiene el detalle de una orden específica
   */
  obtenerDetalleOrden(id: number): Observable<{ success: boolean; data: OrdenCompra }> {
    return this.http.get<{ success: boolean; data: OrdenCompra }>(
      `${this.apiLaravelUrl}/ordenes-compra/${id}`,
      { 
        params: { usuario_id: this.getUsuarioActual() } 
      }
    );
  }

  /**
   * Obtiene la lista de clientes disponibles
   */
  obtenerClientes(): Observable<{ success: boolean; data: Cliente[] }> {
    return this.http.get<{ success: boolean; data: Cliente[] }>(
      `${this.apiLaravelUrl}/clientes`,
      { 
        params: { usuario_id: this.getUsuarioActual() } 
      }
    );
  }

  /**
   * Procesa un documento (PDF/Imagen) y extrae la información
   */
  procesarDocumento(formData: FormData): Observable<{ success: boolean; data: DocumentoProcesado }> {
    formData.append('usuario_id', this.getUsuarioActual().toString());
    
    return this.http.post<{ success: boolean; data: DocumentoProcesado }>(
      `${this.apiLaravelUrl}/ordenes-compra/procesar-documento`,
      formData
    );
  }

  /**
   * Crea una nueva orden de compra con los datos procesados
   */
  crearOrden(payload: {
    cliente: string;
    fecha_llegada: string;
    numero_orden: string;
    productos: ProductoDetectado[];
  }): Observable<{ success: boolean; data: OrdenCompra }> {
    return this.http.post<{ success: boolean; data: OrdenCompra }>(
      `${this.apiLaravelUrl}/ordenes-compra`,
      {
        ...payload,
        usuario_id: this.getUsuarioActual()
      }
    );
  }

  /**
   * Actualiza el estado de una orden
   */
  actualizarEstadoOrden(
    id: number,
    estado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADA'
  ): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${this.apiLaravelUrl}/ordenes-compra/${id}/estado`,
      {
        estado,
        usuario_id: this.getUsuarioActual()
      }
    );
  }

  /**
   * Elimina una orden de compra
   */
  eliminarOrden(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiLaravelUrl}/ordenes-compra/${id}`,
      {
        body: { usuario_id: this.getUsuarioActual() }
      }
    );
  }

  /**
   * Descarga el documento original de una orden
   */
  descargarDocumento(id: number): Observable<Blob> {
    return this.http.get(
      `${this.apiLaravelUrl}/ordenes-compra/${id}/documento`,
      {
        responseType: 'blob',
        params: { usuario_id: this.getUsuarioActual() }
      }
    );
  }

  /**
   * Obtiene estadísticas generales de órdenes de compra
   */
  obtenerEstadisticas(): Observable<{
    success: boolean;
    data: {
      total_ordenes: number;
      pendientes: number;
      en_proceso: number;
      completadas: number;
      valor_total: number;
    }
  }> {
    return this.http.get<any>(
      `${this.apiLaravelUrl}/ordenes-compra/estadisticas`,
      { 
        params: { usuario_id: this.getUsuarioActual() } 
      }
    );
  }
}