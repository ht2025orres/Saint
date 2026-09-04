import { Component, OnInit, ChangeDetectorRef, OnDestroy, HostListener } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SolicitudComercialService } from '../../../services/solicitud-comercial.service';
import * as pdfjsLib from 'pdfjs-dist';
import { ComercialService } from '../../../services/comercial.service';
import { OrdenCompraService } from '../../../services/orden-compra.service';
import Swal from 'sweetalert2';

type CampoEstructura = 'numero_oc' | 'cliente_nombre' | 'nit' | 'fecha_solicitud' | 'fecha_entrega' | 'cantidad' | 'descripcion' | 'precio_unitario' | 'item_cfip' | 'item_cliente' | 'talla';

@Component({
  selector: 'app-solicitud-captura',
  templateUrl: './solicitud-captura.component.html',
  styleUrls: ['./solicitud-captura.component.css']
})
export class SolicitudCapturaComponent implements OnInit, OnDestroy {

  // --- MODELOS ---
  cabeceraOrden = {
    numero_oc: '',
    cliente_nombre: '',
    nit: '',
    fecha_solicitud: '',
    fecha_entrega: '',
    incluye_iva: false
  };

  itemTemporal = {
    item_cfip: '',
    item_cliente: '',
    descripcion: '',
    cantidad: null as number | null,
    talla: '',
    precio_unitario: null as number | null
  };

  itemsProcesados: any[] = [];
  clientesEncontrados: any[] = [];
  itemsSiesaEncontrados: any[] = []; // Items internos de siesa
  clienteSiesaId: number | null = null; // ID interno de Siesa del cliente seleccionado
  buscandoPor: 'NOMBRE' | 'NIT' | 'ITEM_CFIP' | null = null;
  busquedaProfundaItem: boolean = false;

  // --- SELECTOR DE TALLAS & BUSCADOR ---
  mapExtensiones: { [rowid_siesa: number]: any[] } = {};
  tallaSearchTerm: { [index: number]: string } = {};
  tallaDropdownOpen: { [index: number]: boolean } = {};
  busquedaTallaModal: string = '';

  // --- ESTADOS UI ---
  loading = false;
  savingOrder = false;
  pasoActual = 1;
  zoomLevel = 100; // PDF viewer zoom %
  showViewer = true; // Control de visibilidad del visor

  // --- DRAG PAN (arrastrar con click derecho) ---
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private scrollStartX = 0;
  private scrollStartY = 0;
  tipoSolicitud: 'ORDEN_COMPRA' | 'MUESTRA_COTIZACION' | null = 'ORDEN_COMPRA';
  editIndex: number | null = null;
  error: string | null = null;
  mensaje: string | null = null;
  textoSeleccionado: string = ''; // Almacena la última selección válida
  nombreArchivo: string | null = null; // Nombre del archivo cargado
  itemSeleccionadoDetalle: any = null;
  mostrarModalDetalle: boolean = false;
  extensionesItemDetalle: any[] = []; // Tallas/colores del ítem Siesa seleccionado
  busquedaSiesaModal: string = '';
  soloPvSiesaModal: boolean = false;
  buscandoSiesaModal: boolean = false;
  resultadosSiesaModal: any[] = [];

  // Visualización del documento
  htmlDocumentoPlano: string | null = null;
  textoDocumentoPlano: string | null = null;
  safeHtmlDocumento: SafeHtml | null = null;
  datosDocumentoExcel: any[] = [];
  originalFileUrl: SafeHtml | null = null; // URL para el visor original
  originalFile: File | null = null; // Archivo original para renderizado custom
  viewMode: 'EXTRACTO' | 'ORIGINAL' = 'EXTRACTO'; // Modo de visualización

  constructor(
    private service: SolicitudComercialService,
    private comercialService: ComercialService,
    private ordenCompraService: OrdenCompraService,
    public router: Router,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    if (params.get('cliente')) this.cabeceraOrden.cliente_nombre = params.get('cliente')!;
    if (params.get('nit')) this.cabeceraOrden.nit = params.get('nit')!;
    if (params.get('clienteId')) this.clienteSiesaId = Number(params.get('clienteId'));
  }

  ngOnDestroy(): void {
    if (this.originalFileUrl) {
      // Liberar memoria del objeto URL
      URL.revokeObjectURL((this.originalFileUrl as any).changingThisBreaksApplicationSecurity);
    }
  }

  // ==========================================
  // NAVEGACIÓN Y TIPO
  // ==========================================

  seleccionarTipo(tipo: 'ORDEN_COMPRA' | 'MUESTRA_COTIZACION' | null) {
    this.tipoSolicitud = tipo;
    this.pasoActual = 1;
    this.htmlDocumentoPlano = null;
    this.itemsProcesados = [];
  }

  siguientePaso() {
    if (this.pasoActual < 3) {
      this.pasoActual++;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  pasoAnterior() {
    if (this.pasoActual > 1) {
      this.pasoActual--;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  irAPaso(paso: number) {
    this.pasoActual = paso;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goBack() {
    this.router.navigate(['/comerciales']);
  }

  toggleViewer() {
    this.showViewer = !this.showViewer;
  }

  setViewMode(mode: 'EXTRACTO' | 'ORIGINAL') {
    this.viewMode = mode;
    if (mode === 'ORIGINAL' && this.originalFile?.type === 'application/pdf') {
      setTimeout(() => this.renderPdfOriginal(), 100);
    }
  }

  async renderPdfOriginal() {
    const container = document.getElementById('pdf-original-container');
    if (!container || !this.originalFile) return;

    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div><p>Cargando vista original selectable...</p></div>';

    try {
      const buffer = await this.originalFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      container.innerHTML = ''; // Limpiar spinner

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        // Contenedor de la página
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page-wrapper shadow-sm mb-4 position-relative mx-auto bg-white';
        pageDiv.style.width = `${viewport.width}px`;
        pageDiv.style.height = `${viewport.height}px`;

        // Canvas para el dibujo
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.display = 'block';
        const context = canvas.getContext('2d')!;

        // Capa de texto para selección
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        textLayerDiv.style.position = 'absolute';
        textLayerDiv.style.top = '0';
        textLayerDiv.style.left = '0';
        textLayerDiv.style.opacity = '1';
        textLayerDiv.style.lineHeight = '1.0';

        pageDiv.appendChild(canvas);
        pageDiv.appendChild(textLayerDiv);
        container.appendChild(pageDiv);

        // Renderizar página en canvas
        await page.render({ canvasContext: context, viewport }).promise;

        // Renderizar capa de texto con resaltado amarillo de datos extraídos
        const textContent = await page.getTextContent();
        const textItems = (textContent?.items || []) as any[];

        // Colección de términos clave para resaltar
        const keywordsToHighlight: string[] = [];

        if (this.cabeceraOrden.numero_oc && this.cabeceraOrden.numero_oc.length >= 3) {
          keywordsToHighlight.push(this.cabeceraOrden.numero_oc.trim());
        }
        if (this.cabeceraOrden.nit && this.cabeceraOrden.nit.length >= 5) {
          keywordsToHighlight.push(this.cabeceraOrden.nit.replace(/\D/g, ''));
        }
        if (this.cabeceraOrden.fecha_solicitud) {
          keywordsToHighlight.push(this.cabeceraOrden.fecha_solicitud.trim());
        }
        if (this.cabeceraOrden.fecha_entrega) {
          keywordsToHighlight.push(this.cabeceraOrden.fecha_entrega.trim());
        }

        (this.itemsProcesados || []).forEach(it => {
          if (it.item_cfip && it.item_cfip.length >= 2) keywordsToHighlight.push(it.item_cfip.trim());
          if (it.item_cliente && it.item_cliente.length >= 2) keywordsToHighlight.push(it.item_cliente.trim());
        });

        textItems.forEach(item => {
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);

          const span = document.createElement('span');
          span.textContent = item.str;
          span.style.fontFamily = 'sans-serif';
          span.style.fontSize = `${fontHeight}px`;
          span.style.position = 'absolute';
          span.style.left = `${tx[4]}px`;
          span.style.top = `${tx[5] - fontHeight}px`;
          span.style.whiteSpace = 'pre';
          span.style.transformOrigin = '0% 0%';

          const textClean = (item.str || '').trim();
          const textNumOnly = textClean.replace(/\D/g, '');

          const isHighlighted = keywordsToHighlight.some(kw => {
            const kwNum = kw.replace(/\D/g, '');
            return (kw.length >= 2 && textClean.toUpperCase().includes(kw.toUpperCase())) ||
                   (kwNum.length >= 6 && textNumOnly.includes(kwNum));
          });

          if (isHighlighted) {
            span.style.backgroundColor = '#fde047'; // Amarillo brillante
            span.style.color = '#000000';
            span.style.fontWeight = 'bold';
            span.style.borderRadius = '3px';
            span.style.padding = '1px 2px';
            span.style.boxShadow = '0 0 4px rgba(234, 179, 8, 0.8)';
            span.style.zIndex = '5';
          } else {
            span.style.color = 'transparent';
          }

          textLayerDiv.appendChild(span);
        });
      }
    } catch (err) {
      console.error('Error rendering PDF:', err);
      container.innerHTML = '<div class="alert alert-danger">No se pudo renderizar la vista original selectable.</div>';
    }
  }

  sanitizarNit(nitStr: string): string {
    if (!nitStr) return '';
    let limpia = nitStr.trim().replace(/^[\.\s\-\:]+/, '');
    const match = limpia.match(/(\d{7,10})(?:[\-\s]*(\d))?/);
    if (match) {
      return match[2] ? `${match[1]}-${match[2]}` : match[1];
    }
    return limpia.replace(/[^\d\-]/g, '');
  }

  autoBuscarClienteEnSiesa(termino: string): void {
    if (!termino) return;
    const nitSoloDigitos = termino.replace(/[^\d]/g, '');
    const baseNit = (nitSoloDigitos.length === 10 || nitSoloDigitos.length === 9) ? nitSoloDigitos.substring(0, 9) : nitSoloDigitos;

    if (baseNit.length < 4) return;

    this.comercialService.buscarClientes(baseNit).subscribe({
      next: (res) => {
        if (res && res.data && res.data.length > 0) {
          const cli: any = res.data[0];
          this.cabeceraOrden.cliente_nombre = cli.razon_social || cli.nombre || cli.customerName || '';
          this.cabeceraOrden.nit = cli.nit || cli.customerId || termino;
          if (cli.id) this.clienteSiesaId = cli.id;
          this.cdr.detectChanges();
        } else {
          this.comercialService.buscarClientes(termino).subscribe({
            next: (res2) => {
              if (res2 && res2.data && res2.data.length > 0) {
                const cli2: any = res2.data[0];
                this.cabeceraOrden.cliente_nombre = cli2.razon_social || cli2.nombre || '';
                this.cabeceraOrden.nit = cli2.nit || termino;
                if (cli2.id) this.clienteSiesaId = cli2.id;
                this.cdr.detectChanges();
              }
            }
          });
        }
      },
      error: (err) => console.warn('Error buscando cliente en Siesa:', err)
    });
  }

  // ==========================================
  // CARGA Y PROCESAMIENTO CON UNLIMITED OCR
  // ==========================================

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files.length === 0) return;
    this.procesarDocumento(files.length === 1 ? files[0] : Array.from(files));
  }

  async procesarDocumento(fileOrFiles: any) {
    this.loading = true;
    this.error = null;
    this.mensaje = null;
    this.nombreArchivo = null;
    this.htmlDocumentoPlano = null;
    this.textoDocumentoPlano = null;
    this.datosDocumentoExcel = [];
    this.itemsProcesados = [];
    this.originalFileUrl = null;

    try {
      const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
      this.originalFile = file;
      this.nombreArchivo = file.name;

      // Crear URL para previsualización original
      const url = URL.createObjectURL(file);
      this.originalFileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

      // 1. Parser de Vista local / Documento HTML/Excel
      const result = await this.service.parseDocument(fileOrFiles);

      if (Array.isArray(result)) {
        this.datosDocumentoExcel = result;
      } else {
        if (result.data && Array.isArray(result.data)) this.datosDocumentoExcel = result.data;
        if (result.html) {
          this.htmlDocumentoPlano = result.html;
          this.safeHtmlDocumento = this.sanitizer.bypassSecurityTrustHtml(result.html);
        } else if (result.text) {
          this.textoDocumentoPlano = result.text;
        }

        // Extracción estructurada inmediata local
        if (result.structuredData && result.structuredData.cabecera) {
          const sd = result.structuredData.cabecera;
          if (sd.numero_oc) this.cabeceraOrden.numero_oc = sd.numero_oc;
          if (sd.nit) this.cabeceraOrden.nit = this.sanitizarNit(sd.nit);
          if (sd.fecha_solicitud) this.cabeceraOrden.fecha_solicitud = this.sanitizarFecha(sd.fecha_solicitud);
          if (sd.fecha_entrega) this.cabeceraOrden.fecha_entrega = this.sanitizarFecha(sd.fecha_entrega);

          // Buscar cliente en Siesa automáticamente con el NIT extraído
          const busquedaCli = this.cabeceraOrden.nit || sd.cliente_nombre;
          if (busquedaCli && busquedaCli.length >= 4) {
            this.autoBuscarClienteEnSiesa(busquedaCli);
          }
        }

        if (result.structuredData && result.structuredData.items && result.structuredData.items.length > 0) {
          this.itemsProcesados = result.structuredData.items.map((it: any) => ({
            item_cfip: it.item_cfip || it.referencia || it.codigo_item || '',
            item_cliente: it.item_cliente || it.codigo_item || '',
            descripcion: (it.descripcion || '').replace(/\s+/g, ' ').trim(),
            descripcion_cliente: (it.descripcion || '').replace(/\s+/g, ' ').trim(),
            descripcion_cfip: '',
            referencia_cfip: it.item_cfip || '',
            cantidad: it.cantidad || 0,
            talla: it.talla || '',
            precio_unitario: it.precio_unitario || 0,
            precio_total: it.precio_total || 0,
            rowid_siesa: it.rowid_siesa || null,
            sugerencias_siesa: it.sugerencias_siesa || []
          }));
        }
      }

      // Si el número de OC extraído es ambiguo o generic (ej: INGENIERIA, 001-OC), buscar en el nombre del archivo
      const fnMatch = file.name ? file.name.match(/(?:OC|ORDEN)[\s\-\_]*([0-9]{4,15})/i) : null;
      if (fnMatch && (!this.cabeceraOrden.numero_oc || this.cabeceraOrden.numero_oc.length < 4 || ['INGENIERIA', '001-OC'].includes(this.cabeceraOrden.numero_oc.toUpperCase()))) {
        this.cabeceraOrden.numero_oc = fnMatch[1];
      }

      this.cdr.detectChanges();

      // 2. Ejecutar motor Unlimited OCR Backend
      this.ordenCompraService.analizarDocumentoOcr(file).subscribe({
        next: (ocrRes) => {
          if (ocrRes && ocrRes.success && ocrRes.data) {
            const data = ocrRes.data;

            // Encabezado
            if (data.numero_orden) this.cabeceraOrden.numero_oc = data.numero_orden;
            if (data.cliente && data.cliente.razon_social) {
              this.cabeceraOrden.cliente_nombre = data.cliente.razon_social;
              this.cabeceraOrden.nit = this.sanitizarNit(data.cliente.nit || this.cabeceraOrden.nit);
              if (data.cliente.id) this.clienteSiesaId = data.cliente.id;
            } else if (data.cliente && data.cliente.nit) {
              this.autoBuscarClienteEnSiesa(data.cliente.nit);
            }

            if (data.fecha_solicitud) {
              this.cabeceraOrden.fecha_solicitud = this.sanitizarFecha(data.fecha_solicitud);
            }

            if (data.fecha_entrega_estimada) {
              this.cabeceraOrden.fecha_entrega = this.sanitizarFecha(data.fecha_entrega_estimada);
            }

            if (data.items && data.items.length > 0) {
              this.itemsProcesados = data.items.map(it => {
                const topSug = (it.sugerencias_siesa && it.sugerencias_siesa.length > 0) ? it.sugerencias_siesa[0] : null;
                const tallaCalculada = it.talla || topSug?.talla_siesa || this.extraerTallaHelper(it.descripcion, it.codigo_item || it.referencia) || '';
                return {
                  item_cfip: topSug?.codigo_item || topSug?.referencia || it.referencia || it.codigo_item || '',
                  codigo_item: topSug?.codigo_item || (it.codigo_item && !/^\d+\.\d+$/.test(it.codigo_item) ? it.codigo_item : ''),
                  item_cliente: it.codigo_item || it.referencia || '',
                  descripcion: it.descripcion,
                  descripcion_cliente: it.descripcion,
                  descripcion_cfip: topSug?.descripcion || '',
                  referencia_cfip: topSug?.referencia || it.referencia || '',
                  cantidad: it.cantidad,
                  talla: tallaCalculada,
                  precio_unitario: it.precio_unitario,
                  precio_total: it.precio_total,
                  rowid_siesa: topSug?.rowid_siesa || it.rowid_siesa || null,
                  sugerencias_siesa: it.sugerencias_siesa || []
                };
              });
              this.mostrarMensaje(`Unlimited OCR: Extraídos ${data.items.length} ítems automáticamente.`);
            }
          }
          this.cdr.detectChanges();
          if (this.originalFile?.type === 'application/pdf') {
            setTimeout(() => this.renderPdfOriginal(), 100);
          }
        },
        error: (err) => {
          console.warn('Error en Unlimited OCR backend:', err);
          this.cdr.detectChanges();
          if (this.originalFile?.type === 'application/pdf') {
            setTimeout(() => this.renderPdfOriginal(), 100);
          }
        }
      });

    } catch (err: any) {
      this.mostrarError(err.message || 'Error al procesar el documento.');
      console.error(err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
      // Auto-render PDF original view
      if (this.originalFile?.type === 'application/pdf') {
        setTimeout(() => this.renderPdfOriginal(), 200);
      }
    }
  }

  seleccionarSugerenciaSiesa(itemIndex: number, sug: any): void {
    if (!this.itemsProcesados[itemIndex] || !sug) return;
    const it = this.itemsProcesados[itemIndex];
    it.rowid_siesa = sug.rowid_siesa;
    it.codigo_item = sug.codigo_item || it.codigo_item;
    it.item_cfip = sug.referencia || sug.codigo_item || it.item_cfip;
    it.referencia_cfip = sug.referencia || sug.codigo_item || it.referencia_cfip;
    it.descripcion_cfip = sug.descripcion || it.descripcion_cfip;
    it.color_cfip = sug.color_siesa || '';
    if (sug.talla_siesa) {
      it.talla = sug.talla_siesa;
    }
    this.mostrarMensaje(`Vinculado ítem CFIP: ${it.item_cfip}`);
  }

  agregarNuevoItemVacio(): void {
    this.editIndex = null;
    this.itemTemporal = {
      item_cfip: '',
      item_cliente: '',
      descripcion: '',
      cantidad: null,
      talla: '',
      precio_unitario: null
    };
  }

  // ==========================================
  // MAPEO DE DATOS
  // ==========================================

  capturarSeleccion(): void {
    const sel = window.getSelection()?.toString().trim();
    if (sel) {
      this.textoSeleccionado = sel;
      console.log('Selección capturada:', sel);
    }
  }

  asignarSeleccion(campo: CampoEstructura): void {
    const seleccion = this.textoSeleccionado || window.getSelection()?.toString().trim();

    if (seleccion) {
      if (['numero_oc', 'cliente_nombre', 'nit', 'fecha_solicitud', 'fecha_entrega'].includes(campo)) {
        if (campo === 'fecha_solicitud' || campo === 'fecha_entrega') {
          (this.cabeceraOrden as any)[campo] = this.sanitizarFecha(seleccion);
        } else {
          (this.cabeceraOrden as any)[campo] = seleccion;
        }
      } else {
        if (campo === 'cantidad' || campo === 'precio_unitario') {
          const val = this.parseNumber(seleccion);
          (this.itemTemporal as any)[campo] = isNaN(val) ? null : val;
        } else {
          (this.itemTemporal as any)[campo] = seleccion;
        }
      }
      this.mostrarMensaje(`Asignado a: ${campo.replace('_', ' ')}`);

      // Limpiar para la siguiente
      this.textoSeleccionado = '';
      window.getSelection()?.removeAllRanges();

      if (campo === 'cliente_nombre') this.buscarClienteManual(seleccion);
    } else {
      this.mostrarError('Primero resalta un texto en el visor.');
    }
  }

  deteccionInteligente(): void {
    const seleccion = this.textoSeleccionado || window.getSelection()?.toString().trim();

    if (!seleccion) {
      this.mostrarError('Primero selecciona un texto en el visor.');
      return;
    }

    // 1. Detectar Fechas
    const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})|(\d{6,8})/;
    if (dateRegex.test(seleccion)) {
      const fechaSanitizada = this.sanitizarFecha(seleccion);
      if (!this.cabeceraOrden.fecha_solicitud) {
        this.cabeceraOrden.fecha_solicitud = fechaSanitizada;
        this.mostrarMensaje('Detectado como Fecha de Solicitud');
      } else {
        this.cabeceraOrden.fecha_entrega = fechaSanitizada;
        this.mostrarMensaje('Detectado como Fecha de Entrega');
      }
      return;
    }

    // 2. Detectar NIT (Números con guiones o longitud de NIT)
    const nitRegex = /^[\d\.\-]{7,15}$/;
    if (nitRegex.test(seleccion)) {
      this.cabeceraOrden.nit = seleccion.replace(/\./g, '');
      this.mostrarMensaje('Detectado como NIT');
      return;
    }

    // 3. Detectar Cantidad o Precio (Si estamos en paso 2)
    if (this.pasoActual === 2) {
      const num = this.parseNumber(seleccion);
      if (!isNaN(num) && num > 0) {
        if (!this.itemTemporal.cantidad) {
          this.itemTemporal.cantidad = num;
          this.mostrarMensaje('Detectado como Cantidad');
        } else {
          this.itemTemporal.precio_unitario = num;
          this.mostrarMensaje('Detectado como Precio Unitario');
        }
        return;
      }
    }

    // 4. Si no detectó nada específico, preguntar o asignar a descripción si es largo
    if (seleccion.length > 10 && this.pasoActual === 2 && !this.itemTemporal.descripcion) {
      this.itemTemporal.descripcion = seleccion;
      this.mostrarMensaje('Detectado como Descripción');
    } else if (seleccion.length < 15 && !this.cabeceraOrden.numero_oc) {
      this.cabeceraOrden.numero_oc = seleccion;
      this.mostrarMensaje('Detectado como Número OC');
    } else {
      this.mostrarError('No pudimos determinar el tipo de dato. Por favor asígnalo manualmente.');
    }
  }

  /**
   * Sanitiza formatos de fecha: DD/MM/YY, DD.MM.YYYY, DDMMYYYY, etc.
   * Convierte a formato estándar DD/MM/YYYY
   */
  private sanitizarFecha(s: string): string {
    if (!s) return '';

    // 1. Limpieza básica: quitar espacios y normalizar separadores a '/'
    let limpia = s.replace(/[\.\-\s]/g, '/').replace(/[^\d\/]/g, '');

    // 2. Si es solo números (ej: 14052026 o 140526)
    if (/^\d{6,8}$/.test(limpia)) {
      if (limpia.length === 8) {
        // DDMMYYYY -> DD/MM/YYYY
        return `${limpia.substring(0, 2)}/${limpia.substring(2, 4)}/${limpia.substring(4, 8)}`;
      } else if (limpia.length === 6) {
        // DDMMYY -> DD/MM/20YY (Asumiendo siglo 21)
        return `${limpia.substring(0, 2)}/${limpia.substring(2, 4)}/20${limpia.substring(4, 6)}`;
      }
    }

    // 3. Si ya tiene barras, detectar formato y normalizar a DD/MM/YYYY
    const partes = limpia.split('/').filter(p => p.length > 0);
    if (partes.length === 3) {
      let d = partes[0];
      let m = partes[1];
      let y = partes[2];

      // Detectar formato YYYY/MM/DD (primer segmento tiene 4 dígitos)
      if (d.length === 4) {
        // Invertir a DD/MM/YYYY
        const tmp = d;
        d = y;
        y = tmp;
      }

      d = d.padStart(2, '0');
      m = m.padStart(2, '0');
      if (y.length === 2) y = '20' + y;
      return `${d}/${m}/${y}`;
    }

    return limpia;
  }

  /**
   * PARSER INTELIGENTE: Maneja formatos CO (1.000,00) y US (1,000.00)
   * detectando qué separador es el decimal según la posición y cantidad de dígitos.
   */
  private parseNumber(s: string): number {
    if (!s) return 0;
    // Limpieza: Quitar símbolos de moneda y letras
    let clean = s.replace(/[\$A-Za-z\s]/g, '').trim();

    const lastDot = clean.lastIndexOf('.');
    const lastComma = clean.lastIndexOf(',');

    if (lastDot > lastComma) {
      // Caso 1: 1,234.5678 (Punto es el último)
      if (lastComma !== -1) return parseFloat(clean.replace(/,/g, ''));

      const parts = clean.split('.');
      const lastPart = parts[parts.length - 1];
      // Si tiene 4 o más decimales (como 3.0000), es decimal casi seguro
      if (lastPart.length >= 4) return parseFloat(clean);
      // Si tiene exactamente 3 y es el único, en Latam suele ser miles: "37.032" -> 37032
      if (lastPart.length === 3 && parts.length === 2 && !clean.includes(',')) return parseFloat(clean.replace('.', ''));

      return parseFloat(clean);
    } else if (lastComma > lastDot) {
      // Caso 2: 1.234,56 (Coma es el último) -> Estilo Latam/Europa
      return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    } else {
      // Caso 3: No hay separadores o solo uno de un tipo
      return parseFloat(clean.replace(',', '.'));
    }
  }

  capturarTablaDesdeSeleccion(): void {
    const selection = window.getSelection();
    const selectedText = this.textoSeleccionado || selection?.toString().trim();

    if (!selectedText) {
      this.mostrarError('Por favor, resalta las filas de la tabla de ítems en el visor.');
      return;
    }

    // 1. Dividir por líneas y limpiar
    const lines = selectedText.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 2);

    const nuevosItems: any[] = [];

    // 2. Procesar cada línea como un potencial ítem independiente
    // Basado en que el documento del cliente es una lista directa
    lines.forEach(line => {
      const low = line.toLowerCase();

      // Ignorar cabeceras
      if (['item', 'pos', 'cod', 'referencia', 'cant', 'unitario', 'total', 'page', 'pagina'].some(k => low.includes(k) && low.length < 30)) return;

      // EXTRACCIÓN DE BLOQUES NUMÉRICOS (Cantidad, Precio, Total)
      // Buscamos números al final o entre el texto
      const numBlocks = line.match(/[\d\.,\$]{2,}/g) || [];
      const valNums = numBlocks.map(b => ({ raw: b, val: this.parseNumber(b) })).filter(n => !isNaN(n.val) && n.val !== 0);

      // Si la línea tiene al menos 2 números, asumimos que es una fila de producto completa
      if (valNums.length >= 2) {
        let desc = line;

        // Quitar los números de la descripción para aislar el nombre del producto
        valNums.forEach(n => desc = desc.replace(n.raw, ''));

        // Limpiar caracteres de control o índices que el usuario no quiere
        desc = desc.replace(/^\d{1,3}[\.\-\s]+/, '').trim();

        let qty = 0;
        let price = 0;
        let total = 0;

        // HEURÍSTICA PARA LISTAS DIRECTAS:
        // Normalmente los últimos 3 números son Cantidad, Precio Unitario, Total
        if (valNums.length >= 3) {
          // Buscamos la terna que cumpla Q * P = T
          let match = false;
          for (let i = valNums.length - 1; i >= 2; i--) {
            const t = valNums[i].val;
            const p = valNums[i - 1].val;
            const q = valNums[i - 2].val;
            if (Math.abs((q * p) - t) < (t * 0.05) + 10) {
              qty = q; price = p; total = t; match = true; break;
            }
          }
          if (!match) {
            // Fallback: los dos últimos
            qty = valNums[valNums.length - 2].val;
            total = valNums[valNums.length - 1].val;
            price = total / (qty || 1);
          }
        } else {
          // Solo 2 números: Cantidad y Total o Cantidad y Precio
          qty = valNums[0].val;
          price = valNums[1].val;
          total = qty * price;
        }

        nuevosItems.push({
          item_cfip: '',
          item_cliente: '',
          descripcion: desc.replace(/\s+/g, ' ').trim(),
          cantidad: qty,
          talla: '',
          precio_unitario: price,
          precio_total: total
        });
      }
      // Si la línea no tiene suficientes números pero hay ítems previos, 
      // podría ser una descripción larga que se rompió en el PDF
      else if (nuevosItems.length > 0 && line.length > 10) {
        nuevosItems[nuevosItems.length - 1].descripcion += ' ' + line;
      }
    });

    if (nuevosItems.length > 0) {
      // Limpieza final
      nuevosItems.forEach(it => it.descripcion = it.descripcion.replace(/\s+/g, ' ').trim());

      this.itemsProcesados = [...this.itemsProcesados, ...nuevosItems];
      this.mostrarMensaje(`Capturados ${nuevosItems.length} ítems de la lista.`);
      setTimeout(() => { this.pasoActual = 2; }, 800);
    } else {
      this.mostrarError('No se detectaron datos de productos en la selección.');
    }

    this.textoSeleccionado = '';
    window.getSelection()?.removeAllRanges();
  }

  buscarClienteManual(termino: string, tipo: 'NOMBRE' | 'NIT' = 'NOMBRE') {
    this.buscandoPor = tipo;
    if (termino.length > 2) {
      this.comercialService.buscarClientes(termino).subscribe({
        next: (res) => {
          this.clientesEncontrados = (res.data || []).map((c: any) => ({
            id: c.id,
            customerName: c.razon_social || c.nombre || '',
            customerId: c.nit || c.id || ''
          }));
        },
        error: (err) => {
          console.log('Error buscando cliente', err);
          this.clientesEncontrados = [];
          this.buscandoPor = null;
        }
      });
    } else {
      this.clientesEncontrados = [];
      this.buscandoPor = null;
    }
  }

  seleccionarClienteOption(cli: any) {
    this.cabeceraOrden.cliente_nombre = cli.customerName || cli.nombre_comercial || cli.razon_social || '';
    this.cabeceraOrden.nit = cli.customerId || cli.nit || cli.identificacion || '';
    this.clienteSiesaId = cli.id;
    this.clientesEncontrados = [];
    this.buscandoPor = null;
  }

  buscarItemsCFIP(termino: string, deep: boolean = false) {
    this.buscandoPor = 'ITEM_CFIP';
    this.busquedaProfundaItem = deep;

    if (!this.clienteSiesaId) {
      // Si no tenemos ID del cliente, intentamos buscarlo por NIT o Nombre primero
      const cliBusqueda = this.cabeceraOrden.nit || this.cabeceraOrden.cliente_nombre;
      if (cliBusqueda && cliBusqueda.length > 3) {
        this.comercialService.buscarClientes(cliBusqueda).subscribe(res => {
          if (res.data && res.data.length > 0) {
            this.clienteSiesaId = res.data[0].id;
            this.ejecutarBusquedaItemsSiesa(termino, deep);
          } else {
            this.mostrarError('No se encontró el cliente en Siesa. Selecciónalo manualmente.');
          }
        });
      } else {
        this.mostrarError('Primero selecciona un cliente para buscar sus ítems.');
      }
      return;
    }

    this.ejecutarBusquedaItemsSiesa(termino, deep);
  }

  private ejecutarBusquedaItemsSiesa(termino: string, deep: boolean) {
    // Si el término es corto, mostramos los últimos items del cliente
    if (termino.length <= 2) {
      this.comercialService.itemsCliente(this.clienteSiesaId!, deep).subscribe({
        next: (res) => { this.itemsSiesaEncontrados = res.data || []; },
        error: () => { this.itemsSiesaEncontrados = []; }
      });
    } else {
      this.comercialService.buscarItemsCliente(this.clienteSiesaId!, termino, deep).subscribe({
        next: (res) => { this.itemsSiesaEncontrados = res.data || []; },
        error: () => { this.itemsSiesaEncontrados = []; }
      });
    }
  }

  seleccionarItemSiesa(item: any) {
    this.itemTemporal.item_cfip = item.f120_id || item.referencia || '';

    this.itemsSiesaEncontrados = [];
    this.buscandoPor = null;
    this.busquedaProfundaItem = false;
    this.mostrarMensaje('Ítem de Siesa vinculado');
  }



  // ==========================================
  // GESTIÓN DE ÍTEMS (EDIT/ADD)
  // ==========================================

  agregarItem() {
    if (!this.itemTemporal.descripcion || !this.itemTemporal.cantidad) {
      this.mostrarError('Faltan datos obligatorios del ítem.');
      return;
    }

    const nuevoItem = {
      ...this.itemTemporal,
      precio_total: (this.itemTemporal.cantidad || 0) * (this.itemTemporal.precio_unitario || 0)
    };

    if (this.editIndex !== null) {
      this.itemsProcesados[this.editIndex] = nuevoItem;
      this.editIndex = null;
      this.mostrarMensaje('Ítem actualizado.');
    } else {
      this.itemsProcesados.push(nuevoItem);
      this.mostrarMensaje('Ítem añadido.');
    }

    this.limpiarItemTemporal();
  }

  editarItem(idx: number) {
    this.editIndex = idx;
    const item = this.itemsProcesados[idx];
    this.itemTemporal = { ...item };
    window.scrollTo({ top: 400, behavior: 'smooth' });
  }

  cancelarEdicion() {
    this.editIndex = null;
    this.limpiarItemTemporal();
  }

  eliminarItem(idx: number) {
    this.itemsProcesados.splice(idx, 1);
  }

  verDetalleItem(item: any, idx: number): void {
    this.itemSeleccionadoDetalle = { ...item, index: idx };
    this.extensionesItemDetalle = [];
    this.busquedaTallaModal = '';
    this.busquedaSiesaModal = '';
    this.resultadosSiesaModal = [];
    this.soloPvSiesaModal = false;
    this.tallaDropdownOpen = {};
    this.mostrarModalDetalle = true;

    // Cargar extensiones (tallas/colores) del ítem Siesa si hay un rowid_siesa vinculado
    if (item.rowid_siesa) {
      this.ordenCompraService.obtenerExtensionesItem(item.rowid_siesa).subscribe({
        next: (res) => {
          this.extensionesItemDetalle = res.data || [];
          this.cdr.detectChanges();
        },
        error: () => { this.extensionesItemDetalle = []; }
      });
    }

    // Inicializar búsqueda en Siesa por la descripción o palabras clave de la prenda
    const termBusqueda = item.descripcion_cliente || item.descripcion || item.item_cliente || '';
    if (termBusqueda) {
      // Extraer palabra distintiva para la búsqueda inicial (ej: COLUMBIA, BLUSA, CAMISA, PANTALON)
      const palabras = termBusqueda.split(' ').map((w: string) => w.trim()).filter((w: string) => w.length >= 3);
      const clave = palabras.find((w: string) => !['TIPO', 'CORTE', 'INTERNO', 'TELA', 'MAYA', 'BLANCO', 'BLANCA', 'NEGRO', 'ROJO', 'AZUL'].includes(w.toUpperCase())) || palabras[0] || termBusqueda;
      this.busquedaSiesaModal = clave;
      this.ejecutarBusquedaSiesaModal();
    }
  }

  ejecutarBusquedaSiesaModal(): void {
    if (!this.busquedaSiesaModal || this.busquedaSiesaModal.trim().length < 2) {
      this.resultadosSiesaModal = [];
      return;
    }

    this.buscandoSiesaModal = true;
    const clienteId = this.clienteSiesaId || null;
    // Pasar descripción completa del ítem para cálculo de coincidencia consistente con el OCR inicial
    const textoOriginal = this.itemSeleccionadoDetalle?.descripcion_cliente || this.itemSeleccionadoDetalle?.descripcion || '';

    this.ordenCompraService.buscarItemsSiesaCatalogo(this.busquedaSiesaModal, clienteId, this.soloPvSiesaModal, textoOriginal).subscribe({
      next: (res) => {
        this.resultadosSiesaModal = res.data || [];
        this.buscandoSiesaModal = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.resultadosSiesaModal = [];
        this.buscandoSiesaModal = false;
        this.cdr.detectChanges();
      }
    });
  }

  guardarEdicionDetalleModal(): void {
    if (!this.itemSeleccionadoDetalle) return;
    const idx = this.itemSeleccionadoDetalle.index;
    const original = this.itemsProcesados[idx];

    original.item_cliente = this.itemSeleccionadoDetalle.item_cliente;
    original.descripcion_cliente = this.itemSeleccionadoDetalle.descripcion_cliente;
    original.descripcion = this.itemSeleccionadoDetalle.descripcion_cliente;
    original.cantidad = parseFloat(this.itemSeleccionadoDetalle.cantidad) || 0;
    original.precio_unitario = parseFloat(this.itemSeleccionadoDetalle.precio_unitario) || 0;
    original.precio_total = original.cantidad * original.precio_unitario;
    original.talla = this.itemSeleccionadoDetalle.talla;

    this.itemsProcesados[idx] = { ...original };
    this.cdr.detectChanges();
    this.mostrarMensaje('Cambios guardados en el ítem.');
  }

  cerrarModalDetalle(): void {
    this.mostrarModalDetalle = false;
    this.itemSeleccionadoDetalle = null;
    this.extensionesItemDetalle = [];
  }

  vincularSugerenciaModal(sug: any): void {
    if (!this.itemSeleccionadoDetalle) return;
    const idx = this.itemSeleccionadoDetalle.index;
    this.seleccionarSugerenciaSiesa(idx, sug);
    this.itemSeleccionadoDetalle = { ...this.itemsProcesados[idx], index: idx };

    // Recargar extensiones para el nuevo ítem
    if (sug.rowid_siesa) {
      this.ordenCompraService.obtenerExtensionesItem(sug.rowid_siesa).subscribe({
        next: (res) => {
          this.extensionesItemDetalle = res.data || [];
          this.cdr.detectChanges();
        },
        error: () => { this.extensionesItemDetalle = []; }
      });
    }
    this.mostrarMensaje(`Vinculado en detalle: ${sug.codigo_item || sug.referencia}`);
  }

  seleccionarTallaModal(ext: any): void {
    if (!this.itemSeleccionadoDetalle) return;
    const idx = this.itemSeleccionadoDetalle.index;
    const it = this.itemsProcesados[idx];
    it.talla = ext.talla || '';
    it.color_cfip = ext.color || '';
    this.itemSeleccionadoDetalle = { ...it, index: idx };
    this.busquedaTallaModal = '';
    this.mostrarMensaje(`Talla seleccionada: ${ext.talla}`);
  }

  filtrarExtensionesModal(): any[] {
    if (!this.extensionesItemDetalle || this.extensionesItemDetalle.length === 0) return [];
    if (!this.busquedaTallaModal || this.busquedaTallaModal.trim() === '') {
      return this.extensionesItemDetalle;
    }
    const term = this.busquedaTallaModal.toLowerCase().trim();
    return this.extensionesItemDetalle.filter((ext: any) => {
      const talla = (ext.talla || '').toLowerCase();
      const color = (ext.color || '').toLowerCase();
      return talla.includes(term) || color.includes(term);
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    // Cerrar dropdown de tallas si se hace clic fuera de la zona de búsqueda
    if (!target.closest('.position-relative') || target.closest('.modal-footer')) {
      if (this.itemSeleccionadoDetalle) {
        this.tallaDropdownOpen[this.itemSeleccionadoDetalle.index] = false;
      }
    }
  }

  private extraerTallaHelper(desc: string, ref: string = ''): string {
    const tallasValidas = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '48', '50'];
    const full = ((desc || '') + ' ' + (ref || '')).trim();
    if (!full) return '';

    const m1 = full.match(/\b(?:talla|case|size|tl)\s*[:#\.]?\s*([A-Z0-9]{1,4})\b/i);
    if (m1) {
      const cand = m1[1].toUpperCase();
      if (tallasValidas.includes(cand)) return cand;
    }

    const m2 = full.match(/\b(5XL|4XL|3XL|2XL|XXXL|XXL|XL|XS|28|30|32|34|35|36|37|38|39|40|41|42|43|44|45|46|48|50)\b/i);
    if (m2) {
      const cand = m2[1].toUpperCase();
      if (tallasValidas.includes(cand)) return cand;
    }

    const mSingle = full.match(/(?:talla|case|size|tl|t|\/|\-|=|:)\s*[:#\.]?\s*\b([SML])\b/i);
    if (mSingle) {
      const cand = mSingle[1].toUpperCase();
      if (tallasValidas.includes(cand)) return cand;
    }

    if (ref) {
      const refUpper = ref.trim().toUpperCase();
      const m3 = refUpper.match(/(3XL|2XL|XXXL|XXL|XL|XS|28|30|32|34|36|38|40|42|44|46|48)/i);
      if (m3) {
        const cand = m3[1].toUpperCase();
        if (tallasValidas.includes(cand)) return cand;
      }

      const m4 = refUpper.match(/[A-Z]{2,5}(S|M|L)[A-Z]{1,3}/i);
      if (m4) {
        const cand = m4[1].toUpperCase();
        if (tallasValidas.includes(cand)) return cand;
      }
    }

    return '';
  }

  private limpiarItemTemporal() {
    this.itemTemporal = {
      item_cfip: '',
      item_cliente: '',
      descripcion: '',
      cantidad: null,
      talla: '',
      precio_unitario: null
    };
  }

  // ==========================================
  // DESGLOSE Y DIVISION DE ITEMS POR TALLAS
  // ==========================================

  desglosarItemUI(index: number): void {
    const item = this.itemsProcesados[index];
    if (!item) return;

    // Buscar en la descripción de este ítem y de todos los ítems de la lista
    const textosParaBuscar = [
      item.descripcion_cliente || item.descripcion || '',
      ...this.itemsProcesados.map(it => it.descripcion_cliente || it.descripcion || '')
    ];

    let subItems: any[] = [];
    const cantTarget = item.cantidad || 0;

    for (const desc of textosParaBuscar) {
      if (!desc) continue;
      const mBlocks = Array.from(desc.matchAll(/(Mujer|Hombre|Dama|Caballero|Niño|Niña)?\s*(?:Tallas?:?\s*)?((?:[A-Z0-9]{1,4}\s*[:=\-]\s*\d+[\s,\-]*)+)/gi));

      for (const block of mBlocks) {
        const genero = (block[1] || '').trim();
        const cadenaTallas = block[2];
        const mPairs = Array.from(cadenaTallas.matchAll(/([A-Z0-9]{1,4})\s*[:=\-]\s*(\d+)/gi));

        const blockItems: any[] = [];
        let sumCant = 0;

        for (const pair of mPairs) {
          const t = pair[1].toUpperCase().trim();
          const c = parseInt(pair[2], 10);
          if (c > 0) {
            sumCant += c;
            blockItems.push({ talla: t, cant: c, genero });
          }
        }

        // Si la suma del bloque coincide con la cantidad del ítem actual
        if (blockItems.length > 0 && (sumCant === cantTarget || (subItems.length === 0 && sumCant > 0))) {
          const mBase = (item.descripcion || desc).match(/(CAMIBUSO|PANTALON|CAMISETA|POLO|CHAQUETA|GORRA|OVEROL)/i);
          const basePrenda = mBase ? mBase[1].toUpperCase() : ((item.descripcion || desc).trim().split(' ')[0] || 'PRENDA');
          const pu = item.precio_unitario || 0;

          const candidates = blockItems.map(bi => ({
            ...item,
            descripcion: `${basePrenda} ${bi.genero ? bi.genero + ' ' : ''}TALLA ${bi.talla}`.trim(),
            descripcion_cliente: `${basePrenda} ${bi.genero ? bi.genero + ' ' : ''}TALLA ${bi.talla}`.trim(),
            talla: bi.talla,
            cantidad: bi.cant,
            precio_total: bi.cant * pu
          }));

          if (sumCant === cantTarget) {
            subItems = candidates;
            break;
          } else if (subItems.length === 0) {
            subItems = candidates;
          }
        }
      }
      if (subItems.length > 0 && subItems.reduce((acc, it) => acc + it.cantidad, 0) === cantTarget) break;
    }

    if (subItems.length > 0) {
      this.itemsProcesados.splice(index, 1, ...subItems);
      this.cdr.detectChanges();
      Swal.fire({
        icon: 'success',
        title: 'Ítem Desglosado',
        text: `Se desglosó el ítem en ${subItems.length} líneas por talla y género.`,
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      this.duplicarItemParaTalla(index);
    }
  }

  duplicarItemParaTalla(index: number): void {
    const item = this.itemsProcesados[index];
    if (!item) return;

    Swal.fire({
      title: 'Crear Sub-ítem por Talla',
      html: `
        <div class="text-start">
          <p class="small text-muted mb-3">Especifica la talla y la cantidad para crear una línea desglosada:</p>
          <div class="mb-3">
            <label class="form-label small fw-bold">Talla:</label>
            <input id="swalTalla" class="form-control form-control-sm" placeholder="Ej. S, M, L, XL, 32...">
          </div>
          <div class="mb-3">
            <label class="form-label small fw-bold">Cantidad:</label>
            <input id="swalCant" type="number" class="form-control form-control-sm" value="${item.cantidad || 1}">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Agregar Línea',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      preConfirm: () => {
        const tallaInput = (document.getElementById('swalTalla') as HTMLInputElement).value;
        const cantInput = parseInt((document.getElementById('swalCant') as HTMLInputElement).value, 10);
        if (!tallaInput) {
          Swal.showValidationMessage('Debes ingresar una talla.');
          return false;
        }
        if (!cantInput || cantInput <= 0) {
          Swal.showValidationMessage('La cantidad debe ser mayor a 0.');
          return false;
        }
        return { talla: tallaInput.toUpperCase().trim(), cant: cantInput };
      }
    }).then((res) => {
      if (res.isConfirmed && res.value) {
        const pu = item.precio_unitario || 0;
        const newItem = {
          ...item,
          talla: res.value.talla,
          cantidad: res.value.cant,
          precio_total: res.value.cant * pu
        };
        this.itemsProcesados.splice(index + 1, 0, newItem);
        this.cdr.detectChanges();
      }
    });
  }

  // ==========================================
  // HELPERS
  // ==========================================

  getKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  mostrarError(msg: string) {
    this.error = msg;
    setTimeout(() => this.error = null, 4000);
  }

  mostrarMensaje(msg: string) {
    this.mensaje = msg;
    setTimeout(() => this.mensaje = null, 3000);
  }

  get totalOrden(): number {
    return this.itemsProcesados.reduce((acc, it) => acc + (it.precio_total || 0), 0);
  }

  get subtotalAntesDeIva(): number {
    if (this.cabeceraOrden.incluye_iva) {
      return this.totalOrden / 1.19;
    }
    return this.totalOrden;
  }

  get valorIvaCalculado(): number {
    if (this.cabeceraOrden.incluye_iva) {
      return this.totalOrden - (this.totalOrden / 1.19);
    }
    return this.totalOrden * 0.19;
  }

  get totalFinalOrden(): number {
    if (this.cabeceraOrden.incluye_iva) {
      return this.totalOrden;
    }
    return this.totalOrden * 1.19;
  }

  get precioTotalCalculado(): number {
    const c = this.itemTemporal.cantidad || 0;
    const p = this.itemTemporal.precio_unitario || 0;
    return c * p;
  }

  // ==========================================
  // ZOOM DEL VISOR
  // ==========================================
  zoomIn(): void {
    this.zoomLevel = Math.min(this.zoomLevel + 10, 200);
    this.aplicarZoomPdf();
  }
  zoomOut(): void {
    this.zoomLevel = Math.max(this.zoomLevel - 10, 50);
    this.aplicarZoomPdf();
  }
  resetZoom(): void {
    this.zoomLevel = 100;
    this.aplicarZoomPdf();
  }

  private aplicarZoomPdf(): void {
    const container = document.getElementById('pdf-original-container');
    if (!container) return;
    const wrappers = container.querySelectorAll('.pdf-page-wrapper') as NodeListOf<HTMLElement>;
    wrappers.forEach((wrapper: HTMLElement) => {
      wrapper.style.transform = `scale(${this.zoomLevel / 100})`;
      wrapper.style.transformOrigin = 'top center';
    });
  }

  // ==========================================
  // DRAG PAN (arrastrar con click derecho)
  // ==========================================
  private activeScrollTarget: HTMLElement | null = null;

  onViewerMouseDown(event: MouseEvent): void {
    // Click derecho (button 2) o click central con rueda (button 1)
    if (event.button === 2 || event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      this.isDragging = true;
      this.dragStartX = event.clientX;
      this.dragStartY = event.clientY;

      const viewerBody = document.getElementById('doc-viewer-body');
      const pdfContainer = document.getElementById('pdf-original-container');

      if (pdfContainer && pdfContainer.scrollHeight > pdfContainer.clientHeight) {
        this.activeScrollTarget = pdfContainer;
      } else if (viewerBody) {
        this.activeScrollTarget = viewerBody;
      } else {
        this.activeScrollTarget = event.currentTarget as HTMLElement;
      }

      this.scrollStartX = this.activeScrollTarget.scrollLeft;
      this.scrollStartY = this.activeScrollTarget.scrollTop;
      if (viewerBody) viewerBody.style.cursor = 'grabbing';

      const onMove = (e: MouseEvent) => this.onViewerMouseMove(e);
      const onUp = (e: MouseEvent) => {
        this.onViewerMouseUp(e);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
  }

  onViewerMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.activeScrollTarget) return;
    event.preventDefault();
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    this.activeScrollTarget.scrollLeft = this.scrollStartX - dx;
    this.activeScrollTarget.scrollTop = this.scrollStartY - dy;
  }

  onViewerMouseUp(event: MouseEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      const viewerBody = document.getElementById('doc-viewer-body');
      if (viewerBody) viewerBody.style.cursor = '';
      this.activeScrollTarget = null;
    }
  }

  // ==========================================
  // GUARDAR ORDEN EN BACKEND
  // ==========================================

  guardarOrden(): void {
    if (this.itemsProcesados.length === 0) {
      this.mostrarError('No hay ítems para guardar.');
      return;
    }

    if (!this.cabeceraOrden.numero_oc || !this.cabeceraOrden.cliente_nombre) {
      this.mostrarError('Número de OC y nombre del cliente son obligatorios.');
      return;
    }

    this.savingOrder = true;

    // 1. Crear la OC en backend
    const formData = new FormData();
    formData.append('numero_orden', this.cabeceraOrden.numero_oc);
    formData.append('cliente_id', '0'); // Se resuelve con el NIT
    formData.append('archivo_url', ''); // No hay archivo en este flujo
    formData.append('incluye_iva', this.cabeceraOrden.incluye_iva ? '1' : '0');

    this.ordenCompraService.registrarOrden(formData).subscribe({
      next: (res) => {
        const ordenId = res.data.id;

        // 2. Guardar los ítems parseados
        const itemsPayload = this.itemsProcesados.map(item => ({
          codigo_item: item.item_cfip || item.item_cliente || '',
          descripcion: item.descripcion,
          referencia: item.item_cfip || '',
          cantidad: item.cantidad || 0,
          precio_unitario: item.precio_unitario || 0,
          precio_total: item.precio_total || 0,
        }));

        this.comercialService.listarClientes().subscribe(); // Refresh cache

        // Guardar ítems parseados vía servicio
        this.ordenCompraService.guardarItems(ordenId, itemsPayload).subscribe({
          next: () => {
            // Guardar aprendizaje continuo para este cliente si se dispone de clienteSiesaId
            if (this.clienteSiesaId && this.itemsProcesados.length > 0) {
              const itemsConMapeo = this.itemsProcesados
                .filter(it => it.rowid_siesa)
                .map(it => ({
                  descripcion_cliente: it.descripcion_cliente || it.descripcion,
                  rowid_siesa: it.rowid_siesa,
                  codigo_siesa: it.item_cfip,
                  referencia_siesa: it.item_cfip,
                  talla_siesa: it.talla || '',
                  descripcion_siesa: it.descripcion_cfip || it.descripcion
                }));

              if (itemsConMapeo.length > 0) {
                this.ordenCompraService.guardarMapeoCliente(this.clienteSiesaId, itemsConMapeo).subscribe({
                  error: (err) => console.warn('Error al guardar mapeos aprendidos:', err)
                });
              }
            }

            this.savingOrder = false;
            Swal.fire({
              title: '¡Orden Guardada!',
              html: `<p>OC <strong>${this.cabeceraOrden.numero_oc}</strong> registrada con ${this.itemsProcesados.length} ítems.</p>`,
              icon: 'success',
              confirmButtonText: 'Ir a Órdenes',
              showCancelButton: true,
              cancelButtonText: 'Capturar otra'
            }).then((result) => {
              if (result.isConfirmed) {
                this.router.navigate(['/comerciales/ordenes']);
              } else {
                this.seleccionarTipo(null);
              }
            });
          },
          error: (err: any) => {
            this.savingOrder = false;
            console.error('Error guardando ítems:', err);
            Swal.fire('Error', 'La orden se creó pero no se pudieron guardar los ítems', 'warning');
          }
        });
      },
      error: (err) => {
        this.savingOrder = false;
        console.error('Error creando orden:', err);
        Swal.fire('Error', err.error?.message || 'No se pudo crear la orden', 'error');
      }
    });
  }
}