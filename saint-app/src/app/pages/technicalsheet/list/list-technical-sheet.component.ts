import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { TechnicalSheetService } from '../../../services/technical-sheet.service';
import { Component, OnInit } from '@angular/core';
import { TechnicalDataSheet } from '../../../models/TechnicalDataSheet';
import { tap,finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { HTML_HEAD, HTML_FOOTER } from './print-technical-sheet-template';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface LoadingProgress {
    current: number;
    total: number;
    percentage: number;
    isComplete: boolean;
}


@Component({
    selector: 'app-list-technical-sheet',
    templateUrl: './list-technical-sheet.component.html',
    styleUrls: ['./list-technical-sheet.component.css']
})
export class ListTechnicalSheetComponent implements OnInit {

     // Datos originales (todos los datos del servidor)
    allTechnicalDataSheet: any[] = [];
    
    // Datos filtrados y paginados para mostrar
    filteredTechnicalDataSheet: TechnicalDataSheet[] = [];
    
    // Configuración de paginación
    paginator: any = {
        number: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
        numberOfElements: 0,
        first: true,
        last: true
    };

    // Estados de carga
    loading = false;
    loadingProgress: LoadingProgress = {
        current: 0,
        total: 0,
        percentage: 0,
        isComplete: false
    };



    technicalDataSheetCurrent: TechnicalDataSheet = new TechnicalDataSheet();
    downloadCompleteFile: boolean
    statusSearch: string;
    currentSearchTerm: string = '';
    currentPageSize: number = 10;
    selectedFile: File | null = null;
    id: number;
    pdfUrl: SafeResourceUrl | null = null;
    versiones: any[] = [];

    constructor(private technicalSheetService: TechnicalSheetService,
        public authService: AuthService,
        private activatedRoute: ActivatedRoute,
      private sanitizer: DomSanitizer) {
    }

    listaTechnicalDataSheet: TechnicalDataSheet[] = [];
    title = 'Listado de fichas técnicas con estado:';


    ngOnInit(): void {
      this.activatedRoute.paramMap.subscribe(params => {
          this.statusSearch = params.get('status');
          this.loadAllData();
      });  
    }

bloquearAtajos = (event: KeyboardEvent): void => {
  // Ctrl+S, Ctrl+U, Ctrl+P o tecla Imprimir Pantalla (PrintScreen)
  if ((event.ctrlKey && ['s', 'u', 'p'].includes(event.key.toLowerCase())) || event.key === 'PrintScreen') {
    event.preventDefault(); // Se bloquea el comportamiento predeterminado
    Swal.fire({
      icon: 'warning',
      title: 'Acción bloqueada',
      text: 'Esta acción ha sido deshabilitada por seguridad.'
    });
  }
};


onFileSelected(event: Event, fichaId?: number): void {
  const input = event.target as HTMLInputElement;

  if (input.files && input.files.length > 0) {
    this.selectedFile = input.files[0];

    if (!fichaId) {
      Swal.fire({
        icon: 'warning',
        title: 'ID no disponible',
        text: 'No se puede subir el documento sin un ID de ficha técnica válido.'
      });
      return;
    }

    this.technicalDataSheetCurrent.id = fichaId; // Guardamos el ID actual para usar luego

    // Confirmación antes de subir el documento
    Swal.fire({
      title: '¿Deseas subir este documento?',
      text: this.selectedFile.name,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, subir',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed && this.selectedFile) {
        this.subirDocumento(); // Procedemos a la carga
      } else {
        this.selectedFile = null;
      }
    });
  }
}



subirDocumento(): void {
    const id = this.technicalDataSheetCurrent?.id; // Obtenemos el ID de la ficha técnica

    // Verificamos que el ID y el archivo sean válidos
    if (!id || !this.selectedFile) {
      return; // Salimos si no hay ID o archivo
    }

    // Llamamos al servicio para subir el documento
    this.technicalSheetService.saveDocumentsTechnicalDataSheet(id, this.selectedFile).subscribe({
      next: (response: any) => {
        Swal.fire({
          icon: 'success',
          title: 'Documento subido',
          text: response.message,
          timer: 2500,
          showConfirmButton: false
        });
        this.selectedFile = null; // Reiniciamos el archivo seleccionado
      },
      error: (err: HttpErrorResponse) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err?.error?.message || 'No se pudo subir el documento.'
        });
      }
    });
  }

  mostrarOpcionesDocumento(id: number): void {
  Swal.fire({
    title: 'Ver Documento',
    text: '¿Qué deseas hacer?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ver Actual',
    cancelButtonText: 'Ver Historial',
    reverseButtons: true
  }).then((result) => {
    if (result.isConfirmed) {
      this.verDocumento(id); // Ver documento actual
    } else if (result.dismiss === Swal.DismissReason.cancel) {
      this.verHistorialVersiones(id); // Ver historial
    }
  });
}

verDocumento(id: number): void {
  this.technicalSheetService.getDocumentByidregister(id).subscribe({
    next: (url: string) => {
      if (url) {
        // Si se recibe una URL válida, se asigna al visor PDF con parámetros para ocultar la barra de herramientas.
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url + '#toolbar=0&navpanes=0&scrollbar=0');
      } else {
        // Si no hay URL, se limpia el visor y se muestra una alerta de error.
        this.pdfUrl = null;
        Swal.fire({
          icon: 'error',
          title: 'No disponible',
          text: 'El documento no está disponible en este momento.'
        });
      }
    },
    error: () => {
      // Si ocurre un error en la petición, se limpia el visor y se muestra una alerta de error.
      this.pdfUrl = null;
      Swal.fire({
        icon: 'error',
        title: 'No disponible',
        text: 'El documento no está disponible en este momento.'
      });
    }
  });
}

verHistorialVersiones(id: number): void {
  this.technicalSheetService.getLastVersions(id).subscribe({
    next: (versiones: any[]) => {
      if (!versiones.length) {
        Swal.fire({
          icon: 'info',
          title: 'Sin historial',
          text: 'No se encontraron versiones anteriores del documento.'
        });
        return;
      }

      let html = '<ul style="text-align: left;">';
      versiones.forEach((doc, index) => {
        html += `
          <li style="margin-bottom: 10px;">
            <strong>Versión ${doc.version_document}</strong>
            <a href="${doc.url}" target="_blank" class="btn btn-sm btn-primary mt-1">
              Ver PDF
            </a>
          </li>`;
      });
      html += '</ul>';

      Swal.fire({
        title: 'Historial de Versiones',
        html: html,
        width: '600px',
        showCloseButton: true,
        showConfirmButton: false
      });
    },
    error: () => {
      Swal.fire({
        icon: 'info',
        title: 'historial de versiones',
        text: 'No se encontraron versiones anteriores del documento.'
      });
    }
  });
}


cerrarPdf(): void {
  this.pdfUrl = null;
}
/**
     * Carga todos los datos desde el servidor
     */
    private loadAllData(): void {
        this.loading = true;
        this.loadingProgress = { 
            current: 0, 
            total: 1, 
            percentage: 0, 
            isComplete: false 
        };
        
        this.technicalSheetService.getAlldb(this.statusSearch)
            .pipe(
                tap(() => {
                    this.loadingProgress.current = 1;
                    this.loadingProgress.percentage = 100;
                }),
                finalize(() => {
                    this.loading = false;
                    this.loadingProgress.isComplete = true;
                })
            )
            .subscribe({
                next: (response: TechnicalDataSheet[]) => {
                    console.log('Datos cargados:', response);
                    this.allTechnicalDataSheet = Array.isArray(response['data']) ? response['data'] : [];
                    this.initializeLocalPagination();
                },
                error: (error) => {
                    console.error('Error al obtener los datos:', error);
                    Swal.fire('Error al cargar datos', 'No se han podido cargar las fichas técnicas', 'error');
                    this.allTechnicalDataSheet = [];
                    this.initializeLocalPagination();
                }
            });
    }

    /**
     * Inicializa la paginación local con todos los datos
     */
    private initializeLocalPagination(): void {
        // Resetear filtros y página actual
        this.currentSearchTerm = '';
        this.paginator.number = 0;
        
        // Aplicar paginación inicial
        this.updateLocalPagination();
        
        console.log(`Datos cargados: ${this.allTechnicalDataSheet.length} fichas técnicas`);
    }

    /**
     * Actualiza la paginación local basada en los datos filtrados
     */
    private updateLocalPagination(): void {
        // Aplicar filtro de búsqueda si existe
        if (this.currentSearchTerm.trim().length > 0) {
            const searchTerm = this.currentSearchTerm.toLowerCase();
            this.filteredTechnicalDataSheet = this.allTechnicalDataSheet.filter(ficha => 
                ficha.id_item?.toString().toLowerCase().includes(searchTerm) ||
                ficha.item_description?.toLowerCase().includes(searchTerm) ||
                ficha.company_name?.toLowerCase().includes(searchTerm) ||
                ficha.technical_data_sheet_type?.toLowerCase().includes(searchTerm) ||
                ficha.last_update?.toLowerCase().includes(searchTerm)
            );
            console.log(this.allTechnicalDataSheet)
        } else {
            this.filteredTechnicalDataSheet = [...this.allTechnicalDataSheet];
        }

        // Calcular paginación
        const totalElements = this.filteredTechnicalDataSheet.length;
        const totalPages = Math.ceil(totalElements / this.currentPageSize) || 1;
        
        // Validar que la página actual esté en rango válido
        if (this.paginator.number >= totalPages) {
            this.paginator.number = Math.max(0, totalPages - 1);
        }
        
        const currentPage = this.paginator.number;
        const startIndex = currentPage * this.currentPageSize;
        const endIndex = Math.min(startIndex + this.currentPageSize, totalElements);

        // Actualizar datos mostrados
        this.listaTechnicalDataSheet = this.filteredTechnicalDataSheet.slice(startIndex, endIndex);

        // Actualizar información del paginador
        this.paginator = {
            number: currentPage,
            size: this.currentPageSize,
            totalElements: totalElements,
            totalPages: totalPages,
            numberOfElements: this.listaTechnicalDataSheet.length,
            first: currentPage === 0,
            last: currentPage === totalPages - 1 || totalPages === 0
        };

        console.log(`Página ${currentPage + 1} de ${totalPages} - Mostrando ${this.listaTechnicalDataSheet.length} de ${totalElements} elementos`);
        console.log(this.listaTechnicalDataSheet);
    }

    /**
     * Maneja el cambio de página desde el componente paginador
     */
    onPageChange(page: number): void {
        if (page >= 0 && page < this.paginator.totalPages) {
            this.paginator.number = page;
            this.updateLocalPagination();
        }
    }

    /**
     * Búsqueda local en tiempo real
     */
    searchTechnicalDataSheet(searchTerm: string): void {
        this.currentSearchTerm = searchTerm.trim();
        this.paginator.number = 0; // Resetear a la primera página
        this.updateLocalPagination();
    }

    /**
     * Cambio de tamaño de página
     */
    listBySize(size: number): void {
        if (size > 0) {
            this.currentPageSize = size;
            this.paginator.number = 0; // Resetear a la primera página
            this.updateLocalPagination();
        }
    }

    /**
     * Recarga los datos desde el servidor
     */
    reloadData(): void {
        this.loadAllData();
    }

    /**
     * Limpia los filtros de búsqueda
     */
    clearSearch(): void {
        this.currentSearchTerm = '';
        this.paginator.number = 0;
        this.updateLocalPagination();
    }

    // ===== MÉTODOS EXISTENTES (sin cambios) =====

    prepareDownloadTechnicalDataSheet(idItem: number): void {
        this.technicalSheetService.getById(idItem)
            .subscribe(obj => {
                this.technicalDataSheetCurrent = new TechnicalDataSheet();
                this.technicalDataSheetCurrent = obj;              
            }, error => {
                Swal.fire('Error de descarga', 'La ficha seleccionada no se puede descargar', 'error');
            });
    }

    downloadTechnicalDataSheet(downloadCompleteFile: boolean): void {
        this.loading = true;
        this.downloadCompleteFile = downloadCompleteFile;
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

    downloadLogoTechnicalDataSheet(): void {
        if (this.technicalDataSheetCurrent.logoTechnicalDataSheet != null) {
            window.location.href = this.technicalDataSheetCurrent.logoTechnicalDataSheet;
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
                        // Remover de los datos locales
                        this.allTechnicalDataSheet = this.allTechnicalDataSheet.filter(obj => obj !== ficha);
                        this.updateLocalPagination();
                        
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
}