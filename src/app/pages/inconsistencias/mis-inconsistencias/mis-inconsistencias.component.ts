import { Component, OnInit } from '@angular/core';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2'; // AGREGAR ESTA LÍNEA

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
  cargando: boolean = false;
  error: string = '';
  idUsuario: number = 1;
  
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

  constructor(private inconsistenciasService: InconsistenciaService, private authService: AuthService) {}

  ngOnInit(): void {
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
    let idUsuario = this.authService.user.id_Sdp
    this.inconsistenciasService.listarPorUsuario(idUsuario).subscribe({
      next: (data) => {
        this.inconsistencias = data;
        this.inconsistenciasFiltradas = data;
        this.extraerOpcionesFiltros();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al cargar las inconsistencias. Por favor, intente nuevamente.';
        this.cargando = false;
        console.error('Error:', err);
      }
    });
  }

  extraerOpcionesFiltros(): void {
    this.estados = [...new Set(this.inconsistencias.map(i => i.estado_inconsistencia).filter(e => e))];
    this.etapas = [...new Set(this.inconsistencias.map(i => i.etapa).filter(e => e))];
    this.tiposInconsistencia = [...new Set(this.inconsistencias.map(i => i.tipo_inconsistencia).filter(t => t))];
  }

  aplicarFiltros(): void {
    this.inconsistenciasFiltradas = this.inconsistencias.filter(inc => {
      const cumpleEstado = !this.filtroEstado || inc.estado_inconsistencia === this.filtroEstado;
      const cumpleEtapa = !this.filtroEtapa || inc.etapa === this.filtroEtapa;
      const cumpleTipo = !this.filtroTipo || inc.tipo_inconsistencia === this.filtroTipo;
      const cumpleBusqueda = !this.busqueda || 
        inc.id_inconsistencia.toLowerCase().includes(this.busqueda.toLowerCase()) ||
        inc.Cliente?.toLowerCase().includes(this.busqueda.toLowerCase()) ||
        inc.item?.toLowerCase().includes(this.busqueda.toLowerCase());
      
      let cumpleFecha = true;
      if (this.filtroFechaDesde && inc.fecha_inconsistencia) {
        cumpleFecha = cumpleFecha && new Date(inc.fecha_inconsistencia) >= new Date(this.filtroFechaDesde);
      }
      if (this.filtroFechaHasta && inc.fecha_inconsistencia) {
        cumpleFecha = cumpleFecha && new Date(inc.fecha_inconsistencia) <= new Date(this.filtroFechaHasta);
      }

      return cumpleEstado && cumpleEtapa && cumpleTipo && cumpleBusqueda && cumpleFecha;
    });
  }

  limpiarFiltros(): void {
    this.filtroEstado = '';
    this.filtroEtapa = '';
    this.filtroTipo = '';
    this.busqueda = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.inconsistenciasFiltradas = this.inconsistencias;
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
    
    console.log('Anulando inconsistencia:', this.inconsistenciaSeleccionada.id, this.razonAnulacion);
    
    setTimeout(() => {
      this.procesandoAnulacion = false;
      this.cerrarModalAnular();
      this.cargarInconsistencias();
    }, 1000);
  }

  abrirModalDetalles(inconsistencia: Inconsistencia): void {
    this.inconsistenciaSeleccionada = inconsistencia;
    

    // Construir el HTML del contenido del modal con diseño Mobile First y accesibilidad WCAG 2.2
    const htmlContent = `
      <div 
        role="document"
        aria-label="Detalles de inconsistencia ${inconsistencia.id_inconsistencia}"
        style="
          text-align: left;
          max-height: calc(100vh - 200px);
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1rem;
          font-size: clamp(0.875rem, 2.5vw, 1rem);
          line-height: 1.6;
          color: #0f172a;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        "
      >
        <!-- Información General -->
        <section 
          aria-labelledby="info-general-title" 
          style="
            margin-bottom: 2rem;
            scroll-margin-top: 1rem;
          "
        >
          <h2 
            id="info-general-title"
            style="
              color: #1e3a8a;
              font-size: clamp(1rem, 3vw, 1.25rem);
              font-weight: 700;
              margin: 0 0 1.25rem 0;
              border-bottom: 3px solid #3b82f6;
              padding-bottom: 0.75rem;
              line-height: 1.3;
            "
          >
            Información General
          </h2>

          <dl 
            style="
              display: grid; 
              gap: 1.25rem;
              margin: 0;
            "
          >
            ${[
              ['Cliente', inconsistencia.Cliente],
              ['Departamento', inconsistencia.nombre_departamento],
              ['Solicitante', inconsistencia.nombre_solicitante],
              ['Jefe inmediato', inconsistencia.nombre_jefe_inmediato],
              ['Descripción', inconsistencia.descripcion_inconsistencia],
              ['Acción', inconsistencia.accion_inconsistencia],
            ].map(([label, value], index) => value ? `
              <div 
                style="
                  display: grid; 
                  gap: 0.5rem;
                  padding: 0.75rem;
                  background: #f8fafc;
                  border-radius: 0.5rem;
                  border-left: 3px solid #3b82f6;
                "
              >
                <dt 
                  style="
                    font-weight: 600; 
                    color: #1e293b;
                    font-size: clamp(0.8125rem, 2vw, 0.9375rem);
                    margin: 0;
                  "
                >
                  ${label}:
                </dt>
                <dd 
                  style="
                    color: #334155; 
                    margin: 0;
                    font-size: clamp(0.875rem, 2.5vw, 1rem);
                    word-break: break-word;
                    line-height: 1.5;
                  "
                >
                  ${this.escapeHtml(value)}
                </dd>
              </div>
            ` : '').join('')}
          </dl>
        </section>

        <!-- Historial de Trazabilidad -->
        ${inconsistencia.historial_aprobaciones?.length ? `
          <section 
            aria-labelledby="historial-title" 
            style="
              margin-bottom: 2rem;
              scroll-margin-top: 1rem;
            "
          >
            <h2 
              id="historial-title"
              style="
                color: #1e3a8a;
                font-size: clamp(1rem, 3vw, 1.25rem);
                font-weight: 700;
                margin: 0 0 1.25rem 0;
                border-bottom: 3px solid #3b82f6;
                padding-bottom: 0.75rem;
                line-height: 1.3;
              "
            >
              Jefes que aprobaron
            </h2>

            <div 
              role="list"
              aria-label="Historial de aprobaciones"
              style="
                position: relative; 
                padding-left: 2rem;
                margin: 0;
              "
            >
              ${inconsistencia.historial_aprobaciones.map((historial, index, arr) => {
                const isLast = index === arr.length - 1;
                return `
                  <div 
                    role="listitem"
                    style="
                      position: relative; 
                      padding-bottom: ${isLast ? '0' : '1.75rem'};
                      margin-bottom: ${isLast ? '0' : '0'};
                    "
                  >
                    <!-- Punto de la línea de tiempo -->
                    <div 
                      aria-hidden="true"
                      style="
                        position: absolute; 
                        left: -1.5rem; 
                        top: 0.375rem; 
                        width: 0.875rem; 
                        height: 0.875rem; 
                        border-radius: 50%; 
                        background: ${isLast ? '#10b981' : '#3b82f6'};
                        border: 3px solid #ffffff;
                        box-shadow: 0 0 0 2px ${isLast ? '#10b981' : '#3b82f6'};
                        z-index: 2;
                      "
                    ></div>

                    <!-- Línea conectora -->
                    ${!isLast ? `
                      <div 
                        aria-hidden="true"
                        style="
                          position: absolute;
                          left: -1.125rem;
                          top: 1.25rem;
                          width: 2px;
                          height: calc(100% - 0.5rem);
                          background: #e2e8f0;
                          z-index: 1;
                        "
                      ></div>
                    ` : ''}

                    <!-- Contenido del historial -->
                    <div 
                      style="
                        background: #ffffff;
                        padding: 1rem;
                        border-radius: 0.5rem;
                        border-left: 4px solid ${isLast ? '#10b981' : '#3b82f6'};
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                        transition: box-shadow 0.2s ease;
                      "
                      onmouseover="this.style.boxShadow='0 4px 6px rgba(0, 0, 0, 0.1)';"
                      onmouseout="this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)';"
                    >
                      <div 
                        style="
                          display: flex;
                          flex-direction: column;
                          gap: 0.5rem;
                          margin-bottom: 0.75rem;
                        "
                      >
                        <div 
                          style="
                            display: flex;
                            flex-direction: column;
                            gap: 0.25rem;
                          "
                        >
                          <strong 
                            style="
                              color: #1e40af; 
                              font-size: clamp(0.9375rem, 2.5vw, 1.0625rem);
                              font-weight: 600;
                            "
                          >
                            ${this.escapeHtml(historial.etapa)}
                          </strong>
                          <time 
                            dateTime="${historial.fecha}"
                            style="
                              color: #64748b; 
                              font-size: clamp(0.75rem, 2vw, 0.875rem);
                              font-weight: 400;
                            "
                          >
                            ${this.formatearFecha(historial.fecha)}
                          </time>
                        </div>
                      </div>

                      <div 
                        style="
                          display: flex;
                          align-items: center;
                          gap: 0.5rem;
                          margin-bottom: ${historial.observacion ? '0.75rem' : '0'};
                        "
                      >
                        <span aria-hidden="true" style="font-size: 1rem;">👤</span>
                        <p 
                          style="
                            color: #334155; 
                            font-size: clamp(0.875rem, 2.5vw, 1rem); 
                            margin: 0;
                            font-weight: 500;
                          "
                        >
                          ${this.escapeHtml(historial.usuario)}
                        </p>
                      </div>

                      ${historial.observacion ? `
                        <div 
                          style="
                            margin-top: 0.75rem;
                            padding: 0.75rem;
                            background: #f8fafc;
                            border-radius: 0.375rem;
                            border-left: 3px solid #cbd5e1;
                          "
                        >
                          <p 
                            style="
                              color: #475569;
                              font-size: clamp(0.8125rem, 2vw, 0.9375rem);
                              margin: 0;
                              font-style: italic;
                              line-height: 1.5;
                            "
                          >
                            ${this.escapeHtml(historial.observacion)}
                          </p>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </section>
        ` : ''}

        <!-- Información de Anulación -->
        ${inconsistencia.estado_inconsistencia === 'Anulada' ? `
          <section 
            aria-labelledby="anulada-title"
            role="alert"
            style="
              background: #fef2f2;
              border: 2px solid #fecaca;
              border-radius: 0.5rem;
              padding: 1.25rem;
              margin-top: 1rem;
            "
          >
            <h2 
              id="anulada-title"
              style="
                color: #991b1b;
                font-size: clamp(1rem, 3vw, 1.25rem);
                font-weight: 700;
                margin: 0 0 1.25rem 0;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                line-height: 1.3;
              "
            >
              <span aria-hidden="true">⚠️</span>
              <span>Información de Anulación</span>
            </h2>

            <dl 
              style="
                display: grid; 
                gap: 1.25rem;
                margin: 0;
              "
            >
              ${[
                ['Anulada por', inconsistencia.nombre_persona_que_anulo],
                ['Fecha anulación', this.formatearFecha(inconsistencia.fecha_anulacion)],
                ['Razón', inconsistencia.razon_anulacion],
              ].map(([label, value]) => `
                <div 
                  style="
                    display: grid; 
                    gap: 0.5rem;
                    padding: 0.75rem;
                    background: #ffffff;
                    border-radius: 0.375rem;
                    border-left: 3px solid #dc2626;
                  "
                >
                  <dt 
                    style="
                      font-weight: 600; 
                      color: #7f1d1d;
                      font-size: clamp(0.8125rem, 2vw, 0.9375rem);
                      margin: 0;
                    "
                  >
                    ${label}:
                  </dt>
                  <dd 
                    style="
                      color: #991b1b; 
                      margin: 0;
                      font-size: clamp(0.875rem, 2.5vw, 1rem);
                      word-break: break-word;
                      line-height: 1.5;
                    "
                  >
                    ${value || 'N/A'}
                  </dd>
                </div>
              `).join('')}
            </dl>
          </section>
        ` : ''}
      </div>
    `;

    // Mostrar el modal con SweetAlert2 - Diseño Mobile First y Responsive
    Swal.fire({
      title: `<span style="font-size: clamp(1.125rem, 4vw, 1.5rem); font-weight: 700; color: #1e3a8a;">Detalles - ${inconsistencia.id_inconsistencia}</span>`,
      html: htmlContent,
      width: 'min(95vw, 900px)',
      padding: '1.5rem',
      showCloseButton: true,
      closeButtonHtml: '<span aria-label="Cerrar modal" style="font-size: 1.5rem; color: #64748b;">&times;</span>',
      showConfirmButton: true,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#3b82f6',
      confirmButtonAriaLabel: 'Cerrar modal de detalles',
      allowOutsideClick: true,
      allowEscapeKey: true,
      customClass: {
        popup: 'swal-modal-detalles',
        title: 'swal-modal-titulo',
        htmlContainer: 'swal-modal-contenido',
        confirmButton: 'swal-boton-cerrar'
      },
      didOpen: () => {
        // Mejorar accesibilidad del modal
        const popup = document.querySelector('.swal2-popup') as HTMLElement;
        if (popup) {
          popup.setAttribute('role', 'dialog');
          popup.setAttribute('aria-modal', 'true');
          popup.setAttribute('aria-labelledby', 'swal2-title');
        }
        
        // Asegurar que el primer elemento enfocable reciba el foco
        const firstFocusable = popup?.querySelector('a, button, [tabindex]:not([tabindex="-1"])') as HTMLElement;
        if (firstFocusable) {
          setTimeout(() => firstFocusable.focus(), 100);
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
        console.error('Error al parsear evidencias:', error);
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

    // Construye el HTML para mostrar imágenes o PDF con diseño mejorado
    const evidenciasHtml = archivos.map((url: string, index: number) => {
      const extension = url.split('.').pop()?.toLowerCase();

      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
        return `
          <div style="
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: #ffffff;
            border-radius: 0.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          " onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.15)';" 
             onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(0, 0, 0, 0.1)';">
            <p style="
              margin: 0 0 0.75rem 0;
              font-size: 0.875rem;
              font-weight: 600;
              color: #64748b;
              text-align: center;
            ">Evidencia ${index + 1}</p>
            <img src="${url}" 
                 alt="Evidencia ${index + 1}" 
                 style="
                   max-width: 100%;
                   max-height: 60vh;
                   width: auto;
                   height: auto;
                   cursor: pointer;
                   border-radius: 0.375rem;
                   display: block;
                   margin: 0 auto;
                 "
                 onclick="window.open('${url}', '_blank')"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div style="display: none; text-align: center; padding: 1rem; color: #ef4444;">
              <p style="margin: 0;">Error al cargar la imagen</p>
              <a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: underline; margin-top: 0.5rem; display: inline-block;">
                Abrir en nueva pestaña
              </a>
            </div>
          </div>
        `;
      } else if (extension === 'pdf') {
        return `
          <div style="
            margin-bottom: 1rem;
            padding: 1.25rem;
            background: #fef2f2;
            border-radius: 0.5rem;
            text-align: center;
            border: 1px solid #fecaca;
          ">
            <p style="
              margin: 0 0 1rem 0;
              font-size: 0.875rem;
              font-weight: 600;
              color: #991b1b;
            ">Documento PDF</p>
            <a href="${url}" 
               target="_blank" 
               style="
                 display: inline-flex;
                 align-items: center;
                 gap: 0.5rem;
                 padding: 0.75rem 1.5rem;
                 background: #dc2626;
                 color: white;
                 text-decoration: none;
                 border-radius: 0.375rem;
                 font-weight: 600;
                 transition: background 0.2s ease;
               "
               onmouseover="this.style.background='#b91c1c';"
               onmouseout="this.style.background='#dc2626';">
              <i class="fas fa-file-pdf" style="font-size: 1.125rem;"></i>
              <span>Abrir PDF</span>
            </a>
          </div>
        `;
      } else {
        return `
          <div style="
            margin-bottom: 1rem;
            padding: 1.25rem;
            background: #f8fafc;
            border-radius: 0.5rem;
            text-align: center;
            border: 1px solid #e2e8f0;
          ">
            <p style="
              margin: 0 0 1rem 0;
              font-size: 0.875rem;
              font-weight: 600;
              color: #475569;
            ">Archivo adjunto</p>
            <a href="${url}" 
               target="_blank" 
               style="
                 display: inline-flex;
                 align-items: center;
                 gap: 0.5rem;
                 padding: 0.75rem 1.5rem;
                 background: #64748b;
                 color: white;
                 text-decoration: none;
                 border-radius: 0.375rem;
                 font-weight: 600;
                 transition: background 0.2s ease;
               "
               onmouseover="this.style.background='#475569';"
               onmouseout="this.style.background='#64748b';">
              <i class="fas fa-file" style="font-size: 1.125rem;"></i>
              <span>Abrir archivo</span>
            </a>
          </div>
        `;
      }
    }).join('');

    Swal.fire({
      title: `<span style="font-size: 1.5rem; font-weight: 700; color: #1e293b;">Evidencias</span>`,
      html: `
        <div style="
          max-height: 70vh;
          overflow-y: auto;
          padding: 0.5rem;
          text-align: center;
        ">
          ${evidenciasHtml}
        </div>
      `,
      width: 'min(90%, 800px)',
      showCloseButton: true,
      showConfirmButton: false,
      customClass: {
        popup: 'swal-evidencias-popup',
        title: 'swal-evidencias-title',
        htmlContainer: 'swal-evidencias-container'
      },
      didOpen: () => {
        // Mejorar accesibilidad
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