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
  ) { }

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

  guardarItems(ordenId: number, items: any[]): Observable<{ success: boolean; data: any[]; message: string }> {
    return this.http.post<any>(
      `${this.apiLaravelUrl}/ordenes-compra/${ordenId}/items`,
      { items }
    );
  }

  obtenerItems(ordenId: number): Observable<{ success: boolean; data: any[]; resumen: any }> {
    return this.http.get<any>(
      `${this.apiLaravelUrl}/ordenes-compra/${ordenId}/items`
    );
  }

  generarSolicitud(ordenId: number): Observable<{ success: boolean; data: any; message: string }> {
    return this.http.post<any>(
      `${this.apiLaravelUrl}/ordenes-compra/${ordenId}/generar-solicitud`,
      { usuario_id: this.getUsuarioActual() }
    );
  }

  obtenerEstadisticas(): Observable<{ success: boolean; data: any }> {
    return this.http.get<any>(
      `${this.apiLaravelUrl}/ordenes-compra/estadisticas`
    );
  }

  // ========== OCR ==========

  analizarDocumentoOcr(archivo: File): Observable<OcrAnalysisResult> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('usuario_id', this.getUsuarioActual().toString());

    return this.http.post<OcrAnalysisResult>(
      `${this.apiLaravelUrl}/ordenes-compra/analizar-ocr`,
      formData
    );
  }

  guardarMapeoCliente(clienteId: number, items: OcrItemMapeo[]): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(
      `${this.apiLaravelUrl}/ordenes-compra/guardar-mapeo-cliente`,
      {
        cliente_id: clienteId,
        items,
        usuario_id: this.getUsuarioActual()
      }
    );
  }

  buscarSugerenciasSiesa(texto: string, clienteId?: number): Observable<{ success: boolean; data: SugerenciaSiesa[] }> {
    return this.http.post<any>(
      `${this.apiLaravelUrl}/ordenes-compra/buscar-sugerencias-siesa`,
      {
        texto,
        cliente_id: clienteId
      }
    );
  }

  obtenerExtensionesItem(rowidItem: number): Observable<{ success: boolean; data: ExtensionItemSiesa[] }> {
    return this.http.post<any>(
      `${this.apiLaravelUrl}/ordenes-compra/extensiones-item`,
      { rowid_item: rowidItem }
    );
  }

  buscarItemsSiesaCatalogo(query: string, clienteId?: number, soloPv: boolean = false, textoOriginal: string = ''): Observable<{ success: boolean; data: any[] }> {
    return this.http.post<any>(
      `${this.apiLaravelUrl}/ordenes-compra/buscar-items-siesa-catalogo`,
      { query, cliente_id: clienteId, solo_pv: soloPv, texto_original: textoOriginal }
    );
  }
}

// ========== Interfaces OCR ==========

export interface OcrClienteInfo {
  id: number | null;
  nit: string;
  razon_social: string;
  confianza: number;
}

export interface SugerenciaSiesa {
  rowid_siesa: number;
  codigo_item: string;
  referencia: string;
  talla_siesa?: string;
  color_siesa?: string;
  descripcion: string;
  coincidencia: number;
  fuente: string;
}

export interface OcrItemExtraido {
  codigo_item: string;
  descripcion: string;
  referencia: string;
  talla?: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
  unidad_medida: string;
  rowid_siesa: number | null;
  sugerencias_siesa: SugerenciaSiesa[];
}

export interface OcrAnalysisResult {
  success: boolean;
  message?: string;
  data?: {
    numero_orden: string;
    cliente: OcrClienteInfo;
    fecha_solicitud?: string | null;
    fecha_entrega_estimada: string | null;
    dias_entrega: number | null;
    observaciones: string;
    items: OcrItemExtraido[];
    texto_raw: string;
  };
}

export interface OcrItemMapeo {
  descripcion_cliente: string;
  rowid_siesa: number;
  codigo_siesa?: string;
  referencia_siesa?: string;
  talla_siesa?: string;
  descripcion_siesa?: string;
}

export interface ExtensionItemSiesa {
  rowid_item_ext: number;
  rowid_item: number;
  referencia: string;
  color: string;
  talla: string;
}