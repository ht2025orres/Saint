import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

export interface ResumenBodega {
  codigo_bodega: string;
  nombre_bodega: string;
  cantidad_items: number;
  existencias_totales: number;
}

export interface BodegaSummary {
  codigo: string;
  nombre_bodega: string;
  total_items: number;
  total_existencias: number;
  valor_total: number;
  items_con_zona?: number;
  faltantes?: number;
  cobertura_zonas?: number;
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
  zonas: Array<{
    id: number | null;
    nombre: string;
    descripcion: string | null;
  }>;
}

export interface Inventario {
  id: number;
  codigo: string;
  tipo: 'general' | 'ciclico';
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: 'activo' | 'cerrado';
  descripcion?: string;
  total_hojas?: number;
  existencias_contadas?: number;
  valor_total?: number;
}

export interface InventarioDetalle extends Inventario {
  hojas_conteo: any[]; // o HojaConteo[]
  stats?: {
    total_hojas: number;
    items_contados: number;
    existencias_contadas: number;
    valor_total: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class InventarioOldService {
  private apiLaravelUrl = environment.URL_API_LARAVEL;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getUsuarioActual(): number {
    return this.authService.user?.id || 0;
  }
  /**
   * Obtiene resumen de todas las bodegas
   */
  getWarehousesSummary(): Observable<BodegaSummary[]> {
    return this.http.get<{success: boolean, data: BodegaSummary[]}>(`${this.apiLaravelUrl}/inventario-old/bodegas/resumen`)
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

  /**
   * Obtiene items de una bodega específica
   */
  getWarehouseItems(codigoBodega: string): Observable<ItemBodega[]> {
    return this.http.get<ItemBodega[]>(`${this.apiLaravelUrl}/inventario-old/bodegas/${codigoBodega}/items`);
  }

  /**
   * ================================
   *        ZONAS
   * ================================
   */
  obtenerZonas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/inventario-old/zonas`, {
      params: { usuario_id: this.getUsuarioActual() }
    });
  }

  crearZona(zona: any): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/inventario-old/zonas`, {
      ...zona,
      usuario_id: this.getUsuarioActual()
    });
  }

  actualizarZona(id: number, zona: any): Observable<any> {
    return this.http.put<any>(`${this.apiLaravelUrl}/inventario-old/zonas/${id}`, {
      ...zona,
      usuario_id: this.getUsuarioActual()
    });
  }

  eliminarZona(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiLaravelUrl}/inventario-old/zonas/${id}`, {
      body: { usuario_id: this.getUsuarioActual() }
    });
  }

  /**
   * ================================
   *        INVENTARIO / BODEGAS
   * ================================
   */
  obtenerResumenBodegas(): Observable<ResumenBodega[]> {
    return this.http.get<ResumenBodega[]>(`${this.apiLaravelUrl}/inventario-old/bodegas/resumen`, {
      params: { usuario_id: this.getUsuarioActual() }
    });
  }

  obtenerItemsPorBodega(codigoBodega: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/inventario-old/bodegas/${codigoBodega}/items`, {
      params: { usuario_id: this.getUsuarioActual() }
    });
  }

  asignarZonaItems(payload: { codigo_bodega: string; codigo_item: string; id_f400: string; id_zona: number }[]): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/inventario-old/zonas/asignar`, {
      items: payload,
      usuario_id: this.getUsuarioActual()
    });
  }

  eliminarZonaItem(codigoItem: string, codigoBodega: string, idZona: number, id_f400: string): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario-old/zonas/eliminar-item`, {
      codigo_item: codigoItem, codigo_bodega: codigoBodega, id_zona: idZona, id_f400, usuario_id: this.getUsuarioActual()
    });
  }

  sincronizarExistencias(): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario-old/bodegas/sincronizar`, {});
  }

  /**
   * Obtiene la lista de líderes de conteo con sus asignaciones
   */
  obtenerLideresConteo(): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/inventario-old/lideres`);
  }

  /**
   * Obtiene las hojas de conteo disponibles para asignar
   */
  obtenerHojasConteoDisponibles(): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/inventario-old/hojas-disponibles`);
  }

  /**
   * Asigna hojas de conteo a un líder
   */
  asignarHojasALider(payload: any): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario-old/asignar-hojas`, payload);
  }

  /**
   * Asigna contadores a un líder
   */
  asignarContadoresALider(payload: any): Observable<any> {
    payload.usuario_id = this.getUsuarioActual();
    return this.http.post(`${this.apiLaravelUrl}/inventario-old/asignar-contadores`, payload);
  }

  /**
   * Desasigna una hoja de conteo de un líder
   */
  desasignarHojaLider(liderId: number, hojaId: number): Observable<any> {
    return this.http.delete(
      `${this.apiLaravelUrl}/inventario-old/desasignar-hoja/${liderId}/${hojaId}`
    );
  }

  /**
   * Desasigna un contador de un líder
   */
  desasignarContadorLider(liderId: number, contadorId: number): Observable<any> {
    return this.http.delete(
      `${this.apiLaravelUrl}/inventario-old/desasignar-contador/${liderId}/${contadorId}`
    );
  }

  /**
   * Obtiene la lista de contadores registrados
   */
  obtenerContadores(): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/inventario-old/contadores`);
  }

  /**
   * Busca usuarios en la plataforma externa de permisos
   * @param termino - Término de búsqueda (nombre, apellido o cédula)
   */
  buscarUsuariosExternos(termino: string): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/usuarios-externos/buscar`, {
      params: { q: termino }
    });
  }

  /**
   * Registra múltiples contadores en la base de datos
   * @param contadores - Array de contadores a registrar
   */
  registrarContadores(contadores: any[]): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario-old/contadores`, {
      contadores: contadores,
      id: this.getUsuarioActual()
    });
  }

  /**
   * ================================
   *    HOJAS DE CONTEO
   * ================================
   */

  /**
   * Genera una sugerencia de hoja de conteo basada en parámetros
   */
  generarSugerenciaHoja(payload: {
    codigo_bodega: string;
    zonas_ids?: number[];
    max_items?: number;
    umbral_existencia?: number;
  }): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/generar-sugerencia`, {
      ...payload,
      usuario_id: this.getUsuarioActual()
    });
  }

  /**
   * Crea una hoja de conteo definitiva
   */
  crearHojaConteo(payload: {
    id_lider: number;
    tipo: 'CONTEO' | 'RECONTEO1' | 'RECONTEO2' | 'RECONTEO3';
    items: number[]; // IDs de item_zona
    observaciones?: string;
  }): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario-old/hojas-conteo`, {
      ...payload,
      usuario_id: this.getUsuarioActual()
    });
  }

/**
 * Listar hojas de conteo con filtros
 */
listarHojasConteo(params: any): Observable<any> {
  return this.http.get(`${this.apiLaravelUrl}/inventario-old/hojas-conteo`, { params });
}

/**
 * Obtener detalle de una hoja
 */
obtenerDetalleHoja(id: number): Observable<any> {
  return this.http.get(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/${id}`);
}

/**
 * Obtener items de una hoja
 */
obtenerItemsHoja(id: number): Observable<any> {
  return this.http.get(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/${id}/items`);
}

/**
 * Cambiar líder de una hoja
 */
cambiarLiderHoja(id: number, payload: any): Observable<any> {
  return this.http.put(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/${id}/cambiar-lider`, payload);
}

/**
 * Eliminar item de una hoja
 */
eliminarItemHoja(idHoja: number, idItem: number, payload: any): Observable<any> {
  return this.http.delete(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/${idHoja}/items/${idItem}`, {
    body: payload
  });
}

/**
 * Agregar items a una hoja
 */
agregarItemsHoja(id: number, payload: any): Observable<any> {
  return this.http.post(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/${id}/agregar-items`, payload);
}

/**
 * Marcar/desmarcar item para reconteo
 */
toggleReconteoItem(idHoja: number, idItem: number, payload: any): Observable<any> {
  return this.http.put(
    `${this.apiLaravelUrl}/inventario-old/hojas-conteo/${idHoja}/items/${idItem}/toggle-reconteo`,
    payload
  );
}

/**
 * Finalizar hoja de conteo
 */
finalizarHojaConteo(id: number, payload: any): Observable<any> {
  return this.http.post(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/${id}/finalizar`, payload);
}

/**
 * Eliminar hoja de conteo
 */
eliminarHojaConteo(id: number, payload: any): Observable<any> {
  return this.http.delete(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/${id}`, {
    body: payload
  });
}

  // ========================================
  // GESTIÓN DE ITEMS DE HOJAS
  // ========================================

  /**
   * Cambiar estado de un item individual
   */
  cambiarEstadoItem(idHoja: number, idItem: number, payload: any): Observable<any> {
    payload.id_item = idItem;
    return this.http.put(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/${idHoja}/items/${idItem}`, payload);
  }

  /**
   * Marcar todos los items con diferencias para reconteo
   */
  marcarTodosReconteo(idHoja: number, payload: any): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/${idHoja}/items/marcar-todos-reconteo`, payload);
  }

  /**
   * Validar todos los items
   */
  validarTodosItems(idHoja: number, payload: any): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/${idHoja}/items/validar-todos`, payload);
  }

  /**
   * Obtener items disponibles para agregar
   */
  obtenerItemsDisponibles(params: any): Observable<any> {
    let httpParams = new HttpParams();
    
    if (params.codigo_bodega) {
      httpParams = httpParams.set('codigo_bodega', params.codigo_bodega);
    }
    if (params.excluir_hoja_id) {
      httpParams = httpParams.set('excluir_hoja_id', params.excluir_hoja_id.toString());
    }

    return this.http.get(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/items-disponibles`, { params: httpParams });
  }

  /**
   * Actualizar estado de la hoja
   */
  actualizarEstadoHoja(idHoja: number, payload: any): Observable<any> {
    return this.http.put(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/${idHoja}/estado`, payload);
  }

  /**
   * Obtener hojas de conteo del líder actual
   */
  obtenerHojasDelLider(): Observable<any> {
    return this.http.post(`${this.apiLaravelUrl}/inventario-old/hojas-conteo/lider/mis-hojas`, {
      usuario_id: this.getUsuarioActual()
    });
  }

  /**
   * Registrar conteo de un item
   */
  registrarConteoItem(idHoja: number, idItem: number, payload: any): Observable<any> {
    return this.http.post(
      `${this.apiLaravelUrl}/inventario-old/hojas-conteo/${idHoja}/items/${idItem}/registrar-conteo`,
      payload
    );
  }

  /**
   * Guardar progreso del conteo
   */
  guardarProgresoConteo(idHoja: number, payload: any): Observable<any> {
    return this.http.post(
      `${this.apiLaravelUrl}/inventario-old/hojas-conteo/${idHoja}/guardar-progreso`,
      payload
    );
  }

  getInventarios(tipo?: 'general' | 'ciclico' | 'activos'): Observable<{ success: boolean; data: Inventario[] }> {
    let params = new HttpParams();
    if (tipo === 'activos') {
      return this.http.get<{ success: boolean; data: Inventario[] }>(`${this.apiLaravelUrl}/inventario-old/index`)
        .pipe(map(res => ({
          ...res,
          data: res.data.filter(inv => inv.estado === 'activo')
        })));
    }
    if (tipo && tipo !== undefined) params = params.set('tipo', tipo);
    return this.http.get<{ success: boolean; data: Inventario[] }>(`${this.apiLaravelUrl}/inventario-old/index`, { params });
  }

  getInventario(id: number): Observable<{ success: boolean; data: InventarioDetalle; stats: any }> {
    return this.http.get<{ success: boolean; data: InventarioDetalle; stats: any }>(`${this.apiLaravelUrl}/inventario-old/show/${id}`);
  }

  crearInventario(data: Partial<Inventario>): Observable<{ success: boolean; data: Inventario }> {
    return this.http.post<{ success: boolean; data: Inventario }>(`${this.apiLaravelUrl}/inventario-old/store`, data);
  }

  cerrarInventario(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiLaravelUrl}/inventario-old/cerrar/${id}`, {});
  }

  getHojasPorInventario(inventarioId: number): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/inventario-old/inventarios/${inventarioId}/hojas`);
  }

  actualizarInventario(id: number, data: Partial<Inventario>): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(`${this.apiLaravelUrl}/inventario-old/update/${id}`, data);
  }

  getInventarioDetalle(inventarioId: number): Observable<any> {
    return this.http.get(`${this.apiLaravelUrl}/inventario-old/${inventarioId}/detalle`);
  }
}
