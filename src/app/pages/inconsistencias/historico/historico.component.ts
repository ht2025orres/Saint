import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { PaginationService } from '../../../shared/pagination/pagination.service';
import { AuthService } from '../../../services/auth.service';
import Swal from 'sweetalert2';

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
      next: (res) => {
        // Calcular el estado para cada inconsistencia y guardar en array principal
        this.inconsistencias = res.map((inco: any) => ({
          ...inco,
          estado: this.determinarEstado(inco)
        }));

        // Aplicar filtros inmediatamente después de cargar
        this.aplicarFiltrosLocales();
      },
      error: (err) => {
        console.error('Error al cargar histórico', err);
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
verTiemposProceso(inconsistencia: any): void {
  this.cargandoTiempos = true;
  this.tiemposProceso = [];

  this.inconsistenciasService.obtenerTiemposProceso(inconsistencia.id_inconsistencia).subscribe({
    next: (res: any) => {
      if (res.tiempos) {
        const fechas = res.fechas || {};
        const flujo = res.flujo || [];
        const debugInco = res.debug_inco || {};
        
        this.tiemposProceso = Object.entries(res.tiempos)
           .filter(([key]) => key !== 'total' && key !== 'finalizacion') // Nueva línea
          .map(([etapa, tiempo]: [string, any]) => {
            if (!tiempo) {
              return {
                etapa: this.getNombreEtapa(etapa),
                responsable: 'Sin asignar',
                fecha_inicio: null,
                fecha_fin: null,
                tiempo_minutos: null,
                tiempo_dias: null,
                tiempo_horas: null,
                tiempo_minutos_restantes: null,
                sin_aprobar: true
              };
            }
            
            // CORRECCIÓN AQUÍ: Mapear correctamente el campo del responsable
            let nombreCampo: string;
            if (etapa === 'finalizacion') {
              nombreCampo = 'nombre_consumo'; // ← CAMBIO PRINCIPAL
            } else {
              nombreCampo = `nombre_${etapa}`;
            }
            const responsable = debugInco[nombreCampo] || 'Sin asignar';
            
            // ... resto del código permanece igual
            let fechaInicio = null;
            let fechaFin = null;
            
            if (etapa === 'lider') {
              fechaInicio = fechas.creacion;
              fechaFin = fechas.lider;
            } else if (etapa === 'finalizacion') {
              const ultimaEtapaFlujo = flujo[flujo.length - 1];
              fechaInicio = fechas[ultimaEtapaFlujo];
              fechaFin = fechas.terminado;
            } else {
              const indiceActual = flujo.indexOf(etapa);
              if (indiceActual > 0) {
                const etapaAnterior = flujo[indiceActual - 1];
                fechaInicio = fechas[etapaAnterior];
              } else if (indiceActual === 0) {
                fechaInicio = fechas.lider;
              }
              fechaFin = fechas[etapa];
            }
            
            return {
              etapa: this.getNombreEtapa(etapa),
              responsable: responsable,
              fecha_inicio: fechaInicio,
              fecha_fin: fechaFin,
              tiempo_minutos: tiempo.total_minutos || 0,
              tiempo_dias: Math.floor(tiempo.dias || 0),
              tiempo_horas: tiempo.horas || 0,
              tiempo_minutos_restantes: tiempo.minutos || 0,
              sin_aprobar: false
            };
          });
        
        // ... resto del código del total
      }
      this.cargandoTiempos = false;
      this.modalRef = this.modalService.show(this.modalTiempos, {
        class: 'modal-lg',
        initialState: {
          inconsistencia: inconsistencia
        }
      });
    },
    error: (err) => {
      console.error('Error al cargar tiempos de proceso', err);
      this.cargandoTiempos = false;
      alert('Error al cargar los tiempos de proceso');
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

verEvidencias(inco: any): void {
  // Primero intenta obtener evidencias_urls (que vienen del backend ya parseadas)
  let archivos = inco.evidencias_urls;

  // Si no existen evidencias_urls, intenta parsear evidencias (formato antiguo)
  if (!archivos || archivos.length === 0) {
    try {
      const evidenciasParsed = JSON.parse(inco.evidencias || '[]');
      // Convierte las rutas relativas a URLs completas
      archivos = evidenciasParsed.map((ruta: string) => {
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

  // Construye el HTML para mostrar imágenes o PDF igual que en MisInconsistenciasComponent
  const evidenciasHtml = archivos.map((url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return `
        <div class="mb-3">
          <img src="${url}" 
               alt="Evidencia" 
               class="img-fluid rounded shadow-sm"
               style="max-width: 100%; max-height: 70vh; width: auto; cursor: pointer;"
               onclick="window.open('${url}', '_blank')">
        </div>
      `;
    } else if (extension === 'pdf') {
      return `
        <div class="mb-3">
          <a href="${url}" target="_blank" class="btn btn-danger btn-lg">
            <i class="fas fa-file-pdf me-2"></i>Abrir PDF
          </a>
        </div>
      `;
    } else {
      return `
        <div class="mb-3">
          <a href="${url}" target="_blank" class="btn btn-secondary btn-lg">
            <i class="fas fa-file me-2"></i>Abrir archivo
          </a>
        </div>
      `;
    }
  }).join('');

  Swal.fire({
    title: 'Evidencias',
    html: `
      <div class="text-center">
        ${evidenciasHtml}
      </div>
    `,
    width: '40%',
    showCloseButton: true,
    showConfirmButton: false,
    customClass: {
      popup: 'p-4'
    }
  });
}

  /**
   * Determina el estado general de una inconsistencia basándose en su etapa actual
   * y el campo anulado_por
   * @param inconsistencia - Objeto con la información de la inconsistencia
   * @returns Estado de la inconsistencia: "anulado", "en_proceso" o "terminada"
   */
 // En el método determinarEstado, modificar para retornar la etapa específica:

determinarEstado(inconsistencia: any): string {
  // 1. Si fue anulado, el estado es "Anulado"
  if (inconsistencia.anulado_por != null) {
    return 'anulado';
  }
  // 2. Si la etapa actual es "Terminado", el estado es "Terminado"
  if (inconsistencia.etapa === 'terminada') {
    return 'terminada';
  }
  // 3. Si está en proceso, retornar la etapa actual específica
  return inconsistencia.etapa || 'en_proceso';
}

// Actualizar el método getEstadoLabel para manejar las diferentes etapas:

getEstadoLabel(estado: string): string {
  const estados: any = {
    'lider': 'Líder',
    'calidad': 'Calidad',
    'logistica': 'Logística',
    'patronaje': 'Patronaje',
    'finalizacion': 'Consumo',
    'en_proceso': 'En proceso',
    'terminada': 'Terminado',
    'anulado': 'Anulado'
  };
  return estados[estado] || estado;
}

// Actualizar el método getEstadoClass para las diferentes etapas:

getEstadoClass(estado: string): string {
  const clases: any = {
    // Etapas en proceso
    'lider': 'badge bg-info text-white',
    'calidad': 'badge bg-primary',
    'logistica': 'badge bg-warning text-dark',
    'patronaje': 'badge bg-secondary',
    'finalizacion': 'badge bg-info text-white',
    'en_proceso': 'badge bg-warning text-dark',
    // Estados finales
    'terminada': 'badge bg-success',
    'anulado': 'badge bg-danger'
  };
  return clases[estado] || 'badge bg-secondary';
}
}