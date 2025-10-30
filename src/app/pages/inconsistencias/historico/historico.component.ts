import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { PaginationService } from '../../../shared/pagination/pagination.service';
import { AuthService } from '../../../services/auth.service';

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
      // Transformar el objeto de tiempos a un array
      if (res.tiempos) {
        this.tiemposProceso = Object.entries(res.tiempos)
          .filter(([key]) => key !== 'total') // Excluir el total
          .map(([etapa, tiempo]: [string, any]) => {
            // Si el tiempo es null, mostrar "Sin aprobar"
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
            
            return {
              etapa: this.getNombreEtapa(etapa),
              responsable: 'N/A',
              fecha_inicio: null,
              fecha_fin: null,
              tiempo_minutos: tiempo.total_minutos || 0,
              tiempo_dias: Math.floor(tiempo.dias || 0),
              tiempo_horas: tiempo.horas || 0,
              tiempo_minutos_restantes: tiempo.minutos || 0,
              sin_aprobar: false
            };
          });
        
        // Agregar el total al final solo si existe y no es null
        if (res.tiempos.total && res.tiempos.total !== null) {
          this.tiemposProceso.push({
            etapa: 'TOTAL',
            responsable: '-',
            fecha_inicio: null,
            fecha_fin: null,
            tiempo_minutos: res.tiempos.total.total_minutos || 0,
            tiempo_dias: Math.floor(res.tiempos.total.dias || 0),
            tiempo_horas: res.tiempos.total.horas || 0,
            tiempo_minutos_restantes: res.tiempos.total.minutos || 0,
            sin_aprobar: false
          });
        }
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
    'finalizacion': 'Finalización',
    'logistica': 'Logística',
    'patronaje': 'Patronaje'
  };
  return nombres[etapa] || etapa;
}

  verEvidencias(inco: any): void {
    console.log('Ver evidencias de:', inco);
    // Aquí iría lógica adicional si deseas mostrar un modal con imágenes/PDFs
  }

  /**
   * Determina el estado general de una inconsistencia basándose en su etapa actual
   * y el campo anulado_por
   * @param inconsistencia - Objeto con la información de la inconsistencia
   * @returns Estado de la inconsistencia: "anulado", "en_proceso" o "terminada"
   */
  determinarEstado(inconsistencia: any): string {
    // 1. Si fue anulado, el estado es "Anulado"
    if (inconsistencia.anulado_por != null) {
      return 'anulado';
    }
    // 2. Si la etapa actual es "Terminado", el estado es "Terminado"
    if (inconsistencia.etapa === 'terminada') {
      return 'terminada';
    }
    // 3. En cualquier otro caso, está "En proceso"
    return 'en_proceso';
  }

  /**
   * Obtiene la etiqueta visual del estado para mostrar en la interfaz
   * @param estado - Estado de la inconsistencia
   * @returns Etiqueta formateada del estado
   */
  getEstadoLabel(estado: string): string {
    const estados: any = {
      'en_proceso': 'En proceso',
      'terminada': 'Terminado',
      'anulado': 'Anulado'
    };
    return estados[estado] || estado;
  }

  /**
   * Obtiene la clase CSS para el badge del estado
   * @param estado - Estado de la inconsistencia
   * @returns Clase CSS de Bootstrap para el badge
   */
  getEstadoClass(estado: string): string {
    const clases: any = {
      'en_proceso': 'badge bg-warning text-dark',
      'terminada': 'badge bg-success',
      'anulado': 'badge bg-danger'
    };
    return clases[estado] || 'badge bg-secondary';
  }
}