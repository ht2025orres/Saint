import { Component, EventEmitter, Output, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DocumentoFirmaService, DocumentoFirmaEtiqueta } from 'src/app/services/documento-firma.service';
import { AuthService } from 'src/app/services/auth.service';
import { environment } from 'src/environments/environment';
import SignaturePad from 'signature_pad';
import Swal from 'sweetalert2';

export interface FirmanteAsignado {
  isCreator?: boolean;
  colaborador_id: number;
  nombre: string;
  cargo?: string;
  correo_corporativo?: string;
  correo_personal?: string;
  tipo_correo: 'corporativo' | 'personal';
  pagina: number;
  posicion_x: number;
  posicion_y: number;
  ancho: number;
  alto: number;
  tipo_firma_requerida: 'DIGITAL' | 'PULSO' | 'AMBAS';
}

export interface GroupedFirmante {
  key: string;
  colaborador_id: number;
  isCreator: boolean;
  nombre: string;
  cargo: string;
  correo_corporativo: string;
  correo_personal: string;
  tipo_correo: 'corporativo' | 'personal';
  tipo_firma_requerida: 'DIGITAL' | 'PULSO' | 'AMBAS';
  expanded: boolean;
  boxes: {
    index: number;
    pagina: number;
    posicion_x: number;
    posicion_y: number;
    ancho: number;
    alto: number;
  }[];
}

export interface DocumentoTabState {
  id: string;
  tituloTab: string;
  archivo: File | null;
  titulo: string;
  descripcion: string;
  etiquetaId: number | null;
  firmantes: FirmanteAsignado[];
  firmarAhoraCreador: boolean;
  creatorSignatureBase64: string;
  creadorPagina: number;
  creadorX: number;
  creadorY: number;
  creadorAncho: number;
  creadorAlto: number;
  creadorTipoFirma: 'DIGITAL' | 'PULSO' | 'AMBAS';
  
  pdfDoc: any | null;
  pagina: number;
  totalPages: number;
  zoom: number;
  activeFirmanteIndex: number;
  ghostX: number;
  ghostY: number;
  ghostW: number;
  ghostH: number;
  showGhost: boolean;
}

@Component({
  selector: 'app-firmas-subir',
  templateUrl: './firmas-subir.component.html',
  styleUrls: ['./firmas-subir.component.css']
})
export class FirmasSubirComponent implements OnInit {
  @Output() completado = new EventEmitter<void>();
  @ViewChild('creatorSignatureCanvas') creatorCanvasEl!: ElementRef<HTMLCanvasElement>;

  // Pestañas Multi-Documento
  tabs: DocumentoTabState[] = [];
  activeTabIndex: number = 0;

  archivo: File | null = null;
  titulo: string = '';
  descripcion: string = '';
  loading = false;

  // Drag and Drop & Conversión Word (.doc / .docx)
  isDraggingFileOver: boolean = false;
  isConvertingWord: boolean = false;
  convertingMessage: string = '';

  // Arrastre y Movimiento Directo de Recuadros Existentes sobre Canvas
  isMovingBox: boolean = false;
  movingBoxIndex: number = -1;
  boxDragOffsetX: number = 0;
  boxDragOffsetY: number = 0;

  // Popover Emergente de Sobreescritura y Asignación de Firmante sobre Canvas
  showAssignPopover: boolean = false;
  popoverX: number = 0;
  popoverY: number = 0;
  popoverFirmanteIndex: number = -1;
  popoverSearch: string = '';
  popoverColaboradoresFiltrados: any[] = [];
  grupoExpandedState: { [key: string]: boolean } = {};

  // Etiquetas / Categorías por Proceso
  etiquetasList: DocumentoFirmaEtiqueta[] = [];
  etiquetaId: number | null = null;
  mostrarNuevaEtiquetaModal: boolean = false;
  mostrarModalEtiquetas: boolean = false;
  nuevaEtiquetaNombre: string = '';

  // Creador firma opcional
  firmarAhoraCreador: boolean = false;
  creatorSignaturePad!: SignaturePad;
  creatorSignatureBase64: string = '';
  creadorPagina: number = 1;
  creadorX: number = 10;
  creadorY: number = 220;
  creadorAncho: number = 110;
  creadorAlto: number = 30;
  creadorTipoFirma: 'DIGITAL' | 'PULSO' | 'AMBAS' = 'AMBAS';

  // Lista de Colaboradores para Asignar
  colaboradoresList: any[] = [];
  colaboradorSearch: string = '';
  colaboradoresFiltrados: any[] = [];
  mostrarDropdownColab: boolean = false;

  // Firmantes Seleccionados
  firmantes: FirmanteAsignado[] = [];

  // PDF Preview & Ghost properties
  pdfDoc: any = null;
  pagina: number = 1;
  totalPages: number = 0;
  zoom: number = 1.0;
  pdfViewportWidth: number = 595;
  pdfViewportHeight: number = 842;
  private pdfLib: any = null;

  // Posicionamiento interactivo
  activeFirmanteIndex: number = -1;
  isDragging: boolean = false;
  dragStartX: number = 0;
  dragStartY: number = 0;
  ghostX: number = 0;
  ghostY: number = 0;
  ghostW: number = 110;
  ghostH: number = 30;
  showGhost: boolean = false;

  private baseUrl = environment.URL_API_LARAVEL;

  constructor(
    private http: HttpClient,
    private docFirmaService: DocumentoFirmaService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.tabs = [this.createDefaultTab('Documento 1')];
    this.activeTabIndex = 0;
    this.loadTabState(this.tabs[0]);
    this.loadPdfLib();
    this.loadWordConverterLibs();
    this.loadColaboradores();
    this.loadEtiquetas();
  }

  createDefaultTab(name: string): DocumentoTabState {
    return {
      id: Math.random().toString(36).substring(2, 9),
      tituloTab: name,
      archivo: null,
      titulo: '',
      descripcion: '',
      etiquetaId: null,
      firmantes: [],
      firmarAhoraCreador: false,
      creatorSignatureBase64: '',
      creadorPagina: 1,
      creadorX: 10,
      creadorY: 220,
      creadorAncho: 110,
      creadorAlto: 30,
      creadorTipoFirma: 'AMBAS',
      pdfDoc: null,
      pagina: 1,
      totalPages: 0,
      zoom: 1.0,
      activeFirmanteIndex: -1,
      ghostX: 0,
      ghostY: 0,
      ghostW: 110,
      ghostH: 30,
      showGhost: false
    };
  }

  saveCurrentTabState(): void {
    if (!this.tabs[this.activeTabIndex]) return;
    const t = this.tabs[this.activeTabIndex];
    t.archivo = this.archivo;
    t.titulo = this.titulo;
    t.descripcion = this.descripcion;
    t.etiquetaId = this.etiquetaId;
    t.firmantes = [...this.firmantes];
    t.firmarAhoraCreador = this.firmarAhoraCreador;
    t.creatorSignatureBase64 = this.creatorSignatureBase64;
    t.creadorPagina = this.creadorPagina;
    t.creadorX = this.creadorX;
    t.creadorY = this.creadorY;
    t.creadorAncho = this.creadorAncho;
    t.creadorAlto = this.creadorAlto;
    t.creadorTipoFirma = this.creadorTipoFirma;
    t.pdfDoc = this.pdfDoc;
    t.pagina = this.pagina;
    t.totalPages = this.totalPages;
    t.zoom = this.zoom;
    t.activeFirmanteIndex = this.activeFirmanteIndex;
    t.ghostX = this.ghostX;
    t.ghostY = this.ghostY;
    t.ghostW = this.ghostW;
    t.ghostH = this.ghostH;
    t.showGhost = this.showGhost;
    t.tituloTab = this.titulo.trim() || t.tituloTab;
  }

  crearNuevaPestana(): void {
    this.saveCurrentTabState();
    const newTab = this.createDefaultTab(`Documento ${this.tabs.length + 1}`);
    this.tabs.push(newTab);
    this.seleccionarTab(this.tabs.length - 1);
  }

  seleccionarTab(index: number): void {
    if (index === this.activeTabIndex) return;
    this.saveCurrentTabState();
    this.activeTabIndex = index;
    this.loadTabState(this.tabs[index]);
  }

  cerrarTab(index: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.tabs.length <= 1) {
      this.tabs[0] = this.createDefaultTab('Documento 1');
      this.loadTabState(this.tabs[0]);
      return;
    }

    this.tabs.splice(index, 1);
    if (this.activeTabIndex >= this.tabs.length) {
      this.activeTabIndex = this.tabs.length - 1;
    }
    this.loadTabState(this.tabs[this.activeTabIndex]);
  }

  loadTabState(t: DocumentoTabState): void {
    this.archivo = t.archivo;
    this.titulo = t.titulo;
    this.descripcion = t.descripcion;
    this.etiquetaId = t.etiquetaId;
    this.firmantes = [...t.firmantes];
    this.firmarAhoraCreador = t.firmarAhoraCreador;
    this.creatorSignatureBase64 = t.creatorSignatureBase64;
    this.creadorPagina = t.creadorPagina;
    this.creadorX = t.creadorX;
    this.creadorY = t.creadorY;
    this.creadorAncho = t.creadorAncho;
    this.creadorAlto = t.creadorAlto;
    this.creadorTipoFirma = t.creadorTipoFirma;
    this.pdfDoc = t.pdfDoc;
    this.pagina = t.pagina;
    this.totalPages = t.totalPages;
    this.zoom = t.zoom;
    this.activeFirmanteIndex = t.activeFirmanteIndex;
    this.ghostX = t.ghostX;
    this.ghostY = t.ghostY;
    this.ghostW = t.ghostW;
    this.ghostH = t.ghostH;
    this.showGhost = t.showGhost;
    this.updateGroupedFirmantes();

    const fileInput = document.getElementById('pdf-file-input-subir') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }

    setTimeout(() => {
      if (this.pdfDoc) {
        this.renderPage(this.pagina);
      } else {
        const canvas = document.getElementById('pdf-canvas-subir') as HTMLCanvasElement;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }, 100);
  }

  onFileChange(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.processSelectedFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFileOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFileOver = false;
  }

  onDropFile(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFileOver = false;

    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.processSelectedFile(file);
    }
  }

  processSelectedFile(file: File): void {
    const nameLower = file.name.toLowerCase();
    if (nameLower.endsWith('.pdf') || file.type === 'application/pdf') {
      this.cargarArchivoPdf(file);
    } else if (nameLower.endsWith('.docx') || nameLower.endsWith('.doc')) {
      this.convertirWordAPdf(file);
    } else {
      Swal.fire('Formato no soportado', 'Por favor selecciona un archivo PDF (.pdf) o Word (.docx, .doc)', 'warning');
    }
  }

  cargarArchivoPdf(file: File): void {
    this.archivo = file;
    if (this.tabs[this.activeTabIndex]) {
      this.tabs[this.activeTabIndex].archivo = file;
    }
    if (!this.titulo) {
      this.titulo = file.name.replace(/\.[^/.]+$/, '');
      if (this.tabs[this.activeTabIndex]) {
        this.tabs[this.activeTabIndex].titulo = this.titulo;
      }
    }
    this.loadPdfPreview();
  }

  convertirWordAPdf(file: File): void {
    this.isConvertingWord = true;
    this.convertingMessage = `Convirtiendo "${file.name}" de Word a PDF... por favor espera`;

    Swal.fire({
      title: 'Convirtiendo Documento Word',
      html: `
        <div class="flex flex-col items-center gap-3 p-2">
          <div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-xs font-bold text-slate-700">Convirtiendo "${file.name}" a PDF con LibreOffice...</p>
          <span class="text-[10px] text-slate-400">El documento se proyectará automáticamente al finalizar.</span>
        </div>
      `,
      showConfirmButton: false,
      allowOutsideClick: false
    });

    const formData = new FormData();
    formData.append('archivo', file);

    this.http.post(`${this.baseUrl}/documento-firmas/convertir-word`, formData, {
      responseType: 'blob'
    }).subscribe({
      next: (pdfBlob: Blob) => {
        this.isConvertingWord = false;
        Swal.close();

        const pdfName = file.name.replace(/\.[^/.]+$/, '') + '.pdf';
        const pdfFile = new File([pdfBlob], pdfName, { type: 'application/pdf' });

        Swal.fire({
          title: '¡Conversión Completada!',
          text: `Se convirtió correctamente "${file.name}" a PDF.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });

        this.cargarArchivoPdf(pdfFile);
      },
      error: (err) => {
        this.isConvertingWord = false;
        Swal.close();
        console.error('Error convirtiendo Word:', err);

        const errorMsg = err.error?.message || 'No fue posible convertir el archivo Word. Por favor guarda como PDF directamente desde Word.';
        Swal.fire('Error en Conversión', errorMsg, 'error');
      }
    });
  }

  private createPdfBytesFromText(filename: string, text: string): Uint8Array {
    const cleanFilename = filename.replace(/[^\w\s\.-]/g, '').substring(0, 50);
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    
    let streamBody = `BT /F1 14 Tf 40 790 Td (${cleanFilename}) Tj ET\n`;
    streamBody += `BT /F1 10 Tf 40 770 Td (Documento Convertido de Word - Modulo de Firmas Saint) Tj ET\n`;
    
    let currentY = 730;
    const maxLines = Math.min(lines.length, 32);
    
    for (let i = 0; i < maxLines; i++) {
      const lineStr = lines[i].replace(/[^\w\s\.,;:()\/-]/g, ' ').substring(0, 85).trim();
      if (lineStr) {
        streamBody += `BT /F1 10 Tf 40 ${currentY} Td (${lineStr}) Tj ET\n`;
        currentY -= 18;
        if (currentY < 50) break;
      }
    }

    const streamLength = streamBody.length;

    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${streamBody}endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000114 00000 n 
0000000247 00000 n 
0000000400 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
480
%%EOF`;

    return new TextEncoder().encode(pdfContent);
  }

  private loadWordConverterLibs(): void {
    const scriptId = 'mammoth-js-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      document.head.appendChild(script);
    }
  }

  public loadEtiquetas(): void {
    this.docFirmaService.getEtiquetas().subscribe({
      next: (res: any) => {
        this.etiquetasList = res.data ?? [];
      },
      error: (err: any) => console.error('Error cargando etiquetas:', err)
    });
  }

  onEtiquetasCambiada(): void {
    this.loadEtiquetas();
  }

  crearNuevaEtiquetaRapida(): void {
    if (!this.nuevaEtiquetaNombre.trim()) {
      Swal.fire('Atención', 'Por favor ingresa un nombre para la etiqueta (ej: Entrega de salones)', 'warning');
      return;
    }

    this.docFirmaService.crearEtiqueta(this.nuevaEtiquetaNombre).subscribe({
      next: (res: any) => {
        const nueva = res.data;
        this.etiquetasList.push(nueva);
        this.etiquetaId = nueva.id;
        this.nuevaEtiquetaNombre = '';
        this.mostrarNuevaEtiquetaModal = false;
        Swal.fire('Etiqueta Creada', `Se creó la etiqueta "${nueva.nombre}"`, 'success');
      },
      error: (err: any) => {
        Swal.fire('Error', err.error?.message || 'No fue posible crear la etiqueta', 'error');
      }
    });
  }

  private loadColaboradores(): void {
    this.http.get<any>(`${this.baseUrl}/colaboradores?per_page=all&estado=activo`).subscribe({
      next: (res) => {
        const raw = res.data || res || [];
        this.colaboradoresList = raw.map((c: any) => {
          const corp = (c.correo_corporativo || '').trim();
          const pers = (c.correo_personal || '').trim();
          const fallbackEmail = (c.email || '').trim();
          return {
            ...c,
            firstName: c.nombres || c.firstName || '',
            lastName: c.apellidos || c.lastName || '',
            correo_corporativo: corp || (!pers ? fallbackEmail : ''),
            correo_personal: pers,
            email: corp || pers || fallbackEmail
          };
        });
      },
      error: (err) => console.error('Error cargando colaboradores:', err)
    });
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
    this.mostrarDropdownColab = true;
  }

  isCurrentUser(colab: any): boolean {
    if (!colab || !this.authService.user) return false;
    const user = this.authService.user;
    if (colab.id && user.id && Number(colab.id) === Number(user.id)) return true;

    const userEmail = (user.email || (user as any).correo_corporativo || (user as any).correo_personal || '').toLowerCase().trim();
    const colabCorp = (colab.correo_corporativo || '').toLowerCase().trim();
    const colabPers = (colab.correo_personal || '').toLowerCase().trim();
    const colabEmail = (colab.email || '').toLowerCase().trim();

    if (userEmail && (userEmail === colabCorp || userEmail === colabPers || userEmail === colabEmail)) return true;
    if (colab.cedula && (user as any).cedula && String(colab.cedula).trim() === String((user as any).cedula).trim()) return true;

    return false;
  }

  agregarColaborador(colab: any, tipoForzado?: 'corporativo' | 'personal'): void {
    const isMe = this.isCurrentUser(colab);
    const hasCorp = !!(colab.correo_corporativo && colab.correo_corporativo.trim());
    const hasPers = !!(colab.correo_personal && colab.correo_personal.trim());
    const countExist = this.firmantes.filter(f => f.colaborador_id === colab.id).length;

    const tipoFinal = tipoForzado || (hasCorp ? 'corporativo' : (hasPers ? 'personal' : 'corporativo'));

    const nuevo: FirmanteAsignado = {
      isCreator: isMe,
      colaborador_id: colab.id,
      nombre: isMe ? `${colab.firstName || colab.name || ''} ${colab.lastName || ''}`.trim() + ' (Creador)' : `${colab.firstName || colab.name || ''} ${colab.lastName || ''}`.trim(),
      cargo: colab.cargo || (isMe ? 'Creador del Documento' : 'Colaborador'),
      correo_corporativo: colab.correo_corporativo || '',
      correo_personal: colab.correo_personal || '',
      tipo_correo: tipoFinal,
      pagina: this.pagina,
      posicion_x: Math.min(10 + (this.firmantes.length * 8), 180),
      posicion_y: Math.min(180 + (countExist * 15), 230),
      ancho: 110,
      alto: 30,
      tipo_firma_requerida: isMe ? this.creadorTipoFirma : 'AMBAS'
    };

    if (isMe) {
      this.firmarAhoraCreador = true;
      this.creadorPagina = nuevo.pagina;
      this.creadorX = nuevo.posicion_x;
      this.creadorY = nuevo.posicion_y;
      this.creadorAncho = nuevo.ancho;
      this.creadorAlto = nuevo.alto;
      if (this.creadorTipoFirma !== 'DIGITAL') {
        setTimeout(() => {
          if (this.creatorCanvasEl) {
            const canvas = this.creatorCanvasEl.nativeElement;
            canvas.width = 400;
            canvas.height = 140;
            this.creatorSignaturePad = new SignaturePad(canvas, { penColor: '#0f172a' });
          }
        }, 200);
      }
      Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        icon: 'info',
        title: 'Te has asignado como firmante (Creador)'
      });
    }

    this.firmantes.push(nuevo);
    this.activeFirmanteIndex = this.firmantes.length - 1;
    this.colaboradorSearch = '';
    this.mostrarDropdownColab = false;
    this.updateGhostSize();
    this.updateGroupedFirmantes();
  }

  duplicarFirmanteEnPaginaActual(firmante: FirmanteAsignado): void {
    const countExist = this.firmantes.filter(f => f.colaborador_id === firmante.colaborador_id).length;
    const nuevo: FirmanteAsignado = {
      ...firmante,
      pagina: this.pagina,
      posicion_x: Math.min(firmante.posicion_x + 10, 190),
      posicion_y: Math.min(firmante.posicion_y + 10, 240),
    };
    this.firmantes.push(nuevo);
    this.activeFirmanteIndex = this.firmantes.length - 1;
    this.updateGhostSize();
    this.updateGroupedFirmantes();
  }

  deselectFirmante(): void {
    this.activeFirmanteIndex = -1;
    this.showGhost = false;
  }

  removerFirmante(index: number): void {
    const f = this.firmantes[index];
    if (f.isCreator) {
      this.firmarAhoraCreador = false;
    }
    this.firmantes.splice(index, 1);
    if (this.activeFirmanteIndex === index) {
      this.activeFirmanteIndex = -1;
    } else if (this.activeFirmanteIndex > index) {
      this.activeFirmanteIndex--;
    }
    this.updateGhostSize();
    this.updateGroupedFirmantes();
  }

  selectActiveFirmante(index: number): void {
    if (index < 0 || index >= this.firmantes.length) {
      this.deselectFirmante();
      return;
    }
    this.activeFirmanteIndex = index;
    if (this.firmantes[index]) {
      const pageTarget = this.firmantes[index].pagina;
      if (pageTarget && pageTarget !== this.pagina) {
        this.pagina = pageTarget;
        this.renderPage(this.pagina);
      }
    }
    this.updateGhostSize();
  }

  groupedFirmantes: GroupedFirmante[] = [];

  updateGroupedFirmantes(): void {
    const groupsMap = new Map<string, GroupedFirmante>();

    this.firmantes.forEach((f, idx) => {
      let key = 'UNASSIGNED_' + idx;
      if (f.isCreator) {
        key = 'CREATOR';
      } else if (f.colaborador_id && f.colaborador_id > 0) {
        key = `COLAB_${f.colaborador_id}_${f.nombre}`;
      }

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          colaborador_id: f.colaborador_id,
          isCreator: !!f.isCreator,
          nombre: f.nombre,
          cargo: f.cargo || '',
          correo_corporativo: f.correo_corporativo || '',
          correo_personal: f.correo_personal || '',
          tipo_correo: f.tipo_correo || 'corporativo',
          tipo_firma_requerida: f.tipo_firma_requerida || 'AMBAS',
          expanded: this.grupoExpandedState[key] !== false,
          boxes: []
        });
      }

      const group = groupsMap.get(key)!;
      group.boxes.push({
        index: idx,
        pagina: f.pagina,
        posicion_x: f.posicion_x,
        posicion_y: f.posicion_y,
        ancho: f.ancho,
        alto: f.alto
      });
    });

    this.groupedFirmantes = Array.from(groupsMap.values());
  }

  trackByGroupKey(index: number, item: GroupedFirmante): string {
    return item.key;
  }

  trackByBoxIndex(index: number, item: any): number {
    return item.index;
  }

  toggleGrupoExpanded(key: string, event?: Event): void {
    if (event) event.stopPropagation();
    const currentState = this.grupoExpandedState[key] !== false;
    this.grupoExpandedState[key] = !currentState;
    this.updateGroupedFirmantes();
  }

  updateGrupoTipoCorreo(grupo: GroupedFirmante, tipo: 'corporativo' | 'personal', event?: Event): void {
    if (event) event.stopPropagation();
    grupo.tipo_correo = tipo;
    grupo.boxes.forEach(box => {
      if (this.firmantes[box.index]) {
        this.firmantes[box.index].tipo_correo = tipo;
      }
    });
    this.updateGroupedFirmantes();
  }

  updateGrupoTipoFirma(grupo: GroupedFirmante, tipo: 'AMBAS' | 'PULSO' | 'DIGITAL'): void {
    grupo.tipo_firma_requerida = tipo;
    grupo.boxes.forEach(box => {
      if (this.firmantes[box.index]) {
        this.firmantes[box.index].tipo_firma_requerida = tipo;
      }
    });
    this.updateGroupedFirmantes();
  }

  removerRecuadroIndividual(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    this.removerFirmante(index);
  }

  removerGrupoFirmante(grupo: GroupedFirmante, event?: Event): void {
    if (event) event.stopPropagation();
    const paginasList = grupo.boxes.map(b => b.pagina).sort((a, b) => a - b).join(', ');
    const cantidad = grupo.boxes.length;

    Swal.fire({
      title: '¿Eliminar recuadros de firma?',
      html: `Se eliminarán <b>${cantidad}</b> recuadro(s) para <b>${grupo.nombre}</b> en la(s) página(s): <b>${paginasList}</b>.<br>¿Estás seguro de continuar?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar todos',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then(result => {
      if (result.isConfirmed) {
        if (grupo.isCreator) {
          this.firmarAhoraCreador = false;
        }
        const indicesToRemove = grupo.boxes.map(b => b.index).sort((a, b) => b - a);
        indicesToRemove.forEach(idx => {
          this.firmantes.splice(idx, 1);
        });
        this.deselectFirmante();
        this.updateGhostSize();
        this.updateGroupedFirmantes();
      }
    });
  }

  duplicarFirmanteEnGrupo(grupo: GroupedFirmante, event?: Event): void {
    if (event) event.stopPropagation();
    if (!grupo.boxes.length) return;
    const baseFirmante = this.firmantes[grupo.boxes[0].index];
    if (baseFirmante) {
      this.duplicarFirmanteEnPaginaActual(baseFirmante);
    }
  }

  getActiveEmail(f: FirmanteAsignado | GroupedFirmante): string {
    if (!f) return '';
    if (f.tipo_correo === 'personal') {
      return f.correo_personal || f.correo_corporativo || 'Sin correo registrado';
    }
    return f.correo_corporativo || f.correo_personal || 'Sin correo registrado';
  }

  openAssignPopoverForBox(index: number, event: MouseEvent): void {
    event.stopPropagation();
    this.popoverFirmanteIndex = index;
    this.popoverSearch = '';
    this.popoverColaboradoresFiltrados = [...this.colaboradoresList].slice(0, 10);
    this.showAssignPopover = true;
  }

  onPopoverSearch(): void {
    const term = this.popoverSearch.toLowerCase().trim();
    if (!term) {
      this.popoverColaboradoresFiltrados = [...this.colaboradoresList].slice(0, 10);
      return;
    }
    this.popoverColaboradoresFiltrados = this.colaboradoresList.filter(c =>
      (c.firstName || c.name || '').toLowerCase().includes(term) ||
      (c.lastName || '').toLowerCase().includes(term) ||
      (c.cedula || '').includes(term) ||
      (c.cargo || '').toLowerCase().includes(term)
    ).slice(0, 10);
  }

  asignarColaboradorABox(colab: any, tipoForzado?: 'corporativo' | 'personal'): void {
    if (this.popoverFirmanteIndex < 0 || this.popoverFirmanteIndex >= this.firmantes.length) return;
    const isMe = this.isCurrentUser(colab);
    const hasCorp = !!(colab.correo_corporativo && colab.correo_corporativo.trim());
    const hasPers = !!(colab.correo_personal && colab.correo_personal.trim());

    const target = this.firmantes[this.popoverFirmanteIndex];
    target.colaborador_id = colab.id;
    target.nombre = isMe 
      ? `${colab.firstName || colab.name || ''} ${colab.lastName || ''}`.trim() + ' (Creador)'
      : `${colab.firstName || colab.name || ''} ${colab.lastName || ''}`.trim();
    target.cargo = colab.cargo || (isMe ? 'Creador del Documento' : 'Colaborador');
    target.correo_corporativo = colab.correo_corporativo || '';
    target.correo_personal = colab.correo_personal || '';
    target.tipo_correo = tipoForzado || (hasCorp ? 'corporativo' : (hasPers ? 'personal' : 'corporativo'));
    target.isCreator = isMe;

    if (isMe) {
      target.tipo_firma_requerida = this.creadorTipoFirma;
      this.firmarAhoraCreador = true;
      this.creadorPagina = target.pagina;
      this.creadorX = target.posicion_x;
      this.creadorY = target.posicion_y;
      this.creadorAncho = target.ancho;
      this.creadorAlto = target.alto;
      if (this.creadorTipoFirma !== 'DIGITAL') {
        setTimeout(() => {
          if (this.creatorCanvasEl) {
            const canvas = this.creatorCanvasEl.nativeElement;
            canvas.width = 400;
            canvas.height = 140;
            this.creatorSignaturePad = new SignaturePad(canvas, { penColor: '#0f172a' });
          }
        }, 200);
      }
      Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        icon: 'info',
        title: 'Te has asignado como firmante (Creador)'
      });
    }

    this.showAssignPopover = false;
    this.updateGroupedFirmantes();
  }

  updatePopoverTipoCorreo(tipo: 'corporativo' | 'personal'): void {
    if (this.popoverFirmanteIndex >= 0 && this.firmantes[this.popoverFirmanteIndex]) {
      this.firmantes[this.popoverFirmanteIndex].tipo_correo = tipo;
      this.updateGroupedFirmantes();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
      return;
    }

    if (this.showAssignPopover) {
      if (event.key === 'Escape') {
        this.showAssignPopover = false;
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace' || event.code === 'Delete' || event.code === 'Backspace') {
      if (this.activeFirmanteIndex >= 0 && this.activeFirmanteIndex < this.firmantes.length) {
        event.preventDefault();
        event.stopPropagation();
        this.removerFirmante(this.activeFirmanteIndex);
      }
    }

    if (event.key === 'Escape' || event.code === 'Escape') {
      if (this.activeFirmanteIndex !== -1) {
        this.deselectFirmante();
      }
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (this.activeFirmanteIndex === -1) return;
    if (this.showAssignPopover) return;
    if (this.isMovingBox || this.isResizingBox || this.isDragging) return;

    const target = event.target as HTMLElement;
    if (!target) return;

    if (
      target.closest('#pdf-canvas-subir') ||
      target.closest('[data-signature-box]') ||
      target.closest('[data-firmante-sidebar]') ||
      target.closest('.swal2-container') ||
      target.closest('.modal-assign-popover')
    ) {
      return;
    }

    this.deselectFirmante();
  }

  toggleCreatorSignature(): void {
    this.firmarAhoraCreador = !this.firmarAhoraCreador;
    if (this.firmarAhoraCreador) {
      const creatorName = this.authService.user 
        ? (this.authService.user.nombre_completo || `${this.authService.user.firstName ?? ''} ${this.authService.user.lastName ?? ''}`.trim())
        : 'Yo (Creador)';

      const creatorEntry: FirmanteAsignado = {
        isCreator: true,
        colaborador_id: this.authService.user?.id || 0,
        nombre: `${creatorName} (Creador)`,
        cargo: 'Creador del Documento',
        correo_corporativo: this.authService.user?.email || '',
        correo_personal: '',
        tipo_correo: 'corporativo',
        pagina: this.pagina,
        posicion_x: this.creadorX,
        posicion_y: this.creadorY,
        ancho: this.creadorAncho,
        alto: this.creadorAlto,
        tipo_firma_requerida: this.creadorTipoFirma
      };

      this.firmantes = this.firmantes.filter(f => !f.isCreator);
      this.firmantes.unshift(creatorEntry);
      this.activeFirmanteIndex = 0;

      setTimeout(() => {
        if (this.creatorCanvasEl) {
          const canvas = this.creatorCanvasEl.nativeElement;
          canvas.width = 400;
          canvas.height = 140;
          this.creatorSignaturePad = new SignaturePad(canvas, { penColor: '#0f172a' });
        }
      }, 200);
    } else {
      this.firmantes = this.firmantes.filter(f => !f.isCreator);
      if (this.activeFirmanteIndex >= this.firmantes.length) {
        this.activeFirmanteIndex = Math.max(0, this.firmantes.length - 1);
      }
    }
    this.updateGhostSize();
    this.updateGroupedFirmantes();
  }

  onCreatorTipoFirmaChange(tipo: 'DIGITAL' | 'PULSO' | 'AMBAS'): void {
    this.creadorTipoFirma = tipo;
    const creator = this.firmantes.find(f => f.isCreator);
    if (creator) {
      creator.tipo_firma_requerida = tipo;
    }
    this.updateGroupedFirmantes();

    if (tipo !== 'DIGITAL') {
      setTimeout(() => {
        if (this.creatorCanvasEl) {
          const canvas = this.creatorCanvasEl.nativeElement;
          canvas.width = 400;
          canvas.height = 140;
          this.creatorSignaturePad = new SignaturePad(canvas, { penColor: '#0f172a' });
        }
      }, 100);
    }
  }

  clearCreatorSignature(): void {
    if (this.creatorSignaturePad) {
      this.creatorSignaturePad.clear();
      this.creatorSignatureBase64 = '';
    }
  }

  private loadPdfLib(): void {
    const scriptId = 'pdf-js-script-subir';
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

  private currentRenderTask: any = null;

  private async renderPage(num: number): Promise<void> {
    if (!this.pdfDoc) return;

    if (this.currentRenderTask) {
      try {
        await this.currentRenderTask.cancel();
      } catch (_) {}
      this.currentRenderTask = null;
    }

    try {
      const page = await this.pdfDoc.getPage(num);
      const viewportUnscaled = page.getViewport({ scale: 1.0 });
      this.pdfViewportWidth = viewportUnscaled.width;
      this.pdfViewportHeight = viewportUnscaled.height;

      const viewport = page.getViewport({ scale: this.zoom });
      
      const canvas = document.getElementById('pdf-canvas-subir') as HTMLCanvasElement;
      if (!canvas) return;
      
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      this.currentRenderTask = page.render(renderContext);
      try {
        await this.currentRenderTask.promise;
      } finally {
        this.currentRenderTask = null;
        context.restore();
      }

      this.updateGhostSize();
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Error renderizando página PDF:', err);
      }
    }
  }

  getFirmanteBoxStyle(f: FirmanteAsignado): any {
    if (!this.pdfDoc || f.pagina !== this.pagina) {
      return { display: 'none' };
    }

    const canvas = document.getElementById('pdf-canvas-subir') as HTMLCanvasElement;
    if (!canvas || !canvas.width || !this.pdfViewportWidth) {
      return { display: 'none' };
    }

    const mmToPoints = 72 / 25.4;
    const scaleX = this.pdfViewportWidth / canvas.width;
    const scaleY = this.pdfViewportHeight / canvas.height;

    const pdfXPoints = (f.posicion_x || 10) * mmToPoints;
    const pdfYPoints = (f.posicion_y || 200) * mmToPoints;
    const pdfWPoints = (f.ancho || 110) * mmToPoints;
    const pdfHPoints = (f.alto || 30) * mmToPoints;

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

  changeZoom(delta: number): void {
    const newZoom = this.zoom + delta;
    if (newZoom >= 0.5 && newZoom <= 2.5) {
      this.zoom = newZoom;
      this.renderPage(this.pagina);
    }
  }

  changePage(delta: number): void {
    const newPage = this.pagina + delta;
    if (newPage >= 1 && newPage <= this.totalPages) {
      this.pagina = newPage;
      if (this.firmantes[this.activeFirmanteIndex]) {
        this.firmantes[this.activeFirmanteIndex].pagina = newPage;
      }
      this.renderPage(this.pagina);
    }
  }

  goToFirstPage(): void {
    if (this.pagina > 1) {
      this.pagina = 1;
      if (this.firmantes[this.activeFirmanteIndex]) {
        this.firmantes[this.activeFirmanteIndex].pagina = 1;
      }
      this.renderPage(1);
    }
  }

  goToLastPage(): void {
    if (this.pagina < this.totalPages) {
      this.pagina = this.totalPages;
      if (this.firmantes[this.activeFirmanteIndex]) {
        this.firmantes[this.activeFirmanteIndex].pagina = this.totalPages;
      }
      this.renderPage(this.totalPages);
    }
  }

  onPageInputSubmit(event: any): void {
    const target = event.target as HTMLInputElement;
    let newPage = parseInt(target ? target.value : event, 10);
    if (isNaN(newPage)) return;
    if (newPage < 1) newPage = 1;
    if (newPage > this.totalPages) newPage = this.totalPages;

    this.pagina = newPage;
    if (target) target.value = newPage.toString();
    if (this.firmantes[this.activeFirmanteIndex]) {
      this.firmantes[this.activeFirmanteIndex].pagina = newPage;
    }
    this.renderPage(newPage);
  }

  // Variables de Redimensionamiento y Arrastre Ultra-Fluido 60FPS
  dragStartMouseX: number = 0;
  dragStartMouseY: number = 0;
  boxStartPosMmX: number = 0;
  boxStartPosMmY: number = 0;
  boxStartWidthMm: number = 110;
  boxStartHeightMm: number = 30;
  pxToMmScaleX: number = 0.264;
  pxToMmScaleY: number = 0.264;

  isResizingBox: boolean = false;
  resizingBoxIndex: number = -1;
  resizeHandle: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w' = 'se';
  wasBoxSelectedOnMouseDown: boolean = false;

  onResizeHandleMouseDown(event: MouseEvent, index: number, handle: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'): void {
    event.stopPropagation();
    event.preventDefault();

    this.selectActiveFirmante(index);
    this.isResizingBox = true;
    this.resizingBoxIndex = index;
    this.resizeHandle = handle;
    this.dragStartMouseX = event.clientX;
    this.dragStartMouseY = event.clientY;

    const f = this.firmantes[index];
    if (f) {
      this.boxStartPosMmX = f.posicion_x || 10;
      this.boxStartPosMmY = f.posicion_y || 200;
      this.boxStartWidthMm = f.ancho || 110;
      this.boxStartHeightMm = f.alto || 30;
    }

    const canvas = document.getElementById('pdf-canvas-subir') as HTMLCanvasElement;
    if (canvas && this.pdfViewportWidth && this.pdfViewportHeight) {
      const mmPerPoint = 25.4 / 72;
      this.pxToMmScaleX = (this.pdfViewportWidth / canvas.width) * mmPerPoint;
      this.pxToMmScaleY = (this.pdfViewportHeight / canvas.height) * mmPerPoint;
    }
  }

  onBoxMouseDown(event: MouseEvent, index: number): void {
    event.stopPropagation();
    event.preventDefault();
    
    this.selectActiveFirmante(index);
    this.isMovingBox = true;
    this.movingBoxIndex = index;
    this.dragStartMouseX = event.clientX;
    this.dragStartMouseY = event.clientY;

    const f = this.firmantes[index];
    if (f) {
      this.boxStartPosMmX = f.posicion_x || 10;
      this.boxStartPosMmY = f.posicion_y || 200;
    }

    const canvas = document.getElementById('pdf-canvas-subir') as HTMLCanvasElement;
    if (canvas && this.pdfViewportWidth && this.pdfViewportHeight) {
      const mmPerPoint = 25.4 / 72;
      this.pxToMmScaleX = (this.pdfViewportWidth / canvas.width) * mmPerPoint;
      this.pxToMmScaleY = (this.pdfViewportHeight / canvas.height) * mmPerPoint;
    }
  }

  onMouseDown(event: MouseEvent): void {
    const canvas = document.getElementById('pdf-canvas-subir') as HTMLCanvasElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    this.wasBoxSelectedOnMouseDown = (this.activeFirmanteIndex !== -1);

    this.isDragging = true;
    this.dragStartX = event.clientX - rect.left;
    this.dragStartY = event.clientY - rect.top;

    this.showGhost = true;
    this.ghostX = this.dragStartX;
    this.ghostY = this.dragStartY;
    this.ghostW = 0;
    this.ghostH = 0;

    if (canvas && this.pdfViewportWidth && this.pdfViewportHeight) {
      const mmPerPoint = 25.4 / 72;
      this.pxToMmScaleX = (this.pdfViewportWidth / canvas.width) * mmPerPoint;
      this.pxToMmScaleY = (this.pdfViewportHeight / canvas.height) * mmPerPoint;
    }
  }

  onMouseMove(event: MouseEvent): void {
    // 1. REDIMENSIONAR UN RECUADRO EXISTENTE (RESIZE)
    if (this.isResizingBox && this.resizingBoxIndex >= 0) {
      const deltaX = (event.clientX - this.dragStartMouseX) * this.pxToMmScaleX;
      const deltaY = (event.clientY - this.dragStartMouseY) * this.pxToMmScaleY;

      const f = this.firmantes[this.resizingBoxIndex];
      if (f) {
        let newX = this.boxStartPosMmX;
        let newY = this.boxStartPosMmY;
        let newW = this.boxStartWidthMm;
        let newH = this.boxStartHeightMm;

        const minW = 20; // 20mm ancho mínimo
        const minH = 8;  // 8mm alto mínimo

        switch (this.resizeHandle) {
          case 'se':
            newW = Math.max(minW, Math.round(this.boxStartWidthMm + deltaX));
            newH = Math.max(minH, Math.round(this.boxStartHeightMm + deltaY));
            break;
          case 'e':
            newW = Math.max(minW, Math.round(this.boxStartWidthMm + deltaX));
            break;
          case 's':
            newH = Math.max(minH, Math.round(this.boxStartHeightMm + deltaY));
            break;
          case 'sw':
            newW = Math.max(minW, Math.round(this.boxStartWidthMm - deltaX));
            newX = Math.max(0, Math.round(this.boxStartPosMmX + deltaX));
            newH = Math.max(minH, Math.round(this.boxStartHeightMm + deltaY));
            break;
          case 'nw':
            newW = Math.max(minW, Math.round(this.boxStartWidthMm - deltaX));
            newX = Math.max(0, Math.round(this.boxStartPosMmX + deltaX));
            newH = Math.max(minH, Math.round(this.boxStartHeightMm - deltaY));
            newY = Math.max(0, Math.round(this.boxStartPosMmY + deltaY));
            break;
          case 'ne':
            newW = Math.max(minW, Math.round(this.boxStartWidthMm + deltaX));
            newH = Math.max(minH, Math.round(this.boxStartHeightMm - deltaY));
            newY = Math.max(0, Math.round(this.boxStartPosMmY + deltaY));
            break;
          case 'w':
            newW = Math.max(minW, Math.round(this.boxStartWidthMm - deltaX));
            newX = Math.max(0, Math.round(this.boxStartPosMmX + deltaX));
            break;
          case 'n':
            newH = Math.max(minH, Math.round(this.boxStartHeightMm - deltaY));
            newY = Math.max(0, Math.round(this.boxStartPosMmY + deltaY));
            break;
        }

        f.pagina = this.pagina;
        f.posicion_x = newX;
        f.posicion_y = newY;
        f.ancho = newW;
        f.alto = newH;

        if (f.isCreator) {
          this.creadorPagina = this.pagina;
          this.creadorX = newX;
          this.creadorY = newY;
          this.creadorAncho = newW;
          this.creadorAlto = newH;
        }
      }
      return;
    }

    // 2. MOVER UN RECUADRO EXISTENTE
    if (this.isMovingBox && this.movingBoxIndex >= 0) {
      const deltaX = event.clientX - this.dragStartMouseX;
      const deltaY = event.clientY - this.dragStartMouseY;

      const f = this.firmantes[this.movingBoxIndex];
      if (f) {
        const newX = Math.max(0, Math.round(this.boxStartPosMmX + (deltaX * this.pxToMmScaleX)));
        const newY = Math.max(0, Math.round(this.boxStartPosMmY + (deltaY * this.pxToMmScaleY)));
        f.pagina = this.pagina;
        f.posicion_x = newX;
        f.posicion_y = newY;

        if (f.isCreator) {
          this.creadorPagina = this.pagina;
          this.creadorX = newX;
          this.creadorY = newY;
        }
      }
      return;
    }

    // 3. DIBUJAR UN RECUADRO NUEVO SOBRE CANVA
    if (!this.isDragging) return;

    const canvas = document.getElementById('pdf-canvas-subir') as HTMLCanvasElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    this.ghostX = Math.min(this.dragStartX, currentX);
    this.ghostY = Math.min(this.dragStartY, currentY);
    this.ghostW = Math.abs(currentX - this.dragStartX);
    this.ghostH = Math.abs(currentY - this.dragStartY);
  }

  onMouseUp(event: MouseEvent): void {
    if (this.isResizingBox) {
      this.isResizingBox = false;
      this.resizingBoxIndex = -1;
      this.updateGroupedFirmantes();
      return;
    }

    if (this.isMovingBox) {
      this.isMovingBox = false;
      this.movingBoxIndex = -1;
      this.updateGroupedFirmantes();
      return;
    }

    if (!this.isDragging) return;
    this.isDragging = false;

    const canvas = document.getElementById('pdf-canvas-subir') as HTMLCanvasElement;
    if (!canvas) return;

    // Si fue un clic simple sin arrastrar (ghostW < 10 && ghostH < 10)
    if (this.ghostW < 10 || this.ghostH < 10) {
      this.showGhost = false;

      // Si había algún recuadro de firma seleccionado antes de presionar el mouse,
      // un clic en espacio libre deselecciona el recuadro activo
      if (this.wasBoxSelectedOnMouseDown && this.activeFirmanteIndex !== -1) {
        this.deselectFirmante();
        return;
      }

      // Si NO había ningún recuadro seleccionado, se coloca uno NUEVO
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;

      const posX = Math.max(0, Math.round(clickX * this.pxToMmScaleX));
      const posY = Math.max(0, Math.round(clickY * this.pxToMmScaleY));

      const currentActive = (this.activeFirmanteIndex >= 0) ? this.firmantes[this.activeFirmanteIndex] : null;
      const defaultW = currentActive ? currentActive.ancho : 110;
      const defaultH = currentActive ? currentActive.alto : 30;

      this.colocarOActualizarRecuadro(posX, posY, defaultW, defaultH);
      return;
    }

    // Si fue un trazado dinámico con el mouse (drag to draw / move)
    const posX = Math.max(0, Math.round(this.ghostX * this.pxToMmScaleX));
    const posY = Math.max(0, Math.round(this.ghostY * this.pxToMmScaleY));
    const ancho = Math.max(20, Math.round(this.ghostW * this.pxToMmScaleX));
    const alto = Math.max(8, Math.round(this.ghostH * this.pxToMmScaleY));

    if (this.wasBoxSelectedOnMouseDown && this.activeFirmanteIndex !== -1) {
      // Si había un recuadro seleccionado y se arrastró sobre espacio libre,
      // se MUEVE y REDIMENSIONA el recuadro seleccionado a ese lugar en vez de crear otro
      this.colocarOActualizarRecuadro(posX, posY, ancho, alto);
    } else {
      // Si no había ningún recuadro seleccionado, se crea uno nuevo
      this.activeFirmanteIndex = -1;
      this.colocarOActualizarRecuadro(posX, posY, ancho, alto);
    }

    this.showGhost = false;
    this.ghostW = 0;
    this.ghostH = 0;
  }

  private colocarOActualizarRecuadro(posX: number, posY: number, ancho: number, alto: number): void {
    let active = (this.activeFirmanteIndex >= 0) ? this.firmantes[this.activeFirmanteIndex] : null;
    if (!active) {
      const nuevo: FirmanteAsignado = {
        isCreator: false,
        colaborador_id: 0,
        nombre: `Firmante ${this.firmantes.length + 1}`,
        cargo: 'Por asignar',
        correo_corporativo: '',
        correo_personal: '',
        tipo_correo: 'corporativo',
        pagina: this.pagina,
        posicion_x: posX,
        posicion_y: posY,
        ancho: ancho,
        alto: alto,
        tipo_firma_requerida: 'AMBAS'
      };
      this.firmantes.push(nuevo);
      this.activeFirmanteIndex = this.firmantes.length - 1;
    } else {
      active.pagina = this.pagina;
      active.posicion_x = posX;
      active.posicion_y = posY;
      active.ancho = ancho;
      active.alto = alto;

      if (active.isCreator) {
        this.creadorPagina = this.pagina;
        this.creadorX = posX;
        this.creadorY = posY;
        this.creadorAncho = ancho;
        this.creadorAlto = alto;
      }
    }
    this.updateGroupedFirmantes();
  }

  updateGhostSize(): void {
    if (this.activeFirmanteIndex === -1 || !this.pdfDoc || !this.firmantes[this.activeFirmanteIndex]) {
      this.showGhost = false;
      return;
    }

    this.pdfDoc.getPage(this.pagina).then((page: any) => {
      const canvas = document.getElementById('pdf-canvas-subir') as HTMLCanvasElement;
      if (!canvas) return;

      const current = this.firmantes[this.activeFirmanteIndex];
      if (!current) return;
      const viewport = page.getViewport({ scale: 1.0 });
      const scaleX = viewport.width / canvas.width;
      const scaleY = viewport.height / canvas.height;
      const mmToPoints = 72 / 25.4;

      this.ghostW = (current.ancho * mmToPoints) / scaleX;
      this.ghostH = (current.alto * mmToPoints) / scaleY;
      this.showGhost = (current.pagina === this.pagina);
    });
  }

  submit(): void {
    if (!this.archivo) {
      Swal.fire('Atención', 'Debe seleccionar un archivo PDF', 'warning');
      return;
    }
    if (!this.titulo.trim()) {
      Swal.fire('Atención', 'Por favor ingresa un título para el documento', 'warning');
      return;
    }

    const firmantesSinCreador = this.firmantes.filter(f => !f.isCreator);
    if (firmantesSinCreador.length === 0 && !this.firmarAhoraCreador) {
      Swal.fire('Atención', 'Debes agregar al menos un colaborador firmante o firmar como creador', 'warning');
      return;
    }

    // VALIDACIÓN ESTRICTA: Verificar que NINGÚN recuadro esté sin asignar
    const recuadroSinAsignar = firmantesSinCreador.find(f => !f.colaborador_id || f.colaborador_id === 0);
    if (recuadroSinAsignar) {
      Swal.fire({
        title: 'Recuadro Sin Asignar',
        text: `El recuadro "${recuadroSinAsignar.nombre}" no tiene un colaborador asignado. Por favor asigna a quién pertenece cada recuadro antes de enviar.`,
        icon: 'warning',
        confirmButtonColor: '#f59e0b'
      });
      return;
    }

    // VALIDACIÓN: Si firma como creador y escogió método a pulso, verificar que haya dibujado su firma
    if (this.firmarAhoraCreador && this.creadorTipoFirma !== 'DIGITAL') {
      const isPadEmpty = !this.creatorSignaturePad || this.creatorSignaturePad.isEmpty();
      if (isPadEmpty && !this.creatorSignatureBase64) {
        Swal.fire({
          title: 'Firma de Creador Pendiente',
          html: `Has indicado que firmarás el documento como creador con el método <b>${this.creadorTipoFirma === 'AMBAS' ? 'Digital + Pulso' : 'A Pulso'}</b>.<br><br>Por favor dibuja tu firma en el recuadro inferior, o cambia el método a <b>Firma Digital Autoverificada</b>.`,
          icon: 'warning',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#2563eb'
        });
        return;
      }
    }

    if (this.firmarAhoraCreador && this.creatorSignaturePad && !this.creatorSignaturePad.isEmpty() && this.creadorTipoFirma !== 'DIGITAL') {
      const canvas = this.creatorCanvasEl.nativeElement;
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const ctx = tmp.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, tmp.width, tmp.height);
        ctx.drawImage(canvas, 0, 0);
        this.creatorSignatureBase64 = tmp.toDataURL('image/png');
      }
    } else if (this.creadorTipoFirma === 'DIGITAL') {
      this.creatorSignatureBase64 = '';
    }

    this.loading = true;
    const formData = new FormData();
    formData.append('documento', this.archivo);
    formData.append('titulo', this.titulo);
    formData.append('descripcion', this.descripcion);

    const creatorName = this.authService.user 
      ? (this.authService.user.nombre_completo || `${this.authService.user.firstName ?? ''} ${this.authService.user.lastName ?? ''}`.trim() || this.authService.user.email)
      : '';
    if (creatorName) {
      formData.append('nombre_creador', creatorName);
    }
    if (this.authService.user?.email) {
      formData.append('email_creador', this.authService.user.email);
    }

    if (this.etiquetaId) {
      formData.append('etiqueta_id', this.etiquetaId.toString());
    }
    formData.append('firmar_ahora_creador', this.firmarAhoraCreador ? '1' : '0');
    
    if (this.firmarAhoraCreador) {
      if (this.creatorSignatureBase64) {
        formData.append('firma_creador_base64', this.creatorSignatureBase64);
      }
      formData.append('creador_pagina', this.creadorPagina.toString());
      formData.append('creador_posicion_x', this.creadorX.toString());
      formData.append('creador_posicion_y', this.creadorY.toString());
      formData.append('creador_ancho', this.creadorAncho.toString());
      formData.append('creador_alto', this.creadorAlto.toString());
      formData.append('creador_tipo_firma', this.creadorTipoFirma);
    }

    firmantesSinCreador.forEach((f, i) => {
      formData.append(`firmantes[${i}][colaborador_id]`, f.colaborador_id.toString());
      formData.append(`firmantes[${i}][tipo_correo]`, f.tipo_correo);
      formData.append(`firmantes[${i}][pagina]`, f.pagina.toString());
      formData.append(`firmantes[${i}][posicion_x]`, f.posicion_x.toString());
      formData.append(`firmantes[${i}][posicion_y]`, f.posicion_y.toString());
      formData.append(`firmantes[${i}][ancho]`, f.ancho.toString());
      formData.append(`firmantes[${i}][alto]`, f.alto.toString());
      formData.append(`firmantes[${i}][tipo_firma_requerida]`, f.tipo_firma_requerida);
    });

    this.docFirmaService.crearDocumento(formData).subscribe({
      next: () => {
        this.loading = false;
        Swal.fire({
          title: '¡Solicitud Creada y Enviada!',
          text: 'Se han generado los enlaces únicos y enviado las invitaciones por correo a los firmantes.',
          icon: 'success',
          confirmButtonColor: '#2563eb'
        });

        // Si quedan más pestañas, remover la enviada actual
        if (this.tabs.length > 1) {
          this.tabs.splice(this.activeTabIndex, 1);
          this.activeTabIndex = Math.max(0, this.activeTabIndex - 1);
          this.loadTabState(this.tabs[this.activeTabIndex]);
        } else {
          this.completado.emit();
        }
      },
      error: (err) => {
        this.loading = false;
        Swal.fire('Error al crear la solicitud', err.error?.message || 'Ocurrió un error inesperado', 'error');
      }
    });
  }

  async submitTodas(): Promise<void> {
    this.saveCurrentTabState();
    const validTabs = this.tabs.filter(t => t.archivo && t.titulo.trim() && (t.firmantes.length > 0 || t.firmarAhoraCreador));

    if (validTabs.length === 0) {
      Swal.fire('Atención', 'Ninguna pestaña tiene un PDF cargado y firmantes configurados para enviar.', 'warning');
      return;
    }

    // Verificar que NINGUNA pestaña contenga recuadros sin asignar o firmas pendientes
    for (let tIdx = 0; tIdx < this.tabs.length; tIdx++) {
      const tab = this.tabs[tIdx];
      const sinCreador = tab.firmantes.filter(f => !f.isCreator);
      const unassigned = sinCreador.find(f => !f.colaborador_id || f.colaborador_id === 0);
      if (unassigned) {
        this.seleccionarTab(tIdx);
        Swal.fire({
          title: 'Recuadro Sin Asignar',
          text: `En la pestaña "${tab.tituloTab}", el recuadro "${unassigned.nombre}" no tiene un colaborador asignado. Por favor asigna el firmante antes de enviar.`,
          icon: 'warning',
          confirmButtonColor: '#f59e0b'
        });
        return;
      }

      if (tab.firmarAhoraCreador && tab.creadorTipoFirma !== 'DIGITAL') {
        const isCurrentActive = this.activeTabIndex === tIdx;
        const hasPad = isCurrentActive && this.creatorSignaturePad && !this.creatorSignaturePad.isEmpty();
        if (!hasPad && !tab.creatorSignatureBase64) {
          this.seleccionarTab(tIdx);
          Swal.fire({
            title: 'Firma de Creador Pendiente',
            html: `En la pestaña <b>"${tab.tituloTab}"</b> indicaste que firmarás como creador a pulso.<br><br>Por favor dibuja tu trazo de firma o cambia al método <b>Firma Digital Autoverificada</b> antes de enviar.`,
            icon: 'warning',
            confirmButtonColor: '#f59e0b'
          });
          return;
        }
      }
    }

    const confirm = await Swal.fire({
      title: `¿Enviar ${validTabs.length} Solicitudes de Firma?`,
      text: `Se enviarán simultáneamente las invitaciones para los ${validTabs.length} documentos configurados en las pestañas.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Sí, Enviar Todos (${validTabs.length})`,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981'
    });

    if (!confirm.isConfirmed) return;

    this.loading = true;
    let enviados = 0;
    let errores = 0;

    for (let i = 0; i < validTabs.length; i++) {
      const tab = validTabs[i];
      const formData = new FormData();
      formData.append('documento', tab.archivo!);
      formData.append('titulo', tab.titulo);
      formData.append('descripcion', tab.descripcion);

      const creatorName = this.authService.user 
        ? (this.authService.user.nombre_completo || `${this.authService.user.firstName ?? ''} ${this.authService.user.lastName ?? ''}`.trim() || this.authService.user.email)
        : '';
      if (creatorName) formData.append('nombre_creador', creatorName);
      if (this.authService.user?.email) formData.append('email_creador', this.authService.user.email);
      if (tab.etiquetaId) formData.append('etiqueta_id', tab.etiquetaId.toString());

      formData.append('firmar_ahora_creador', tab.firmarAhoraCreador ? '1' : '0');
      if (tab.firmarAhoraCreador) {
        if (tab.creatorSignatureBase64) formData.append('firma_creador_base64', tab.creatorSignatureBase64);
        formData.append('creador_pagina', tab.creadorPagina.toString());
        formData.append('creador_posicion_x', tab.creadorX.toString());
        formData.append('creador_posicion_y', tab.creadorY.toString());
        formData.append('creador_ancho', tab.creadorAncho.toString());
        formData.append('creador_alto', tab.creadorAlto.toString());
        formData.append('creador_tipo_firma', tab.creadorTipoFirma);
      }

      const firmantesSinCreador = tab.firmantes.filter(f => !f.isCreator);
      firmantesSinCreador.forEach((f, idx) => {
        formData.append(`firmantes[${idx}][colaborador_id]`, f.colaborador_id.toString());
        formData.append(`firmantes[${idx}][tipo_correo]`, f.tipo_correo);
        formData.append(`firmantes[${idx}][pagina]`, f.pagina.toString());
        formData.append(`firmantes[${idx}][posicion_x]`, f.posicion_x.toString());
        formData.append(`firmantes[${idx}][posicion_y]`, f.posicion_y.toString());
        formData.append(`firmantes[${idx}][ancho]`, f.ancho.toString());
        formData.append(`firmantes[${idx}][alto]`, f.alto.toString());
        formData.append(`firmantes[${idx}][tipo_firma_requerida]`, f.tipo_firma_requerida);
      });

      try {
        await this.docFirmaService.crearDocumento(formData).toPromise();
        enviados++;
      } catch (err) {
        console.error(`Error enviando documento de pestaña ${tab.tituloTab}:`, err);
        errores++;
      }
    }

    this.loading = false;
    Swal.fire({
      title: 'Proceso de Envío Completado',
      text: `Se enviaron exitosamente ${enviados} de ${validTabs.length} solicitudes de firma.${errores > 0 ? ` (${errores} con error)` : ''}`,
      icon: errores === 0 ? 'success' : 'warning',
      confirmButtonColor: '#2563eb'
    });

    this.completado.emit();
  }
}
