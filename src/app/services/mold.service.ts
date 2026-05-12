import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MoldService {
  private apiUrl = environment.URL_API_LARAVEL;

  constructor(private http: HttpClient) {}

  // ==================== MOLDS ====================

  getMolds(): Observable<any> {
    return this.http.get(`${this.apiUrl}/molds`);
  }

  getMold(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/molds/${id}`);
  }

  createMold(data: { name: string; description?: string; id_product_category?: number; parts?: any[] }): Observable<any> {
    return this.http.post(`${this.apiUrl}/molds`, data);
  }

  updateMold(id: number, data: { name: string; description?: string; id_product_category?: number; parts?: any[] }): Observable<any> {
    return this.http.put(`${this.apiUrl}/molds/${id}`, data);
  }

  getComponentsByCategory(categoryId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/molds/components/category/${categoryId}`);
  }

  uploadMoldImage(moldId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/molds/${moldId}/image`, formData);
  }

  // ==================== TECHNICAL SPECS (OPM / FT) ====================

  createTechnicalSpec(data: { mold_id: number; reference?: string; user_created?: string; parts: any[] }): Observable<any> {
    return this.http.post(`${this.apiUrl}/technical-specs`, data);
  }

  getTechnicalSpec(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/technical-specs/${id}`);
  }

  convertSpecToOfficialSheet(specId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/technical-specs/${specId}/convert`, {});
  }

  // ==================== INVENTORY SEARCH ====================

  searchInventory(query: string, bodega: string = 'MP001'): Observable<any> {
    let params = new HttpParams()
      .set('q', query)
      .set('bodega', bodega);
    return this.http.get(`${this.apiUrl}/inventory/search`, { params });
  }
}
