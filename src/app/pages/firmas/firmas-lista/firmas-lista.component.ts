import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DocumentoFirmaService, DocumentoFirma, DocumentoFirmaEtiqueta } from 'src/app/services/documento-firma.service';
import { AuthService } from 'src/app/services/auth.service';
import { forkJoin, firstValueFrom } from 'rxjs';
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

  get esTecnologia(): boolean {
    const user = this.authService.user;
    if (!user) return false;
    if (this.authService.hasRole('Tecnologia') || this.authService.hasRole('Tecnología') || this.authService.hasRole('Admin') || this.authService.hasRole('Administrador')) {
      return true;
    }
    const deptName = (user.nombre_departamento_Sdp || '').toUpperCase();
    if (deptName.includes('TECNOLOG') || deptName.includes('T.I.') || deptName.includes('SISTEMAS')) {
      return true;
    }
    return this.authService.hasPermission(1);
  }

  reemplazandoPdf = false;

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
  modalFirmanteData: any = {};
  modalFirmanteBoxes: {
    id?: number | null;
    pagina: number;
    posicion_x: number;
    posicion_y: number;
    ancho: number;
    alto: number;
  }[] = [];
  activeModalBoxIndex: number = 0;
  deletedModalBoxIds: number[] = [];
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
  // GOOGLE DRIVE STYLE MANAGEMENT & PAGINACIÓN GLOBAL
  // ============================
  viewMode: 'folders' | 'grid' | 'table' = 'folders';
  filtroAnio: string = '';
  filtroMes: string = '';
  filtroProceso: string = '';
  selectedFolderType: 'etiqueta' | 'anio_mes' | 'estado' | 'proceso' | null = null;
  selectedFolderKey: string | null = null;
  selectedFolderName: string = 'Mi Unidad';

  // Paginación Global Saint
  resumenStats: any = null;
  currentPage: number = 1;
  perPage: number = 12;
  totalDocs: number = 0;
  totalPages: number = 1;
  fromItem: number = 0;
  toItem: number = 0;
  perPageOptions: number[] = [6, 9, 12, 15, 18, 21, 24, 30, 36, 60];

  switchViewMode(mode: 'folders' | 'grid' | 'table'): void {
    this.viewMode = mode;
    if (mode === 'folders') {
      this.selectedFolderType = null;
      this.selectedFolderKey = null;
      this.selectedFolderName = 'Mi Unidad';
      this.perPageOptions = [6, 9, 12, 15, 18, 21, 24, 30, 36, 60];
      if (this.perPage % 3 !== 0 || !this.perPageOptions.includes(this.perPage)) {
        this.perPage = 12;
      }
    } else if (mode === 'grid') {
      this.perPageOptions = [6, 9, 12, 15, 18, 21, 24, 30, 36, 60];
      if (this.perPage % 3 !== 0 || !this.perPageOptions.includes(this.perPage)) {
        this.perPage = 12;
      }
    } else if (mode === 'table') {
      this.perPageOptions = [10, 15, 20, 30, 50, 100];
      if (!this.perPageOptions.includes(this.perPage)) {
        this.perPage = 20;
      }
    }
    this.currentPage = 1;
    this.cargarDocumentos();
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
    this.cargarDocumentos(true);
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

  cargarDocumentos(showLoading: boolean = false): void {
    if (showLoading || this.documentos.length === 0) {
      this.loading = true;
    }
    this.docFirmaService.getDocumentos(
      this.currentPage,
      this.search,
      this.estadoFiltro,
      this.etiquetaFiltro,
      this.verPapelera,
      this.perPage,
      this.filtroAnio,
      this.filtroMes,
      this.filtroProceso
    ).subscribe({
      next: (resp: any) => {
        const paginator = resp.data || {};
        this.documentos = paginator.data ?? (Array.isArray(resp.data) ? resp.data : []);
        this.totalDocs = paginator.total ?? this.documentos.length;
        this.currentPage = paginator.current_page ?? 1;
        this.totalPages = paginator.last_page ?? (Math.ceil(this.totalDocs / this.perPage) || 1);
        this.fromItem = paginator.from ?? (this.totalDocs > 0 ? ((this.currentPage - 1) * this.perPage + 1) : 0);
        this.toItem = paginator.to ?? Math.min(this.currentPage * this.perPage, this.totalDocs);
        if (resp.stats) {
          this.resumenStats = resp.stats;
        }
        this.loading = false;
      },
      error: (err: any) => {
        console.error(err);
        Swal.fire('Error', 'No fue posible cargar el listado de documentos de firma', 'error');
        this.loading = false;
      }
    });
  }

  private searchTimeout: any;

  onSearchChange(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.cargarDocumentos(false);
    }, 400);
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.cargarDocumentos(false);
  }

  onPerPageChange(): void {
    this.currentPage = 1;
    this.cargarDocumentos(false);
  }

  cambiarPagina(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.cargarDocumentos(false);
    }
  }

  getPagesArray(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;

    if (end > this.totalPages) {
      end = this.totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
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

  onReemplazarPdfSelected(event: any, doc: DocumentoFirma): void {
    const file: File = event.target?.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      Swal.fire('Archivo no válido', 'Por favor selecciona un archivo en formato PDF (.pdf)', 'warning');
      event.target.value = '';
      return;
    }

    Swal.fire({
      title: '¿Reemplazar archivo PDF?',
      html: `Estás a punto de reemplazar el archivo PDF del documento <strong>"${doc.titulo}"</strong>.<br><br><small class="text-muted">Se mantendrán todos los firmantes, coordenadas y configuraciones asociadas.</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, reemplazar PDF',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.reemplazandoPdf = true;
        Swal.fire({
          title: 'Subiendo nuevo PDF...',
          text: 'Por favor espera un momento mientras se actualiza el archivo en el servidor.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        this.docFirmaService.reemplazarPdf(doc.id!, file).subscribe({
          next: (res: any) => {
            this.reemplazandoPdf = false;
            Swal.fire('¡PDF Reemplazado!', res.message || 'El PDF ha sido actualizado correctamente.', 'success');

            if (this.selectedDocDetail && this.selectedDocDetail.id === doc.id) {
              this.selectedDocDetail = res.data;
              const newUrl = res.data.pdf_url || res.data.s3_direct_url;
              if (newUrl) {
                this.loadPdfDetailModal(newUrl);
              }
            }

            this.cargarDocumentos();
          },
          error: (err: any) => {
            this.reemplazandoPdf = false;
            console.error('Error reemplazando PDF:', err);
            Swal.fire('Error', err.error?.message || 'No fue posible reemplazar el archivo PDF.', 'error');
          }
        });
      }
      event.target.value = '';
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

  reenviarInvitacion(destinatarioIdOrDest: any): void {
    let dest: any = null;
    if (typeof destinatarioIdOrDest === 'object' && destinatarioIdOrDest !== null) {
      dest = destinatarioIdOrDest;
    } else {
      for (const d of this.documentos) {
        const found = (d.destinatarios || []).find((item: any) => item.id === destinatarioIdOrDest);
        if (found) {
          dest = found;
          break;
        }
      }
    }

    const destId = dest?.id || destinatarioIdOrDest;
    const isRechazado = dest && (dest.estado === 'RECHAZADO' || !!dest.motivo_rechazo);
    const motivo = dest?.motivo_rechazo || '';

    if (isRechazado) {
      this.reiniciarFirma(dest || { id: destId, nombre_firmante: 'Firmante', motivo_rechazo: motivo, estado: 'RECHAZADO' });
      return;
    }

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
        this.docFirmaService.reenviarCorreo(destId).subscribe({
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
    const isRechazado = dest.estado === 'RECHAZADO' || !!dest.motivo_rechazo;
    const motivo = dest.motivo_rechazo || '';

    let htmlContent = '';

    if (isRechazado) {
      htmlContent = `
        <div class="text-left text-xs text-slate-700 mb-3">
          <p class="mb-1.5 font-bold text-rose-800"><i class="bi bi-x-circle-fill text-rose-600 me-1"></i> Motivo por el cual rechazó la firma:</p>
          <div class="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl font-medium italic shadow-2xs">
            "${motivo || 'Sin motivo especificado'}"
          </div>
        </div>
        <p class="text-xs text-slate-600 mb-2">Al reenviar la solicitud a <strong>${dest.nombre_firmante || 'el firmante'}</strong>:</p>
        <ul class="text-xs text-left text-slate-700 bg-blue-50 p-3 rounded-xl border border-blue-200 list-disc pl-5 space-y-1">
          <li>Se cambiará su estado de <strong>RECHAZADO</strong> a <strong>PENDIENTE</strong>.</li>
          <li>Se le enviará un nuevo correo de invitación con su enlace directo para volver a firmar.</li>
        </ul>
      `;
    } else {
      htmlContent = `
        <p class="text-xs text-slate-600 mb-2">Esto realizará las siguientes acciones para <strong>${dest.nombre_firmante || 'el firmante'}</strong>:</p>
        <ul class="text-xs text-left text-slate-700 bg-amber-50 p-3 rounded-xl border border-amber-200 list-disc pl-5 space-y-1">
          <li>Removerá su sello del documento PDF de forma limpia.</li>
          <li>Revertirá su estado de firma a <strong>PENDIENTE</strong>.</li>
          <li>Le enviará un nuevo correo de invitación con su enlace directo.</li>
        </ul>
      `;
    }

    Swal.fire({
      title: isRechazado ? '⚠️ Solicitud Rechazada - ¿Reenviar Firma?' : '¿Re-solicitar y Reiniciar Firma?',
      html: htmlContent,
      icon: isRechazado ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: isRechazado ? 'Sí, Reenviar Solicitud' : 'Sí, Reiniciar y Reenviar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb'
    }).then((result) => {
      if (result.isConfirmed) {
        this.docFirmaService.resetDestinatario(dest.id!).subscribe({
          next: (resp: any) => {
            Swal.fire(
              isRechazado ? 'Solicitud Reenviada' : '¡Firma Reiniciada!',
              isRechazado ? `Se ha reactivado la solicitud para '${dest.nombre_firmante}' y enviado el correo de firma.` : (resp.message || 'La firma fue removida del PDF y se envió una nueva solicitud.'),
              'success'
            );
            this.cargarDocumentos();
            if (this.showDetailModal && this.selectedDocDetail) {
              const refreshed = this.documentos.find(d => d.id === this.selectedDocDetail?.id);
              if (refreshed) this.verDetalle(refreshed);
            }
          },
          error: (err: any) => {
            Swal.fire('Error', err.error?.message || 'No fue posible procesar la solicitud', 'error');
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

  private currentRenderTask: any = null;

  async renderPage(num: number): Promise<void> {
    if (!this.pdfDoc) return;

    if (this.currentRenderTask) {
      try {
        this.currentRenderTask.cancel();
      } catch (_) {}
      this.currentRenderTask = null;
    }

    try {
      const page = await this.pdfDoc.getPage(num);
      const viewportUnscaled = page.getViewport({ scale: 1.0 });
      this.pdfViewportWidth = viewportUnscaled.width;
      this.pdfViewportHeight = viewportUnscaled.height;

      const viewport = page.getViewport({ scale: this.zoomPdf });

      const canvas = document.getElementById('pdf-canvas-modal-firmante') as HTMLCanvasElement;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      this.currentRenderTask = page.render(renderContext);
      await this.currentRenderTask.promise;
      this.currentRenderTask = null;

      this.updateGhostFromModalData();
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') {
        console.error('Error renderizando página PDF:', e);
      }
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

      if (this.modalFirmanteBoxes[this.activeModalBoxIndex]) {
        this.modalFirmanteBoxes[this.activeModalBoxIndex].pagina = this.paginaPdf;
        this.modalFirmanteBoxes[this.activeModalBoxIndex].posicion_x = posX;
        this.modalFirmanteBoxes[this.activeModalBoxIndex].posicion_y = posY;
        this.modalFirmanteBoxes[this.activeModalBoxIndex].ancho = ancho;
        this.modalFirmanteBoxes[this.activeModalBoxIndex].alto = alto;
      }

      this.updateGhostFromModalData();
    });
  }

  updateGhostFromModalData(): void {
    if (!this.pdfDoc) return;

    const currentBox = this.modalFirmanteBoxes[this.activeModalBoxIndex] || this.modalFirmanteData;

    this.pdfDoc.getPage(this.paginaPdf).then((page: any) => {
      const canvas = document.getElementById('pdf-canvas-modal-firmante') as HTMLCanvasElement;
      if (!canvas) return;

      const viewport = page.getViewport({ scale: 1.0 });
      const scaleX = viewport.width / canvas.width;
      const scaleY = viewport.height / canvas.height;
      const mmToPoints = 72 / 25.4;

      const pdfXPoints = (currentBox.posicion_x || 10) * mmToPoints;
      const pdfYPoints = (currentBox.posicion_y || 200) * mmToPoints;
      const pdfWPoints = (currentBox.ancho || 110) * mmToPoints;
      const pdfHPoints = (currentBox.alto || 30) * mmToPoints;

      this.ghostX = pdfXPoints / scaleX;
      this.ghostY = pdfYPoints / scaleY;
      this.ghostW = pdfWPoints / scaleX;
      this.ghostH = pdfHPoints / scaleY;
      this.showGhost = (currentBox.pagina === this.paginaPdf);
    });
  }

  // ============================
  // MODAL AGREGAR / EDITAR FIRMANTE (MULTI-RECUADRO)
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

    this.modalFirmanteBoxes = [
      { id: null, pagina: 1, posicion_x: 10, posicion_y: 200, ancho: 110, alto: 30 }
    ];
    this.activeModalBoxIndex = 0;
    this.deletedModalBoxIds = [];

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

    // Buscar todos los recuadros pertenecientes a este mismo firmante
    const firmanteBoxes = (doc?.destinatarios || []).filter((d: any) =>
      (dest.colaborador_id && d.colaborador_id === dest.colaborador_id) ||
      (dest.email_destinatario && d.email_destinatario === dest.email_destinatario) ||
      d.id === dest.id
    );

    if (firmanteBoxes.length > 0) {
      this.modalFirmanteBoxes = firmanteBoxes.map((b: any) => ({
        id: b.id,
        pagina: b.pagina || 1,
        posicion_x: b.posicion_x ?? 10,
        posicion_y: b.posicion_y ?? 200,
        ancho: b.ancho ?? 110,
        alto: b.alto ?? 30
      }));
    } else {
      this.modalFirmanteBoxes = [{
        id: dest.id,
        pagina: dest.pagina || 1,
        posicion_x: dest.posicion_x ?? 10,
        posicion_y: dest.posicion_y ?? 200,
        ancho: dest.ancho ?? 110,
        alto: dest.alto ?? 30
      }];
    }

    this.activeModalBoxIndex = 0;
    this.deletedModalBoxIds = [];

    const activeBox = this.modalFirmanteBoxes[0];
    this.modalFirmanteData = {
      colaborador_id: dest.colaborador_id,
      tipo_correo: dest.tipo_correo || 'corporativo',
      pagina: activeBox.pagina,
      posicion_x: activeBox.posicion_x,
      posicion_y: activeBox.posicion_y,
      ancho: activeBox.ancho,
      alto: activeBox.alto,
      tipo_firma_requerida: dest.tipo_firma_requerida || 'AMBAS',
      enviar_correo: false
    };

    this.paginaPdf = activeBox.pagina;

    this.showModalFirmante = true;
    if (doc?.pdf_url) {
      this.loadPdfPreview(doc.pdf_url);
    }
  }

  cerrarModalFirmante(): void {
    this.showModalFirmante = false;
    this.submittingFirmante = false;
  }

  seleccionarRecuadroModal(idx: number): void {
    if (idx < 0 || idx >= this.modalFirmanteBoxes.length) return;
    this.activeModalBoxIndex = idx;
    const box = this.modalFirmanteBoxes[idx];
    this.modalFirmanteData.pagina = box.pagina;
    this.modalFirmanteData.posicion_x = box.posicion_x;
    this.modalFirmanteData.posicion_y = box.posicion_y;
    this.modalFirmanteData.ancho = box.ancho;
    this.modalFirmanteData.alto = box.alto;

    this.paginaPdf = box.pagina;
    if (this.pdfDoc) {
      this.renderPage(this.paginaPdf);
    }
  }

  agregarRecuadroModalEnPaginaActual(): void {
    const newBox = {
      id: null,
      pagina: this.paginaPdf,
      posicion_x: 10,
      posicion_y: Math.min(650, 180 + (this.modalFirmanteBoxes.length * 25)),
      ancho: 110,
      alto: 30
    };
    this.modalFirmanteBoxes.push(newBox);
    this.seleccionarRecuadroModal(this.modalFirmanteBoxes.length - 1);
  }

  eliminarRecuadroModal(idx: number, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.modalFirmanteBoxes.length <= 1) {
      Swal.fire('Atención', 'El firmante debe conservar al menos un recuadro de firma.', 'warning');
      return;
    }

    const targetBox = this.modalFirmanteBoxes[idx];
    if (targetBox.id) {
      this.deletedModalBoxIds.push(targetBox.id);
    }

    this.modalFirmanteBoxes.splice(idx, 1);
    if (this.activeModalBoxIndex >= this.modalFirmanteBoxes.length) {
      this.activeModalBoxIndex = this.modalFirmanteBoxes.length - 1;
    }
    this.seleccionarRecuadroModal(this.activeModalBoxIndex);
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

  async guardarFirmante(): Promise<void> {
    if (!this.modalFirmanteData.colaborador_id) {
      Swal.fire('Atención', 'Debes seleccionar un colaborador para asignar como firmante.', 'warning');
      return;
    }

    this.submittingFirmante = true;

    try {
      // 1. Eliminar recuadros removidos
      if (this.deletedModalBoxIds.length > 0) {
        for (const delId of this.deletedModalBoxIds) {
          await firstValueFrom(this.docFirmaService.destroyDestinatario(delId));
        }
      }

      // 2. Guardar/Actualizar cada recuadro en modalFirmanteBoxes
      for (const box of this.modalFirmanteBoxes) {
        const payload = {
          colaborador_id: this.modalFirmanteData.colaborador_id,
          tipo_correo: this.modalFirmanteData.tipo_correo,
          tipo_firma_requerida: this.modalFirmanteData.tipo_firma_requerida,
          enviar_correo: this.modalFirmanteData.enviar_correo,
          pagina: box.pagina,
          posicion_x: box.posicion_x,
          posicion_y: box.posicion_y,
          ancho: box.ancho,
          alto: box.alto
        };

        if (box.id) {
          await firstValueFrom(this.docFirmaService.updateDestinatario(box.id, payload));
        } else {
          await firstValueFrom(this.docFirmaService.addDestinatario(this.modalFirmanteDocId!, payload));
        }
      }

      Swal.fire('Firma(s) Guardada(s)', 'La configuración de firmas fue guardada exitosamente.', 'success');
      this.cerrarModalFirmante();
      this.cargarDocumentos();
    } catch (err: any) {
      this.submittingFirmante = false;
      Swal.fire('Error', err.error?.message || 'No fue posible guardar la configuración de firmas.', 'error');
    }
  }

  onEtiquetasCambiada(): void {
    this.cargarEtiquetas();
    this.cargarDocumentos();
  }

  // ============================
  // GESTIÓN Y AGRUPACIÓN DE DESTINATARIOS
  // ============================
  groupCollapseState: { [key: string]: boolean } = {};

  toggleCollapseGroup(groupKey: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.groupCollapseState[groupKey] = !this.groupCollapseState[groupKey];
  }

  isGroupCollapsed(groupKey: string): boolean {
    return !!this.groupCollapseState[groupKey];
  }

  getGroupedDestinatarios(destinatarios: any[]): any[] {
    if (!destinatarios || destinatarios.length === 0) return [];
    
    const groupsMap = new Map<string, any>();

    for (const dest of destinatarios) {
      const key = dest.colaborador_id 
        ? `colab_${dest.colaborador_id}` 
        : `email_${(dest.email_destinatario || dest.nombre_firmante || dest.id).toLowerCase()}`;
        
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          colaborador_id: dest.colaborador_id,
          nombre_firmante: dest.nombre_firmante || dest.colaborador?.nombres || 'Sin Nombre',
          email_destinatario: dest.email_destinatario || dest.colaborador?.email || '',
          tipo_correo: dest.tipo_correo || 'corporativo',
          colaborador: dest.colaborador,
          boxes: []
        });
      }
      groupsMap.get(key).boxes.push(dest);
    }

    const groups = Array.from(groupsMap.values());
    for (const g of groups) {
      g.boxes.sort((a: any, b: any) => (a.pagina || 1) - (b.pagina || 1));
      
      if (g.boxes.every((b: any) => b.estado === 'FIRMADO')) {
        g.estado = 'FIRMADO';
      } else if (g.boxes.some((b: any) => b.estado === 'RECHAZADO')) {
        g.estado = 'RECHAZADO';
      } else if (g.boxes.some((b: any) => b.estado === 'DESHABILITADO' || b.estado === 'CANCELADO')) {
        g.estado = 'DESHABILITADO';
      } else {
        g.estado = 'PENDIENTE';
      }
    }
    return groups;
  }

  getGroupPagesText(group: any): string {
    if (!group || !group.boxes) return '';
    return group.boxes.map((b: any) => b.pagina || 1).join(', ');
  }

  reiniciarRecuadroIndividual(box: any, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!box || !box.id) return;

    Swal.fire({
      title: '¿Reiniciar este Recuadro de Firma?',
      html: `Se removerá el sello de firma de la <strong>Página ${box.pagina || 1}</strong> para <strong>${box.nombre_firmante || 'este firmante'}</strong> y el recuadro volverá a estar <strong>PENDIENTE</strong>.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#d97706',
      confirmButtonText: 'Sí, Reiniciar Recuadro',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        this.docFirmaService.resetDestinatario(box.id).subscribe({
          next: (resp: any) => {
            Swal.fire('Firma Reiniciada', resp.message || `El recuadro de la Página ${box.pagina || 1} ha sido reiniciado a estado PENDIENTE.`, 'success');
            this.cargarDocumentos();
          },
          error: (err: any) => Swal.fire('Error', err.error?.message || 'No fue posible reiniciar este recuadro de firma.', 'error')
        });
      }
    });
  }

  eliminarRecuadroIndividual(dest: any, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!dest || !dest.id) return;

    Swal.fire({
      title: '¿Eliminar Recuadro de Firma?',
      text: `Se eliminará el recuadro de firma de la Página ${dest.pagina || 1} para ${dest.nombre_firmante || 'este firmante'}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      confirmButtonText: 'Sí, Eliminar Recuadro',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        this.docFirmaService.destroyDestinatario(dest.id).subscribe({
          next: () => {
            Swal.fire('Recuadro Eliminado', 'Se ha eliminado el recuadro de firma.', 'success');
            this.cargarDocumentos();
          },
          error: (err: any) => Swal.fire('Error', err.error?.message || 'No se pudo eliminar el recuadro.', 'error')
        });
      }
    });
  }

  eliminarFirmanteCompletoGroup(group: any, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!group || !group.boxes || group.boxes.length === 0) return;

    const totalBoxes = group.boxes.length;
    const paginasList = group.boxes.map((b: any) => `Página ${b.pagina || 1}`).join(', ');
    const nombre = group.nombre_firmante || 'el firmante';

    Swal.fire({
      title: `¿Eliminar a ${nombre}?`,
      html: `Se eliminarán <b>${totalBoxes}</b> recuadro(s) de firma en <b>${paginasList}</b> pertenecientes a este firmante.<br><br>¿Estás seguro de continuar?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      confirmButtonText: 'Sí, Eliminar Todo',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        const deleteRequests = group.boxes.map((b: any) => this.docFirmaService.destroyDestinatario(b.id));
        forkJoin(deleteRequests).subscribe({
          next: () => {
            Swal.fire('Firmante Eliminado', `Se han eliminado los ${totalBoxes} recuadros de firma de ${nombre}.`, 'success');
            this.cargarDocumentos();
          },
          error: (err: any) => Swal.fire('Error', err.error?.message || 'No fue posible eliminar al firmante.', 'error')
        });
      }
    });
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
    if (this.resumenStats?.estados && this.resumenStats.estados[estado] !== undefined) {
      return this.resumenStats.estados[estado];
    }
    if (!this.documentos) return 0;
    return this.documentos.filter(d => d.estado === estado).length;
  }

  // ============================
  // GOOGLE DRIVE DRIVE COMPUTED PROPERTIES & FILTERS
  // ============================
  get carpetasPorEtiqueta(): any[] {
    const foldersMap = new Map<string, { id: number | null, nombre: string, color: string, count: number }>();

    const generalCount = (this.resumenStats?.etiquetas && (this.resumenStats.etiquetas['null'] ?? this.resumenStats.etiquetas[''])) ?? 0;
    foldersMap.set('general', { id: null, nombre: 'General / Sin Etiqueta', color: '#64748b', count: Number(generalCount) || 0 });

    this.etiquetasList.forEach(e => {
      const c = (this.resumenStats?.etiquetas && this.resumenStats.etiquetas[e.id!]) ? Number(this.resumenStats.etiquetas[e.id!]) : 0;
      foldersMap.set(e.id!.toString(), { id: e.id!, nombre: e.nombre, color: e.color || '#2563eb', count: c });
    });

    if (!this.resumenStats) {
      this.documentos.forEach(doc => {
        const key = doc.etiqueta_id ? doc.etiqueta_id.toString() : 'general';
        if (foldersMap.has(key)) {
          foldersMap.get(key)!.count++;
        } else if (doc.etiqueta) {
          foldersMap.set(key, { id: doc.etiqueta.id!, nombre: doc.etiqueta.nombre, color: doc.etiqueta.color || '#2563eb', count: 1 });
        }
      });
    }

    return Array.from(foldersMap.values()).filter(f => f.count > 0 || f.id !== null);
  }

  get carpetasPorAnioMes(): any[] {
    if (this.resumenStats?.periodos && Array.isArray(this.resumenStats.periodos)) {
      return this.resumenStats.periodos.map((p: any) => {
        const monthObj = this.mesesList.find(item => item.key === p.month);
        const label = `${monthObj ? monthObj.name : p.month} ${p.year}`;
        return {
          year: p.year,
          month: p.month,
          label: label,
          count: p.count
        };
      });
    }

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
    if (this.resumenStats?.procesos && Array.isArray(this.resumenStats.procesos)) {
      return this.resumenStats.procesos;
    }

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
    if (this.resumenStats?.periodos && Array.isArray(this.resumenStats.periodos)) {
      const set = new Set<string>(this.resumenStats.periodos.map((p: any) => p.year.toString()));
      if (set.size === 0) set.add(new Date().getFullYear().toString());
      return Array.from(set).sort((a, b) => b.localeCompare(a));
    }

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
    if (this.resumenStats?.procesos && Array.isArray(this.resumenStats.procesos)) {
      return this.resumenStats.procesos.map((p: any) => p.nombre);
    }

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
    return this.documentos;
  }

  abrirCarpetaEtiqueta(folder: any): void {
    this.selectedFolderType = 'etiqueta';
    this.selectedFolderKey = folder.id ? folder.id.toString() : 'general';
    this.selectedFolderName = `Etiqueta: ${folder.nombre}`;
    this.etiquetaFiltro = folder.id ? folder.id.toString() : 'null';
    if (this.viewMode === 'folders') {
      this.viewMode = 'grid';
    }
    this.currentPage = 1;
    this.cargarDocumentos();
  }

  abrirCarpetaAnioMes(folder: any): void {
    this.selectedFolderType = 'anio_mes';
    this.selectedFolderKey = `${folder.year}-${folder.month}`;
    this.selectedFolderName = `Período: ${folder.label}`;
    this.filtroAnio = folder.year;
    this.filtroMes = folder.month;
    if (this.viewMode === 'folders') {
      this.viewMode = 'grid';
    }
    this.currentPage = 1;
    this.cargarDocumentos();
  }

  abrirCarpetaEstado(estado: string): void {
    this.selectedFolderType = 'estado';
    this.selectedFolderKey = estado;
    this.selectedFolderName = `Estado: ${estado}`;
    this.estadoFiltro = estado;
    if (this.viewMode === 'folders') {
      this.viewMode = 'grid';
    }
    this.currentPage = 1;
    this.cargarDocumentos();
  }

  abrirCarpetaProceso(folder: any): void {
    this.selectedFolderType = 'proceso';
    this.selectedFolderKey = folder.nombre;
    this.selectedFolderName = `Proceso: ${folder.nombre}`;
    this.filtroProceso = folder.nombre;
    if (this.viewMode === 'folders') {
      this.viewMode = 'grid';
    }
    this.currentPage = 1;
    this.cargarDocumentos();
  }

  limpiarSeleccionCarpeta(): void {
    this.selectedFolderType = null;
    this.selectedFolderKey = null;
    this.selectedFolderName = 'Mi Unidad';
    this.estadoFiltro = '';
    this.etiquetaFiltro = '';
    this.filtroAnio = '';
    this.filtroMes = '';
    this.filtroProceso = '';
    this.search = '';
    this.viewMode = 'folders';
    this.currentPage = 1;
    this.cargarDocumentos();
  }
}
