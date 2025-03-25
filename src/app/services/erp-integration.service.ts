import { Customer } from './../models/Customer';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {environment} from '../../environments/environment';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ErpIntegrationService {

  private urlEndPoint = `${environment.URL_ERP_INTEGRATION}/v1/customers/`;
  constructor(private http: HttpClient) { }
  

  searchCustomer(word: string): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.urlEndPoint}/${word}`);
  }
}
