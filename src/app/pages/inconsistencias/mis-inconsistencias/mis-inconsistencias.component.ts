import { Component, OnInit } from '@angular/core';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { AuthService } from 'src/app/services/auth.service';
import { PaginationService } from '../../../shared/pagination/pagination.service';
import Swal from 'sweetalert2';
import { getDetallesHtml, generarTiemposHtml, generarEvidenciasSwalHtml, generarEvidenciasHtml } from '../../../shared/templates/detalles-popup.template';
interface Inconsistencia {
  id: number;
  id_inconsistencia: string;
  fecha_inconsistencia: string;
  Cliente: string;
  tipo_inconsistencia: string;
  cantidad_solicitada_op: string;
  cantidad_inconsistencia: string;
  item: string;
  tipo_de_orden: string;
  precio_unitario: number;
  precio_total_inconsistencia: number;
  descripcion_inconsistencia: string;
  etapa: string;
  estado_inconsistencia: string;
  accion_inconsistencia: string;
  estado_consumo: string;
  evidencias: string[] | null;
  razon_anulacion: string | null;
  fecha_anulacion: string | null;
  nombre_solicitante: string;
  nombre_jefe_inmediato: string;
  nombre_persona_que_anulo: string;
  nombre_departamento: string;
  historial_aprobaciones: HistorialAprobacion[];
  puede_anular: boolean;
}

interface HistorialAprobacion {
  etapa: string;
  usuario: string;
  fecha: string;
  observacion: string | null;
}

@Component({
  selector: 'app-mis-inconsistencias',
  templateUrl: './mis-inconsistencias.component.html',
  styleUrls: ['./mis-inconsistencias.component.css']
})
export class MisInconsistenciasComponent implements OnInit {
  inconsistencias: Inconsistencia[] = [];
  inconsistenciasFiltradas: Inconsistencia[] = [];
  currentData: Inconsistencia[] = [];
  cargando: boolean = false;
  error: string = '';
  idUsuario: number = 1;
  paginatorId = 'misInconsistenciasPaginator';

  // Filtros
  filtroEstado: string = '';
  filtroEtapa: string = '';
  filtroTipo: string = '';
  busqueda: string = '';
  filtroFechaDesde: string = '';
  filtroFechaHasta: string = '';

  filtrosExpandidos: boolean = false;

  // Modal
  modalAnularAbierto: boolean = false;
  inconsistenciaSeleccionada: Inconsistencia | null = null;
  razonAnulacion: string = '';
  procesandoAnulacion: boolean = false;

  // ELIMINAR ESTA LÍNEA (ya no se necesita)
  // modalDetallesAbierto: boolean = false;

  // Estados y etapas únicas
  estados: string[] = [];
  etapas: string[] = [];
  tiposInconsistencia: string[] = [];

  constructor(
    private inconsistenciasService: InconsistenciaService,
    private authService: AuthService,
    public paginationService: PaginationService
  ) { }

  ngOnInit(): void {
    const today = new Date();
    const firstDayPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    this.filtroFechaDesde = firstDayPrevMonth.toISOString().split('T')[0];
    this.filtroFechaHasta = lastDay.toISOString().split('T')[0];

    this.cargarInconsistencias();
  }

  toggleFiltros(): void {
    this.filtrosExpandidos = !this.filtrosExpandidos;
  }

  contarFiltrosActivos(): number {
    let contador = 0;
    if (this.filtroEstado) contador++;
    if (this.filtroEtapa) contador++;
    if (this.filtroTipo) contador++;
    if (this.busqueda) contador++;
    if (this.filtroFechaDesde) contador++;
    if (this.filtroFechaHasta) contador++;
    return contador;
  }

  trackByInconsistencia(index: number, item: Inconsistencia): number {
    return item.id;
  }

  cargarInconsistencias(): void {
    this.cargando = true;
    this.error = '';
    let idUsuario = this.authService.user?.id_Sdp || this.authService.user?.id;
    this.inconsistenciasService.listarPorUsuario(idUsuario, this.filtroFechaDesde, this.filtroFechaHasta).subscribe({
      next: (data) => {
        this.inconsistencias = data;
        this.extraerOpcionesFiltros();
        // Aplicar filtros existentes a la nueva data cargada
        this.aplicarFiltros();
      },
      error: (err) => {
        this.error = 'Error al cargar las inconsistencias. Por favor, intente nuevamente.';
        this.cargando = false;
      }
    });
  }

  extraerOpcionesFiltros(): void {
    this.estados = [...new Set(this.inconsistencias.map(i => i.estado_inconsistencia).filter(e => e))];
    this.etapas = [...new Set(this.inconsistencias.map(i => i.etapa).filter(e => e))];
    this.tiposInconsistencia = [...new Set(this.inconsistencias.map(i => i.tipo_inconsistencia).filter(t => t))];
  }

  cambioFecha(): void {
    // Al cambiar la fecha, volver a cargar desde el backend
    this.cargarInconsistencias();
  }

  aplicarFiltros(): void {
    this.cargando = true;
    setTimeout(() => {
      this.inconsistenciasFiltradas = this.inconsistencias.filter(inc => {
        const cumpleEstado = !this.filtroEstado || inc.estado_inconsistencia === this.filtroEstado;
        const cumpleEtapa = !this.filtroEtapa || inc.etapa === this.filtroEtapa;
        const cumpleTipo = !this.filtroTipo || inc.tipo_inconsistencia === this.filtroTipo;
        const cumpleBusqueda = !this.busqueda ||
          inc.id_inconsistencia.toLowerCase().includes(this.busqueda.toLowerCase()) ||
          inc.Cliente?.toLowerCase().includes(this.busqueda.toLowerCase()) ||
          inc.item?.toLowerCase().includes(this.busqueda.toLowerCase());

        let cumpleFecha = true;
        // La fecha ya se filtra en el backend, pero mantenemos esta lógica de seguridad
        if (this.filtroFechaDesde && inc.fecha_inconsistencia) {
          cumpleFecha = cumpleFecha && new Date(inc.fecha_inconsistencia) >= new Date(this.filtroFechaDesde);
        }
        if (this.filtroFechaHasta && inc.fecha_inconsistencia) {
          cumpleFecha = cumpleFecha && new Date(inc.fecha_inconsistencia) <= new Date(this.filtroFechaHasta);
        }

        return cumpleEstado && cumpleEtapa && cumpleTipo && cumpleBusqueda && cumpleFecha;
      });

      // Inicializar/actualizar paginador con datos filtrados
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.inconsistenciasFiltradas,
        10,
        {},
        () => true
      ).subscribe(state => {
        this.currentData = state.currentData;
      });

      this.cargando = false;
    }, 300); // 300ms de feedback visual para que el usuario note que se aplicaron
  }

  limpiarFiltros(): void {
    this.filtroEstado = '';
    this.filtroEtapa = '';
    this.filtroTipo = '';
    this.busqueda = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.inconsistenciasFiltradas = this.inconsistencias;
    // Reinicializar paginador con todos los datos
    this.paginationService.initializePaginator(
      this.paginatorId,
      this.inconsistenciasFiltradas,
      10,
      {},
      () => true
    ).subscribe(state => {
      this.currentData = state.currentData;
    });
  }

  abrirModalAnular(inconsistencia: Inconsistencia): void {
    this.inconsistenciaSeleccionada = inconsistencia;
    this.modalAnularAbierto = true;
    this.razonAnulacion = '';
  }

  cerrarModalAnular(): void {
    this.modalAnularAbierto = false;
    this.inconsistenciaSeleccionada = null;
    this.razonAnulacion = '';
  }

  confirmarAnulacion(): void {
    if (!this.inconsistenciaSeleccionada || !this.razonAnulacion.trim()) {
      return;
    }

    this.procesandoAnulacion = true;

    this.inconsistenciasService.anularInconsistencia(
      this.inconsistenciaSeleccionada.id_inconsistencia || this.inconsistenciaSeleccionada.id.toString(),
      this.razonAnulacion,
      ((this.authService.user?.id_Sdp || this.authService.user?.id) ?? '').toString()
    ).subscribe({
      next: (res) => {
        this.procesandoAnulacion = false;
        if (res.success) {
          Swal.fire({
            icon: 'success',
            title: 'Inconsistencia anulada',
            text: 'La inconsistencia se ha anulado correctamente.'
          });
          this.cerrarModalAnular();
          this.cargarInconsistencias();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo anular la inconsistencia.'
          });
        }
      },
      error: (err) => {
        this.procesandoAnulacion = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al intentar anular la inconsistencia.'
        });
      }
    });
  }

  puedeSerAnulada(inco: any): boolean {
    if (!inco) return false;
    const estado = inco.estado_inconsistencia || '';
    const inactiva = estado === 'Denegada' || estado === 'Aprobada' || inco.fecha_anulacion;
    const terminada = inco.etapa === 'terminada';
    return !inactiva && !terminada;
  }

  abrirModalDetalles(inconsistencia: any): void {
    this.inconsistenciaSeleccionada = inconsistencia;

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

    // Abrir ventana nativa (pop-up) de inmediato para evitar bloqueos del navegador
    const win = window.open('', '_blank', 'width=900,height=750,scrollbars=yes,resizable=yes');
    if (win) {
      win.document.write('<p style="font-family:sans-serif;text-align:center;padding:20px;">Cargando detalles...</p>');
    }

    // Obtener los tiempos del proceso
    this.inconsistenciasService.obtenerTiemposProceso(inconsistencia.id_inconsistencia || inconsistencia.id).subscribe({
      next: (res: any) => {


        // Generar HTML de tiempos y evidencias usando las funciones compartidas
        const tiemposHtml = generarTiemposHtml(res, this.traducirEtapa.bind(this));
        const evidenciasHtml = generarEvidenciasHtml(archivos);

        // Construir HTML usando la plantilla completa
        const htmlContent = getDetallesHtml(
          inconsistencia,
          tiemposHtml,
          evidenciasHtml,
          '', // Mis inconsistencias no tiene botones de acción aquí
          this.tiposInconsistencia, // Asegurarse que se le pasen los tipos
          this.traducirEtapa.bind(this),
          {
            mostrarSeccionAnulacion: true,
            mostrarFooter: true,
            mostrarInfoEconomica: true,
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

  // Método auxiliar para escapar HTML y prevenir XSS
  private escapeHtml(text: string | null | undefined): string {
    if (!text) return 'N/A';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ELIMINAR ESTE MÉTODO (ya no se necesita)
  // cerrarModalDetalles(): void {
  //   this.modalDetallesAbierto = false;
  //   this.inconsistenciaSeleccionada = null;
  // }

  obtenerClaseEstado(estado: string): string {
    const clases: { [key: string]: string } = {
      'abierta': 'estado-abierta',
      'Aprobada': 'estado-aprobada',
      'Anulada': 'estado-anulada',
      'Denegada': 'estado-denegada'
    };
    return clases[estado] || 'estado-default';
  }

  obtenerClaseEtapa(etapa: string): string {
    const clases: { [key: string]: string } = {
      'lider': 'etapa-lider',
      'contabilidad': 'etapa-contabilidad',
      'calidad': 'etapa-calidad',
      'logistica': 'etapa-logistica',
      'terminada': 'etapa-terminada',
      'espera': 'etapa-espera',
      'cartera': 'etapa-cartera',
      'patronaje': 'etapa-patronaje'
    };
    return clases[etapa] || 'etapa-default';
  }

  formatearFecha(fecha: string | null): string {
    if (!fecha) return 'N/A';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatearMoneda(valor: number | null): string {
    if (!valor) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor);
  }

  traducirTipoInconsistencia(tipo: string): string {
    const traducciones: { [key: string]: string } = {
      'error_operario': 'Error de Operario',
      'error_patronaje': 'Error de Patronaje',
      'error_corte': 'Error de Corte',
      'documental_contabilidad': 'Documental Contabilidad',
      'documental_calidad': 'Documental Calidad',
      'ajuste_promedio': 'Ajuste de Promedio'
    };
    return traducciones[tipo] || tipo;
  }

  traducirEtapa(etapa: string): string {
    const traducciones: { [key: string]: string } = {
      'lider': 'Líder',
      'contabilidad': 'Contabilidad',
      'calidad': 'Calidad',
      'logistica': 'Logística',
      'terminada': 'Terminada',
      'espera': 'En Espera',
      'cartera': 'Cartera',
      'patronaje': 'Patronaje',
      'desarrollo': 'Desarrollo',
      'produccion': 'Producción',
      'trazo': 'Trazo'
    };
    return traducciones[etapa] || etapa;
  }

  tieneEvidencias(inconsistencia: Inconsistencia): boolean {
    // Verificar si tiene evidencias_urls
    if ((inconsistencia as any).evidencias_urls && (inconsistencia as any).evidencias_urls.length > 0) {
      return true;
    }
    // Verificar si tiene evidencias como array
    if (inconsistencia.evidencias && Array.isArray(inconsistencia.evidencias) && inconsistencia.evidencias.length > 0) {
      return true;
    }
    // Verificar si tiene evidencias como string JSON
    if (inconsistencia.evidencias && typeof inconsistencia.evidencias === 'string') {
      try {
        const parsed = JSON.parse(inconsistencia.evidencias);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch {
        return false;
      }
    }
    return false;
  }

  verEvidencias(inconsistencia: Inconsistencia): void {
    // Primero intenta obtener evidencias_urls (que vienen del backend ya parseadas)
    let archivos = (inconsistencia as any).evidencias_urls;

    // Si no existen evidencias_urls, intenta parsear evidencias (formato antiguo)
    if (!archivos || archivos.length === 0) {
      try {
        let evidenciasParsed: string[] = [];

        // Si evidencias es un array, usarlo directamente
        if (Array.isArray(inconsistencia.evidencias)) {
          evidenciasParsed = inconsistencia.evidencias;
        }
        // Si evidencias es un string, intentar parsearlo como JSON
        else if (typeof inconsistencia.evidencias === 'string') {
          evidenciasParsed = JSON.parse(inconsistencia.evidencias || '[]');
        }

        // Convierte las rutas relativas a URLs completas
        archivos = evidenciasParsed.map((ruta: string) => {
          // Si ya es una URL completa, retornarla tal cual
          if (ruta && (ruta.startsWith('http://') || ruta.startsWith('https://'))) {
            return ruta;
          }
          // Usa el dominio actual de la app (útil en desarrollo y producción)
          const baseUrl = 'https://colegioprovidencia.edu.co/Saint-Backend/public';
          return `${baseUrl}/${ruta}`;
        });
      } catch (error) {
        archivos = [];
      }
    }

    if (!archivos || archivos.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin evidencia',
        text: 'Esta inconsistencia no tiene evidencias adjuntas.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // HTML del Swal generado desde el template compartido (sin duplicar lógica en el .ts)
    const swalHtml = generarEvidenciasSwalHtml(archivos);

    Swal.fire({
      title: `<span style="font-size: 1.5rem; font-weight: 700; color: #1e293b;">Evidencias</span>`,
      html: swalHtml,
      width: 'min(90%, 800px)',
      showCloseButton: true,
      showConfirmButton: false,
      customClass: {
        popup: 'swal-evidencias-popup',
        title: 'swal-evidencias-title',
        htmlContainer: 'swal-evidencias-container'
      },
      didOpen: () => {
        const popup = document.querySelector('.swal-evidencias-popup') as HTMLElement;
        if (popup) {
          popup.setAttribute('role', 'dialog');
          popup.setAttribute('aria-modal', 'true');
          popup.setAttribute('aria-labelledby', 'swal2-title');
        }
      }
    });
  }
}