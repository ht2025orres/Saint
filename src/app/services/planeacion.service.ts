import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface OP {
  id: number;
  codigo: string;
  fecha_creacion?: string;
  estado?: string;
}

export interface ItemSiesa {
  seleccionado: boolean;
  pv: number;
  codigo_item: string;
  referencia: string;
  descripcion: string;
  cantidad: number;
  cliente?: string;
}

export interface OPSeleccionada {
  numero: number;
  completa: boolean;
  pvs?: PVSeleccionada[];
  expandida?: boolean;
}

export interface PVSeleccionada {
  numero: number;
  completa: boolean;
  items?: string[];
}

export interface Planeacion {
  id?: number;
  codigo?: string;
  estado?: string;
  ops: OPSeleccionada[];
  observaciones?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlaneacionService {
  private apiUrl = environment.URL_API_LARAVEL;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getUsuarioActual(): number {
    return this.authService.user?.id || 0;
  }

  obtenerOPs(): Observable<{ success: boolean; data: OP[] }> {
    return this.http.get<any>(`${this.apiUrl}/siesa/consultar?ops=true`);
  }

  obtenerPVsDeOP(opNumero: number): Observable<{ success: boolean; data: { pvs: number[]; items: ItemSiesa[] } }> {
    return this.http.get<any>(`${this.apiUrl}/siesa/consultar?op=${opNumero}`);
  }

  // obtenerItemsDePV(pvNumero: number): Observable<{ success: boolean; data: { items: ItemSiesa[] } }> {
  //   return this.http.get<any>(`${this.apiUrl}/siesa/consultar?pv=${pvNumero}`);
  // }

  obtenerItemsDePV(pvNumero: number): Observable<{ 
    success: boolean; 
    tipo: string;
    pvs: number[]; 
    items: ItemSiesa[] 
  }> {
    return this.http.get<{ 
      success: boolean; 
      tipo: string;
      pvs: number[]; 
      items: ItemSiesa[] 
    }>(`${this.apiUrl}/siesa/consultar?pv=${pvNumero}`);
  }

  crearPlaneacion(planeacion: Planeacion): Observable<{ success: boolean; data: any; message: string }> {
    return this.http.post<any>(`${this.apiUrl}/planeaciones`, {
      ...planeacion,
      usuario_id: this.getUsuarioActual()
    });
  }

  actualizarPlaneacion(id: number, planeacion: Planeacion): Observable<{ success: boolean; data: any }> {
    return this.http.put<any>(`${this.apiUrl}/planeaciones/${id}`, {
      ...planeacion,
      usuario_id: this.getUsuarioActual()
    });
  }

  obtenerPlaneaciones(filtros?: any): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<any>(`${this.apiUrl}/planeaciones`, { params: filtros });
  }

  obtenerDetallePlaneacion(id: number): Observable<{ success: boolean; data: any }> {
    return this.http.get<any>(`${this.apiUrl}/planeaciones/${id}`);
  }
}