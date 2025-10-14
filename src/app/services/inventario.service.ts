import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

  constructor(private http: HttpClient) {}

  /**
  * Trae todas las bodegas con su conteo de ítems y existencias
  */
  obtenerZonas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/zonas`);
  }

  crearZona(zona: any): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/crear/zonas`, zona);
  }

  actualizarZona(id: number, zona: any): Observable<any> {
    return this.http.put<any>(`${this.apiLaravelUrl}/zonas/${id}`, zona);
  }

  eliminarZona(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiLaravelUrl}/zonas/${id}`);
  }

  obtenerResumenBodegas(): Observable<ResumenBodega[]> {
    return this.http.get<ResumenBodega[]>(`${this.apiLaravelUrl}/inventario/resumen-bodegas`);
  }

  obtenerItemsPorBodega(codigoBodega: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/bodegas/${codigoBodega}/items`);
  }

  asignarZonaItems(payload: { codigo_bodega: string; codigo_item: string; id_zona: number }[]): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/inventario/asignar-zona-items`, payload);
  }

  eliminarZonaItem(codigoItem: string, codigoBodega: string, idZona: number) {
    return this.http.delete(`${this.apiLaravelUrl}/inventario/eliminar-zona-item`, {
      body: { codigo_item: codigoItem, codigo_bodega: codigoBodega, id_zona: idZona }
    });
  }

  /**
   * ================================
   *        BODEGAS
   * ================================
   */
  listarBodegas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/bodegas`);
  }

  obtenerBodega(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiLaravelUrl}/bodegas/${id}`);
  }

  crearBodega(bodega: any): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/bodegas`, bodega);
  }

  actualizarBodega(id: number, bodega: any): Observable<any> {
    return this.http.put<any>(`${this.apiLaravelUrl}/bodegas/${id}`, bodega);
  }

  eliminarBodega(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiLaravelUrl}/bodegas/${id}`);
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
