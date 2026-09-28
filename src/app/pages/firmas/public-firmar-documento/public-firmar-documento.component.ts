import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DocumentoFirmaService } from 'src/app/services/documento-firma.service';
import SignaturePad from 'signature_pad';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-public-firmar-documento',
  templateUrl: './public-firmar-documento.component.html',
  styleUrls: ['./public-firmar-documento.component.css']
})
export class PublicFirmarDocumentoComponent implements OnInit, AfterViewInit {
  @ViewChild('signatureCanvas') signatureCanvasEl!: ElementRef<HTMLCanvasElement>;

  token: string = '';
  loading: boolean = true;
  submitting: boolean = false;
  errorMessage: string = '';
  errorData: any = null;
  docData: any = null;

  // PDF Preview
  pdfDoc: any = null;
  pagina: number = 1;
  totalPages: number = 1;
  zoom: number = 1.0;
  private pdfLib: any = null;

  // Mobile navigation tab ('DOCUMENTO' | 'FIRMAR')
  mobileTab: 'DOCUMENTO' | 'FIRMAR' = 'DOCUMENTO';

  // Canvas Signature Pad
  signaturePad!: SignaturePad;
  signatureBase64: string = '';
  showRechazoModal: boolean = false;
  motivoRechazo: string = '';

  // Método de firma seleccionado por el firmante
  metodoFirmaSeleccionado: 'PULSO' | 'DIGITAL' = 'DIGITAL';

  constructor(
    private route: ActivatedRoute,
    private docFirmaService: DocumentoFirmaService
  ) { }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.loadPdfLib();
    if (this.token) {
      this.loadDocumentData();
    } else {
      this.errorMessage = 'Enlace de firma no válido.';
      this.loading = false;
    }
  }

  ngAfterViewInit(): void {
    if (this.signatureCanvasEl) {
      this.initSignaturePad();
    }
  }

  get isSignaturePage(): boolean {
    if (this.recuadrosAsignados.length) {
      return this.recuadrosAsignados.some(r => r.pagina === this.pagina);
    }
    return this.pagina === (this.docData?.destinatario?.pagina || 1);
  }

  get targetPageNumber(): number {
    return this.docData?.destinatario?.pagina || 1;
  }

  // Múltiples recuadros de firma asignados al firmante
  firmarTodasLasPaginas: boolean = true;

  // Estado de selección del checklist por recuadro ID
  recuadroSelections: { [id: number]: boolean } = {};

  initRecuadroSelections(): void {
    this.recuadroSelections = {};
    const pend = this.recuadrosPendientes;
    for (const r of pend) {
      if (r.id) {
        this.recuadroSelections[r.id] = true;
      }
    }
  }

  isRecuadroSelected(id: number): boolean {
    if (!id) return true;
    return this.recuadroSelections[id] !== false;
  }

  toggleRecuadroSelection(id: number): void {
    if (!id) return;
    this.recuadroSelections[id] = !this.isRecuadroSelected(id);
    this.firmarTodasLasPaginas = (this.selectedRecuadroIds.length === this.recuadrosPendientes.length);
  }

  seleccionarTodosRecuadros(): void {
    for (const r of this.recuadrosPendientes) {
      if (r.id) this.recuadroSelections[r.id] = true;
    }
    this.firmarTodasLasPaginas = true;
  }

  deseleccionarTodosRecuadros(): void {
    for (const r of this.recuadrosPendientes) {
      if (r.id) this.recuadroSelections[r.id] = false;
    }
    this.firmarTodasLasPaginas = false;
  }

  get selectedRecuadroIds(): number[] {
    return this.recuadrosPendientes
      .filter(r => r.id && this.recuadroSelections[r.id] !== false)
      .map(r => r.id);
  }

  get recuadrosAsignados(): any[] {
    const list = this.docData?.destinatario?.recuadros_asignados;
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    if (this.docData?.destinatario) {
      return [this.docData.destinatario];
    }
    return [];
  }

  get totalRecuadros(): number {
    return this.recuadrosAsignados.length || 1;
  }

  get recuadrosPendientes(): any[] {
    if (!this.recuadrosAsignados.length) {
      return this.docData?.destinatario?.estado === 'FIRMADO' ? [] : [this.docData?.destinatario];
    }
    return this.recuadrosAsignados.filter(r => r.estado !== 'FIRMADO');
  }

  get recuadrosFirmadosCount(): number {
    return this.totalRecuadros - this.recuadrosPendientes.length;
  }

  get recuadrosEnPaginaActual(): any[] {
    if (!this.recuadrosAsignados.length) {
      return this.isSignaturePage ? [this.docData?.destinatario] : [];
    }
    return this.recuadrosAsignados.filter(r => Number(r.pagina || 1) === Number(this.pagina));
  }

  goToPage(num: number): void {
    if (num >= 1 && num <= this.totalPages) {
      this.pagina = num;
      this.renderPage(this.pagina);
    }
  }

  // Conversión exacta: mm a PDF points (72 / 25.4 = 2.834645) por zoom
  get mmToPoints(): number {
    return 72 / 25.4;
  }

  getBoxLeft(box: any): number {
    return (box.posicion_x || 0) * this.mmToPoints * this.zoom;
  }

  getBoxTop(box: any): number {
    return (box.posicion_y || 0) * this.mmToPoints * this.zoom;
  }

  getBoxWidth(box: any): number {
    return Math.max((box.ancho || 40) * this.mmToPoints * this.zoom, 60);
  }

  getBoxHeight(box: any): number {
    return Math.max((box.alto || 15) * this.mmToPoints * this.zoom, 25);
  }

  goToSignaturePage(): void {
    if (this.targetPageNumber >= 1 && this.targetPageNumber <= this.totalPages) {
      this.pagina = this.targetPageNumber;
      this.renderPage(this.pagina);
    }
  }

  setMobileTab(tab: 'DOCUMENTO' | 'FIRMAR'): void {
    this.mobileTab = tab;
    if (tab === 'FIRMAR') {
      setTimeout(() => {
        this.initSignaturePad();
      }, 150);
    }
  }

  selectMetodoFirma(metodo: 'PULSO' | 'DIGITAL'): void {
    this.metodoFirmaSeleccionado = metodo;
    if (metodo === 'PULSO') {
      setTimeout(() => {
        this.initSignaturePad();
      }, 150);
    }
  }

  public initSignaturePad(): void {
    if (!this.signatureCanvasEl) return;
    const canvas = this.signatureCanvasEl.nativeElement;
    if (!canvas) return;

    if (this.signaturePad) {
      this.signaturePad.off();
    }

    const parentW = canvas.parentElement?.clientWidth || 400;
    canvas.width = Math.max(parentW - 8, 280);
    canvas.height = 160;

    this.signaturePad = new SignaturePad(canvas, {
      minWidth: 1.5,
      maxWidth: 3.5,
      penColor: '#0f172a'
    });

    if (this.firmaPrecargadaAplicada && this.docData?.destinatario?.firma_preloaded) {
      this.cargarFirmaPrecargada();
    }
  }

  // Firma Precargada desde Perfil (AWS S3)
  firmaPrecargadaAplicada: boolean = false;

  cargarFirmaPrecargada(): void {
    if (!this.docData?.destinatario?.firma_preloaded) return;
    const dataUri = this.docData.destinatario.firma_preloaded;
    this.firmaPrecargadaAplicada = true;

    const img = new Image();
    img.onload = () => {
      // 1. Generar base64 con fondo blanco en canvas fuera de pantalla para envío al backend
      const offCanvas = document.createElement('canvas');
      offCanvas.width = 600;
      offCanvas.height = 300;
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        offCtx.fillStyle = '#FFFFFF';
        offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        const scale = Math.min((offCanvas.width - 40) / img.width, (offCanvas.height - 40) / img.height);
        const x = (offCanvas.width - img.width * scale) / 2;
        const y = (offCanvas.height - img.height * scale) / 2;
        offCtx.drawImage(img, x, y, img.width * scale, img.height * scale);
        this.signatureBase64 = offCanvas.toDataURL('image/png');
      }

      // 2. Renderizar visualmente en el canvas interactivo
      if (this.signatureCanvasEl) {
        const canvas = this.signatureCanvasEl.nativeElement;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const scaleVis = Math.min((canvas.width - 20) / img.width, (canvas.height - 20) / img.height);
          const xVis = (canvas.width - img.width * scaleVis) / 2;
          const yVis = (canvas.height - img.height * scaleVis) / 2;
          ctx.drawImage(img, xVis, yVis, img.width * scaleVis, img.height * scaleVis);
        }
      }
    };
    img.src = dataUri;
  }

  clearSignature(): void {
    if (this.signaturePad) {
      this.signaturePad.clear();
      this.signatureBase64 = '';
      this.firmaPrecargadaAplicada = false;
    }
  }

  private loadPdfLib(): void {
    const scriptId = 'pdf-js-script-public';
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
      if (this.docData?.documento?.pdf_url && !this.pdfDoc) {
        this.renderPdfFromUrl(this.docData.documento.pdf_url);
      }
    };
    document.head.appendChild(script);
  }

  loadDocumentData(forceReloadPdf: boolean = false): void {
    this.loading = true;
    this.docFirmaService.getByToken(this.token).subscribe({
      next: (res: any) => {
        this.docData = res.data;
        this.loading = false;
        this.pagina = this.docData.destinatario?.pagina || 1;
        this.initRecuadroSelections();

        const tipoReq = this.docData.destinatario?.tipo_firma_requerida;
        if (tipoReq === 'PULSO') {
          this.metodoFirmaSeleccionado = 'PULSO';
        } else if (tipoReq === 'DIGITAL') {
          this.metodoFirmaSeleccionado = 'DIGITAL';
        } else {
          this.metodoFirmaSeleccionado = 'PULSO'; // Selección por defecto en modo libre
        }

        if (forceReloadPdf) {
          this.pdfDoc = null;
          this.isRendering = false;
        }

        setTimeout(() => {
          this.initSignaturePad();
          if (this.docData.documento?.pdf_url && this.pdfLib && (!this.pdfDoc || forceReloadPdf)) {
            const cacheBuster = (this.docData.documento.pdf_url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
            this.renderPdfFromUrl(this.docData.documento.pdf_url + cacheBuster);
          }
        }, 300);
      },
      error: (err: any) => {
        this.loading = false;
        this.errorData = err.error || null;
        this.errorMessage = err.error?.message || 'No fue posible cargar el documento para firma.';
      }
    });
  }

  private isRendering = false;
  private currentRenderTask: any = null;

  private async renderPdfFromUrl(url: string): Promise<void> {
    if (!this.pdfLib || this.isRendering) return;
    this.isRendering = true;
    try {
      this.pdfDoc = await this.pdfLib.getDocument(url).promise;
      this.totalPages = this.pdfDoc.numPages;
      await this.autoFitWidth();
      await this.renderPage(this.pagina);
    } catch (e) {
      console.error('Error renderizando PDF público:', e);
    } finally {
      this.isRendering = false;
    }
  }

  async autoFitWidth(): Promise<void> {
    if (!this.pdfDoc) return;
    try {
      const page = await this.pdfDoc.getPage(1);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const container = document.getElementById('public-pdf-container');
      const containerW = container ? (container.clientWidth - 24) : (window.innerWidth - 32);
      if (containerW > 0 && unscaledViewport.width > 0) {
        // Calcular escala óptima para cubrir el ancho disponible
        const computedZoom = Math.min(Math.max(containerW / unscaledViewport.width, 0.45), 2.2);
        this.zoom = Number(computedZoom.toFixed(2));
      }
    } catch (e) {
      console.error('Error calculando fit zoom:', e);
    }
  }

  private async renderPage(num: number): Promise<void> {
    if (!this.pdfDoc) return;

    // Cancel any in-progress render
    if (this.currentRenderTask) {
      try { this.currentRenderTask.cancel(); } catch (_) { }
      this.currentRenderTask = null;
    }

    const page = await this.pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: this.zoom });

    const canvas = document.getElementById('public-pdf-canvas') as HTMLCanvasElement;
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
    try {
      await this.currentRenderTask.promise;
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') {
        throw e;
      }
    } finally {
      this.currentRenderTask = null;
    }
  }

  changePage(delta: number): void {
    const newPage = this.pagina + delta;
    if (newPage >= 1 && newPage <= this.totalPages) {
      this.pagina = newPage;
      this.renderPage(this.pagina);
    }
  }

  changeZoom(delta: number): void {
    const newZoom = Number((this.zoom + delta).toFixed(2));
    if (newZoom >= 0.35 && newZoom <= 3.0) {
      this.zoom = newZoom;
      this.renderPage(this.pagina);
    }
  }

  // Pan / Click & Drag en el visor de PDF (Navegación por arrastre en Desktop y Móvil)
  isPanning: boolean = false;
  panStartX: number = 0;
  panStartY: number = 0;
  scrollStartX: number = 0;
  scrollStartY: number = 0;
  private touchInitialDist: number = 0;
  private touchInitialZoom: number = 1.0;

  onPanStart(event: MouseEvent): void {
    const container = document.getElementById('public-pdf-container');
    if (!container) return;
    this.isPanning = true;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.scrollStartX = container.scrollLeft;
    this.scrollStartY = container.scrollTop;
  }

  onPanMove(event: MouseEvent): void {
    if (!this.isPanning) return;
    const container = document.getElementById('public-pdf-container');
    if (!container) return;
    event.preventDefault();
    const dx = event.clientX - this.panStartX;
    const dy = event.clientY - this.panStartY;
    container.scrollLeft = this.scrollStartX - dx;
    container.scrollTop = this.scrollStartY - dy;
  }

  onPanEnd(): void {
    this.isPanning = false;
  }

  // Soporte de Gestos Táctiles (Smartphones, Tablets y Pantallas Pequeñas)
  onTouchStart(event: TouchEvent): void {
    const container = document.getElementById('public-pdf-container');
    if (!container) return;

    if (event.touches.length === 1) {
      this.isPanning = true;
      const touch = event.touches[0];
      this.panStartX = touch.clientX;
      this.panStartY = touch.clientY;
      this.scrollStartX = container.scrollLeft;
      this.scrollStartY = container.scrollTop;
    } else if (event.touches.length === 2) {
      this.isPanning = false;
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      this.touchInitialDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      this.touchInitialZoom = this.zoom;
    }
  }

  onTouchMove(event: TouchEvent): void {
    const container = document.getElementById('public-pdf-container');
    if (!container) return;

    if (this.isPanning && event.touches.length === 1) {
      const touch = event.touches[0];
      const dx = touch.clientX - this.panStartX;
      const dy = touch.clientY - this.panStartY;
      container.scrollLeft = this.scrollStartX - dx;
      container.scrollTop = this.scrollStartY - dy;
    } else if (event.touches.length === 2 && this.touchInitialDist > 0) {
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const scale = currentDist / this.touchInitialDist;
      const calculatedZoom = Math.min(Math.max(this.touchInitialZoom * scale, 0.35), 3.0);

      if (Math.abs(calculatedZoom - this.zoom) > 0.08) {
        this.zoom = Number(calculatedZoom.toFixed(2));
        this.renderPage(this.pagina);
      }
    }
  }

  onTouchEnd(event: TouchEvent): void {
    if (event.touches.length === 0) {
      this.isPanning = false;
      this.touchInitialDist = 0;
    } else if (event.touches.length === 1) {
      const container = document.getElementById('public-pdf-container');
      if (container) {
        this.isPanning = true;
        const touch = event.touches[0];
        this.panStartX = touch.clientX;
        this.panStartY = touch.clientY;
        this.scrollStartX = container.scrollLeft;
        this.scrollStartY = container.scrollTop;
      }
    }
  }

  firmarDocumento(): void {
    if (this.recuadrosPendientes.length > 0 && this.selectedRecuadroIds.length === 0) {
      Swal.fire('Atención', 'Debes seleccionar al menos un recuadro de firma para estampar.', 'warning');
      return;
    }

    if (this.metodoFirmaSeleccionado === 'PULSO') {
      // Verificar si hay contenido: trazo manual O firma precargada aplicada
      const tieneTrazo = this.signaturePad && !this.signaturePad.isEmpty();
      const tienePrecargada = this.firmaPrecargadaAplicada && !!this.signatureBase64;

      if (!tieneTrazo && !tienePrecargada) {
        Swal.fire('Firma Requerida', 'Por favor dibuja tu trazo de firma a pulso dentro del recuadro o usa tu firma precargada.', 'warning');
        return;
      }

      // Si el usuario dibujó un trazo manual en el canvas, re-exportamos del canvas visible sobre fondo blanco
      if (tieneTrazo && this.signatureCanvasEl) {
        const originalCanvas = this.signatureCanvasEl.nativeElement;
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = originalCanvas.width;
        tmpCanvas.height = originalCanvas.height;
        const ctx = tmpCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
          ctx.drawImage(originalCanvas, 0, 0);
          this.signatureBase64 = tmpCanvas.toDataURL('image/png');
        }
      }
    }

    const count = this.selectedRecuadroIds.length;
    const textoMetodo = (this.metodoFirmaSeleccionado === 'PULSO') ? 'Firma a Pulso' : 'Firma Digital Autoverificada Saint';
    const textoCantidad = (count > 1) ? `en los ${count} recuadros seleccionados` : 'en el recuadro seleccionado';

    Swal.fire({
      title: '¿Confirmar Firma Electrónica?',
      text: `Estamparás tu ${textoMetodo} ${textoCantidad} de forma permanente.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Sí, Firmar (${count})`,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.procesarFirma();
      }
    });
  }

  irASaint(): void {
    window.location.href = window.location.origin;
  }

  cerrarPestana(): void {
    try {
      window.close();
    } catch (e) {
      console.warn('No fue posible cerrar la pestaña directamente:', e);
    }
    setTimeout(() => {
      window.location.href = 'about:blank';
    }, 300);
  }

  private procesarFirma(): void {
    const selectedIds = this.selectedRecuadroIds;
    if (this.recuadrosPendientes.length > 0 && selectedIds.length === 0) {
      Swal.fire('Atención', 'Debes seleccionar al menos un recuadro de firma.', 'warning');
      return;
    }

    const firmarTodas = (selectedIds.length === this.recuadrosPendientes.length);

    this.submitting = true;
    this.docFirmaService.signByToken(this.token, {
      metodo_firma_usado: this.metodoFirmaSeleccionado,
      firma_pulso_base64: (this.metodoFirmaSeleccionado === 'PULSO') ? this.signatureBase64 : undefined,
      firmar_todas: firmarTodas,
      destinatario_ids: firmarTodas ? undefined : selectedIds
    }).subscribe({
      next: (res: any) => {
        this.submitting = false;
        this.mobileTab = 'DOCUMENTO';

        // Recargar datos y renderizar PDF firmado inmediatamente sin refrescar la página
        this.loadDocumentData(true);

        const msgText = (selectedIds.length > 1)
          ? `Se han estampado tus firmas en los ${selectedIds.length} recuadros seleccionados.`
          : 'Tu firma ha sido estampada en el recuadro seleccionado.';

        Swal.fire({
          title: '¡Firma Registrada Exitosamente!',
          text: msgText,
          icon: 'success',
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonColor: '#2563eb',
          denyButtonColor: '#059669',
          cancelButtonColor: '#64748b',
          confirmButtonText: '<i class="bi bi-house-door-fill"></i> Ir a Saint System',
          denyButtonText: '<i class="bi bi-download"></i> Descargar Copia',
          cancelButtonText: 'Ver Documento'
        }).then((result) => {
          if (result.isConfirmed) {
            this.irASaint();
          } else if (result.isDenied) {
            if (this.docData?.documento?.pdf_url) {
              window.open(this.docData.documento.pdf_url, '_blank');
            }
          }
        });
      },
      error: (err: any) => {
        this.submitting = false;
        Swal.fire('Error al firmar', err.error?.message || 'Ocurrió un error al guardar la firma.', 'error');
      }
    });
  }

  rechazarDocumento(): void {
    if (!this.motivoRechazo.trim()) {
      Swal.fire('Atención', 'Por favor ingresa un motivo para el rechazo.', 'warning');
      return;
    }
    this.submitting = true;
    this.docFirmaService.signByToken(this.token, {
      rechazar: true,
      motivo_rechazo: this.motivoRechazo
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.showRechazoModal = false;
        Swal.fire('Documento Rechazado', 'Has notificado el rechazo del documento.', 'info');
        this.loadDocumentData();
      },
      error: (err: any) => {
        this.submitting = false;
        Swal.fire('Error', err.error?.message || 'No fue posible registrar el rechazo', 'error');
      }
    });
  }
}