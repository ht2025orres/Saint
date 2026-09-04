import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DocumentoFirmaService, DocumentoFirma, DocumentoFirmaEtiqueta } from 'src/app/services/documento-firma.service';
import { AuthService } from 'src/app/services/auth.service';
import { environment } from 'src/environments/environment';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-firmas-lista',
  templateUrl: './firmas-lista.component.html',
  styleUrls: ['./firmas-lista.component.css']
})
export class FirmasListaComponent implements OnInit {
  documentos: DocumentoFirma[] = [];

  get esAdmin(): boolean {
    return this.authService.hasPermission(1);
  }

  etiquetasList: DocumentoFirmaEtiqueta[] = [];
  loading = false;
  search: string = '';
  estadoFiltro: string = '';
  etiquetaFiltro: string = '';
  selectedDocDetail: DocumentoFirma | null = null;
  showDetailModal: boolean = false;
  mostrarModalEtiquetas: boolean = false;

  // Modal Agregar / Editar firmante
  showModalFirmante: boolean = false;
  modalFirmanteMode: 'add' | 'edit' = 'add';
  modalFirmanteDocId: number | null = null;
  modalFirmanteDestId: number | null = null;
  modalFirmanteData: any = {
    colaborador_id: null,
    tipo_correo: 'corporativo',
    pagina: 1,
    posicion_x: 10,
    posicion_y: 200,
    ancho: 110,
    alto: 30,
    tipo_firma_requerida: 'AMBAS',
    enviar_correo: true
  };
  submittingFirmante: boolean = false;

  // Visual PDF Placement & Dragging
  pdfDoc: any = null;
  paginaPdf: number = 1;
  totalPagesPdf: number = 0;
  zoomPdf: number = 1.0;
  pdfViewportWidth: number = 595;
  pdfViewportHeight: number = 842;
  loadingPdf: boolean = false;
  private pdfLib: any = null;

  isDragging: boolean = false;
  dragStartX: number = 0;
  dragStartY: number = 0;
  ghostX: number = 0;
  ghostY: number = 0;
  ghostW: number = 110;
  ghostH: number = 30;
  showGhost: boolean = true;
  currentDocumentPdfUrl: string = '';
  currentDocumentDestinatarios: any[] = [];

  // Buscador de colaboradores para el modal
  colaboradoresList: any[] = [];
  colaboradorSearch: string = '';
  colaboradoresFiltrados: any[] = [];
  mostrarDropdownColab: boolean = false;
  selectedColab: any = null;

  // ============================
  // GOOGLE DRIVE STYLE MANAGEMENT
  // ============================
  viewMode: 'folders' | 'grid' | 'table' = 'folders';
  filtroAnio: string = '';
  filtroMes: string = '';
  filtroProceso: string = '';
  selectedFolderType: 'etiqueta' | 'anio_mes' | 'estado' | 'proceso' | null = null;
  selectedFolderKey: string | null = null;
  selectedFolderName: string = 'Mi Unidad';

  switchViewMode(mode: 'folders' | 'grid' | 'table'): void {
    this.viewMode = mode;
    if (mode === 'folders') {
      this.selectedFolderType = null;
      this.selectedFolderKey = null;
      this.selectedFolderName = 'Mi Unidad';
    }
  }

  mesesList = [
    { key: '01', name: 'Enero' },
    { key: '02', name: 'Febrero' },
    { key: '03', name: 'Marzo' },
    { key: '04', name: 'Abril' },
    { key: '05', name: 'Mayo' },
    { key: '06', name: 'Junio' },
    { key: '07', name: 'Julio' },
    { key: '08', name: 'Agosto' },
    { key: '09', name: 'Septiembre' },
    { key: '10', name: 'Octubre' },
    { key: '11', name: 'Noviembre' },
    { key: '12', name: 'Diciembre' }
  ];

  // Papelera y Selección Múltiple
  verPapelera: boolean = false;
  selectedDocIds: number[] = [];
  selectAllDocs: boolean = false;
  showDeleteModal: boolean = false;
  deleteReason: string = '';
  submittingDelete: boolean = false;

  private baseUrl = environment.URL_API_LARAVEL;

  constructor(
    private docFirmaService: DocumentoFirmaService,
    public authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadPdfLib();
    this.cargarEtiquetas();
    this.cargarDocumentos();
    this.loadColaboradores();
  }

  private loadColaboradores(): void {
    this.http.get<any>(`${this.baseUrl}/colaboradores?per_page=all&estado=activo`).subscribe({
      next: (res) => {
        const raw = res.data || res || [];
        this.colaboradoresList = raw.map((c: any) => ({
          ...c,
          firstName: c.nombres || c.firstName,
          lastName: c.apellidos || c.lastName,
          email: c.correo_corporativo || c.correo_personal || c.email
        }));
      },
      error: (err) => console.error('Error cargando colaboradores:', err)
    });
  }

  cargarEtiquetas(): void {
    this.docFirmaService.getEtiquetas().subscribe({
      next: (res: any) => {
        this.etiquetasList = res.data ?? [];
      },
      error: (err: any) => console.error('Error cargando etiquetas:', err)
    });
  }

  cargarDocumentos(): void {
    this.loading = true;
    this.docFirmaService.getDocumentos(1, this.search, this.estadoFiltro, this.etiquetaFiltro, this.verPapelera).subscribe({
      next: (resp: any) => {
        this.documentos = resp.data?.data ?? [];
        this.loading = false;
      },
      error: (err: any) => {
        console.error(err);
        Swal.fire('Error', 'No fue posible cargar el listado de documentos de firma', 'error');
        this.loading = false;
      }
    });
  }

  togglePapelera(modoPapelera: boolean): void {
    this.verPapelera = modoPapelera;
    this.selectedDocIds = [];
    this.selectAllDocs = false;
    this.limpiarSeleccionCarpeta();
    if (modoPapelera && this.viewMode === 'folders') {
      this.viewMode = 'table';
    }
    this.cargarDocumentos();
  }

  toggleSelectAllDocs(event: any): void {
    this.selectAllDocs = event.target.checked;
    if (this.selectAllDocs) {
      this.selectedDocIds = this.documentos.map(d => d.id!).filter(Boolean);
    } else {
      this.selectedDocIds = [];
    }
  }

  toggleSelectDoc(docId: number, event: any): void {
    if (event.target.checked) {
      if (!this.selectedDocIds.includes(docId)) {
        this.selectedDocIds.push(docId);
      }
    } else {
      this.selectedDocIds = this.selectedDocIds.filter(id => id !== docId);
    }
    this.selectAllDocs = this.selectedDocIds.length === this.documentos.length && this.documentos.length > 0;
  }

  isDocSelected(docId: number): boolean {
    return this.selectedDocIds.includes(docId);
  }

  abrirModalEliminarMasivo(doc?: DocumentoFirma): void {
    if (doc && doc.id) {
      this.selectedDocIds = [doc.id];
    }
    if (this.selectedDocIds.length === 0) {
      Swal.fire('Atención', 'Selecciona al menos un documento para mover a la papelera', 'warning');
      return;
    }
    this.deleteReason = '';
    this.showDeleteModal = true;
  }

  cerrarModalEliminarMasivo(): void {
    this.showDeleteModal = false;
    this.deleteReason = '';
  }

  confirmarEliminarMasivo(): void {
    if (!this.deleteReason.trim()) {
      Swal.fire('Atención', 'Debes ingresar una razón o motivo para deshabilitar el documento', 'warning');
      return;
    }

    this.submittingDelete = true;
    this.docFirmaService.eliminarMasivo(this.selectedDocIds, this.deleteReason).subscribe({
      next: (resp: any) => {
        Swal.fire('Movido a Papelera', resp.message || 'Documentos deshabilitados exitosamente', 'success');
        this.submittingDelete = false;
        this.cerrarModalEliminarMasivo();
        this.selectedDocIds = [];
        this.selectAllDocs = false;
        this.cargarDocumentos();
      },
      error: (err: any) => {
        Swal.fire('Error', err.error?.message || 'Error al deshabilitar documentos', 'error');
        this.submittingDelete = false;
      }
    });
  }

  restaurarMasivo(doc?: DocumentoFirma): void {
    const ids = doc && doc.id ? [doc.id] : this.selectedDocIds;
    if (ids.length === 0) {
      Swal.fire('Atención', 'Selecciona al menos un documento para restaurar', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Restaurar documentos?',
      text: `Se restaurarán ${ids.length} documento(s) deshabilitado(s) a la lista activa`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, restaurar',
      cancelButtonText: 'Cancelar'
    }).then(res => {
      if (res.isConfirmed) {
        this.docFirmaService.restaurarMasivo(ids).subscribe({
          next: (resp: any) => {
            Swal.fire('Restaurados', resp.message || 'Documentos restaurados con éxito', 'success');
            this.selectedDocIds = [];
            this.selectAllDocs = false;
            this.cargarDocumentos();
          },
          error: (err: any) => {
            Swal.fire('Error', err.error?.message || 'Error al restaurar documentos', 'error');
          }
        });
      }
    });
  }

  cambiarEtiquetaDocumento(doc: DocumentoFirma): void {
    const optionsHtml = `
      <div class="text-left text-xs font-medium text-slate-700">
        <label class="block mb-2 font-bold text-slate-800">Selecciona la nueva etiqueta para "${doc.titulo}":</label>
        <select id="swal-select-etiqueta" class="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-blue-500">
          <option value="">(Sin Etiqueta / General)</option>
          ${this.etiquetasList.map(e => `<option value="${e.id}" ${doc.etiqueta_id === e.id ? 'selected' : ''}>🏷️ ${e.nombre}</option>`).join('')}
        </select>
      </div>
    `;

    Swal.fire({
      title: 'Cambiar Etiqueta',
      html: optionsHtml,
      showCancelButton: true,
      confirmButtonText: 'Guardar Etiqueta',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
      preConfirm: () => {
        const select = document.getElementById('swal-select-etiqueta') as HTMLSelectElement;
        return select ? select.value : null;
      }
    }).then((res) => {
      if (res.isConfirmed) {
        const newEtiquetaId = res.value ? parseInt(res.value, 10) : null;
        this.docFirmaService.updateDocumento(doc.id!, { etiqueta_id: newEtiquetaId }).subscribe({
          next: (resp: any) => {
            Swal.fire('Etiqueta Actualizada', 'La etiqueta del documento ha sido actualizada correctamente.', 'success');
            this.cargarDocumentos();
          },
          error: (err: any) => {
            Swal.fire('Error', err.error?.message || 'No fue posible actualizar la etiqueta', 'error');
          }
        });
      }
    });
  }

  pdfDocDetailModal: any = null;
  paginaPdfDetailModal: number = 1;
  totalPagesPdfDetailModal: number = 0;
  zoomPdfDetailModal: number = 1.0;
  loadingPdfDetailModal: boolean = false;

  verDetalle(doc: DocumentoFirma): void {
    this.selectedDocDetail = doc;
    this.showDetailModal = true;
    this.paginaPdfDetailModal = 1;
    this.zoomPdfDetailModal = 1.0;
    const url = doc.pdf_url || (doc as any).s3_direct_url;
    if (url) {
      this.loadPdfDetailModal(url);
    } else {
      this.pdfDocDetailModal = null;
    }
  }

  loadPdfDetailModal(pdfUrl: string): void {
    if (!pdfUrl) return;
    this.loadingPdfDetailModal = true;

    if (!this.pdfLib) {
      this.loadPdfLib();
      setTimeout(() => this.loadPdfDetailModal(pdfUrl), 300);
      return;
    }

    this.http.get(pdfUrl, { responseType: 'arraybuffer' }).subscribe({
      next: async (buffer: ArrayBuffer) => {
        try {
          const typedarray = new Uint8Array(buffer);
          this.pdfDocDetailModal = await this.pdfLib.getDocument(typedarray).promise;
          this.totalPagesPdfDetailModal = this.pdfDocDetailModal.numPages;
          this.paginaPdfDetailModal = 1;
          this.loadingPdfDetailModal = false;
          setTimeout(() => this.renderPageDetailModal(1), 150);
        } catch (err) {
          console.error('Error cargando PDF en modal detalle:', err);
          this.loadingPdfDetailModal = false;
        }
      },
      error: (err) => {
        console.warn('HTTP interceptor error descargando PDF para detalle, intentando con fetch nativo:', err);
        fetch(pdfUrl)
          .then(res => res.arrayBuffer())
          .then(async (buffer) => {
            const typedarray = new Uint8Array(buffer);
            this.pdfDocDetailModal = await this.pdfLib.getDocument(typedarray).promise;
            this.totalPagesPdfDetailModal = this.pdfDocDetailModal.numPages;
            this.paginaPdfDetailModal = 1;
            this.loadingPdfDetailModal = false;
            setTimeout(() => this.renderPageDetailModal(1), 150);
          })
          .catch(fetchErr => {
            console.error('Error final cargando PDF para detalle:', fetchErr);
            this.loadingPdfDetailModal = false;
          });
      }
    });
  }

  async renderPageDetailModal(num: number): Promise<void> {
    if (!this.pdfDocDetailModal) return;

    try {
      const page = await this.pdfDocDetailModal.getPage(num);
      const viewport = page.getViewport({ scale: this.zoomPdfDetailModal });

      const canvas = document.getElementById('pdf-canvas-detail-modal') as HTMLCanvasElement;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
    } catch (e) {
      console.error('Error renderizando página PDF detalle:', e);
    }
  }

  changePageDetailModal(delta: number): void {
    const newPage = this.paginaPdfDetailModal + delta;
    if (newPage >= 1 && newPage <= this.totalPagesPdfDetailModal) {
      this.paginaPdfDetailModal = newPage;
      this.renderPageDetailModal(this.paginaPdfDetailModal);
    }
  }

  goToFirstPageDetailModal(): void {
    if (this.paginaPdfDetailModal > 1) {
      this.paginaPdfDetailModal = 1;
      this.renderPageDetailModal(1);
    }
  }

  goToLastPageDetailModal(): void {
    if (this.paginaPdfDetailModal < this.totalPagesPdfDetailModal) {
      this.paginaPdfDetailModal = this.totalPagesPdfDetailModal;
      this.renderPageDetailModal(this.totalPagesPdfDetailModal);
    }
  }

  onPageInputDetailModal(event: any): void {
    const val = parseInt(event.target ? event.target.value : event, 10);
    if (!isNaN(val) && val >= 1 && val <= this.totalPagesPdfDetailModal) {
      this.paginaPdfDetailModal = val;
      this.renderPageDetailModal(val);
    } else if (event.target) {
      event.target.value = this.paginaPdfDetailModal;
    }
  }

  changeZoomDetailModal(delta: number): void {
    const newZoom = this.zoomPdfDetailModal + delta;
    if (newZoom >= 0.5 && newZoom <= 2.5) {
      this.zoomPdfDetailModal = newZoom;
      this.renderPageDetailModal(this.paginaPdfDetailModal);
    }
  }

  descargarPdf(doc: DocumentoFirma): void {
    const url = (doc as any).s3_direct_url || doc.pdf_url;
    if (url) {
      window.open(url, '_blank');
    } else {
      Swal.fire('Atención', 'El enlace de descarga del PDF no está disponible', 'warning');
    }
  }

  reenviarInvitacion(destinatarioId: number): void {
    Swal.fire({
      title: '¿Reenviar Invitación?',
      text: 'Se enviará nuevamente el correo con el enlace directo de firma.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, Reenviar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb'
    }).then((res) => {
      if (res.isConfirmed) {
        this.docFirmaService.reenviarCorreo(destinatarioId).subscribe({
          next: (resp: any) => {
            Swal.fire('Enviado', resp.message || 'Correo reenviado exitosamente', 'success');
            this.cargarDocumentos();
          },
          error: (err: any) => {
            Swal.fire('Error', err.error?.message || 'No fue posible reenviar el correo', 'error');
          }
        });
      }
    });
  }

  // ============================
  // REINICIAR / RE-SOLICITAR FIRMA (REMOVER SELLO DEL PDF)
  // ============================
  reiniciarFirma(dest: any): void {
    Swal.fire({
      title: '¿Re-solicitar y Reiniciar Firma?',
      html: `
        <p class="text-xs text-slate-600 mb-2">Esto realizará las siguientes acciones para <strong>${dest.nombre_firmante}</strong>:</p>
        <ul class="text-xs text-left text-slate-700 bg-amber-50 p-3 rounded-xl border border-amber-200 list-disc pl-5 space-y-1">
          <li>Removerá su sello del documento PDF de forma limpia.</li>
          <li>Revertirá su estado de firma a <strong>PENDIENTE</strong>.</li>
          <li>Le enviará un nuevo correo de invitación con su enlace directo.</li>
        </ul>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, Reiniciar y Reenviar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb'
    }).then((result) => {
      if (result.isConfirmed) {
        this.docFirmaService.resetDestinatario(dest.id!).subscribe({
          next: (resp: any) => {
            Swal.fire('¡Firma Reiniciada!', resp.message || 'La firma fue removida del PDF y se envió una nueva solicitud.', 'success');
            this.cargarDocumentos();
          },
          error: (err: any) => {
            Swal.fire('Error', err.error?.message || 'No fue posible reiniciar la firma', 'error');
          }
        });
      }
    });
  }

  // ============================
  // DESHABILITAR / HABILITAR FIRMA
  // ============================
  toggleEstadoFirma(dest: any): void {
    const isDisabled = dest.estado === 'DESHABILITADO' || dest.estado === 'CANCELADO';
    const accion = isDisabled ? 'habilitar' : 'deshabilitar';

    Swal.fire({
      title: `¿${isDisabled ? 'Habilitar' : 'Deshabilitar'} Firma?`,
      html: `<p class="text-sm text-slate-600">Esto ${isDisabled ? 'reactivará' : 'deshabilitará'} la solicitud de firma de <strong>${dest.nombre_firmante}</strong>.</p>`,
      icon: isDisabled ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: isDisabled ? 'Sí, Habilitar' : 'Sí, Deshabilitar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: isDisabled ? '#2563eb' : '#ef4444'
    }).then((result) => {
      if (result.isConfirmed) {
        this.docFirmaService.toggleEstadoDestinatario(dest.id!).subscribe({
          next: (resp: any) => {
            Swal.fire('¡Listo!', resp.message, 'success');
            this.cargarDocumentos();
          },
          error: (err: any) => {
            Swal.fire('Error', err.error?.message || `No fue posible ${accion} la firma`, 'error');
          }
        });
      }
    });
  }

  // ============================
  // SINCRONIZAR PROCESOS DE FIRMANTES
  // ============================
  sincronizandoProcesos: boolean = false;

  sincronizarProcesosFirmantes(documentoId?: number): void {
    const tituloMsg = documentoId 
      ? '¿Sincronizar procesos de los firmantes de este documento?'
      : '¿Sincronizar procesos de los firmantes de todos los documentos?';

    Swal.fire({
      title: tituloMsg,
      text: 'Se actualizarán los nombres de los procesos de los firmantes basados en su asignación actual en el módulo de Seguridad.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, Sincronizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5'
    }).then((res) => {
      if (res.isConfirmed) {
        this.sincronizandoProcesos = true;
        this.docFirmaService.sincronizarProcesosFirmantes(documentoId).subscribe({
          next: (resp: any) => {
            this.sincronizandoProcesos = false;
            Swal.fire('¡Sincronizado! ✅', resp.message || 'Se han actualizado los departamentos de los firmantes.', 'success');
            this.cargarDocumentos();
            if (this.showDetailModal && this.selectedDocDetail) {
              this.verDetalle(this.selectedDocDetail);
            }
          },
          error: (err: any) => {
            this.sincronizandoProcesos = false;
            Swal.fire('Error', err.error?.message || 'Ocurrió un error al sincronizar los procesos de los firmantes', 'error');
          }
        });
      }
    });
  }

  // ============================
  // ELIMINAR FIRMANTE
  // ============================
  eliminarFirmante(dest: any): void {
    Swal.fire({
      title: '¿Eliminar Firmante?',
      html: `<p class="text-sm text-slate-600">Se eliminará a <strong>${dest.nombre_firmante}</strong> de este documento de forma permanente.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (result.isConfirmed) {
        this.docFirmaService.destroyDestinatario(dest.id!).subscribe({
          next: (resp: any) => {
            Swal.fire('Eliminado', resp.message || 'Firmante eliminado exitosamente', 'success');
            this.cargarDocumentos();
          },
          error: (err: any) => {
            Swal.fire('Error', err.error?.message || 'No fue posible eliminar al firmante', 'error');
          }
        });
      }
    });
  }

  // ============================
  // PDF JS & VISUAL POSITIONING
  // ============================
  private loadPdfLib(): void {
    const scriptId = 'pdf-js-script-lista';
    if (document.getElementById(scriptId)) {
      this.pdfLib = (window as any).pdfjsLib;
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      this.pdfLib = (window as any).pdfjsLib;
      this.pdfLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    };
    document.head.appendChild(script);
  }

  loadPdfPreview(pdfUrl: string): void {
    if (!pdfUrl) return;
    this.loadingPdf = true;
    this.currentDocumentPdfUrl = pdfUrl;

    if (!this.pdfLib) {
      this.loadPdfLib();
      setTimeout(() => this.loadPdfPreview(pdfUrl), 300);
      return;
    }

    this.http.get(pdfUrl, { responseType: 'arraybuffer' }).subscribe({
      next: async (buffer: ArrayBuffer) => {
        try {
          const typedarray = new Uint8Array(buffer);
          this.pdfDoc = await this.pdfLib.getDocument(typedarray).promise;
          this.totalPagesPdf = this.pdfDoc.numPages;
          this.paginaPdf = this.modalFirmanteData.pagina || 1;
          this.loadingPdf = false;
          setTimeout(() => this.renderPage(this.paginaPdf), 150);
        } catch (err) {
          console.error('Error cargando PDF en modal:', err);
          this.loadingPdf = false;
        }
      },
      error: (err) => {
        console.warn('HTTP interceptor error al descargar PDF en modal, intentando con fetch nativo:', err);
        fetch(pdfUrl)
          .then(res => res.arrayBuffer())
          .then(async (buffer) => {
            const typedarray = new Uint8Array(buffer);
            this.pdfDoc = await this.pdfLib.getDocument(typedarray).promise;
            this.totalPagesPdf = this.pdfDoc.numPages;
            this.paginaPdf = this.modalFirmanteData.pagina || 1;
            this.loadingPdf = false;
            setTimeout(() => this.renderPage(this.paginaPdf), 150);
          })
          .catch(fetchErr => {
            console.error('Error final cargando PDF para modal:', fetchErr);
            this.loadingPdf = false;
          });
      }
    });
  }

  async renderPage(num: number): Promise<void> {
    if (!this.pdfDoc) return;

    try {
      const page = await this.pdfDoc.getPage(num);
      const viewportUnscaled = page.getViewport({ scale: 1.0 });
      this.pdfViewportWidth = viewportUnscaled.width;
      this.pdfViewportHeight = viewportUnscaled.height;

      const viewport = page.getViewport({ scale: this.zoomPdf });

      const canvas = document.getElementById('pdf-canvas-modal-firmante') as HTMLCanvasElement;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      this.updateGhostFromModalData();
    } catch (e) {
      console.error('Error renderizando página PDF:', e);
    }
  }

  getExistingDestinatarioBoxStyle(dest: any): any {
    if (!this.pdfDoc || dest.pagina !== this.paginaPdf) {
      return { display: 'none' };
    }

    const canvas = document.getElementById('pdf-canvas-modal-firmante') as HTMLCanvasElement;
    if (!canvas || !canvas.width || !this.pdfViewportWidth) {
      return { display: 'none' };
    }

    const mmToPoints = 72 / 25.4;
    const scaleX = this.pdfViewportWidth / canvas.width;
    const scaleY = this.pdfViewportHeight / canvas.height;

    const pdfXPoints = (dest.posicion_x || 10) * mmToPoints;
    const pdfYPoints = (dest.posicion_y || 200) * mmToPoints;
    const pdfWPoints = (dest.ancho || 110) * mmToPoints;
    const pdfHPoints = (dest.alto || 30) * mmToPoints;

    const left = pdfXPoints / scaleX;
    const top = pdfYPoints / scaleY;
    const width = pdfWPoints / scaleX;
    const height = pdfHPoints / scaleY;

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`
    };
  }

  changePage(delta: number): void {
    const newPage = this.paginaPdf + delta;
    if (newPage >= 1 && newPage <= this.totalPagesPdf) {
      this.paginaPdf = newPage;
      this.modalFirmanteData.pagina = newPage;
      this.renderPage(this.paginaPdf);
    }
  }

  changeZoom(delta: number): void {
    const newZoom = this.zoomPdf + delta;
    if (newZoom >= 0.5 && newZoom <= 2.5) {
      this.zoomPdf = newZoom;
      this.renderPage(this.paginaPdf);
    }
  }

  onMouseDown(event: MouseEvent): void {
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();

    this.isDragging = true;
    this.dragStartX = event.clientX - rect.left;
    this.dragStartY = event.clientY - rect.top;

    this.showGhost = true;
    this.ghostX = this.dragStartX;
    this.ghostY = this.dragStartY;
    this.ghostW = 0;
    this.ghostH = 0;
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;

    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    this.ghostX = Math.min(this.dragStartX, currentX);
    this.ghostY = Math.min(this.dragStartY, currentY);
    this.ghostW = Math.abs(currentX - this.dragStartX);
    this.ghostH = Math.abs(currentY - this.dragStartY);
  }

  onMouseUp(event: MouseEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    if (this.ghostW < 10 || this.ghostH < 10) {
      return;
    }

    if (!this.pdfDoc) return;

    this.pdfDoc.getPage(this.paginaPdf).then((page: any) => {
      const viewport = page.getViewport({ scale: 1.0 });
      const mmPerPoint = 25.4 / 72;

      const canvas = document.getElementById('pdf-canvas-modal-firmante') as HTMLCanvasElement;
      if (!canvas) return;

      const scaleX = viewport.width / canvas.width;
      const scaleY = viewport.height / canvas.height;

      const pdfXPoints = this.ghostX * scaleX;
      const pdfYPoints = this.ghostY * scaleY;

      const posX = Math.round(pdfXPoints * mmPerPoint);
      const posY = Math.round(pdfYPoints * mmPerPoint);
      const ancho = Math.max(20, Math.round((this.ghostW * scaleX) * mmPerPoint));
      const alto = Math.max(8, Math.round((this.ghostH * scaleY) * mmPerPoint));

      this.modalFirmanteData.pagina = this.paginaPdf;
      this.modalFirmanteData.posicion_x = posX;
      this.modalFirmanteData.posicion_y = posY;
      this.modalFirmanteData.ancho = ancho;
      this.modalFirmanteData.alto = alto;

      this.updateGhostFromModalData();
    });
  }

  updateGhostFromModalData(): void {
    if (!this.pdfDoc) return;

    this.pdfDoc.getPage(this.paginaPdf).then((page: any) => {
      const canvas = document.getElementById('pdf-canvas-modal-firmante') as HTMLCanvasElement;
      if (!canvas) return;

      const viewport = page.getViewport({ scale: 1.0 });
      const scaleX = viewport.width / canvas.width;
      const scaleY = viewport.height / canvas.height;
      const mmToPoints = 72 / 25.4;

      const pdfXPoints = (this.modalFirmanteData.posicion_x || 10) * mmToPoints;
      const pdfYPoints = (this.modalFirmanteData.posicion_y || 200) * mmToPoints;
      const pdfWPoints = (this.modalFirmanteData.ancho || 110) * mmToPoints;
      const pdfHPoints = (this.modalFirmanteData.alto || 30) * mmToPoints;

      this.ghostX = pdfXPoints / scaleX;
      this.ghostY = pdfYPoints / scaleY;
      this.ghostW = pdfWPoints / scaleX;
      this.ghostH = pdfHPoints / scaleY;
      this.showGhost = (this.modalFirmanteData.pagina === this.paginaPdf);
    });
  }

  // ============================
  // MODAL AGREGAR / EDITAR FIRMANTE
  // ============================
  abrirModalAgregarFirmante(doc: DocumentoFirma): void {
    this.modalFirmanteMode = 'add';
    this.modalFirmanteDocId = doc.id!;
    this.modalFirmanteDestId = null;
    this.selectedColab = null;
    this.colaboradorSearch = '';
    this.colaboradoresFiltrados = [];
    this.mostrarDropdownColab = false;
    this.currentDocumentDestinatarios = doc.destinatarios || [];
    this.modalFirmanteData = {
      colaborador_id: null,
      tipo_correo: 'corporativo',
      pagina: 1,
      posicion_x: 10,
      posicion_y: 200,
      ancho: 110,
      alto: 30,
      tipo_firma_requerida: 'AMBAS',
      enviar_correo: true
    };
    this.showModalFirmante = true;
    if (doc.pdf_url) {
      this.loadPdfPreview(doc.pdf_url);
    }
  }

  abrirModalEditarFirmante(dest: any): void {
    this.modalFirmanteMode = 'edit';
    this.modalFirmanteDocId = dest.documento_firma_id;
    this.modalFirmanteDestId = dest.id;
    this.selectedColab = dest.colaborador || null;
    this.colaboradorSearch = dest.nombre_firmante || '';
    this.colaboradoresFiltrados = [];
    this.mostrarDropdownColab = false;

    const doc = this.documentos.find(d => d.id === dest.documento_firma_id);
    this.currentDocumentDestinatarios = doc?.destinatarios || [];

    this.modalFirmanteData = {
      colaborador_id: dest.colaborador_id,
      tipo_correo: dest.tipo_correo || 'corporativo',
      pagina: dest.pagina || 1,
      posicion_x: dest.posicion_x ?? 10,
      posicion_y: dest.posicion_y ?? 200,
      ancho: dest.ancho ?? 110,
      alto: dest.alto ?? 30,
      tipo_firma_requerida: dest.tipo_firma_requerida || 'AMBAS',
      enviar_correo: false
    };
    this.showModalFirmante = true;
    if (doc?.pdf_url) {
      this.loadPdfPreview(doc.pdf_url);
    }
  }

  cerrarModalFirmante(): void {
    this.showModalFirmante = false;
    this.submittingFirmante = false;
  }

  onColaboradorSearch(): void {
    const term = this.colaboradorSearch.toLowerCase().trim();
    if (!term) {
      this.colaboradoresFiltrados = [];
      this.mostrarDropdownColab = false;
      return;
    }

    this.colaboradoresFiltrados = this.colaboradoresList.filter(c =>
      (c.firstName || c.name || '').toLowerCase().includes(term) ||
      (c.lastName || '').toLowerCase().includes(term) ||
      (c.cedula || '').includes(term) ||
      (c.cargo || '').toLowerCase().includes(term)
    ).slice(0, 10);
    this.mostrarDropdownColab = this.colaboradoresFiltrados.length > 0;
  }

  seleccionarColaboradorModal(colab: any): void {
    this.selectedColab = colab;
    this.modalFirmanteData.colaborador_id = colab.id;
    this.colaboradorSearch = `${colab.firstName || colab.name || ''} ${colab.lastName || ''}`.trim();
    this.modalFirmanteData.tipo_correo = colab.correo_corporativo ? 'corporativo' : 'personal';
    this.mostrarDropdownColab = false;
    this.colaboradoresFiltrados = [];
  }

  guardarFirmante(): void {
    if (!this.modalFirmanteData.colaborador_id) {
      Swal.fire('Atención', 'Debes seleccionar un colaborador para asignar como firmante.', 'warning');
      return;
    }

    this.submittingFirmante = true;

    if (this.modalFirmanteMode === 'add') {
      this.docFirmaService.addDestinatario(this.modalFirmanteDocId!, this.modalFirmanteData).subscribe({
        next: (resp: any) => {
          Swal.fire('Firmante Agregado', resp.message || 'Firmante añadido exitosamente', 'success');
          this.cerrarModalFirmante();
          this.cargarDocumentos();
        },
        error: (err: any) => {
          this.submittingFirmante = false;
          Swal.fire('Error', err.error?.message || 'No fue posible agregar al firmante', 'error');
        }
      });
    } else {
      this.docFirmaService.updateDestinatario(this.modalFirmanteDestId!, this.modalFirmanteData).subscribe({
        next: (resp: any) => {
          Swal.fire('Firmante Actualizado', resp.message || 'Firmante actualizado exitosamente', 'success');
          this.cerrarModalFirmante();
          this.cargarDocumentos();
        },
        error: (err: any) => {
          this.submittingFirmante = false;
          Swal.fire('Error', err.error?.message || 'No fue posible actualizar al firmante', 'error');
        }
      });
    }
  }

  onEtiquetasCambiada(): void {
    this.cargarEtiquetas();
    this.cargarDocumentos();
  }

  getFirmantesCompletadosCount(doc: DocumentoFirma): number {
    if (!doc.destinatarios) return 0;
    return doc.destinatarios.filter(d => d.estado === 'FIRMADO').length;
  }

  getFirmantesActivosCount(doc: DocumentoFirma): number {
    if (!doc.destinatarios) return 0;
    return doc.destinatarios.filter(d => d.estado !== 'DESHABILITADO' && d.estado !== 'CANCELADO').length;
  }

  getCountByEstado(estado: string): number {
    if (!this.documentos) return 0;
    return this.documentos.filter(d => d.estado === estado).length;
  }

  // ============================
  // GOOGLE DRIVE DRIVE COMPUTED PROPERTIES & FILTERS
  // ============================
  get carpetasPorEtiqueta(): any[] {
    const foldersMap = new Map<string, { id: number | null, nombre: string, color: string, count: number }>();

    foldersMap.set('general', { id: null, nombre: 'General / Sin Etiqueta', color: '#64748b', count: 0 });

    this.etiquetasList.forEach(e => {
      foldersMap.set(e.id!.toString(), { id: e.id!, nombre: e.nombre, color: e.color || '#2563eb', count: 0 });
    });

    this.documentos.forEach(doc => {
      const key = doc.etiqueta_id ? doc.etiqueta_id.toString() : 'general';
      if (foldersMap.has(key)) {
        foldersMap.get(key)!.count++;
      } else if (doc.etiqueta) {
        foldersMap.set(key, { id: doc.etiqueta.id!, nombre: doc.etiqueta.nombre, color: doc.etiqueta.color || '#2563eb', count: 1 });
      }
    });

    return Array.from(foldersMap.values()).filter(f => f.count > 0 || f.id !== null);
  }

  get carpetasPorAnioMes(): any[] {
    const map = new Map<string, { year: string, month: string, label: string, count: number }>();

    this.documentos.forEach(doc => {
      if (doc.created_at) {
        const d = new Date(doc.created_at);
        const y = d.getFullYear().toString();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const monthObj = this.mesesList.find(item => item.key === m);
        const label = `${monthObj ? monthObj.name : m} ${y}`;
        const key = `${y}-${m}`;

        if (!map.has(key)) {
          map.set(key, { year: y, month: m, label: label, count: 0 });
        }
        map.get(key)!.count++;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.year.localeCompare(a.year) || b.month.localeCompare(a.month));
  }

  get carpetasPorProceso(): any[] {
    const map = new Map<string, { nombre: string, count: number }>();

    this.documentos.forEach(doc => {
      const procesosDoc = new Set<string>();
      if (doc.destinatarios) {
        doc.destinatarios.forEach(d => {
          if (d.proceso_nombre) procesosDoc.add(d.proceso_nombre.trim());
        });
      }
      if (doc.etiqueta?.proceso?.nombre) {
        procesosDoc.add(doc.etiqueta.proceso.nombre.trim());
      }

      procesosDoc.forEach(pName => {
        if (!map.has(pName)) {
          map.set(pName, { nombre: pName, count: 0 });
        }
        map.get(pName)!.count++;
      });
    });

    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  get availableYears(): string[] {
    const set = new Set<string>();
    this.documentos.forEach(doc => {
      if (doc.created_at) {
        const y = new Date(doc.created_at).getFullYear().toString();
        set.add(y);
      }
    });
    if (set.size === 0) set.add(new Date().getFullYear().toString());
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }

  get availableProcesos(): string[] {
    const set = new Set<string>();
    this.documentos.forEach(doc => {
      if (doc.destinatarios) {
        doc.destinatarios.forEach(d => {
          if (d.proceso_nombre) set.add(d.proceso_nombre.trim());
        });
      }
      if (doc.etiqueta?.proceso?.nombre) {
        set.add(doc.etiqueta.proceso.nombre.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  get documentosFiltrados(): DocumentoFirma[] {
    return this.documentos.filter(doc => {
      if (this.search.trim()) {
        const term = this.search.toLowerCase().trim();
        const matchesTitle = (doc.titulo || '').toLowerCase().includes(term);
        const matchesCreator = (doc.nombre_creador || '').toLowerCase().includes(term);
        const matchesTag = (doc.etiqueta?.nombre || '').toLowerCase().includes(term);
        const matchesSignerName = doc.destinatarios && doc.destinatarios.some(d => (d.nombre_firmante || '').toLowerCase().includes(term));
        const matchesSignerProcess = doc.destinatarios && doc.destinatarios.some(d => (d.proceso_nombre || '').toLowerCase().includes(term));
        if (!matchesTitle && !matchesCreator && !matchesTag && !matchesSignerName && !matchesSignerProcess) return false;
      }

      if (this.estadoFiltro && doc.estado !== this.estadoFiltro) {
        return false;
      }

      if (this.etiquetaFiltro) {
        if (this.etiquetaFiltro === 'null') {
          if (doc.etiqueta_id) return false;
        } else if (doc.etiqueta_id?.toString() !== this.etiquetaFiltro) {
          return false;
        }
      }

      if (this.filtroAnio && doc.created_at) {
        const y = new Date(doc.created_at).getFullYear().toString();
        if (y !== this.filtroAnio) return false;
      }

      if (this.filtroMes && doc.created_at) {
        const m = (new Date(doc.created_at).getMonth() + 1).toString().padStart(2, '0');
        if (m !== this.filtroMes) return false;
      }

      if (this.filtroProceso) {
        const procTerm = this.filtroProceso.toLowerCase().trim();
        const hasMatchingProcess = doc.destinatarios && doc.destinatarios.some(d => 
          (d.proceso_nombre || '').toLowerCase().trim() === procTerm
        );
        const matchesTagProcess = (doc.etiqueta?.proceso?.nombre || '').toLowerCase().trim() === procTerm;
        if (!hasMatchingProcess && !matchesTagProcess) return false;
      }

      if (this.selectedFolderType === 'etiqueta' && this.selectedFolderKey !== null) {
        if (this.selectedFolderKey === 'general') {
          if (doc.etiqueta_id) return false;
        } else if (doc.etiqueta_id?.toString() !== this.selectedFolderKey) {
          return false;
        }
      } else if (this.selectedFolderType === 'anio_mes' && this.selectedFolderKey !== null && doc.created_at) {
        const d = new Date(doc.created_at);
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        if (key !== this.selectedFolderKey) return false;
      } else if (this.selectedFolderType === 'estado' && this.selectedFolderKey !== null) {
        if (doc.estado !== this.selectedFolderKey) return false;
      } else if (this.selectedFolderType === 'proceso' && this.selectedFolderKey !== null) {
        const keyLower = this.selectedFolderKey.toLowerCase().trim();
        const hasMatchingProcess = doc.destinatarios && doc.destinatarios.some(d => 
          (d.proceso_nombre || '').toLowerCase().trim() === keyLower
        );
        const matchesTagProcess = (doc.etiqueta?.proceso?.nombre || '').toLowerCase().trim() === keyLower;
        if (!hasMatchingProcess && !matchesTagProcess) return false;
      }

      return true;
    });
  }

  abrirCarpetaEtiqueta(folder: any): void {
    this.selectedFolderType = 'etiqueta';
    this.selectedFolderKey = folder.id ? folder.id.toString() : 'general';
    this.selectedFolderName = `Etiqueta: ${folder.nombre}`;
    if (this.viewMode === 'folders') {
      this.viewMode = 'grid';
    }
  }

  abrirCarpetaAnioMes(folder: any): void {
    this.selectedFolderType = 'anio_mes';
    this.selectedFolderKey = `${folder.year}-${folder.month}`;
    this.selectedFolderName = `Período: ${folder.label}`;
    if (this.viewMode === 'folders') {
      this.viewMode = 'grid';
    }
  }

  abrirCarpetaEstado(estado: string): void {
    this.selectedFolderType = 'estado';
    this.selectedFolderKey = estado;
    this.selectedFolderName = `Estado: ${estado}`;
    if (this.viewMode === 'folders') {
      this.viewMode = 'grid';
    }
  }

  abrirCarpetaProceso(folder: any): void {
    this.selectedFolderType = 'proceso';
    this.selectedFolderKey = folder.nombre;
    this.selectedFolderName = `Proceso: ${folder.nombre}`;
    if (this.viewMode === 'folders') {
      this.viewMode = 'grid';
    }
  }

  limpiarSeleccionCarpeta(): void {
    this.selectedFolderType = null;
    this.selectedFolderKey = null;
    this.selectedFolderName = 'Mi Unidad';
    this.viewMode = 'folders';
  }
}
