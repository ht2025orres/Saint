import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { PaginationService } from '../../../shared/pagination/pagination.service';
import { AuthService } from '../../../services/auth.service';
import Swal from 'sweetalert2';
import { getDetallesHtml, generarTiemposHtml, generarEvidenciasHtml } from '../../../shared/templates/detalles-popup.template';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
@Component({
  selector: 'app-historico-inconsistencias',
  templateUrl: './historico.component.html',
  styleUrls: ['./historico.component.css']
})
export class HistoricoInconsistenciasComponent implements OnInit {
  title = 'Histórico de Inconsistencias';
  inconsistencias: any[] = [];
  inconsistenciasFiltradas: any[] = [];
  currentData: any[] = [];
  tipos_inco: any = {};
  paginatorId = 'historicoPaginator';
  modalRef?: BsModalRef;

  tiemposProceso: any[] = [];
  cargandoTiempos = false;

  mostrarDepartamento = false;
  mostrarEstado = true;
  esLiderEspecial = false;

  evidenciasActuales: string[] = [];
mostrandoEvidencias = false;

  lastLoadedDesde = '';
  lastLoadedHasta = '';

  filters = {
    busqueda: '',
    estado: '',
    desde: '',
    hasta: ''
  };

  @ViewChild('modalTiempos') modalTiempos!: TemplateRef<any>;

  constructor(
    private inconsistenciasService: InconsistenciaService,
    public paginationService: PaginationService,
    private modalService: BsModalService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.cargarTiposInconsistencias();
    
    // Rango de fechas por defecto: primer día del mes actual al día de hoy
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.filters.desde = this.formatDate(primerDia);
    this.filters.hasta = this.formatDate(hoy);

    this.cargarInconsistencias();
  }

  formatDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  cargarTiposInconsistencias(): void {
    fetch('/assets/config/config.json')
      .then(r => r.json())
      .then(json => this.tipos_inco = json);
  }

  cargarInconsistencias(): void {
    this.lastLoadedDesde = this.filters.desde;
    this.lastLoadedHasta = this.filters.hasta;

    this.inconsistenciasService.listarHistorico(undefined, undefined, this.filters.desde, this.filters.hasta).subscribe({
      next: (res: any) => {
        // La respuesta del backend tiene la forma { success: true, data: [...] }
        const datos = res.data || res;
        
        // Calcular el estado y separar NIT/Nombre para cada inconsistencia
        this.inconsistencias = Array.isArray(datos) ? datos.map((inco: any) => ({
          ...inco,
          nit_cliente: this.extraerNit(inco.Cliente),
          nombre_cliente: this.extraerNombreCliente(inco.Cliente),
          estado: this.determinarEstado(inco)
        })) : [];

        // Aplicar filtros inmediatamente después de cargar
        this.aplicarFiltrosLocales();
      },
      error: (err) => {
        console.error('Error al cargar inconsistencias:', err);
      }
    });
  }

  extraerNit(clienteStr: string | null | undefined): string {
    if (!clienteStr) return 'N/A';
    const str = clienteStr.trim();
    const match = str.match(/^(?:NIT\s*[:#\.]?\s*)?([\d\.\-]{7,17})(?:\s*[\-\|:]\s*|\s+|$)/i);
    if (match) {
      const nitMatch = match[1].trim();
      const digits = nitMatch.replace(/\D/g, '');
      if (digits.length >= 7) {
        return nitMatch.replace(/^[\-\s]+|[\-\s]+$/g, '');
      }
    }
    return 'N/A';
  }

  extraerNombreCliente(clienteStr: string | null | undefined): string {
    if (!clienteStr) return 'N/A';
    const str = clienteStr.trim();
    const match = str.match(/^(?:NIT\s*[:#\.]?\s*)?[\d\.\-]{7,17}\s*[\-\|:]?\s*(.*)/i);
    if (match && match[1] && match[1].trim().length > 0) {
      return match[1].trim();
    }
    return str;
  }

  /**
   * Aplica los filtros de búsqueda y estado localmente sin consultar el servidor
   */
  aplicarFiltrosLocales(): void {
    // Filtrar el array de inconsistencias original
    this.inconsistenciasFiltradas = this.inconsistencias.filter(item => {
      const texto = this.filters.busqueda?.toLowerCase() || '';

      // Filtro de búsqueda de texto
      const coincideBusqueda = !texto ||
        item.Cliente?.toLowerCase().includes(texto) ||
        item.nit_cliente?.toLowerCase().includes(texto) ||
        item.nombre_cliente?.toLowerCase().includes(texto) ||
        item.item?.toLowerCase().includes(texto) ||
        item.descripcion_inconsistencia?.toLowerCase().includes(texto) ||
        item.id_inconsistencia?.toString().includes(texto) ||
        (item.nombre_solicitante + ' ' + item.apellido_solicitante)?.toLowerCase().includes(texto) ||
        item.tipo_de_orden?.toLowerCase().includes(texto);

      // Filtro de estado
      const coincideEstado = !this.filters.estado || item.estado === this.filters.estado;

      return coincideBusqueda && coincideEstado;
    });

    // Reinicializar el paginador con los datos filtrados
    this.paginationService.initializePaginator(
      this.paginatorId,
      this.inconsistenciasFiltradas,
      10,
      {},  // No necesitamos pasar filtros al paginador porque ya filtramos localmente
      () => true  // Función de filtro que siempre retorna true
    ).subscribe(state => {
      this.currentData = state.currentData;
    });
  }

  /**
   * Método llamado cuando se aplican los filtros desde la interfaz
   */
  applyFilters(): void {
    if (this.filters.desde !== this.lastLoadedDesde || this.filters.hasta !== this.lastLoadedHasta) {
      this.cargarInconsistencias();
    } else {
      this.aplicarFiltrosLocales();
    }
  }

  clearFilters(): void {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.filters = {
      busqueda: '',
      estado: '',
      desde: this.formatDate(primerDia),
      hasta: this.formatDate(hoy)
    };
    this.cargarInconsistencias();
  }

  parseNumero(val: any): number | null {
    if (val === null || val === undefined || val === '') return null;

    if (typeof val === 'number') {
      return isNaN(val) ? null : val;
    }

    let str = String(val).trim();
    if (!str) return null;

    if (str.includes('.') && str.includes(',')) {
      const lastDot = str.lastIndexOf('.');
      const lastComma = str.lastIndexOf(',');
      if (lastComma > lastDot) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }

    str = str.replace(/[^0-9.-]/g, '');

    const parsed = parseFloat(str);
    return isNaN(parsed) ? null : parsed;
  }

  formatUnidadMedida(val: any): string {
    if (!val) return 'N/A';
    const u = String(val).trim().toLowerCase();
    const mapa: { [key: string]: string } = {
      'unidades': 'UDS',
      'metros': 'MTS',
      'centimetros': 'CMS',
      'mts': 'MTS',
      'mt': 'MTS',
      'und': 'UDS',
      'uds': 'UDS',
      'cms': 'CMS',
      'cm': 'CMS'
    };
    return mapa[u] || u.toUpperCase();
  }

  exportarExcel(): void {
    if (!this.inconsistenciasFiltradas || this.inconsistenciasFiltradas.length === 0) {
      Swal.fire('Atención', 'No hay datos filtrados para exportar', 'warning');
      return;
    }

    const data = this.inconsistenciasFiltradas.map(inco => {
      return {
        'Fecha': inco.fecha_inconsistencia ? new Date(inco.fecha_inconsistencia).toLocaleDateString('es-ES') : '',
        'ID Inconsistencia': inco.id_inconsistencia,
        'NIT Cliente': inco.nit_cliente || this.extraerNit(inco.Cliente),
        'Cliente': inco.nombre_cliente || this.extraerNombreCliente(inco.Cliente),
        'Solicitante': inco.solicitante || 'N/A',
        'Departamento': inco.departamento || 'N/A',
        'Tipo de Inconsistencia': this.tipos_inco[inco.tipo_inconsistencia] || inco.tipo_inconsistencia || 'N/A',
        'Cant. Solicitada OP': this.parseNumero(inco.cantidad_solicitada_op),
        'Cant. Inconsistencia': this.parseNumero(inco.cantidad_inconsistencia),
        'Unidad de Medida': this.formatUnidadMedida(inco.unidad_medida),
        'Item': inco.item || 'N/A',
        'Tipo Orden': this.extraerTipoOrden(inco.tipo_de_orden),
        'Número Orden/Pedido': this.extraerNumeroOrden(inco.tipo_de_orden),
        'Estado Orden': this.formatEstadoOrden(inco.estado_orden),
        'Precio Unitario': this.parseNumero(inco.precio_unitario),
        'Precio Total': this.parseNumero(inco.precio_total_inconsistencia),
        'Estado': this.getEstadoLabel(inco.estado),
        'Descripción': inco.descripcion_inconsistencia || '',
        'Acción Sugerida': inco.accion_inconsistencia || ''
      };
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

    // Formatear las celdas numéricas para que Excel (en español) aplique miles (.) y decimales (,)
    const numCols = ['Cant. Solicitada OP', 'Cant. Inconsistencia', 'Precio Unitario', 'Precio Total'];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    const headerMap: { [key: number]: string } = {};
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })];
      if (cell && cell.v) {
        headerMap[C] = String(cell.v);
      }
    }

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const colName = headerMap[C];
        if (numCols.includes(colName)) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellRef];
          if (cell && cell.t === 'n') {
            cell.z = '#,##0.00';
          }
        }
      }
    }

    const workbook: XLSX.WorkBook = {
      Sheets: { 'Histórico Inconsistencias': worksheet },
      SheetNames: ['Histórico Inconsistencias']
    };

    const excelBuffer: any = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const blob = new Blob([excelBuffer], {
      type: 'application/octet-stream'
    });

    const nombreArchivo = `Historico_Inconsistencias_${this.filters.desde || 'inicio'}_a_${this.filters.hasta || 'fin'}.xlsx`;
    saveAs(blob, nombreArchivo);
  }

  abrirModalDetalles(inconsistencia: any): void {
    // Obtener URLs de evidencias: prioridad a evidencias_urls, luego evidencias si ya es array de URLs
    let archivos: string[] = [];
    if (Array.isArray(inconsistencia.evidencias_urls) && inconsistencia.evidencias_urls.length > 0) {
      archivos = inconsistencia.evidencias_urls;
    } else if (Array.isArray(inconsistencia.evidencias) && inconsistencia.evidencias.length > 0) {
      archivos = inconsistencia.evidencias;
    }

    const evidenciasHtml = archivos.length > 0 ? archivos.map((url: string, i: number) => {
      const ext = url.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
        return `<div style="text-align: center; margin-bottom: 10px;">
                  <span style="display:block;font-size:12px;color:#888;">Evidencia ${i + 1}</span>
                  <img src="${url}" style="max-width:100%; max-height: 400px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer;" onclick="window.open('${url}', '_blank')">
                </div>`;
      }
      return `<div style="margin-bottom: 10px;">
                <a href="${url}" target="_blank" style="background:#72BE44; color:white; padding: 6px 12px; text-decoration:none; border-radius: 4px; font-size:12px; display:inline-block;">Abrir Archivo Adjunto ${i + 1}</a>
              </div>`;
    }).join('') : '<p style="color:#888; font-size:13px; font-style:italic;">No hay evidencias adjuntas.</p>';

    // Abrir ventana nativa (pop-up)
    const win = window.open('', '_blank', 'width=900,height=750,scrollbars=yes,resizable=yes');
    if (win) {
      win.document.write('<p style="font-family:sans-serif;text-align:center;padding:20px;">Cargando detalles...</p>');
    }

    this.inconsistenciasService.obtenerTiemposProceso(inconsistencia.id_inconsistencia || inconsistencia.id).subscribe({
      next: (res: any) => {
        // Generar HTML de tiempos y evidencias usando las funciones compartidas
        const tiemposHtml = generarTiemposHtml(res, this.getNombreEtapa.bind(this));
        const evidenciasHtml = generarEvidenciasHtml(archivos);

        // Generar el HTML completo usando la plantilla compartida
        const htmlContent = getDetallesHtml(
          inconsistencia,
          tiemposHtml,
          evidenciasHtml,
          '', // Histórico no tiene botones de acción
          this.tipos_inco,
          this.getNombreEtapa.bind(this),
          {
            mostrarSeccionAnulacion: true,
            mostrarFooter: true,
            mostrarInfoEconomica: false, // Histórico no lo mostraba
            mostrarBotonesAccion: false
          }
        );

        if (win) {
          win.document.open();
          win.document.write(htmlContent);
          win.document.close();
        }
      },
      error: (err) => {
        if (win) {
          win.document.body.innerHTML = '<p style="color:red; text-align:center; padding:20px;">Error al cargar los tiempos de proceso.</p>';
        }
      }
    });
  }

  // Método auxiliar para obtener nombres legibles de las etapas
  getNombreEtapa(etapa: string): string {
    const nombres: any = {
      'lider': 'Líder',
      'calidad': 'Calidad',
      'finalizacion': 'Consumo',
      'logistica': 'Logística',
      'patronaje': 'Patronaje'
    };
    return nombres[etapa] || etapa;
  }

  /**
   * Determina el estado general de una inconsistencia basándose en su etapa actual
   * y el campo anulado_por
   * @param inconsistencia - Objeto con la información de la inconsistencia
   * @returns Estado de la inconsistencia: "en_proceso", "terminada", u otra etapa.
   */
  determinarEstado(inconsistencia: any): string {
    // Si fue anulada, retornar 'anulado'
    if (inconsistencia.fecha_anulacion || inconsistencia.anulado_por) {
      return 'anulado';
    }
    // Si la etapa actual es "terminada", el estado es "terminada"
    if (inconsistencia.etapa === 'terminada') {
      return 'terminada';
    }
    // Si está en proceso, retornar la etapa actual específica
    return inconsistencia.etapa || 'en_proceso';
  }

  getEstadoLabel(estado: string): string {
    const estados: any = {
      'lider': 'Líder',
      'calidad': 'Calidad',
      'logistica': 'Logística',
      'contabilidad': 'Contabilidad',
      'cartera': 'Cartera',
      'patronaje': 'Patronaje',
      'trazo': 'Trazo',
      'finalizacion': 'Consumo',
      'en_proceso': 'En proceso',
      'terminada': 'Terminada',
      'anulado': 'Anulada'
    };
    return estados[estado] || estado;
  }

  getEstadoClass(estado: string): string {
    const clases: any = {
      // Etapas en proceso
      'lider': 'badge bg-info text-white',
      'calidad': 'badge bg-primary',
      'logistica': 'badge bg-warning text-dark',
      'contabilidad': 'badge bg-purple text-white',
      'cartera': 'badge bg-orange text-white',
      'patronaje': 'badge bg-secondary',
      'trazo': 'badge bg-secondary',
      'finalizacion': 'badge bg-info text-white',
      'en_proceso': 'badge bg-warning text-dark',
      // Estados finales
      'terminada': 'badge bg-success',
      'anulado': 'badge bg-danger'
    };
    return clases[estado] || 'badge bg-secondary';
  }

  /**
   * Extrae el tipo de orden (OP, OPM, PV, etc.) del campo tipo_de_orden
   * Ejemplo: "OP 12345" → "OP", "OPM-678 Abierta" → "OPM"
   */
  extraerTipoOrden(tipoDeOrden: string | null): string {
    if (!tipoDeOrden) return 'N/A';
    const texto = tipoDeOrden.trim().toUpperCase();
    // Buscar prefijo de tipo conocido
    const match = texto.match(/^(OPM|OP|PV|PD|OC|RM|NC|FC|FV|REM)/);
    if (match) return match[1];
    // Si no coincide con un patrón conocido, tomar la primera palabra
    const primeraPalabra = texto.split(/[\s\-]+/)[0];
    return primeraPalabra || 'N/A';
  }

  /**
   * Extrae el número de la orden/pedido del campo tipo_de_orden
   * Ejemplo: "OP 12345" → "12345", "OPM-678" → "678"
   */
  extraerNumeroOrden(tipoDeOrden: string | null): string {
    if (!tipoDeOrden) return 'N/A';
    const texto = tipoDeOrden.trim();
    // Remover el prefijo de tipo y extraer el resto (número y posible texto)
    const sinTipo = texto.replace(/^(OPM|OP|PV|PD|OC|RM|NC|FC|FV|REM)[\s\-]*/i, '').trim();
    // Remover estado si está pegado al final (Abierta, Cerrada, etc.)
    const sinEstado = sinTipo.replace(/\s*(abierta|cerrada|anulada|terminada)\s*$/i, '').trim();
    return sinEstado || texto;
  }

  /**
   * Formatea el estado de la orden a texto legible
   * Ejemplo: "1" → "Abierta", "0" → "Cerrada", "Abierta" → "Abierta"
   */
  formatEstadoOrden(estadoOrden: any): string {
    if (estadoOrden === null || estadoOrden === undefined || estadoOrden === '') return 'N/A';
    const val = String(estadoOrden).trim().toLowerCase();
    if (val === '1' || val === 'abierta' || val === 'activa' || val === 'true') return 'Abierta';
    if (val === '0' || val === 'cerrada' || val === 'inactiva' || val === 'false') return 'Cerrada';
    if (val === 'anulada') return 'Anulada';
    // Si ya es un texto legible, capitalizar
    return val.charAt(0).toUpperCase() + val.slice(1);
  }
}