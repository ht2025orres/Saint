import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { FirmasService } from 'src/app/services/firmas.service';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-firmas-subir',
  templateUrl: './firmas-subir.component.html',
})
export class FirmasSubirComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();

  archivo: File | null = null;
  motivo: string = '';
  nombre_firmante: string = '';
  email_firmante: string = '';
  isExternal: boolean = false;
  loading = false;

  // Nuevos campos de posicionamiento
  posicion_x: number = 10;
  posicion_y: number = 250;
  ancho: number = 110;
  alto: number = 30;
  pagina: number = 1;
  totalPages: number = 0;
  
  // PDF Preview properties
  pdfDoc: any = null;
  showGhost: boolean = false;
  ghostX: number = 0;
  ghostY: number = 0;
  ghostW: number = 110;
  ghostH: number = 30;
  zoom: number = 1.0;
  private pdfLib: any = null;

  // Dragging properties
  isDragging: boolean = false;
  dragStartX: number = 0;
  dragStartY: number = 0;

  constructor(
    private firmasService: FirmasService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadPdfLib();
    // Si es interno, podemos precargar datos del usuario logueado
    if (this.authService.user) {
      this.nombre_firmante = this.authService.user.nombre_completo || 
                             `${this.authService.user.firstName ?? ''} ${this.authService.user.lastName ?? ''}`.trim();
      this.email_firmante = this.authService.user.email;
    }
  }

  private loadPdfLib(): void {
    const scriptId = 'pdf-js-script';
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

  onFileChange(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.archivo = file;
      this.loadPdfPreview();
    } else {
      Swal.fire('Error', 'Solo se permiten archivos PDF', 'error');
      event.target.value = null;
    }
  }

  private loadPdfPreview(): void {
    if (!this.archivo || !this.pdfLib) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const typedarray = new Uint8Array(reader.result as ArrayBuffer);
      try {
        this.pdfDoc = await this.pdfLib.getDocument(typedarray).promise;
        this.totalPages = this.pdfDoc.numPages;
        this.pagina = 1;
        this.renderPage(this.pagina);
      } catch (error) {
        console.error('Error cargando PDF:', error);
        Swal.fire('Error', 'No se pudo previsualizar el PDF', 'error');
      }
    };
    reader.readAsArrayBuffer(this.archivo);
  }

  private async renderPage(num: number): Promise<void> {
    if (!this.pdfDoc) return;

    const page = await this.pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: this.zoom });
    
    const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;
    this.updateGhostSize();
  }

  changePage(delta: number): void {
    const newPage = this.pagina + delta;
    if (newPage >= 1 && newPage <= this.totalPages) {
      this.pagina = newPage;
      this.renderPage(this.pagina);
    }
  }

  changeZoom(delta: number): void {
    const newZoom = this.zoom + delta;
    if (newZoom >= 0.5 && newZoom <= 3.0) {
      this.zoom = newZoom;
      this.renderPage(this.pagina);
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

    // Calcular dimensiones del ghost (soporta arrastre en cualquier dirección)
    this.ghostX = Math.min(this.dragStartX, currentX);
    this.ghostY = Math.min(this.dragStartY, currentY);
    this.ghostW = Math.abs(currentX - this.dragStartX);
    this.ghostH = Math.abs(currentY - this.dragStartY);
  }

  onMouseUp(event: MouseEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    // Validar tamaño mínimo (ej: 10px) para evitar clics accidentales
    if (this.ghostW < 10 || this.ghostH < 10) {
      this.showGhost = false;
      return;
    }

    // Convertir a coordenadas de PDF (mm)
    this.pdfDoc.getPage(this.pagina).then((page: any) => {
      const viewport = page.getViewport({ scale: 1.0 });
      const mmPerPoint = 25.4 / 72;
      
      const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
      const scaleX = viewport.width / canvas.width;
      const scaleY = viewport.height / canvas.height;

      // Posición X e Y (Top-Left del rectángulo dibujado)
      const pdfXPoints = this.ghostX * scaleX;
      const pdfYPoints = this.ghostY * scaleY;
      
      this.posicion_x = Math.round(pdfXPoints * mmPerPoint);
      this.posicion_y = Math.round(pdfYPoints * mmPerPoint);

      // Ancho y Alto en mm
      this.ancho = Math.round((this.ghostW * scaleX) * mmPerPoint);
      this.alto = Math.round((this.ghostH * scaleY) * mmPerPoint);

      // Limitar a valores mínimos razonables (20mm x 8mm)
      if (this.ancho < 20) this.ancho = 20;
      if (this.alto < 8) this.alto = 8;
      
      // Actualizar ghost visual para que coincida con los mm redondeados
      this.updateGhostSize();
    });
  }

  updateGhostSize(): void {
    if (!this.pdfDoc || !this.showGhost) return;

    this.pdfDoc.getPage(this.pagina).then((page: any) => {
      const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
      if (!canvas) return;

      const viewport = page.getViewport({ scale: 1.0 });
      const scaleX = viewport.width / canvas.width;
      const scaleY = viewport.height / canvas.height;
      const mmToPoints = 72 / 25.4;

      this.ghostW = (this.ancho * mmToPoints) / scaleX;
      this.ghostH = (this.alto * mmToPoints) / scaleY;
    });
  }

  submit(): void {
    if (!this.archivo) {
      Swal.fire('Error', 'Debe seleccionar un archivo', 'warning');
      return;
    }

    this.loading = true;
    const formData = new FormData();
    formData.append('documento', this.archivo);
    formData.append('motivo', this.motivo);
    formData.append('posicion_x', this.posicion_x.toString());
    formData.append('posicion_y', this.posicion_y.toString());
    formData.append('ancho', this.ancho.toString());
    formData.append('alto', this.alto.toString());
    formData.append('pagina', this.pagina.toString());
    
    // Enviamos el user_id explícitamente desde el front
    if (this.authService.user && this.authService.user.id) {
      formData.append('user_id', this.authService.user.id.toString());
    }
    
    if (this.isExternal) {
      formData.append('nombre_firmante', this.nombre_firmante);
      formData.append('email_firmante', this.email_firmante);
    }

    this.firmasService.signDocument(formData).subscribe({
      next: () => {
        Swal.fire('Exito', 'Documento firmado correctamente', 'success');
        this.loading = false;
        this.completado.emit();
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'Error al firmar documento', 'error');
        this.loading = false;
      }
    });
  }
}
