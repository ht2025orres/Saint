import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SolicitudComercialService } from '../../../services/solicitud-comercial.service';
import { ErpIntegrationService } from '../../../services/erp-integration.service';

type CampoEstructura = 'numero_oc' | 'cliente_nombre' | 'nit' | 'fecha_solicitud' | 'fecha_entrega' | 'cantidad' | 'descripcion' | 'precio_unitario' | 'item_cfip' | 'item_cliente' | 'talla';

@Component({
  selector: 'app-solicitud',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './solicitud.component.html',
  styleUrls: ['./solicitud.component.css']
})
export class SolicitudComponent implements OnInit {

  // --- MODELOS ---
  cabeceraOrden = {
    numero_oc: '',
    cliente_nombre: '',
    nit: '',
    fecha_solicitud: '10/10/26',
    fecha_entrega: '15/11/26'
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

  // --- ESTADOS UI ---
  loading = false;
  pasoActual = 1;
  tipoSolicitud: 'ORDEN_COMPRA' | 'MUESTRA_COTIZACION' | null = null;
  editIndex: number | null = null;
  error: string | null = null;
  mensaje: string | null = null;

  // Visualización del documento
  htmlDocumentoPlano: string | null = null;
  textoDocumentoPlano: string | null = null;
  safeHtmlDocumento: SafeHtml | null = null;
  datosDocumentoExcel: any[] = [];

  constructor(
    private service: SolicitudComercialService,
    private erpIntegration: ErpIntegrationService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void { }

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
    this.htmlDocumentoPlano = null;
    this.textoDocumentoPlano = null;
    this.datosDocumentoExcel = [];
    this.itemsProcesados = [];

    try {
      const result = await this.service.parseDocument(fileOrFiles);

      // --- AUTOMATIZACIÓN 90%: Inyección de Datos Estructurados ---
      if (result.structuredData) {
        const sd = result.structuredData;
        if (sd.cabecera) {
          if (sd.cabecera.numero_oc) this.cabeceraOrden.numero_oc = sd.cabecera.numero_oc;
          if (sd.cabecera.cliente_nombre) this.cabeceraOrden.cliente_nombre = sd.cabecera.cliente_nombre;
          if (sd.cabecera.nit) this.cabeceraOrden.nit = sd.cabecera.nit;
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

  asignarSeleccion(campo: CampoEstructura): void {
    const seleccion = window.getSelection()?.toString().trim();
    if (seleccion) {
      if (['numero_oc', 'cliente_nombre', 'nit', 'fecha_solicitud', 'fecha_entrega'].includes(campo)) {
        (this.cabeceraOrden as any)[campo] = seleccion;
      } else {
        if (campo === 'cantidad' || campo === 'precio_unitario') {
          const val = this.parseNumber(seleccion);
          (this.itemTemporal as any)[campo] = isNaN(val) ? null : val;
        } else {
          (this.itemTemporal as any)[campo] = seleccion;
        }
      }
      this.mostrarMensaje(`Texto asignado a: ${campo.replace('_', ' ')}`);
      window.getSelection()?.removeAllRanges();
      if (campo === 'cliente_nombre') this.buscarClienteManual(seleccion);
    } else {
      this.mostrarError('Por favor, resalta un texto en el documento primero.');
    }
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
    const selectedText = selection?.toString().trim();
    if (!selectedText) {
      this.mostrarError('Por favor, resalta las filas de la tabla de ítems.');
      return;
    }

    // Dividir por líneas pero manteniendo un rastro de "ítem actual"
    const lines = selectedText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    const nuevosItems: any[] = [];
    let itemActual: any = null;

    lines.forEach(line => {
      const low = line.toLowerCase();
      // Ignorar cabeceras y basurilla técnica
      if (['item', 'pos', 'cod', 'referencia', 'cant', 'unitario', 'total', 'page', 'pagina', 'vviene', 'vienen'].some(k => low.includes(k) && low.length < 25)) return;

      const numBlocks = line.match(/[\d\.,\$]{1,}/g) || [];
      const valNums = numBlocks.map(b => ({ raw: b, val: this.parseNumber(b) })).filter(n => !isNaN(n.val));

      // ¿Tiene datos numéricos (Cantidad/Precio)?
      if (valNums.length >= 1) {
        let desc = line;
        valNums.forEach(n => desc = desc.replace(n.raw, ''));
        desc = desc.replace(/\s{2,}/g, ' ').trim();

        let qty = 1;
        let price = 0;

        // HEURÍSTICA DE RECONOCIMIENTO
        if (valNums.length >= 3) {
          let matchFound = false;
          for (let i = valNums.length - 1; i >= 2; i--) {
            const target = valNums[i].val;
            for (let j = 0; j < i; j++) {
              for (let k = j + 1; k < i; k++) {
                const p1 = valNums[j].val;
                const p2 = valNums[k].val;
                if (Math.abs((p1 * p2) - target) < (target * 0.01) + 5) {
                  qty = p1; price = p2; matchFound = true; break;
                }
              }
              if (matchFound) break;
            }
            if (matchFound) break;
          }
          if (!matchFound) {
            qty = valNums[valNums.length - 2].val;
            price = valNums[valNums.length - 1].val;
          }
        } else if (valNums.length === 2) {
          qty = valNums[0].val;
          price = valNums[1].val;
        } else {
          price = valNums[0].val;
        }

        // Si es una línea con números, asumimos nuevo ítem
        itemActual = {
          item_cfip: '',
          item_cliente: line.split(/\s+/)[0].length < 20 ? line.split(/\s+/)[0] : '',
          descripcion: desc,
          cantidad: qty,
          talla: '',
          precio_unitario: price,
          precio_total: (qty * price)
        };
        nuevosItems.push(itemActual);
      }
      // Si NO tiene números pero hay un ítem previo, es una continuación de descripción
      else if (itemActual && line.length > 3) {
        itemActual.descripcion += ' ' + line;
      }
    });

    if (nuevosItems.length > 0) {
      // Limpiar descripciones (remover comas dobles o espacios extras)
      nuevosItems.forEach(it => it.descripcion = it.descripcion.replace(/\s+/g, ' ').trim());

      this.itemsProcesados = [...this.itemsProcesados, ...nuevosItems];
      this.mostrarMensaje(`Se capturaron ${nuevosItems.length} ítems correctamente.`);
      setTimeout(() => { this.pasoActual = 2; }, 1000);
    } else {
      this.mostrarError('No detectamos Cantidad/Precio. Resalta las filas completas.');
    }
    selection?.removeAllRanges();
  }

  buscarClienteManual(termino: string) {
    if (termino.length > 2) {
      this.erpIntegration.searchCustomer(termino).subscribe({
        next: (clientes) => { this.clientesEncontrados = clientes || []; },
        error: (err) => { console.log('Error buscando cliente', err); this.clientesEncontrados = []; }
      });
    } else {
      this.clientesEncontrados = [];
    }
  }

  seleccionarClienteOption(cli: any) {
    this.cabeceraOrden.cliente_nombre = cli.customerName || cli.nombre_comercial || cli.razon_social || '';
    this.cabeceraOrden.nit = cli.customerId || cli.nit || cli.identificacion || '';
    this.clientesEncontrados = [];
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
}