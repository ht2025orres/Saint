import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DocumentoFirmaEtiqueta {
  id?: number;
  nombre: string;
  proceso_id?: number;
  color?: string;
  proceso?: any;
}

export interface DocumentoFirma {
  id?: number;
  titulo: string;
  descripcion?: string;
  etiqueta_id?: number;
  etiqueta?: DocumentoFirmaEtiqueta;
  nombre_creador?: string;
  email_creador?: string;
  estado?: string;
  firmado_por_creador?: boolean;
  creador_pagina?: number;
  creador_posicion_x?: number;
  creador_posicion_y?: number;
  creador_ancho?: number;
  creador_alto?: number;
  creador_tipo_firma?: 'DIGITAL' | 'PULSO' | 'AMBAS';
  pdf_url?: string;
  destinatarios?: DocumentoFirmaDestinatario[];
  created_at?: string;
}

export interface DocumentoFirmaDestinatario {
  id?: number;
  colaborador_id?: number;
  nombre_firmante: string;
  email_destinatario: string;
  tipo_correo: 'corporativo' | 'personal';
  proceso_nombre?: string;
  token_firma?: string;
  pagina?: number;
  posicion_x?: number;
  posicion_y?: number;
  ancho?: number;
  alto?: number;
  estado?: 'PENDIENTE' | 'FIRMADO' | 'RECHAZADO' | 'DESHABILITADO' | 'CANCELADO';
  tipo_firma_requerida?: 'DIGITAL' | 'PULSO' | 'AMBAS';
  firmado_at?: string;
  ip_firma?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentoFirmaService {
  private baseUrl = environment.URL_API_LARAVEL;

  constructor(private http: HttpClient) {}

  /** Listar documentos de firma creados */
  getDocumentos(page: number = 1, search: string = '', estado: string = '', etiquetaId: string = '', papelera: boolean = false, perPage: number = 500): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/documento-firmas?page=${page}&per_page=${perPage}&search=${search}&estado=${estado}&etiqueta_id=${etiquetaId}&papelera=${papelera ? 1 : 0}`);
  }

  /** Mover uno o varios documentos a la Papelera con motivo */
  eliminarMasivo(ids: number[], razon: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/documento-firmas/eliminar-masivo`, { ids, razon });
  }

  /** Restaurar uno o varios documentos de la Papelera */
  restaurarMasivo(ids: number[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/documento-firmas/restaurar-masivo`, { ids });
  }

  /** Crear y distribuir documento para firma */
  crearDocumento(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/documento-firmas`, formData);
  }

  /** Ver detalle completo de documento por ID */
  getDetalle(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/documento-firmas/${id}`);
  }

  /** Actualizar metadatos de un documento (cambiar etiqueta, título, etc) */
  updateDocumento(id: number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/documento-firmas/${id}`, payload);
  }

  /** Listar etiquetas por proceso */
  getEtiquetas(procesoId?: number): Observable<any> {
    const query = procesoId ? `?proceso_id=${procesoId}` : '';
    return this.http.get<any>(`${this.baseUrl}/documento-firmas/etiquetas${query}`);
  }

  /** Listar procesos activos para asignación */
  getProcesos(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/documento-firmas/procesos`);
  }

  /** Crear nueva etiqueta/categoría por proceso */
  crearEtiqueta(nombre: string, procesoId?: number, color: string = '#2563eb'): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/documento-firmas/etiquetas`, {
      nombre,
      proceso_id: procesoId,
      color
    });
  }

  /** Actualizar etiqueta existente */
  actualizarEtiqueta(id: number, nombre: string, procesoId?: number, color: string = '#2563eb'): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/documento-firmas/etiquetas/${id}`, {
      nombre,
      proceso_id: procesoId,
      color
    });
  }

  /** Eliminar etiqueta */
  eliminarEtiqueta(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/documento-firmas/etiquetas/${id}`);
  }

  /** Reenviar correo de invitación */
  reenviarCorreo(destinatarioId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/documento-firmas/destinatarios/${destinatarioId}/reenviar`, {});
  }

  /** Reiniciar la firma de un destinatario (borrar su sello del PDF y volver a PENDIENTE) */
  resetDestinatario(destinatarioId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/documento-firmas/destinatarios/${destinatarioId}/reset`, {});
  }

  /** Deshabilitar / Habilitar una firma pendiente */
  toggleEstadoDestinatario(destinatarioId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/documento-firmas/destinatarios/${destinatarioId}/toggle-estado`, {});
  }

  /** Agregar un nuevo firmante a un documento existente */
  addDestinatario(documentoId: number, payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/documento-firmas/${documentoId}/destinatarios`, payload);
  }

  /** Editar los datos de un firmante existente */
  updateDestinatario(destinatarioId: number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/documento-firmas/destinatarios/${destinatarioId}`, payload);
  }

  /** Eliminar un firmante de un documento */
  destroyDestinatario(destinatarioId: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/documento-firmas/destinatarios/${destinatarioId}`);
  }

  /** Sincronizar los procesos de los firmantes basados en su asignación actual */
  sincronizarProcesosFirmantes(documentoId?: number): Observable<any> {
    const url = documentoId 
      ? `${this.baseUrl}/documento-firmas/${documentoId}/sincronizar-procesos-firmantes`
      : `${this.baseUrl}/documento-firmas/sincronizar-procesos-firmantes`;
    return this.http.post<any>(url, {});
  }

  /** RUTA PÚBLICA: Obtener datos por Token */
  getByToken(token: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/public/firmar-documento/${token}`);
  }

  /** RUTA PÚBLICA: Procesar firma por Token */
  signByToken(token: string, payload: { metodo_firma_usado?: string; firma_pulso_base64?: string; rechazar?: boolean; motivo_rechazo?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/public/firmar-documento/${token}`, payload);
  }
}
