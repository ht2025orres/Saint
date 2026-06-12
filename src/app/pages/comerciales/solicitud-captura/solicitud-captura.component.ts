import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
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
    fecha_entrega: ''
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

  // --- ESTADOS UI ---
  loading = false;
  savingOrder = false;
  pasoActual = 1;
  zoomLevel = 100; // PDF viewer zoom %
  showViewer = true; // Control de visibilidad del visor
  tipoSolicitud: 'ORDEN_COMPRA' | 'MUESTRA_COTIZACION' | null = 'ORDEN_COMPRA';
  editIndex: number | null = null;
  error: string | null = null;
  mensaje: string | null = null;
  textoSeleccionado: string = ''; // Almacena la última selección válida
  nombreArchivo: string | null = null; // Nombre del archivo cargado

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
        textLayerDiv.style.opacity = '0.2'; // Casi invisible pero seleccionable
        textLayerDiv.style.lineHeight = '1.0';

        pageDiv.appendChild(canvas);
        pageDiv.appendChild(textLayerDiv);
        container.appendChild(pageDiv);

        // Renderizar página en canvas
        await page.render({ canvasContext: context, viewport }).promise;

        // Renderizar capa de texto
        const textContent = await page.getTextContent();
        const textItems = textContent.items as any[];

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
          span.style.color = 'transparent'; // Hacerlo invisible pero seleccionable
          
          textLayerDiv.appendChild(span);
        });
      }
    } catch (err) {
      console.error('Error rendering PDF:', err);
      container.innerHTML = '<div class="alert alert-danger">No se pudo renderizar la vista original selectable.</div>';
    }
  }

  // ==========================================
  // CARGA Y PROCESAMIENTO
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

      const result = await this.service.parseDocument(fileOrFiles);

      // --- AUTOMATIZACIÓN 90%: Inyección de Datos Estructurados ---
      if (result.structuredData) {
        const sd = result.structuredData;
        if (sd.cabecera) {
          if (sd.cabecera.numero_oc) this.cabeceraOrden.numero_oc = sd.cabecera.numero_oc;
          if (sd.cabecera.cliente_nombre) this.cabeceraOrden.cliente_nombre = sd.cabecera.cliente_nombre;
          if (sd.cabecera.nit) this.cabeceraOrden.nit = sd.cabecera.nit;
          if (sd.cabecera.fecha_solicitud) this.cabeceraOrden.fecha_solicitud = sd.cabecera.fecha_solicitud;
          if (sd.cabecera.fecha_entrega) this.cabeceraOrden.fecha_entrega = sd.cabecera.fecha_entrega;
        }
      }

      // --- ASIGNACIÓN DE VISTA ---
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
      }
    } catch (err: any) {
      this.mostrarError(err.message || 'Error al procesar el documento.');
      console.error(err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
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
    
    // 3. Si ya tiene barras, asegurar que el año tenga 4 dígitos
    const partes = limpia.split('/');
    if (partes.length === 3) {
      let d = partes[0].padStart(2, '0');
      let m = partes[1].padStart(2, '0');
      let y = partes[2];
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
            const p = valNums[i-1].val;
            const q = valNums[i-2].val;
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

  get precioTotalCalculado(): number {
    const c = this.itemTemporal.cantidad || 0;
    const p = this.itemTemporal.precio_unitario || 0;
    return c * p;
  }

  // ==========================================
  // ZOOM DEL VISOR
  // ==========================================
  zoomIn(): void { this.zoomLevel = Math.min(this.zoomLevel + 10, 200); }
  zoomOut(): void { this.zoomLevel = Math.max(this.zoomLevel - 10, 50); }
  resetZoom(): void { this.zoomLevel = 100; }

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