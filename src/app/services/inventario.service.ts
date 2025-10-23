import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service'; // ✅ asegúrate de importar tu AuthService

export interface ResumenBodega {
  codigo_bodega: string;
  nombre_bodega: string;
  cantidad_items: number;
  existencias_totales: number;
}

@Injectable({
  providedIn: 'root'
})
export class InventarioService {
  private apiLaravelUrl = environment.URL_API_LARAVEL;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getUsuarioActual(): number {
    return this.authService.user?.id || 0;
  }

  /**
   * ================================
   *        ZONAS
   * ================================
   */
  obtenerZonas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/zonas`, {
      params: { usuario_id: this.getUsuarioActual() }
    });
  }

  crearZona(zona: any): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/crear/zonas`, {
      ...zona,
      usuario_id: this.getUsuarioActual()
    });
  }

  actualizarZona(id: number, zona: any): Observable<any> {
    return this.http.put<any>(`${this.apiLaravelUrl}/zonas/${id}`, {
      ...zona,
      usuario_id: this.getUsuarioActual()
    });
  }

  eliminarZona(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiLaravelUrl}/zonas/${id}`, {
      body: { usuario_id: this.getUsuarioActual() }
    });
  }

  /**
   * ================================
   *        INVENTARIO / BODEGAS
   * ================================
   */
  obtenerResumenBodegas(): Observable<ResumenBodega[]> {
    return this.http.get<ResumenBodega[]>(`${this.apiLaravelUrl}/inventario/resumen-bodegas`, {
      params: { usuario_id: this.getUsuarioActual() }
    });
  }

  obtenerItemsPorBodega(codigoBodega: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/bodegas/${codigoBodega}/items`, {
      params: { usuario_id: this.getUsuarioActual() }
    });
  }

  asignarZonaItems(payload: { codigo_bodega: string; codigo_item: string; id_f400: string; id_zona: number }[]): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/inventario/asignar-zona-items`, {
      items: payload,
      usuario_id: this.getUsuarioActual()
    });
  }

  eliminarZonaItem(codigoItem: string, codigoBodega: string, idZona: number, id_f400: string): Observable<any> {
    return this.http.delete(`${this.apiLaravelUrl}/inventario/eliminar-zona-item`, {
      body: { codigo_item: codigoItem, codigo_bodega: codigoBodega, id_zona: idZona, id_f400, usuario_id: this.getUsuarioActual() }
    });
  }

  listarBodegas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/bodegas`, {
      params: { usuario_id: this.getUsuarioActual() }
    });
  }

  obtenerBodega(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiLaravelUrl}/bodegas/${id}`, {
      params: { usuario_id: this.getUsuarioActual() }
    });
  }

  crearBodega(bodega: any): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/bodegas`, {
      ...bodega,
      usuario_id: this.getUsuarioActual()
    });
  }

  actualizarBodega(id: number, bodega: any): Observable<any> {
    return this.http.put<any>(`${this.apiLaravelUrl}/bodegas/${id}`, {
      ...bodega,
      usuario_id: this.getUsuarioActual()
    });
  }

  eliminarBodega(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiLaravelUrl}/bodegas/${id}`, {
      body: { usuario_id: this.getUsuarioActual() }
    });
  }

  /**
   * ================================
   *        ÍTEMS
   * ================================
   */
  listarItems(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/items`);
  }

  obtenerItem(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiLaravelUrl}/items/${id}`);
  }

  crearItem(item: any): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/items`, item);
  }

  actualizarItem(id: number, item: any): Observable<any> {
    return this.http.put<any>(`${this.apiLaravelUrl}/items/${id}`, item);
  }

  eliminarItem(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiLaravelUrl}/items/${id}`);
  }

  /**
   * ================================
   *   MOVIMIENTOS DE INVENTARIO
   * ================================
   */
  listarMovimientos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/movimientos-inventario`);
  }

  obtenerMovimiento(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiLaravelUrl}/movimientos-inventario/${id}`);
  }

  registrarMovimiento(movimiento: any): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/movimientos-inventario`, movimiento);
  }

  eliminarMovimiento(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiLaravelUrl}/movimientos-inventario/${id}`);
  }

  /**
   * ================================
   *   REPORTES Y DASHBOARD
   * ================================
   */
  obtenerStockPorBodega(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/inventario/stock-por-bodega`);
  }

  obtenerKardex(itemId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/inventario/${itemId}/kardex`);
  }
}
