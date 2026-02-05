import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type OrigenArchivo = 
  | 'orden_compra' 
  | 'reporte_evidencia' 
  | 'documento_proveedor';

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private apiUrl = environment.URL_API_LARAVEL;

  constructor(private http: HttpClient) {}

  /**
   * Subir archivo a S3
   */
  uploadFile(file: File, path: string): Observable<{ success: boolean; url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    return this.http.post<{ success: boolean; url: string }>(
      `${this.apiUrl}/files/upload`,
      formData
    );
  }

  /**
   * Obtener URL temporal de un archivo
   */
  getTemporaryUrl(
    id: number, 
    origen: OrigenArchivo, 
    minutes: number = 60
  ): Observable<{ success: boolean; url: string; expires_in_minutes: number }> {
    return this.http.get<{ success: boolean; url: string; expires_in_minutes: number }>(
      `${this.apiUrl}/files/temporary-url`,
      {
        params: {
          id: id.toString(),
          origen,
          minutes: minutes.toString()
        }
      }
    );
  }

  /**
   * Eliminar archivo
   */
  deleteFile(path: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/files/delete`,
      {
        body: { path }
      }
    );
  }

  /**
   * Verificar si existe un archivo
   */
  fileExists(path: string): Observable<{ success: boolean; exists: boolean }> {
    return this.http.get<{ success: boolean; exists: boolean }>(
      `${this.apiUrl}/files/exists`,
      {
        params: { path }
      }
    );
  }
}