import { PaginationService, FilterFunction } from '../../../shared/pagination/pagination.service';
import { InconsistenciaService } from 'src/app/services/inconsistencia.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChartConfiguration } from 'chart.js';
import { AuthService } from 'src/app/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-reporte-inconsistencias',
  templateUrl: './reporte-inconsistencias.component.html',
  styleUrls: ['./reporte-inconsistencias.component.css']
})
export class ReporteInconsistenciasComponent implements OnInit, OnDestroy {
  title = 'Reporte de Inconsistencias';
  paginatorId = 'inconsistencias-reporte-paginator';

  datosOriginales: any[] = [];
  datosFiltrados: any[] = [];
  currentData: any[] = [];

  // Suscripción para limpiar en OnDestroy
  private paginationSubscription?: Subscription;

  inconsistencias: any[] = [];
  departamentos: any[] = [];
  tipos: { id: string, nombre: string, checked?: boolean }[] = [];

  tipos_inco: { [key: string]: string } = {};

  filtros = {
    tiposSeleccionados: [] as string[],
    departamento: '',
    mes: '',
    fechaInicio: '',
    fechaFin: '',
    estadoAnulacion: 'todas'
  };

  estadoChartLabels: string[] = [];
  estadoChartData: ChartConfiguration<'pie'>['data']['datasets'] = [
    { data: [], label: 'Por estado' }
  ];

  depChartLabels: string[] = [];
  depChartData: ChartConfiguration<'bar'>['data']['datasets'] = [
    { data: [], label: 'Por departamento' }
  ];

  tipoChartLabels: string[] = [];
  tipoChartData: ChartConfiguration<'doughnut'>['data']['datasets'] = [
    { data: [], label: 'Por tipo de inconsistencia' }
  ];

  dropdownAbierto = false;

  constructor(
    private inconsistenciaService: InconsistenciaService,
    public paginationService: PaginationService,
    private authService: AuthService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.obtenerTipos();
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    // Limpiar suscripción y destruir paginador
    if (this.paginationSubscription) {
      this.paginationSubscription.unsubscribe();
    }
    this.paginationService.destroyPaginator(this.paginatorId);
  }

  toggleDropdown(): void {
    this.dropdownAbierto = !this.dropdownAbierto;
  }

  cerrarDropdown(): void {
    this.dropdownAbierto = false;
  }

  obtenerTextoSeleccionado(): string {
    const seleccionados = this.tipos.filter(t => t.checked);
    if (seleccionados.length === 0) return 'Todos';
    if (seleccionados.length === 1) return seleccionados[0].nombre;
    return `${seleccionados.length} seleccionados`;
  }
 
  obtenerTipos() {
    this.http.get<{ [key: string]: string }>('/assets/config/config.json')
      .subscribe({
        next: (res) => {
          this.tipos_inco = res;
          console.log('Tipos de inconsistencias cargados:', this.tipos_inco);
        },
        error: () => {
          console.error('Error cargando config.json');
        }
      });
  }

  cargarDatos(): void {
    this.inconsistenciaService.listarInconsistenciasPorRol(this.authService.user.roles, this.authService.user.id_Sdp).subscribe({
      next: (res) => {
        this.datosOriginales = res;
        this.datosFiltrados = Array.isArray(res) ? res : [];
        this.extraerFiltrosUnicos();
        
        // Inicializar paginador y suscribirse a cambios
        this.paginationSubscription = this.paginationService.initializePaginator(
          this.paginatorId, 
          this.datosFiltrados, 
          10
        ).subscribe(paginationState => {
          // Esta es la clave: actualizar currentData cuando cambie el estado del paginador
          this.currentData = paginationState.currentData;
        });

        this.actualizarGraficas();
      },
      error: (err) => {
        console.error('Error al cargar reporte', err);
      }
    });
  }

  extraerFiltrosUnicos(): void {
    const deps = new Set<string>();
    const tiposSet = new Set<string>();

    for (const item of this.datosOriginales) {
      if (item.nombre_departamento) {
        deps.add(item.nombre_departamento);
      }
      if (item.tipo_inconsistencia) {
        tiposSet.add(item.tipo_inconsistencia);
      }
    }

    this.departamentos = Array.from(deps).map((nombre) => ({
      id: nombre,
      nombre: nombre
    }));

    this.tipos = Array.from(tiposSet).map((id) => ({
      id,
      nombre: this.tipos_inco[id] || id,
      checked: false
    }));
  }

  onTipoCheckboxChange(): void {
    this.filtros.tiposSeleccionados = this.tipos
      .filter(t => t.checked)
      .map(t => t.id);
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    const filtros = this.filtros;
    const usarMes = filtros.mes;
    const usarRango = filtros.fechaInicio || filtros.fechaFin;
    
    // Función personalizada para filtrar
    const filtroCustom: FilterFunction = (item: any, filtros: any): boolean => {
      const coincideDep = !filtros.departamento || item.nombre_departamento === filtros.departamento;
      const tiposSeleccionados = this.tipos.filter(t => t.checked).map(t => t.id);
      const coincideTipo = tiposSeleccionados.length === 0 || tiposSeleccionados.includes(item.tipo_inconsistencia);
      
      const fecha = new Date(item.fecha_inconsistencia);
      let coincideFecha = true;

      if (usarMes && !usarRango) {
        const [anio, mes] = filtros.mes.split('-').map(Number);
        coincideFecha = fecha.getFullYear() === anio && (fecha.getMonth() + 1) === mes;
      } else if (usarRango && !usarMes) {
        const inicio = filtros.fechaInicio ? new Date(filtros.fechaInicio) : null;
        const fin = filtros.fechaFin ? new Date(filtros.fechaFin) : null;
        coincideFecha = (!inicio || fecha >= inicio) && (!fin || fecha <= fin);
      } else if (usarMes && usarRango) {
        return false;
      }

      const esAnulada = !!item.razon_anulacion && !!item.persona_que_anulo && !!item.fecha_anulacion;

      const coincideAnulacion =
        filtros.estadoAnulacion === 'todas' ||
        (filtros.estadoAnulacion === 'anuladas' && esAnulada) ||
        (filtros.estadoAnulacion === 'no_anuladas' && !esAnulada);
      
      return coincideDep && coincideTipo && coincideFecha && coincideAnulacion;
    };

    // Filtrar datos localmente para las gráficas
    this.datosFiltrados = this.datosOriginales.filter(item => filtroCustom(item, this.filtros));

    // Actualizar paginador con datos filtrados
    // Esto automáticamente actualizará currentData gracias a la suscripción
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.datosFiltrados,
      undefined, // Mantener el pageSize actual
      this.filtros,
      filtroCustom
    );

    this.actualizarGraficas();
  }

  onMesChange(): void {
    if (this.filtros.mes) {
      this.filtros.fechaInicio = '';
      this.filtros.fechaFin = '';
    }
    this.aplicarFiltros();
  }

  onRangoChange(): void {
    if (this.filtros.fechaInicio || this.filtros.fechaFin) {
      this.filtros.mes = '';
    }
    this.aplicarFiltros();
  }

  actualizarGraficas(): void {
    const estadoMap = new Map<string, number>();
    const depMap = new Map<string, number>();
    const tipoMap = new Map<string, number>();

    for (const item of this.datosFiltrados) {
      const estado = item.estado_inconsistencia || 'Sin estado';
      const dep = item.nombre_departamento || 'Desconocido';
      const tipoId = item.tipo_inconsistencia || 'Otro';

      const tipoNombre = this.tipos_inco[tipoId] || tipoId;

      estadoMap.set(estado, (estadoMap.get(estado) || 0) + 1);
      depMap.set(dep, (depMap.get(dep) || 0) + 1);
      tipoMap.set(tipoNombre, (tipoMap.get(tipoNombre) || 0) + 1);
    }

    this.estadoChartLabels = Array.from(estadoMap.keys());
    this.estadoChartData = [
      {
        data: Array.from(estadoMap.values()),
        label: 'Por estado'
      }
    ];

    this.depChartLabels = Array.from(depMap.keys());
    this.depChartData = [
      {
        data: Array.from(depMap.values()),
        label: 'Por departamento'
      }
    ];

    this.tipoChartLabels = Array.from(tipoMap.keys());
    this.tipoChartData = [
      {
        data: Array.from(tipoMap.values()),
        label: 'Por tipo'
      }
    ];
  }
}