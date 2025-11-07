import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

interface BillingDataResponse {
  totalPresupuesto: number;
  totalReal: number;
  totalDiferencia: number;
  porcentajeEjecutado: number;
  detalleUnidades: Array<{
    unidad: string;
    descripcion: string;
    presupuesto: number;
    real: number;
    diferencia: number;
    porcentajeEjecutado: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  private apiUrl = `${environment.URL_API_LARAVEL}/billing`;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene datos de facturación por año, plan y periodo
   */
  getBillingData(year: number, plan: string, periodo: number): Observable<BillingDataResponse> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('plan', plan)
      .set('periodo', periodo.toString());

    return this.http.get<BillingDataResponse>(`${this.apiUrl}/budget-summary`, { params });
  }

  /**
   * Obtiene presupuesto por unidad de negocio
   */
  getBudgetByBusinessUnit(year: number, plan: string, periodo: number): Observable<any[]> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('plan', plan)
      .set('periodo', periodo.toString());

    return this.http.get<any[]>(`${this.apiUrl}/budget-by-unit`, { params });
  }

  /**
   * Obtiene detalle de facturas por periodo
   */
  getInvoiceDetail(year: number, month: number, unidad?: string): Observable<any[]> {
    let params = new HttpParams()
      .set('year', year.toString())
      .set('month', month.toString());

    if (unidad) {
      params = params.set('unidad', unidad);
    }

    return this.http.get<any[]>(`${this.apiUrl}/invoice-detail`, { params });
  }

  /**
   * Obtiene remisiones pendientes de facturar
   */
  getPendingShipments(unidad?: string, fechaHasta?: string): Observable<any[]> {
    let params = new HttpParams();

    if (unidad) {
      params = params.set('unidad', unidad);
    }
    if (fechaHasta) {
      params = params.set('fecha_hasta', fechaHasta);
    }

    return this.http.get<any[]>(`${this.apiUrl}/pending-shipments`, { params });
  }

  /**
   * Obtiene histórico mensual de facturación
   */
  getMonthlyHistory(year: number, unidad?: string): Observable<any[]> {
    let params = new HttpParams().set('year', year.toString());

    if (unidad) {
      params = params.set('unidad', unidad);
    }

    return this.http.get<any[]>(`${this.apiUrl}/monthly-history`, { params });
  }
}