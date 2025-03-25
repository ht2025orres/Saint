import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {environment} from '../../environments/environment';
import {Observable, throwError} from 'rxjs';
import {ProductCategory} from '../models/ProductCategory';

@Injectable({
  providedIn: 'root'
})
export class ProductCategoryService {

  private urlEndPoint = `${environment.URL_TECHNICAL_DATA_SHEET}/v1/product/category`;
  constructor(private http: HttpClient) { }
  

  getAll(): Observable<ProductCategory[]> {
    return this.http.get<ProductCategory[]>(`${this.urlEndPoint}`);
  }
}
