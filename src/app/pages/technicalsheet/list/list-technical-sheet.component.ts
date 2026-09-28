import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { TechnicalSheetService } from '../../../services/technical-sheet.service';
import { TechnicalDataSheet } from '../../../models/TechnicalDataSheet';
import { tap, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { HTML_HEAD, HTML_FOOTER } from './print-technical-sheet-template';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import moment from 'moment';

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
    downloadCompleteFile: boolean = false;
    statusSearch: string = '';
    currentSearchTerm: string = '';
    currentPageSize: number = 10;
    selectedFile: File | null = null;
    id: number = 0;
    pdfUrl: SafeResourceUrl | null = null;
    versiones: any[] = [];

    constructor(private technicalSheetService: TechnicalSheetService,
        public authService: AuthService,
        private activatedRoute: ActivatedRoute,
        private sanitizer: DomSanitizer,
        private cdr: ChangeDetectorRef) {
    }

    listaTechnicalDataSheet: TechnicalDataSheet[] = [];
    title = 'Listado de fichas técnicas con estado:';


    ngOnInit(): void {
      this.activatedRoute.paramMap.subscribe(params => {
          const newStatus = params.get('status');
          
          // Si el estado cambia (ej: de Desarrollo a Calidad), reseteamos filtros
            if (this.statusSearch !== newStatus) {
              this.statusSearch = newStatus ?? '';
              this.currentSearchTerm = '';
              this.paginator.number = 0;
          }

          // Verificar si debemos restaurar el estado (solo si viene de un "atrás")
          this.activatedRoute.queryParamMap.subscribe(queryParams => {
              if (queryParams.get('restoreState') === 'true') {
                  this.loadStateFromStorage();
              }
              this.loadAllData();
          });
      });  
    }

    private saveStateToStorage(): void {
        const state = {
            page: this.paginator.number,
            pageSize: this.currentPageSize,
            searchTerm: this.currentSearchTerm
        };
        sessionStorage.setItem(`technicalSheetState_${this.statusSearch}`, JSON.stringify(state));
    }

    private loadStateFromStorage(): void {
        const savedState = sessionStorage.getItem(`technicalSheetState_${this.statusSearch}`);
        if (savedState) {
            const state = JSON.parse(savedState);
            this.paginator.number = state.page || 0;
            this.currentPageSize = state.pageSize || 10;
            this.currentSearchTerm = state.searchTerm || '';
        }
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
                next: (response: any) => {
                    console.log('Respuesta cruda del servidor:', response);
                    
                    // El backend de Laravel devuelve un objeto con { success, message, data }
                    // Extraemos el array de la propiedad 'data'
                    if (response && response.data && Array.isArray(response.data)) {
                        this.allTechnicalDataSheet = response.data;
                    } else if (Array.isArray(response)) {
                        // Por si acaso el backend devuelve el array directamente (comportamiento anterior)
                        this.allTechnicalDataSheet = response;
                    } else {
                        console.warn('La respuesta del servidor no tiene el formato esperado:', response);
                        this.allTechnicalDataSheet = [];
                    }
                    
                    // Actualizamos la visualización local
                    this.updateLocalPagination();
                },
                error: (error) => {
                    console.error('Error al obtener los datos:', error);
                    Swal.fire('Error al cargar datos', 'No se han podido cargar las fichas técnicas', 'error');
                    this.allTechnicalDataSheet = [];
                    this.updateLocalPagination();
                }
            });
    }

    /**
     * Inicializa la paginación local con todos los datos
     */
    private initializeLocalPagination(): void {
        // Este método ya no es necesario llamarlo directamente desde loadAllData
        // ya que updateLocalPagination se encarga de aplicar los filtros y la paginación
        // basándose en el estado actual (sea restaurado o inicial).
        this.currentSearchTerm = '';
        this.paginator.number = 0;
        this.updateLocalPagination();
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

        // Guardar estado actual en sessionStorage
        this.saveStateToStorage();

        // Forzar detección de cambios ya que estamos en una operación asíncrona
        this.cdr.markForCheck();
        this.cdr.detectChanges();

        console.log(`Paginación actualizada: Página ${currentPage + 1} de ${totalPages} - Mostrando ${this.listaTechnicalDataSheet.length} de ${totalElements} elementos`);
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

    /**
     * Descarga todas las fichas técnicas actualmente filtradas en formato Excel (.xlsx)
     * Incluye toda la información detallada, especificaciones técnicas y estado de carga de figurines/imágenes.
     */
    exportarListadoExcel(): void {
        if (!this.filteredTechnicalDataSheet || this.filteredTechnicalDataSheet.length === 0) {
            Swal.fire('Sin datos', 'No hay fichas técnicas en el listado filtrado para descargar.', 'info');
            return;
        }

        const isImgLoaded = (val: any): string => {
            if (!val) return 'NO CARGADO';
            const s = String(val).trim().toLowerCase();
            return (s === '' || s === 'null' || s === 'undefined' || s === 'false') ? 'NO CARGADO' : 'CARGADO';
        };

        const datosExportar = this.filteredTechnicalDataSheet.map((ficha: any) => {
            const imgCount = [
                ficha.product_image_1,
                ficha.product_image_2,
                ficha.characteristic_image_1,
                ficha.characteristic_image_2,
                ficha.characteristic_image_3,
                ficha.characteristic_image_4,
                ficha.logo_technical_data_sheet
            ].filter(img => isImgLoaded(img) === 'CARGADO').length;

            return {
                // --- 1. IDENTIFICACIÓN Y GENERALES ---
                'Código Ficha': ficha.id || '',
                'Código Ítem CFIP': ficha.id_item || '',
                'Código Ítem Cliente': ficha.id_item_customer || '',
                'Tipo de Ficha': ficha.technical_data_sheet_type || '',
                'Descripción del Ítem': ficha.item_description || '',
                'Cliente / Empresa': ficha.company_name || '',
                'ID Cliente': ficha.id_company || '',
                'Estado': ficha.status || this.statusSearch || '',
                'Versión': ficha.version || '',
                'Género': ficha.gender || '',
                'Fecha Creación': ficha.date_creation ? moment(ficha.date_creation).format('YYYY-MM-DD HH:mm') : '',
                'Fecha Modificación': ficha.last_update ? moment(ficha.last_update).format('YYYY-MM-DD HH:mm') : '',
                'Creado Por': ficha.user_created || '',
                'Validado Por': ficha.user_validation || '',
                'Aprobado Por': ficha.user_approved || '',

                // --- 2. FIGURINES E IMÁGENES (ESTADO) ---
                'Figurín Delantero': isImgLoaded(ficha.product_image_1),
                'Figurín Trasero': isImgLoaded(ficha.product_image_2),
                'Imagen Detalle 1': isImgLoaded(ficha.characteristic_image_1),
                'Imagen Detalle 2': isImgLoaded(ficha.characteristic_image_2),
                'Imagen Detalle 3': isImgLoaded(ficha.characteristic_image_3),
                'Imagen Detalle 4': isImgLoaded(ficha.characteristic_image_4),
                'Ficha Bordado / Logo': isImgLoaded(ficha.logo_technical_data_sheet),
                'Total Imágenes Cargadas': `${imgCount} de 7`,

                // --- 3. TELAS Y MATERIALES ---
                'Tela Principal': ficha.main_fabric || '',
                'Tela Contraste': ficha.contrast_fabric || '',
                'Composición': ficha.composition || '',
                'Forro': ficha.lining || '',
                'Lista de Materiales (BOM)': ficha.bill_materials || '',

                // --- 4. ESPECIFICACIONES TÉCNICAS Y CONFECCIÓN ---
                'Cuello': ficha.shirt_collar || '',
                'Mangas': ficha.sleeves || '',
                'Puños': ficha.cuffs || '',
                'Bolsillos': ficha.pockets || '',
                'Carteras / Pechera': ficha.purses || '',
                'Ajuste del Frente': ficha.front_adjustment || '',
                'Pretina / Cintura': ficha.waistband || '',
                'Cotilla (Rib)': ficha.rib || ficha.busybody || '',
                'Bota': ficha.boot || '',
                'Entrepierna': ficha.crotch || '',
                'Espalda': ficha.back || '',
                'Hombros': ficha.shoulders || '',
                'Unión de Hombros': ficha.shoulder_union || '',
                'Unión de Mangas': ficha.sleeve_connection || '',
                'Cerrado de Costados': ficha.closed_sides || '',
                'Dobladillo': ficha.hem || '',
                'Capucha': ficha.hood || '',
                'Escote': ficha.neckline || '',
                'Pinzas': ficha.darts || '',
                'Aberturas': ficha.opening || '',
                'Tiras': ficha.straps || '',
                'Cortes': ficha.cuts || '',
                'Tiros': ficha.side_pulls || '',

                // --- 5. INSUMOS, BORDADOS Y APLIQUES ---
                'Botón': ficha.button || '',
                'Ojal': ficha.buttonhole || '',
                'Cierre / Cremallera': ficha.zipper || '',
                'Presillas': ficha.loops || '',
                'Pasadores': ficha.pins || '',
                'Pespuntes': ficha.stitching || '',
                'Puntadas': ficha.stitches || '',
                'Reflectivo': ficha.reflective || '',
                'Bordado': ficha.embroidery || '',
                'Estampado': ficha.stamped || '',
                'Figurado': ficha.figured || '',
                'Descripción Logo': ficha.logo_description || '',

                // --- 6. ACABADOS Y OBSERVACIONES ---
                'Prelavado': ficha.prewash || '',
                'Planchado': ficha.ironing || '',
                'Terminado': ficha.finished || '',
                'Empaque': ficha.packaging || '',
                'Puntos Críticos': ficha.critical_points || '',
                'Tabla de Medidas': ficha.measurement_table || '',
                'Requisitos Cliente': ficha.customer_description || '',
                'Observaciones': ficha.observations || '',
                'Adicionales': ficha.additional || '',
                'Comentarios Edición': ficha.edit_comments || '',
                'Comentarios Calidad (QA)': ficha.qa_comments || ''
            };
        });

        const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(datosExportar);

        // Auto-ajustar anchos de columnas dinámicamente
        const colKeys = Object.keys(datosExportar[0]);
        worksheet['!cols'] = colKeys.map(key => {
            const maxValLength = Math.max(
                key.length,
                ...datosExportar.slice(0, 50).map(row => (row[key as keyof typeof row] || '').toString().length)
            );
            return { wch: Math.min(Math.max(maxValLength + 3, 14), 55) };
        });

        const workbook: XLSX.WorkBook = {
            Sheets: { 'Fichas Técnicas Detalladas': worksheet },
            SheetNames: ['Fichas Técnicas Detalladas']
        };

        const now = moment().format('YYYY-MM-DD_HH-mm');
        const estadoLimpio = this.statusSearch ? this.statusSearch.trim().replace(/\s+/g, '_') : 'TODAS';
        const fileName = `Fichas_Tecnicas_Detalladas_${estadoLimpio}_${now}.xlsx`;

        const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const data: Blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        saveAs(data, fileName);

        Swal.fire({
            icon: 'success',
            title: 'Descarga Detallada Completada',
            html: `Se exportaron <b>${datosExportar.length}</b> fichas técnicas con toda su información técnica y estado de imágenes/figurines.`,
            timer: 2500,
            showConfirmButton: false
        });
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

            const printElement = document.getElementById('print');
            if (!printElement) {
                Swal.fire('Error', 'No se encontró el elemento de impresión', 'error');
                this.loading = false;
                return;
            }

            printContents = printElement.innerHTML.toString();
            printContents = ((printContents as string) + '');

            popupWin = window.open('', '_blank', 'top=0,left=0,height=100%,width=auto');
            if (!popupWin) {
                Swal.fire('Error', 'No se pudo abrir la ventana de impresión', 'error');
                this.loading = false;
                return;
            }

            const htmlContent = `
            <html>
                <!doctype html>
                <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <title>${this.technicalDataSheetCurrent.id_item}</title>
                    ${HTML_HEAD}
                <body onload="setTimeout(function () { window.print(); }, 500); window.onmouseover = function () { setTimeout(function () { window.close(); }, 500); }">
                    ${printContents}
                </body>
                ${HTML_FOOTER}
            </html>
            `;

            popupWin.document.open();
            popupWin.document.write(htmlContent);
            popupWin.document.close();
            this.loading = false;
        }, 1000);
    }

    downloadLogoTechnicalDataSheet(): void {
        if (this.technicalDataSheetCurrent.logo_technical_data_sheet != null) {
            window.location.href = this.technicalDataSheetCurrent.logo_technical_data_sheet;
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

    anularFicha(ficha: any): void {
        Swal.fire({
            title: '¿Está seguro de anular la ficha técnica?',
            text: 'La ficha será marcada como ANULADA y excluida de los listados y reportes activos.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, anular',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.value) {
                this.loading = true;
                this.technicalSheetService.annulFichas([ficha.id]).subscribe({
                    next: () => {
                        this.loading = false;
                        // Remover de los datos locales
                        this.allTechnicalDataSheet = this.allTechnicalDataSheet.filter(obj => obj.id !== ficha.id);
                        this.updateLocalPagination();
                        
                        Swal.fire({
                            title: 'Anulada',
                            text: 'La ficha técnica ha sido anulada correctamente.',
                            icon: 'success',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    },
                    error: (err) => {
                        this.loading = false;
                        console.error(err);
                        Swal.fire({
                            title: 'Error',
                            text: 'Ha ocurrido un error al anular la ficha técnica.',
                            icon: 'error'
                        });
                    }
                });
            }
        });
    }
}