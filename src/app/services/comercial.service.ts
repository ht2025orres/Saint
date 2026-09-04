import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ClienteSiesa {
  id: number;
  nit: string;
  razon_social: string;
}

export interface ItemSiesa {
  rowid_item_ext?: number;
  f121_rowid?: number;
  f120_rowid?: number;
  f120_id?: string;
  f120_referencia?: string;
  f120_descripcion_corta?: string;
  f120_descripcion?: string;
  referencia?: string;
  descripcion?: string;
  id_color?: string;
  color?: string;
  id_talla?: string;
  talla?: string;
  veces_pedido?: number;
  total_pedido?: number;
  ultima_pv?: string;
}

export interface SolicitudItem {
  id?: number;
  solicitud_id?: number;
  siesa_item_rowid?: number | null;
  siesa_item_ext_rowid?: number | null;
  siesa_referencia?: string | null;
  descripcion: string;
  item_cliente?: string;
  cantidad_muestra: number;
  orden?: number;
  ref_siesa_item_rowid?: number | null;
  ref_siesa_referencia?: string | null;
  ref_siesa_descripcion?: string | null;
  tallas: SolicitudItemTalla[];
}

export interface SolicitudItemTalla {
  id?: number;
  talla: string;
  cantidad: number;
}

export interface SolicitudVersion {
  id?: number;
  solicitud_id?: number;
  version: number;
  precio_tela?: number;
  ancho_util_tela?: number;
  promedio_trazo?: number;
  tiempo_produccion?: number;
  costo_total_unitario?: number;
  precio_venta_unitario?: number;
  precio_tela_fuente?: string;
  propuesta_producto?: string;
  proveedor_producto?: string;
  precio_producto?: number;
  notas?: string;
  estado: string;
  usuario_creacion?: number;
  created_at?: string;
}

export interface Solicitud {
  id?: number;
  codigo?: string;
  cliente_id: number;
  cliente_nombre: string;
  cliente_nit?: string;
  requiere_costeo: boolean;
  requiere_muestra: boolean;
  estado_costeo?: 'NO_REQUERIDO' | 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'RECHAZADO';
  estado_muestra?: 'NO_REQUERIDO' | 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'RECHAZADO';
  fecha_inicio_costeo?: string;
  fecha_fin_costeo?: string;
  fecha_inicio_muestra?: string;
  fecha_fin_muestra?: string;
  fecha_entrega_cotizacion?: string;
  fecha_entrega_muestra?: string;
  tipo_despacho: 'INTERNACIONAL' | 'NACIONAL' | 'LOCAL';
  material_empaque?: string;
  tipo_empaque?: string;
  observaciones?: string;
  cantidad_por_entrega: number;
  entregas_anual: number;
  cantidad_anual: number;
  imagen_referencia_url?: string;
  estado?: string;
  mold_id?: number | null;
  items?: SolicitudItem[];
  versiones?: SolicitudVersion[];
  items_count?: number;
  versiones_count?: number;
  usuario_creacion?: number;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ComercialService {
  private api = environment.URL_API_LARAVEL;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private uid(): number {
    return this.authService.user?.id || 0;
  }

  // ==================== CLIENTES ====================

  listarClientes(): Observable<{ success: boolean; data: ClienteSiesa[] }> {
    return this.http.get<any>(`${this.api}/comerciales/clientes`);
  }

  buscarClientes(word: string): Observable<{ success: boolean; data: ClienteSiesa[] }> {
    return this.http.get<any>(`${this.api}/comerciales/clientes/buscar/${encodeURIComponent(word)}`);
  }

  itemsCliente(clienteId: number, deep: boolean = false): Observable<{ success: boolean; data: ItemSiesa[] }> {
    let params = new HttpParams();
    if (deep) params = params.set('deep', 'true');
    return this.http.get<any>(`${this.api}/comerciales/clientes/${clienteId}/items`, { params });
  }

  buscarItemsCliente(clienteId: number, word: string, deep: boolean = false): Observable<{ success: boolean; data: ItemSiesa[] }> {
    let params = new HttpParams();
    if (deep) params = params.set('deep', 'true');
    return this.http.get<any>(`${this.api}/comerciales/clientes/${clienteId}/items/buscar/${encodeURIComponent(word)}`, { params });
  }

  extensionesItem(rowidItem: number): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<any>(`${this.api}/comerciales/items/${rowidItem}/extensiones`);
  }

  buscarItemsGlobal(word: string): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<any>(`${this.api}/comerciales/items/buscar/${encodeURIComponent(word)}`);
  }

  // ==================== SOLICITUDES ====================

  listarSolicitudes(filtros?: any): Observable<{ success: boolean; data: Solicitud[] }> {
    let params = new HttpParams();
    if (filtros) {
      Object.keys(filtros).forEach(k => {
        if (filtros[k] !== null && filtros[k] !== undefined && filtros[k] !== '') {
          params = params.set(k, filtros[k]);
        }
      });
    }
    return this.http.get<any>(`${this.api}/comerciales/solicitudes`, { params });
  }

  crearSolicitud(data: any): Observable<{ success: boolean; data: Solicitud; message: string }> {
    return this.http.post<any>(`${this.api}/comerciales/solicitudes`, {
      ...data,
      usuario_id: this.uid()
    });
  }

  detalleSolicitud(id: number): Observable<{ success: boolean; data: Solicitud }> {
    return this.http.get<any>(`${this.api}/comerciales/solicitudes/${id}`);
  }

  actualizarSolicitud(id: number, data: any): Observable<{ success: boolean; data: Solicitud }> {
    return this.http.put<any>(`${this.api}/comerciales/solicitudes/${id}`, {
      ...data,
      usuario_id: this.uid()
    });
  }

  cambiarEstado(id: number, estado: string): Observable<any> {
    return this.http.put<any>(`${this.api}/comerciales/solicitudes/${id}/estado`, {
      estado,
      usuario_id: this.uid()
    });
  }

  cambiarEstadoCosteo(id: number, estado_costeo: string): Observable<any> {
    return this.http.put<any>(`${this.api}/comerciales/solicitudes/${id}/estado-costeo`, {
      estado_costeo,
      usuario_id: this.uid()
    });
  }

  cambiarEstadoMuestra(id: number, estado_muestra: string): Observable<any> {
    return this.http.put<any>(`${this.api}/comerciales/solicitudes/${id}/estado-muestra`, {
      estado_muestra,
      usuario_id: this.uid()
    });
  }

  eliminarSolicitud(id: number): Observable<any> {
    return this.http.delete<any>(`${this.api}/comerciales/solicitudes/${id}`, {
      body: { usuario_id: this.uid() }
    });
  }

  // ==================== VERSIONES ====================

  crearVersion(solicitudId: number, notas?: string): Observable<any> {
    return this.http.post<any>(`${this.api}/comerciales/solicitudes/${solicitudId}/versiones`, {
      notas,
      usuario_id: this.uid()
    });
  }

  // ==================== ITEMS ====================

  agregarItem(solicitudId: number, item: any): Observable<any> {
    return this.http.post<any>(`${this.api}/comerciales/solicitudes/${solicitudId}/items`, item);
  }

  actualizarItem(solicitudId: number, itemId: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.api}/comerciales/solicitudes/${solicitudId}/items/${itemId}`, data);
  }

  eliminarItem(solicitudId: number, itemId: number): Observable<any> {
    return this.http.delete<any>(`${this.api}/comerciales/solicitudes/${solicitudId}/items/${itemId}`);
  }

  vincularItemSiesa(solicitudId: number, itemId: number, data: any): Observable<any> {
    return this.http.put<any>(
      `${this.api}/comerciales/solicitudes/${solicitudId}/items/${itemId}/vincular-siesa`,
      { ...data, usuario_id: this.uid() }
    );
  }
}
