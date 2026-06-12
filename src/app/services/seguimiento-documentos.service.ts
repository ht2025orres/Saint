import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface OrdenResponse {
  tipo_orden: string;
  nro_orden: string;
  fecha_orden: string;
  fecha_creacion_orden: string;
  creador_orden: string;
  aprobador_orden: string;
  estado_orden: string;
  notas_orden: string;
  referencia_orden: string;
}

export interface ItemDetalle {
  referencia: string;
  descripcion: string;
  bodega: string;
  id_bodega: string;
  unidad_medida: string;
  cant_pedida: number;
  cant_entrada: number;
  faltante: number;
  precio_unitario: number;
  vlr_neto: number;
  notas: string;
  detalle: string;
  fecha_entrega: string;
  estado: string;
  estado_visual: 'COMPLETO' | 'PARCIAL' | 'PENDIENTE';
  oc_tipo?: string | null;
  oc_consecutivo?: string | null;
}

export interface ItemsResponse {
  success: boolean;
  tipo: string;
  consecutivo: string;
  total_items: number;
  total_pedida: number;
  total_entrada: number;
  items_faltantes: number;
  items_completos: number;
  items: ItemDetalle[];
}

export interface DocumentoSeguimiento {
  tipo_ss: string;
  nro_ss: string;
  fecha_ss: string;
  fecha_creacion_ss: string;
  creador_ss: string;
  aprobador_ss: string;
  estado_ss: string;
  notas_ss: string;
  referencia_ss: string;
  ordenes: OrdenResponse[];
  estado_visual: 'PENDIENTE' | 'EN_PROCESO' | 'PROCESADO' | 'ANULADO';
  cerrada_incompleta?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SeguimientoDocumentosService {
  private apiLaravelUrl = environment.URL_API_LARAVEL;

  constructor(private http: HttpClient) {}

  obtenerSeguimientos(params?: {
    creador?: string;
    consecutive?: string;
    tipo?: 'SS' | 'SC' | '';
    estado_visual?: 'PENDIENTE' | 'EN_PROCESO' | 'PROCESADO' | 'ANULADO' | '';
    fecha_desde?: string;
    fecha_hasta?: string;
  }): Observable<{ success: boolean; is_logistica: boolean; data: DocumentoSeguimiento[] }> {
    return this.http.get<{ success: boolean; is_logistica: boolean; data: DocumentoSeguimiento[] }>(
      `${this.apiLaravelUrl}/seguimiento-documentos`,
      { params }
    );
  }

  obtenerItems(tipo: string, consecutivo: string): Observable<ItemsResponse> {
    return this.http.get<ItemsResponse>(
      `${this.apiLaravelUrl}/seguimiento-documentos/${tipo}/${consecutivo}/items`
    );
  }
}

