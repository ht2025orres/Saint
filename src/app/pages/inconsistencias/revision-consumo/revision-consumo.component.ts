import { PaginationService, FilterFunction } from '../../../shared/pagination/pagination.service';
import { InconsistenciaService } from 'src/app/services/inconsistencia.service';
import { Component, OnInit, TemplateRef, ViewChild, OnDestroy } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { AuthService } from '../../../services/auth.service';
import { Subscription, tap, switchMap, finalize } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-revision-consumo',
  templateUrl: './revision-consumo.component.html',
  styleUrls: ['./revision-consumo.component.css']
})
export class RevisionConsumoComponent implements OnInit, OnDestroy {
  title = 'Inconsistencias Pendientes de Consumo';
  paginatorId = 'inconsistencias-revision-paginator';
  
  inconsistencias: any[] = [];
  currentData: any[] = [];
  tipos: any = {};
  loading = false;
  
  // Filtros
  filters = {
    busqueda: '',
    estadoConsumo: '',
    etapa: ''
  };
  
  private subscription = new Subscription();
  modalRef?: BsModalRef;
  detallesSeleccionados: any[] = [];

  @ViewChild('modalDetalles') modalDetalles!: TemplateRef<any>;

  constructor(
    private inconsistenciasService: InconsistenciaService,
    private modalService: BsModalService,
    public authService: AuthService,
    public paginationService: PaginationService
  ) {}

  ngOnInit(): void {
    this.inicializarComponente();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.modalRef) {
      this.modalRef.hide();
    }
  }

  private inicializarComponente(): void {
    this.cargarTipos();
    this.cargarDatos();
  }

  cargarTipos(): void {
    this.loading = true;
    fetch('/assets/config/config.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Error al cargar configuración');
        }
        return response.json();
      })
      .then(json => {
        this.tipos = json || {};
      })
      .catch(error => {
        console.error('Error cargando tipos:', error);
        this.tipos = {};
        Swal.fire('Error', 'No se pudo cargar la configuración de tipos', 'warning');
      })
      .finally(() => {
        this.loading = false;
      });
  }

  cargarDatos(): void {
    this.loading = true;
    
    // Validar que el usuario esté autenticado
    if (!this.authService.user || !this.authService.user.roles) {
      Swal.fire('Error', 'Usuario no autenticado correctamente', 'error');
      this.loading = false;
      return;
    }

    this.subscription.add(
      this.inconsistenciasService.listarInconsistenciasPorRol(
        this.authService.user.roles, 
        this.authService.user.id_Sdp
      ).pipe(
        tap(res => {
          this.inconsistencias = Array.isArray(res) ? res : [];
        }),
        switchMap(() => {
          if (this.inconsistencias.length === 0) {
            this.currentData = [];
            return [];
          }
          return this.paginationService.initializePaginator(
            this.paginatorId, 
            this.inconsistencias, 
            10
          );
        }),
        finalize(() => {
          this.loading = false;
        })
      ).subscribe({
        next: (state) => {
          if (state && state.currentData) {
            this.currentData = state.currentData;
          }
        },
        error: (error) => {
          console.error('Error cargando datos:', error);
          this.inconsistencias = [];
          this.currentData = [];
          Swal.fire('Error', 'No se pudieron cargar las inconsistencias', 'error');
        }
      })
    );
  }

  filtrarDatos(): void {
    let datosFiltrados = [...this.inconsistencias];

    // Filtro por búsqueda de texto
    if (this.filters.busqueda && this.filters.busqueda.trim() !== '') {
      const texto = this.filters.busqueda.toLowerCase().trim();
      datosFiltrados = datosFiltrados.filter(item => {
        if (!item) return false;
        
        return Object.values(item).some(value => {
          if (value === null || value === undefined) return false;
          return value.toString().toLowerCase().includes(texto);
        });
      });
    }

    // Filtro por estado de consumo
    if (this.filters.estadoConsumo) {
      datosFiltrados = datosFiltrados.filter(item => 
        item?.estado_consumo === this.filters.estadoConsumo
      );
    }

    // Filtro por etapa
    if (this.filters.etapa) {
      datosFiltrados = datosFiltrados.filter(item => 
        item?.etapa === this.filters.etapa
      );
    }

    // Reinicializar paginación con datos filtrados
    this.subscription.add(
      this.paginationService.initializePaginator(
        this.paginatorId, 
        datosFiltrados, 
        10
      ).subscribe(state => {
        this.currentData = state.currentData;
      })
    );
  }

  onSearchInput(event: any): void {
    this.filters.busqueda = event.target.value;
    this.filtrarDatos();
  }

  onEstadoConsumoChange(event: any): void {
    this.filters.estadoConsumo = event.target.value;
    this.filtrarDatos();
  }

  onEtapaChange(event: any): void {
    this.filters.etapa = event.target.value;
    this.filtrarDatos();
  }

  getColorEtapa(etapa: string): string {
    if (!etapa) return 'secondary';
    
    const etapaNormalizada = etapa.toLowerCase();
    switch (etapaNormalizada) {
      case 'logistica':
        return 'danger';
      case 'terminada':
        return 'success';
      case 'espera':
        return 'warning';
      default:
        return 'secondary';
    }
  }

  getColorConsumo(estado: string): string {
    if (!estado) return 'secondary';
    
    const estadoNormalizado = estado.toUpperCase();
    switch (estadoNormalizado) {
      case 'CONSUMIDO':
        return 'success';
      case 'POR CONSUMIR':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  verDetalles(item: any): void {
    if (!item) {
      Swal.fire('Error', 'No se pueden mostrar los detalles', 'error');
      return;
    }

    this.detallesSeleccionados = [
      { label: 'Estado Consumo', value: item.estado_consumo || 'N/A' },
      { label: 'Fecha de Registro', value: item.fecha_inconsistencia || 'N/A' },
      { label: 'ID Inconsistencia', value: item.id_inconsistencia || 'N/A' },
      { label: 'Cliente', value: item.Cliente || 'N/A' },
      { label: 'Departamento', value: item.nombre_departamento || 'N/A' },
      { label: 'Solicitante', value: item.nombre_solicitante || 'N/A' },
      { label: 'Jefe Inmediato', value: item.jefe_inmediato_nombre || 'N/A' },
      { label: 'Tipo de Inconsistencia', value: this.tipos[item.tipo_inconsistencia] || item.tipo_inconsistencia || 'N/A' },
      { label: 'Cantidad Solicitada', value: item.cantidad_solicitada_op || 'N/A' },
      { label: 'Cantidad Inconsistencia', value: item.cantidad_inconsistencia || 'N/A' },
      { label: 'Item', value: item.item || 'N/A' },
      { label: 'Tipo de Orden', value: item.tipo_de_orden || 'N/A' },
      { label: 'Precio Unitario', value: item.precio_unitario || 'N/A' },
      { label: 'Precio Total', value: item.precio_total_inconsistencia || 'N/A' },
      { label: 'Descripción', value: item.descripcion_inconsistencia || 'N/A' },
      { label: 'Etapa', value: item.etapa || 'N/A' },
      { label: 'Acción Inconsistencia', value: item.accion_inconsistencia || 'N/A' },
      { label: 'Estado', value: item.estado_inconsistencia || 'N/A' },
      { label: 'Aprobó logística', value: item.nombre_aprovado_por_logistica || 'Sin aprobación' },
    ];

    try {
      this.modalRef = this.modalService.show(this.modalDetalles, {
        backdrop: 'static',
        keyboard: false
      });
    } catch (error) {
      console.error('Error abriendo modal:', error);
      Swal.fire('Error', 'No se pudo abrir el modal de detalles', 'error');
    }
  }

  puedeConsumir(item: any): boolean {
    if (!item) return false;
    return item.etapa === 'terminada' && item.estado_consumo !== 'CONSUMIDO';
  }

  consumirInconsistencia(item: any): void {
    if (!this.puedeConsumir(item)) {
      Swal.fire('Error', 'Esta inconsistencia no se puede consumir.', 'error');
      return;
    }

    Swal.fire({
      title: '¿Qué tipo de consumo es?',
      input: 'select',
      inputOptions: {
        'consumo': 'Consumo',
        'gasto': 'Gasto',
        'devolucion': 'Devolución'
      },
      inputPlaceholder: 'Selecciona una opción',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed && result.value) {
        const tipo = result.value as string;
        this.confirmarConsumo(item, tipo);
      }
    });
  }

  confirmarConsumo(item: any, tipo: string): void {
    // Mostrar confirmación final
    Swal.fire({
      title: '¿Confirmar consumo?',
      text: `Se registrará como: ${tipo}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.procesarConsumo(item, tipo);
      }
    });
  }

  private procesarConsumo(item: any, tipo: string): void {
    // Aquí deberías implementar la llamada al servicio
    console.log('Procesando consumo:', { item, tipo });
    
    // Ejemplo de implementación:
    /*
    this.inconsistenciasService.consumirInconsistencia(item.id_inconsistencia, tipo)
      .subscribe({
        next: (response) => {
          Swal.fire('Éxito', 'Consumo registrado correctamente', 'success');
          this.cargarDatos(); // Recargar datos
        },
        error: (error) => {
          console.error('Error procesando consumo:', error);
          Swal.fire('Error', 'No se pudo procesar el consumo', 'error');
        }
      });
    */
    
    // Por ahora, solo mostrar mensaje de éxito
    Swal.fire('Consumido', `Consumo registrado como: ${tipo}`, 'success');
  }

}