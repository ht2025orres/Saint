import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface BodegaSummary {
  codigo: string;
  nombre_bodega: string;
  total_items: number;
  total_existencias: number;
  valor_total: number;
  items_con_zona?: number;
  faltantes?: number;
  cobertura_zonas?: number;
  total_zonas?: number;
}

export interface ItemBodega {
  id_item: string;
  referencia: string;
  descripcion: string;
  fecha: string;
  cantidad: number;
  id_f400: number;
  unidad_medida: string;
  costo_prom_unitario: number;
  costo_prom_total: number;
  codigo_bodega: string;
  nombre_bodega: string;
  color: string;
  id_color: string;
  id_talla: string;
  ultimo_movimiento_naturaleza?: number; // 1: entrada, 2: salida
  fecha_ultimo_movimiento?: number; // Formato YYYYMMDD
  fecha_ultimo_movimiento_formatted?: string;
  zonas: Array<{
    id: number | null;
    nombre: string;
    descripcion: string | null;
  }>;
  hasEntradasMes?: boolean;
  hasSalidasMes?: boolean;
  contadoReciente?: boolean;
  ultimoConteo?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class InventarioService {
  private apiLaravelUrl = environment.URL_API_LARAVEL;

  constructor(private http: HttpClient) { }

  getBodegas(): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/inventario/bodegas`);
  }

  // Alias para compatibilidad con Dashboard
  getWarehousesSummary(): Observable<BodegaSummary[]> {
    return this.http.get<{ success: boolean, data: BodegaSummary[] }>(`${this.apiLaravelUrl}/inventario/bodegas`)
      .pipe(
        map(response => response.data.map(warehouse => ({
          ...warehouse,
          total_items: parseFloat(warehouse.total_items as any) || 0,
          total_existencias: parseFloat(warehouse.total_existencias as any) || 0,
          valor_total: parseFloat(warehouse.valor_total as any) || 0,
          items_con_zona: parseFloat(warehouse.items_con_zona as any) || 0,
          faltantes: parseFloat(warehouse.faltantes as any) || 0,
          cobertura_zonas: parseFloat(warehouse.cobertura_zonas as any) || 0
        })))
      );
  }

  sincronizarBodegas(): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario/bodegas/sincronizar`, {});
  }

  migrarZonasAnteriores(): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario/zonas/migrar`, {});
  }

  getZonas(codigoBodega?: string, activo: 'true' | 'false' | 'all' = 'true'): Observable<any> {
    let url = `${this.apiLaravelUrl}/inventario/zonas?activo=${activo}`;
    if (codigoBodega) {
      url += `&codigo_bodega=${codigoBodega}`;
    }
    return this.http.get(url);
  }

  storeZona(zona: any, idUsuario: number): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario/zonas`, { ...zona, id_usuario: idUsuario });
  }

  getInventarios(): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/inventario/inventarios`);
  }

  storeInventario(inventario: any, idUsuario: number): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario/inventarios`, { ...inventario, id_usuario: idUsuario });
  }

  updateInventarioStatus(id: number, estado: string, idUsuario: number): Observable<any> {
    return this.http.put(`${this.apiLaravelUrl}/inventario/inventarios/${id}/status`, { estado, id_usuario: idUsuario });
  }

  getAsignaciones(idInventario?: number, idUsuario?: number, tipoConteo?: string): Observable<any> {
    let params = new HttpParams();
    if (idInventario) params = params.set('id_inventario', idInventario.toString());
    if (idUsuario) params = params.set('id_usuario', idUsuario.toString());
    if (tipoConteo) params = params.set('tipo_conteo', tipoConteo);
    return this.http.get(`${this.apiLaravelUrl}/inventario/asignaciones`, { params });
  }

  storeAsignacion(asignacion: any, idUsuario: number): Observable<any> {
    // Si la asignación no tiene tipo_conteo, por defecto es 'conteo'
    if (!asignacion.tipo_conteo) asignacion.tipo_conteo = 'conteo';
    return this.http.post(`${this.apiLaravelUrl}/inventario/asignaciones`, { ...asignacion, usuario_crea: idUsuario });
  }

  updateAsignacion(id: number, asignacion: any, idUsuario: number): Observable<any> {
    return this.http.put(`${this.apiLaravelUrl}/inventario/asignaciones/${id}`, { ...asignacion, usuario_actualiza: idUsuario });
  }

  deleteAsignacion(id: number, idUsuario: number): Observable<any> {
    return this.http.delete(`${this.apiLaravelUrl}/inventario/asignaciones/${id}?id_usuario=${idUsuario}`);
  }

  getConteos(idAsignacion: number): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/inventario/asignaciones/${idAsignacion}/conteos`);
  }

  storeConteo(conteo: any, idUsuario: number): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario/conteos`, { ...conteo, id_usuario: idUsuario });
  }

  updateConteo(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiLaravelUrl}/inventario/conteos/${id}`, data);
  }

  deleteConteo(id: number, idUsuario: number): Observable<any> {
    return this.http.delete(`${this.apiLaravelUrl}/inventario/conteos/${id}?id_usuario=${idUsuario}`);
  }

  getContadores(): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/inventario/usuarios-saint`);
  }

  getItemsPorBodega(codigoBodega: string, includeMovements: boolean = false): Observable<any> {
    let params = new HttpParams();
    params = params.set('include_movements', includeMovements.toString());
    return this.http.get(`${this.apiLaravelUrl}/inventario/bodegas/${codigoBodega}/items`, { params });
  }

  // Alias para compatibilidad con Dashboard
  getWarehouseItems(codigoBodega: string): Observable<ItemBodega[]> {
    return this.http.get<{ success: boolean, data: ItemBodega[] }>(`${this.apiLaravelUrl}/inventario/bodegas/${codigoBodega}/items`)
      .pipe(map(resp => resp.data));
  }

  asignarZonaItems(payload: any): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario/asignar-zona-items`, payload);
  }

  eliminarZonaItem(payload: any): Observable<any> {
    return this.http.delete(`${this.apiLaravelUrl}/inventario/eliminar-zona-item`, { body: payload });
  }

  eliminarZonasMasivo(payload: any): Observable<any> {
    return this.http.delete(`${this.apiLaravelUrl}/inventario/eliminar-zonas-masivo`, { body: payload });
  }

  getValidacionesReconteo(idInventario: number, sincronizar: boolean = true): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/inventario/inventarios/${idInventario}/validaciones?sincronizar=${sincronizar}`);
  }

  bulkUpdateValidaciones(payload: { ids: number[], estado: string, justificacion?: string, virtual_item?: any }, idUsuario: number): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario/validaciones/bulk-update`, { ...payload, id_usuario: idUsuario });
  }

  justificarPorTolerancia(idInventario: number, toleranciaTelas: number, toleranciaInsumos: number, idUsuario: number): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario/inventarios/${idInventario}/validaciones/tolerancia`, { 
      tolerancia_telas: toleranciaTelas, 
      tolerancia_insumos: toleranciaInsumos, 
      id_usuario: idUsuario 
    });
  }

  getHistoricoMovimientos(params?: { id_inventario?: number, id_usuario?: number, tipo_movimiento?: string, page?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.id_inventario) httpParams = httpParams.set('id_inventario', params.id_inventario.toString());
    if (params?.id_usuario) httpParams = httpParams.set('id_usuario', params.id_usuario.toString());
    if (params?.tipo_movimiento) httpParams = httpParams.set('tipo_movimiento', params.tipo_movimiento);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());

    return this.http.get(`${this.apiLaravelUrl}/inventario/historico-movimientos`, { params: httpParams });
  }

  // Inventario Cíclico
  getMovimientosCiclico(bodega: string, fechaInicio: string, fechaFin: string, tipoMovimiento: string = '', referencia: string = ''): Observable<ItemBodega[]> {
    let params = new HttpParams()
      .set('bodega', bodega)
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    if (tipoMovimiento) {
      params = params.set('tipo_movimiento', tipoMovimiento);
    }
    if (referencia) {
      params = params.set('referencia', referencia);
    }

    return this.http.get<{ success: boolean, data: ItemBodega[] }>(`${this.apiLaravelUrl}/inventario/ciclico/movimientos`, { params })
      .pipe(
        map(response => response.data)
      );
  }

  storeCiclico(conteo: any): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario/ciclico`, conteo);
  }

  getCiclicoEventos(bodega?: string): Observable<any> {
    let params = new HttpParams();
    if (bodega) params = params.set('bodega', bodega);
    return this.http.get(`${this.apiLaravelUrl}/inventario/ciclico/eventos`, { params });
  }

  getCiclicoPorFecha(fecha: string, bodega?: string): Observable<any> {
    let params = new HttpParams();
    if (bodega) params = params.set('bodega', bodega);
    return this.http.get(`${this.apiLaravelUrl}/inventario/ciclico/fecha/${fecha}`, { params });
  }

  getCiclicoPorRango(fechaInicio: string, fechaFin: string, bodega?: string): Observable<any> {
    let params = new HttpParams()
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);
    if (bodega) params = params.set('bodega', bodega);
    return this.http.get(`${this.apiLaravelUrl}/inventario/ciclico/rango`, { params });
  }

  getItemMovimientosDetallados(idF400: string, bodega: string, page: number = 1): Observable<any> {
    const params = new HttpParams()
      .set('id_f400', idF400)
      .set('bodega', bodega)
      .set('page', page.toString());
    return this.http.get(`${this.apiLaravelUrl}/inventario/ciclico/item-movimientos`, { params });
  }

  exportarMovimientosCiclicoExcel(
    bodega: string,
    fechaInicio: string,
    fechaFin: string,
    tipoMovimiento: string = '',
    referencia: string = ''
  ): Observable<Blob> {
    let params = new HttpParams()
      .set('bodega', bodega)
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    if (tipoMovimiento) {
      params = params.set('tipo_movimiento', tipoMovimiento);
    }
    if (referencia) {
      params = params.set('referencia', referencia);
    }

    return this.http.get(`${this.apiLaravelUrl}/inventario/ciclico/exportar-excel`, {
      params,
      responseType: 'blob' // Important for file downloads
    });
  }

  getItemsContadosRecientes(bodega: string, dias: number = 15): Observable<any> {
    let params = new HttpParams()
      .set('bodega', bodega)
      .set('dias', dias.toString());
    return this.http.get(`${this.apiLaravelUrl}/inventario/ciclico/items-contados-recientes`, { params });
  }

  corregirZonasDuplicadas(): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario/zonas/corregir-duplicadas`, {});
  }
}
