import { Component, OnInit } from '@angular/core';
import { InconsistenciaService  } from '../../../services/inconsistencia.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-reporte-inconsistencias',
  templateUrl: './reporte-inconsistencias.component.html',
  styleUrls: ['./reporte-inconsistencias.component.css']
})
export class ReporteInconsistenciasComponent implements OnInit {

  // ==================== VARIABLES DE ESTADO ====================
  
  isLoading: boolean = false;
  errorMessage: string = '';
  
  // ==================== DATOS DEL DASHBOARD ====================
  
  dashboardData: any = null;
  productividad: any = null;
  costos: any = null;
  consumo: any = null;
  gestionHumana: any = null;

  // ==================== DATOS PARA FILTROS ====================
  
  departamentos: any[] = [];
  clientes: any[] = [];
  tiposInconsistencia: any[] = [];
  usuarios: any[] = [];

  // ==================== FILTROS ACTIVOS ====================
  
  filtros: any = {
    fecha_inicio: '',
    fecha_fin: '',
    departamento: null,
    cliente: '',
    tipo_inconsistencia: '',
    etapa: '',
    solicitante: null,
    estado_consumo: '',
    tipo_de_orden: ''
  };

  // ==================== OPCIONES DE FILTROS ESTÁTICOS ====================
  
  etapasDisponibles: string[] = ['lider', 'calidad', 'logistica', 'espera', 'finalizado'];
  estadosConsumo: string[] = ['CONSUMIDO', 'POR CONSUMIR'];

  // ==================== VARIABLES DE UI ====================
  
  mostrarFiltros: boolean = false;
  seccionActiva: string = 'general'; // general, productividad, costos, consumo, gestion

  constructor(private dashboardService: InconsistenciaService ) { }

  ngOnInit(): void {
    this.cargarDatosFiltros();
    this.cargarDashboard();
  }

  // ==================== MÉTODOS DE CARGA ====================

  cargarDatosFiltros(): void {
    this.dashboardService.getDepartamentos().subscribe({
      next: (response) => {
        if (response.success) {
          this.departamentos = response.data;
        }
      },
      error: (error) => {
        console.error('Error al cargar departamentos:', error);
      }
    });

    this.dashboardService.getClientes().subscribe({
      next: (response) => {
        if (response.success) {
          this.clientes = response.data;
        }
      },
      error: (error) => {
        console.error('Error al cargar clientes:', error);
      }
    });

    this.dashboardService.getTiposInconsistencia().subscribe({
      next: (response) => {
        if (response.success) {
          this.tiposInconsistencia = response.data;
        }
      },
      error: (error) => {
        console.error('Error al cargar tipos:', error);
      }
    });

    this.dashboardService.getUsuarios().subscribe({
      next: (response) => {
        if (response.success) {
          this.usuarios = response.data;
        }
      },
      error: (error) => {
        console.error('Error al cargar usuarios:', error);
      }
    });
  }

  cargarDashboard(): void {
  this.isLoading = true;
  this.errorMessage = '';

  const filtrosLimpios = this.limpiarFiltros();

  this.dashboardService.getDashboardData(filtrosLimpios)
    .pipe(finalize(() => this.isLoading = false))
    .subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.dashboardData = response.data;
          this.productividad = response.data.productividad || {};
          this.costos = response.data.costos || {};
          this.consumo = response.data.consumo || {};
          this.gestionHumana = response.data.gestion_humana || {};
        } else {
          this.errorMessage = 'No se recibieron datos del servidor.';
        }
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar los datos del dashboard. Por favor, intente nuevamente.';
        console.error('Error al cargar dashboard:', error);
      }
    });
}

  // ==================== MÉTODOS DE FILTROS ====================

  limpiarFiltros(): any {
    const filtrosLimpios: any = {};
    
    Object.keys(this.filtros).forEach(key => {
      const valor = this.filtros[key];
      if (valor !== null && valor !== undefined && valor !== '') {
        filtrosLimpios[key] = valor;
      }
    });

    return filtrosLimpios;
  }

  aplicarFiltros(): void {
    this.cargarDashboard();
    this.mostrarFiltros = false;
  }

  limpiarTodosFiltros(): void {
    this.filtros = {
      fecha_inicio: '',
      fecha_fin: '',
      departamento: null,
      cliente: '',
      tipo_inconsistencia: '',
      etapa: '',
      solicitante: null,
      estado_consumo: '',
      tipo_de_orden: ''
    };
    this.cargarDashboard();
  }

  toggleFiltros(): void {
    this.mostrarFiltros = !this.mostrarFiltros;
  }

  // ==================== MÉTODOS DE NAVEGACIÓN ====================

  cambiarSeccion(seccion: string): void {
    this.seccionActiva = seccion;
  }

  // ==================== MÉTODOS AUXILIARES ====================

  obtenerNombreCompleto(usuario: any): string {
  if (!usuario) return 'N/A';
  
  const nombres = usuario.nombres || '';
  const apellidos = usuario.apellidos || '';
  
  const nombreCompleto = `${nombres} ${apellidos}`.trim();
  return nombreCompleto || 'N/A';
}

 obtenerNombreDepartamento(item: any): string {
  if (!item) return 'N/A';
  
  // Si tiene la relación directa
  if (item.departamento_relacion?.nombre_departamento) {
    return item.departamento_relacion.nombre_departamento;
  }
  
  // Si tiene id_departamento, buscar en el array de departamentos
  if (item.id_departamento) {
    const dept = this.departamentos.find(d => d.id_departamento === item.id_departamento);
    return dept?.nombre_departamento || 'N/A';
  }
  
  // Si el item es directamente un departamento
  if (item.nombre_departamento) {
    return item.nombre_departamento;
  }
  
  return 'N/A';
}
  formatearMoneda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(valor);
}

formatearNumero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor)) return '0';
  return new Intl.NumberFormat('es-CO').format(valor);
}

formatearHoras(horas: number | null | undefined): string {
  if (horas === null || horas === undefined || isNaN(horas)) return '0h';
  return `${Math.round(horas)}h`;
}

formatearDias(dias: number | null | undefined): string {
  if (dias === null || dias === undefined || isNaN(dias)) return '0 días';
  const diasRedondeados = Math.round(dias);
  return `${diasRedondeados} día${diasRedondeados !== 1 ? 's' : ''}`;
}
  calcularPorcentaje(cantidad: number): number {
  if (!this.productividad?.total_inconsistencias || this.productividad.total_inconsistencias === 0) {
    return 0;
  }
  return (cantidad / this.productividad.total_inconsistencias) * 100;
}
}