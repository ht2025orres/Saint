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
  ) {}

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
    return this.pagina === (this.docData?.destinatario?.pagina || 1);
  }

  get targetPageNumber(): number {
    return this.docData?.destinatario?.pagina || 1;
  }

  // Conversión exacta: mm a PDF points (72 / 25.4 = 2.834645) por zoom
  private get mmToPoints(): number {
    return 72 / 25.4;
  }

  get markerLeft(): number {
    const mmX = this.docData?.destinatario?.posicion_x || 0;
    return mmX * this.mmToPoints * this.zoom;
  }

  get markerTop(): number {
    const mmY = this.docData?.destinatario?.posicion_y || 0;
    return mmY * this.mmToPoints * this.zoom;
  }

  get markerWidth(): number {
    const mmW = this.docData?.destinatario?.ancho || 40;
    return Math.max(mmW * this.mmToPoints * this.zoom, 60);
  }

  get markerHeight(): number {
    const mmH = this.docData?.destinatario?.alto || 15;
    return Math.max(mmH * this.mmToPoints * this.zoom, 25);
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
  }

  clearSignature(): void {
    if (this.signaturePad) {
      this.signaturePad.clear();
      this.signatureBase64 = '';
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

  loadDocumentData(): void {
    this.loading = true;
    this.docFirmaService.getByToken(this.token).subscribe({
      next: (res: any) => {
        this.docData = res.data;
        this.loading = false;
        this.pagina = this.docData.destinatario?.pagina || 1;
        
        const tipoReq = this.docData.destinatario?.tipo_firma_requerida;
        if (tipoReq === 'PULSO') {
          this.metodoFirmaSeleccionado = 'PULSO';
        } else if (tipoReq === 'DIGITAL') {
          this.metodoFirmaSeleccionado = 'DIGITAL';
        } else {
          this.metodoFirmaSeleccionado = 'PULSO'; // Selección por defecto en modo libre
        }

        setTimeout(() => {
          this.initSignaturePad();
          if (this.docData.documento?.pdf_url && this.pdfLib && !this.pdfDoc) {
            this.renderPdfFromUrl(this.docData.documento.pdf_url);
          }
        }, 300);
      },
      error: (err: any) => {
        this.loading = false;
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
      try { this.currentRenderTask.cancel(); } catch (_) {}
      this.currentRenderTask = null;
    }

    const page = await this.pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: this.zoom });
    
    const canvas = document.getElementById('public-pdf-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

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
    if (this.metodoFirmaSeleccionado === 'PULSO') {
      if (!this.signaturePad || this.signaturePad.isEmpty()) {
        Swal.fire('Firma Requerida', 'Por favor dibuja tu trazo de firma a pulso dentro del recuadro.', 'warning');
        return;
      }
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

    const textoMetodo = (this.metodoFirmaSeleccionado === 'PULSO') ? 'Firma a Pulso' : 'Firma Digital Autoverificada Saint';

    Swal.fire({
      title: '¿Confirmar Firma Electrónica?',
      text: `Estamparás tu ${textoMetodo} en este documento oficial de forma permanente.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, Firmar Documento',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.procesarFirma();
      }
    });
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
    this.submitting = true;
    this.docFirmaService.signByToken(this.token, {
      metodo_firma_usado: this.metodoFirmaSeleccionado,
      firma_pulso_base64: (this.metodoFirmaSeleccionado === 'PULSO') ? this.signatureBase64 : undefined
    }).subscribe({
      next: (res: any) => {
        this.submitting = false;
        Swal.fire({
          title: '¡Firma Registrada Exitosamente!',
          text: 'El documento ha sido estampado y firmado digitalmente.',
          icon: 'success',
          showCancelButton: true,
          confirmButtonColor: '#2563eb',
          cancelButtonColor: '#475569',
          confirmButtonText: 'Cerrar Pestaña',
          cancelButtonText: 'Ver Documento'
        }).then((result) => {
          if (result.isConfirmed) {
            this.cerrarPestana();
          } else {
            this.loadDocumentData();
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
