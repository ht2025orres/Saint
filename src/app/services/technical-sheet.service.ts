import {Injectable} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {environment} from '../../environments/environment';
import {TechnicalDataSheet} from '../models/TechnicalDataSheet';
import {Observable, throwError} from 'rxjs';
import {catchError, map, tap} from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class TechnicalSheetService {

    private urlEndPoint = `${environment.URL_TECHNICAL_DATA_SHEET}/v1/technical/data/sheet`;
    private urlEndPointSaint = `${environment.URL_API_LARAVEL}`;
    constructor(private http: HttpClient) {
    }

    saveDocumentsTechnicalDataSheet(id: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('id_register_item_document', id.toString());
    formData.append('documento', file);

    return this.http.post(`${this.urlEndPointSaint}/document/save`, formData);
    }

    getDocumentByidregister(id: number): Observable<string> {
    return this.http.get<{ url: string }>(`${this.urlEndPointSaint}/get-document-technical-data-sheet/${id}`)
        .pipe(map(response => response.url));
    }

    // Obtener historial completo de versiones por ID
    getLastVersions(id: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.urlEndPointSaint}/document/last-versions/${id}`);
    }

    getAlldb(status: string): Observable<any> {
        return this.http.post(`${this.urlEndPointSaint}/technicaldatasheet/list`, {status});
    }
    
    // getAll(page: number, status: string): Observable<TechnicalDataSheet[]> {
    //     return this.http.get(`${this.urlEndPoint}/page/${page}/status/${status}`)
    //         .pipe(
    //             tap((response: any) =>
    //                 (response.content as TechnicalDataSheet[]).forEach(ficha => console.log(ficha)))
    //         );
    // }

    saveFicha(technicalDataSheet: TechnicalDataSheet): Observable<any> {
        if (technicalDataSheet.id != null){
            return this.http.put(`${this.urlEndPoint}`, technicalDataSheet);
        }
        return this.http.post(`${this.urlEndPoint}`, technicalDataSheet);
    }

    saveProductImages(id: number, idCompany: string, idItem: string, formData: FormData): Observable<any>{
        return this.http.put(`${this.urlEndPoint}/product/images/${id}/${idCompany}/${idItem}`, formData);
    }

    saveCharacteristicImages(id: number, idCompany: string, idItem: string, formData: FormData): Observable<any>{
        return this.http.put(`${this.urlEndPoint}/product/characteristic/images/${id}/${idCompany}/${idItem}`, formData);
    }

    saveLogoTechnicalDataSheetFile(id: number, idCompany: string, idItem: string, formData: FormData): Observable<any>{
        return this.http.put(`${this.urlEndPoint}/product/embroidery/files/${id}/${idCompany}/${idItem}`, formData);
    }

    getById(id: number): Observable<TechnicalDataSheet> {
        return this.http.get<TechnicalDataSheet>(`${this.urlEndPoint}/${id}`);
    }

    deleteFicha(ficha: TechnicalDataSheet) {
        return this.http.delete(`${this.urlEndPoint}/${ficha.id}`);
    }

    searchFicha(word: string, status: string) {
        return this.http.get<TechnicalDataSheet[]>(`${this.urlEndPoint}/search/${word}/status/${status}`)
            .pipe(
                tap((response: any) =>
                    (response.content as TechnicalDataSheet[]).forEach(ficha => console.log(ficha)))
            );
    }

    listTechnicalSheetBySize(size: number): Observable<TechnicalDataSheet[]> {
        return this.http.get(`${this.urlEndPoint}/size/` + size)
            .pipe(
                tap((response: any) =>
                    (response.content as TechnicalDataSheet[]).forEach(ficha => console.log(ficha)))
            );
    }

    updateStatus(id: number, status: string) {
        return this.http.put(`${this.urlEndPoint}/status/${id}/${status}`, null);
    }

    validateExistsTechnicalSheetByIdItem(idItem: string): Observable<any> {
        return this.http.get(`${this.urlEndPoint}/exists/${idItem}`);
    }
}