import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { TechnicalDataSheet } from '../models/TechnicalDataSheet';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TechnicalDataSheetsReportService {
  private urlEndPoint = `${environment.URL_REPORT_TECHNICAL_DATA_SHEETS}`;
  constructor(private http: HttpClient) { }

    // Método para obtener los datos de la API
    getAlldb(): Observable<TechnicalDataSheet[]> {
        return this.http.get<TechnicalDataSheet[]>(this.urlEndPoint);
    }
}