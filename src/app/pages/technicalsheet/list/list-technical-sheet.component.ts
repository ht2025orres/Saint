import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { TechnicalSheetService } from '../../../services/technical-sheet.service';
import { Component, OnInit } from '@angular/core';
import { TechnicalDataSheet } from '../../../models/TechnicalDataSheet';
import { tap } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { HTML_HEAD, HTML_FOOTER } from './print-technical-sheet-template';

@Component({
    selector: 'app-list-technical-sheet',
    templateUrl: './list-technical-sheet.component.html',
    styleUrls: ['./list-technical-sheet.component.css']
})
export class ListTechnicalSheetComponent implements OnInit {

    paginator: any;
    loading = false; // Flag variable
    technicalDataSheetCurrent: TechnicalDataSheet = new TechnicalDataSheet();
    downloadCompleteFile: boolean
    statusSearch: string;

    constructor(private technicalSheetService: TechnicalSheetService,
        public authService: AuthService,
        private activatedRoute: ActivatedRoute) {
    }

    listaTechnicalDataSheet: TechnicalDataSheet[] = [];
    title = 'Listado de fichas técnicas con estado:';


    ngOnInit(): void {
        this.activatedRoute.paramMap.subscribe(params => {
            let page: number = +params.get('page');
            this.statusSearch = params.get('status');
            if (!page) {
                page = 0;
            }

            this.reloadList(page, this.statusSearch);
        });
    }


    reloadList(page: number, status: string) {
        this.loading = true;
        return this.technicalSheetService.getAll(page, status)
            .pipe(
                tap((response: any) => {
                    (response.content as TechnicalDataSheet[]).forEach(ficha => console.log(ficha));
                })
            )
            .subscribe(response => {
                this.listaTechnicalDataSheet = response.content as TechnicalDataSheet[];
                this.paginator = response;
                this.loading = false;
            }, error => Swal.fire('Error al cargar datos', 'No se han podido cargar las fichas', 'error'));
    }

    prepareDownloadTechnicalDataSheet(idItem: number) {
        this.technicalSheetService.getById(idItem)
            .subscribe(obj => {
                this.technicalDataSheetCurrent = new TechnicalDataSheet();
                this.technicalDataSheetCurrent = obj;              
            }, error => {
                Swal.fire('Error de descarga', 'La ficha seleccionada no se puede descargar', 'error');
            });
    }

    downloadTechnicalDataSheet(downloadCompleteFile: boolean) {
        this.loading = true;
        this.downloadCompleteFile = downloadCompleteFile
        setTimeout(() => {
            let printContents;
            let popupWin;

            printContents = document.getElementById('print').innerHTML.toString();
            printContents = ((printContents as string) + '');

            popupWin = window.open('', '_blank', 'top=0,left=0,height=100%,width=auto');
            popupWin.document.open();
            popupWin.document.write(`
            <html>
                <!doctype html>
                <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <title>${this.technicalDataSheetCurrent.idItem}</title>
                    ${HTML_HEAD}
                <body onload="setTimeout(function () { window.print(); }, 500); window.onmouseover = function () { setTimeout(function () { window.close(); }, 500); }">
                    ${printContents}
                </body>
                ${HTML_FOOTER}
            </html>
            `);

            popupWin.document.close();
            this.loading = false;
        }, 1000);
    }

    downloadLogoTechnicalDataSheet(): void{
        if (this.technicalDataSheetCurrent.logoTechnicalDataSheet != null) {
            window.location.href=this.technicalDataSheetCurrent.logoTechnicalDataSheet;
        } else {
            Swal.fire('Error al descargar ficha técnica de bordado', 'No se encontro el documento', 'error');
        }        
    }

    deleteFicha(ficha: TechnicalDataSheet): void {
        Swal.fire({
            title: '¿Esta seguro de eliminar la ficha?',
            text: 'Esta accion no puede ser revertida',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Si, eliminar!',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.value) {
                this.technicalSheetService.deleteFicha(ficha).subscribe(
                    resp => {
                        this.listaTechnicalDataSheet = this.listaTechnicalDataSheet.filter(obj => obj !== ficha);
                        Swal.fire({
                            title: 'Eliminado',
                            html: 'Ficha eliminada correctamente',
                            icon: 'success',
                            timer: 1500,
                            timerProgressBar: true
                        });
                    }, error => {
                        Swal.fire({
                            title: 'Error',
                            html: 'Ha ocurrido un error al eliminar la ficha',
                            icon: 'error',
                            timer: 1500,
                            timerProgressBar: true
                        });
                    }
                );
            }
        });
    }

    searchTechnicalDataSheet(word: string) {
        if (word.trim().length > 2) {
            this.technicalSheetService.searchFicha(word, this.statusSearch)
                .pipe(
                    tap((response: any) => {
                        (response.content as TechnicalDataSheet[]).forEach(ficha => console.log(ficha));
                    })
                )
                .subscribe(resp => {
                    this.listaTechnicalDataSheet = resp.content as TechnicalDataSheet[];
                    this.paginator = resp;
                });
        }
        else if (word.trim().length === 0) {
            this.reloadList(0, this.statusSearch);
        }
    }

    listBySize(size: number) {
        this.loading = true;
        this.technicalSheetService.listTechnicalSheetBySize(size)
            .pipe(
                tap((response: any) => {
                    // Verifica si 'content' está presente antes de iterar
                    if (response.content && Array.isArray(response.content)) {
                        response.content.forEach((ficha: TechnicalDataSheet) => console.log(ficha));
                    } else {
                        console.error('No se encontraron datos en la respuesta');
                    }
                })
            )
            .subscribe({
                next: (response) => {
                    // Asegúrate de que 'content' exista en la respuesta
                    if (response && response.content) {
                        this.listaTechnicalDataSheet = response.content as TechnicalDataSheet[];
                        this.paginator = response;
                    } else {
                        console.error('La respuesta no tiene contenido válido');
                    }
                    this.loading = false;
                },
                error: (err) => {
                    console.error('Error al cargar datos', err);
                    Swal.fire('Error al cargar datos', 'No se han podido cargar las fichas', 'error');
                    this.loading = false;
                }
            });
    }
}
