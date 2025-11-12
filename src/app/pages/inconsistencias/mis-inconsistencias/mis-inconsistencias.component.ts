import { Component, OnInit } from '@angular/core';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { AuthService } from 'src/app/services/auth.service';

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
  idUsuario: number = 1; // Obtener del servicio de autenticación
  
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

  // Modal detalles
  modalDetallesAbierto: boolean = false;
  
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
   // **NUEVO: TrackBy para optimizar rendimiento de lista**
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
    
    // Aquí iría la llamada al servicio para anular
    // this.inconsistenciasService.anularInconsistencia(...)
    console.log('Anulando inconsistencia:', this.inconsistenciaSeleccionada.id, this.razonAnulacion);
    
    // Simulación
    setTimeout(() => {
      this.procesandoAnulacion = false;
      this.cerrarModalAnular();
      this.cargarInconsistencias();
    }, 1000);
  }

  abrirModalDetalles(inconsistencia: Inconsistencia): void {
    this.inconsistenciaSeleccionada = inconsistencia;
    this.modalDetallesAbierto = true;
  }

  cerrarModalDetalles(): void {
    this.modalDetallesAbierto = false;
    this.inconsistenciaSeleccionada = null;
  }

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
}