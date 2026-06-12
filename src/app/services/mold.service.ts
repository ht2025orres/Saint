import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MoldService {
  private apiUrl = environment.URL_TECHNICAL_DATA_SHEET;

  constructor(private http: HttpClient) { }

  // --- Helpers ---
  private getUploadHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-S3-Folder': environment.S3_FOLDER || 'produccion'
    });
  }

  // ==================== MOLDS ====================

  getMolds(): Observable<any> {
    return this.http.get(`${this.apiUrl}/molds`);
  }

  getMold(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/molds/${id}`);
  }

  createMold(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/molds`, data);
  }

  updateMold(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/molds/${id}`, data);
  }

  getComponentsByCategory(categoryId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/molds/components/category/${categoryId}`);
  }

  uploadMoldImage(moldId: number, file: File, view: 'front' | 'back' = 'front'): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('view', view);
    return this.http.post(`${this.apiUrl}/molds/${moldId}/image`, formData, {
      headers: this.getUploadHeaders()
    });
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

  // ==================== MOLD CATEGORIES ====================

  getCategories(): Observable<any> {
    return this.http.get(`${this.apiUrl}/mold-categories`);
  }

  createCategory(data: { name: string; description?: string; keywords?: string[] }): Observable<any> {
    return this.http.post(`${this.apiUrl}/mold-categories`, data);
  }

  updateCategory(id: number, data: { name: string; description?: string; keywords?: string[] }): Observable<any> {
    return this.http.put(`${this.apiUrl}/mold-categories/${id}`, data);
  }

  deleteCategory(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/mold-categories/${id}`);
  }

  uploadCategoryImage(categoryId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/mold-categories/${categoryId}/image`, formData, {
      headers: this.getUploadHeaders()
    });
  }

  suggestCategory(text: string): Observable<any> {
    const params = new HttpParams().set('q', text);
    return this.http.get(`${this.apiUrl}/mold-categories/suggest`, { params });
  }

  getMoldsByCategory(categoryId: number): Observable<any> {
    const params = new HttpParams().set('category_id', categoryId.toString());
    return this.http.get(`${this.apiUrl}/molds`, { params });
  }
}
