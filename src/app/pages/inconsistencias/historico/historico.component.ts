import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { PaginationService } from '../../../shared/pagination/pagination.service';
import { AuthService } from '../../../services/auth.service';
import Swal from 'sweetalert2';
import { getDetallesHtml, generarTiemposHtml, generarEvidenciasHtml } from '../../../shared/templates/detalles-popup.template';
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

  filters = {
    busqueda: '',
    estado: '',
    mes: ''
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
    this.cargarInconsistencias();
  }

  cargarTiposInconsistencias(): void {
    fetch('/assets/config/config.json')
      .then(r => r.json())
      .then(json => this.tipos_inco = json);
  }

  cargarInconsistencias(): void {
    // Solo obtener el mes actual por defecto si no hay filtro de mes
    const [year, month] = this.filters.mes
      ? this.filters.mes.split('-').map(Number)
      : [new Date().getFullYear(), new Date().getMonth() + 1];

    this.inconsistenciasService.listarHistorico(month, year).subscribe({
      next: (res: any) => {
        // La respuesta del backend tiene la forma { success: true, data: [...] }
        const datos = res.data || res;
        
        // Calcular el estado para cada inconsistencia y guardar en array principal
        this.inconsistencias = Array.isArray(datos) ? datos.map((inco: any) => ({
          ...inco,
          estado: this.determinarEstado(inco)
        })) : [];

        // Aplicar filtros inmediatamente después de cargar
        this.aplicarFiltrosLocales();
      },
      error: (err) => {
      }
    });
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
        item.item?.toLowerCase().includes(texto) ||
        item.descripcion_inconsistencia?.toLowerCase().includes(texto) ||
        item.id_inconsistencia?.toString().includes(texto) ||
        (item.nombre_solicitante + ' ' + item.apellido_solicitante)?.toLowerCase().includes(texto.toLowerCase()) ||
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
    // Si cambió el filtro de mes, recargar desde el servidor
    if (this.filters.mes) {
      this.cargarInconsistencias();
    } else {
      // Si solo son filtros de búsqueda o estado, filtrar localmente
      this.aplicarFiltrosLocales();
    }
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
}