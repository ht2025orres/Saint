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
  usuariosTopReportes: any[] = [];

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
  
  etapasDisponibles: string[] = ['lider', 'calidad', 'logistica','', 'espera', 'finalizado'];
  estadosConsumo: string[] = ['CONSUMIDO', 'POR CONSUMIR'];

  // ==================== VARIABLES DE UI ====================
  
  mostrarFiltros: boolean = false;
  seccionActiva: string = 'general'; // general, productividad, costos, consumo, gestion

  constructor(private dashboardService: InconsistenciaService ) { }

 ngOnInit(): void {
  this.establecerFechasMesActual(); // ✅ Agregar esta línea
  this.cargarDatosFiltros();
  this.cargarDashboard();
}
  // ==================== MÉTODOS DE CARGA ====================


establecerFechasMesActual(): void {
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  
  // Formatear a YYYY-MM-DD
  this.filtros.fecha_inicio = this.formatearFecha(primerDia);
  this.filtros.fecha_fin = this.formatearFecha(ultimoDia);
}

formatearFecha(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


  cargarDatosFiltros(): void {
    this.dashboardService.getDepartamentos().subscribe({
      next: (response) => {
        if (response.success) {
          this.departamentos = response.data;
        }
      },
      error: (error) => {
      }
    });

    this.dashboardService.getClientes().subscribe({
      next: (response) => {
        if (response.success) {
          this.clientes = response.data;
        }
      },
      error: (error) => {
      }
    });

    this.dashboardService.getTiposInconsistencia().subscribe({
      next: (response) => {
        if (response.success) {
          this.tiposInconsistencia = response.data;
        }
      },
      error: (error) => {
      }
    });

    this.dashboardService.getUsuarios().subscribe({
      next: (response) => {
        if (response.success) {
          this.usuarios = response.data;
        }
      },
      error: (error) => {
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
          
          // ✅ FIX: Mapear correctamente los datos de usuarios con rechazos
          if (response.data.productividad?.top_usuarios_reportes_denegados) {
            this.usuariosTopReportes = response.data.productividad.top_usuarios_reportes_denegados.map((item: any) => ({
              nombre_completo: this.obtenerNombreCompleto(item.persona_que_anulo),
              total_denegadas: item.total_inconsistencias_anuladas
            }));
          } else {
            this.usuariosTopReportes = [];
          }
        } else {
          this.errorMessage = 'No se recibieron datos del servidor.';
        }
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar los datos del dashboard. Por favor, intente nuevamente.';
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

  calcularPorcentajeDepartamento(cantidad: number, total: number): number {
    if (!total || total === 0) return 0;
    return (cantidad / total) * 100;
  }

  obtenerTotalDepartamentos(): number {
    if (!this.productividad?.promedio_por_departamento) return 0;
    return this.productividad.promedio_por_departamento.reduce((sum: number, item: any) => sum + (item.cantidad || 0), 0);
  }

  obtenerMaximoCostoDepartamento(): number {
    if (!this.costos?.costo_por_departamento || this.costos.costo_por_departamento.length === 0) return 0;
    return Math.max(...this.costos.costo_por_departamento.map((item: any) => item.total || 0));
  }

  normalizarTexto(texto: string | null | undefined): string {
    if (!texto) return 'N/A';
    
    return texto
      .replace(/_/g, ' ')  // Reemplazar guiones bajos por espacios
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());  // Primera letra de cada palabra en mayúscula
  }

  // ==================== MÉTODOS PARA GRÁFICO CIRCULAR ====================

  calcularStrokeDashoffset(index: number): number {
    if (!this.productividad?.promedio_por_departamento) return 502.6;
    
    const total = this.obtenerTotalDepartamentos();
    let offsetAcumulado = 0;
    
    for (let i = 0; i < index; i++) {
      const item = this.productividad.promedio_por_departamento[i];
      offsetAcumulado += this.calcularPorcentajeDepartamento(item.cantidad, total);
    }
    
    return 502.6 - (offsetAcumulado * 5.026);
  }

  calcularStrokeDasharray(cantidad: number): string {
    const total = this.obtenerTotalDepartamentos();
    const porcentaje = this.calcularPorcentajeDepartamento(cantidad, total);
    const longitud = porcentaje * 5.026;
    return `${longitud} 502.6`;
  }

  obtenerColorDepartamento(index: number): string {
    if (!this.productividad?.promedio_por_departamento) return 'hsl(0, 65%, 55%)';
    const hue = (index * 360) / this.productividad.promedio_por_departamento.length;
    return `hsl(${hue}, 65%, 55%)`;
  }
}