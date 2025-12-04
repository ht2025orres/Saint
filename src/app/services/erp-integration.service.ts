import { Customer } from './../models/Customer';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {environment} from '../../environments/environment';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ErpIntegrationService {

  private urlEndPoint = 'https://colegioprovidencia.edu.co/Sdp/app/api/clientes.php';
  constructor(private http: HttpClient) { }

  searchCustomer(word: string): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.urlEndPoint}?term=${word}`);
  }
  // Cargar op con sus items y la descripcion de la prenda
  getItemsByOP(op: string) {
    return this.http.get<any>(`${environment.URL_API_LARAVEL}/siesa/consulta?op[]=${op}`);
  }
}
