import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface MoldZone {
  id?: number;
  mold_id?: number;
  name: string;
  zone_type: string; // 'manga' | 'pecho' | 'cuello' | 'espalda' | 'pretina' | 'pierna_bota' | 'bragueta' | 'bolsillo_sup' | etc.
  zone_nature?: 'structural' | 'overlay'; // 'structural' (base del molde) o 'overlay' (elemento opcional superpuesto)
  garment_part_id?: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  path_data?: { x: number; y: number }[];
  view: 'front' | 'back';
  color?: string;
}

export interface GenericMaterial {
  id: string;
  name: string;
  type: 'tela' | 'insumo';
  icon?: string;
  description?: string;
  is_default?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MoldService {
  private apiUrl = environment.URL_TECHNICAL_DATA_SHEET;

  // Cache in-memory para evitar peticiones repetidas al filtrar
  private zonePartsCache = new Map<string, any>();
  private allPartsCache$: Observable<any> | null = null;
  private machinesCache$: Observable<any> | null = null;

  constructor(private http: HttpClient) { }

  // --- Helpers ---
  private getUploadHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-S3-Folder': environment.S3_FOLDER || 'produccion'
    });
  }

  /**
   * Invalida el caché en memoria del catálogo para refrescar datos tras cambios
   */
  public clearGarmentPartsCache(): void {
    this.zonePartsCache.clear();
    this.allPartsCache$ = null;
    this.machinesCache$ = null;
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

  updateTechnicalSpec(id: number, data: { mold_id?: number; reference?: string; user_created?: string; parts: any[] }): Observable<any> {
    return this.http.put(`${this.apiUrl}/technical-specs/${id}`, data);
  }

  getTechnicalSpec(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/technical-specs/${id}`);
  }

  convertSpecToOfficialSheet(specId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/technical-specs/${specId}/convert`, {});
  }

  deleteMold(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/molds/${id}`);
  }

  // ==================== MOLD MACHINES ====================

  getMoldMachines(forceRefresh: boolean = false): Observable<any> {
    if (!this.machinesCache$ || forceRefresh) {
      this.machinesCache$ = this.http.get(`${this.apiUrl}/mold-machines`).pipe(
        shareReplay(1)
      );
    }
    return this.machinesCache$;
  }

  createMoldMachine(data: { name: string; code?: string; description?: string; is_active?: boolean }): Observable<any> {
    return this.http.post(`${this.apiUrl}/mold-machines`, data).pipe(
      tap(() => { this.machinesCache$ = null; })
    );
  }

  updateMoldMachine(id: number, data: { name: string; code?: string; description?: string; is_active?: boolean }): Observable<any> {
    return this.http.put(`${this.apiUrl}/mold-machines/${id}`, data).pipe(
      tap(() => { this.machinesCache$ = null; })
    );
  }

  deleteMoldMachine(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/mold-machines/${id}`).pipe(
      tap(() => { this.machinesCache$ = null; })
    );
  }

  // ==================== GARMENT PARTS (CATÁLOGO GLOBAL) ====================

  getGarmentParts(search?: string, isActive?: boolean, zone?: string, forceRefresh: boolean = false): Observable<any> {
    // Si es petición general sin filtros de texto, usar caché compartido
    if (!search && isActive === true && !zone && !forceRefresh && this.allPartsCache$) {
      return this.allPartsCache$;
    }

    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (isActive !== undefined) params = params.set('is_active', isActive.toString());
    if (zone) params = params.set('zone', zone);

    const req$ = this.http.get(`${this.apiUrl}/garment-parts`, { params });

    if (!search && isActive === true && !zone) {
      this.allPartsCache$ = req$.pipe(shareReplay(1));
      return this.allPartsCache$;
    }

    return req$;
  }

  getGarmentPart(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/garment-parts/${id}`);
  }

  createGarmentPart(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/garment-parts`, data).pipe(
      tap(() => this.clearGarmentPartsCache())
    );
  }

  updateGarmentPart(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/garment-parts/${id}`, data).pipe(
      tap(() => this.clearGarmentPartsCache())
    );
  }

  getGarmentPartsByZone(zone: string, forceRefresh: boolean = false): Observable<any> {
    const key = (zone || 'general').toLowerCase();
    if (!forceRefresh && this.zonePartsCache.has(key)) {
      return of(this.zonePartsCache.get(key));
    }
    return this.http.get(`${this.apiUrl}/garment-parts/by-zone/${zone}`).pipe(
      tap((res: any) => {
        if (res && res.success) {
          this.zonePartsCache.set(key, res);
        }
      })
    );
  }

  deleteGarmentPart(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/garment-parts/${id}`).pipe(
      tap(() => this.clearGarmentPartsCache())
    );
  }

  // ==================== SIESA INSUMOS AGRUPADOS ====================

  getGroupedInsumos(query: string = '', grupo: string = '', conStock: boolean = false, bodega: string = 'MP001'): Observable<any> {
    let params = new HttpParams()
      .set('q', query)
      .set('grupo', grupo)
      .set('con_stock', conStock.toString())
      .set('bodega', bodega);
    return this.http.get(`${this.apiUrl}/siesa/insumos/agrupados`, { params });
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

  // ==================== MASTER GENERIC MATERIALS (CRUD) ====================
  private readonly GENERIC_MATERIALS_KEY = 'saint_master_generic_materials';

  private defaultGenericMaterials: GenericMaterial[] = [
    { id: 'mat_1', name: 'Tela Principal', type: 'tela', icon: 'bi-droplet-fill', description: 'Cuerpo base estructural de la prenda', is_default: true },
    { id: 'mat_2', name: 'Tela Contraste / Combinación', type: 'tela', icon: 'bi-palette-fill', description: 'Vivos, solapas, sangrías o piezas de realce', is_default: true },
    { id: 'mat_3', name: 'Tela Forro', type: 'tela', icon: 'bi-layers-fill', description: 'Forro interno o fondos de bolsillo', is_default: true },
    { id: 'mat_4', name: 'Entretela Fusionable', type: 'tela', icon: 'bi-card-heading', description: 'Refuerzo de cuello, puños y pechera', is_default: true },
    { id: 'mat_5', name: 'Malla Transpirable / Mesh', type: 'tela', icon: 'bi-grid-3x3', description: 'Ventilación axilar o en espalda', is_default: true },
    { id: 'mat_6', name: 'Hilo de Confección', type: 'insumo', icon: 'bi-threads', description: 'Hilo de costura al tono de la prenda', is_default: true },
    { id: 'mat_7', name: 'Botones', type: 'insumo', icon: 'bi-record-circle', description: 'Botones para pechera, puños o bolsillos', is_default: true },
    { id: 'mat_8', name: 'Cremallera / Cierre', type: 'insumo', icon: 'bi-distribute-vertical', description: 'Cierre frontal o de bolsillos', is_default: true },
    { id: 'mat_9', name: 'Broches Metálicos', type: 'insumo', icon: 'bi-circle-square', description: 'Broches de presión inoxidables', is_default: true },
    { id: 'mat_10', name: 'Cinta Reflectiva', type: 'insumo', icon: 'bi-brightness-high', description: 'Cinta de alta visibilidad industrial', is_default: true },
    { id: 'mat_11', name: 'Elástico', type: 'insumo', icon: 'bi-arrows-expand', description: 'Elástico de pretina o ajuste de bota', is_default: true },
    { id: 'mat_12', name: 'Marquillas / Etiquetas', type: 'insumo', icon: 'bi-tag-fill', description: 'Marquilla de marca, talla y composición', is_default: true },
    { id: 'mat_13', name: 'Velcro / Contacto', type: 'insumo', icon: 'bi-grip-vertical', description: 'Ajuste en puños, tapas o solapas', is_default: true },
    { id: 'mat_14', name: 'Cordón de Ajuste', type: 'insumo', icon: 'bi-bezier2', description: 'Cordón con terminales plásticas', is_default: true },
    { id: 'mat_15', name: 'Sesgo / Vivo', type: 'insumo', icon: 'bi-dash-lg', description: 'Sesgo de acabado o vivo decorativo', is_default: true },
    { id: 'mat_16', name: 'Ojaletes Metálicos', type: 'insumo', icon: 'bi-circle', description: 'Ojaletes para respiraderos o paso de cordón', is_default: true }
  ];

  getGenericMaterials(): GenericMaterial[] {
    try {
      const stored = localStorage.getItem(this.GENERIC_MATERIALS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading generic materials from localStorage', e);
    }
    this.saveGenericMaterialsToStorage(this.defaultGenericMaterials);
    return [...this.defaultGenericMaterials];
  }

  saveGenericMaterial(material: Partial<GenericMaterial>): GenericMaterial {
    const list = this.getGenericMaterials();
    if (material.id) {
      const idx = list.findIndex(m => m.id === material.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...material } as GenericMaterial;
        this.saveGenericMaterialsToStorage(list);
        return list[idx];
      }
    }
    const newMat: GenericMaterial = {
      id: material.id || 'mat_' + Date.now(),
      name: (material.name || 'Nuevo Material').trim(),
      type: material.type || 'insumo',
      icon: material.icon || (material.type === 'tela' ? 'bi-droplet-fill' : 'bi-box-seam-fill'),
      description: material.description || '',
      is_default: false
    };
    list.push(newMat);
    this.saveGenericMaterialsToStorage(list);
    return newMat;
  }

  deleteGenericMaterial(id: string): void {
    const list = this.getGenericMaterials().filter(m => m.id !== id);
    this.saveGenericMaterialsToStorage(list);
  }

  resetGenericMaterials(): GenericMaterial[] {
    this.saveGenericMaterialsToStorage(this.defaultGenericMaterials);
    return [...this.defaultGenericMaterials];
  }

  private saveGenericMaterialsToStorage(list: GenericMaterial[]): void {
    try {
      localStorage.setItem(this.GENERIC_MATERIALS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Error saving generic materials to localStorage', e);
    }
  }
}
