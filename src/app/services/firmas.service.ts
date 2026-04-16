import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FirmaDocumento {
  id: number;
  user_id?: number;
  nombre_firmante?: string;
  email_firmante?: string;
  documento_original_path: string;
  documento_firmado_path?: string;
  estado: string;
  motivo_firma?: string;
  detalles_firma?: any;
  firmado_at?: string;
  created_at: string;
  updated_at: string;
  user?: any;
}

@Injectable({
  providedIn: 'root'
})
export class FirmasService {
  private apiUrl = `${environment.URL_API_LARAVEL}/firmas`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<{ success: boolean; data: FirmaDocumento[] }> {
    return this.http.get<{ success: boolean; data: FirmaDocumento[] }>(this.apiUrl);
  }

  signDocument(formData: FormData): Observable<{ success: boolean; message: string; data: FirmaDocumento }> {
    return this.http.post<{ success: boolean; message: string; data: FirmaDocumento }>(this.apiUrl, formData);
  }

  getDownloadUrl(id: number): Observable<{ success: boolean; url: string }> {
    return this.http.get<{ success: boolean; url: string }>(`${this.apiUrl}/${id}`);
  }

  delete(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }
}
