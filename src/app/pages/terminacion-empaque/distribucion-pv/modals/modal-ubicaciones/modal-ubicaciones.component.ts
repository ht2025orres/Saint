import { Component } from '@angular/core';
import { Modal } from 'bootstrap';
import { TerminacionEmpaqueService } from 'src/app/services/terminacion-empaque.service';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-ubicaciones',
  templateUrl: './modal-ubicaciones.component.html',
})
export class ModalUbicacionesComponent {
  ubicDistPaginatorId = 'ubicaciones-distintas-paginator';

  vistaActual: 'resumen' | 'detalle' = 'resumen';
  resumenOPs: any[] = [];
  cargandoResumen = false;

  itemsUbicacionesDistintas: any[] = [];
  currentUbicDistItems: any[] = [];
  cargandoUbicaciones = false;
  guardandoCambioUbicacion = false;
  opBuscadaUbicaciones: string = '';

  ubicDistFilters = {
    busqueda: '',
    ubicacion: ''
  };

  constructor(
    private terminacionEmpaqueService: TerminacionEmpaqueService,
    public paginationService: PaginationService,
    private AuthService: AuthService
  ) {}

  // ===== ABRIR MODAL =====

  abrir(): void {
    this.opBuscadaUbicaciones = '';
    this.itemsUbicacionesDistintas = [];
    this.currentUbicDistItems = [];
    this.ubicDistFilters = {
      busqueda: '',
      ubicacion: ''
    };
    
    this.vistaActual = 'resumen';
    this.cargarResumenReciente();

    const modalEl = document.getElementById('ubicacionesDistintasModal');
    if (modalEl) {
      const modal = new Modal(modalEl);
      modal.show();
    }
  }

  // ===== RESUMEN =====

  cargarResumenReciente(): void {
    this.cargandoResumen = true;
    this.terminacionEmpaqueService.obtenerResumenUbicacionesRecientes().subscribe({
      next: (data) => {
        this.resumenOPs = data || [];
        this.cargandoResumen = false;
      },
      error: (err) => {
        console.error('Error cargando resumen de ubicaciones:', err);
        this.cargandoResumen = false;
      }
    });
  }

  verDetalleOP(opCodigo: string): void {
    this.opBuscadaUbicaciones = opCodigo;
    this.vistaActual = 'detalle';
    this.buscarUbicacionesPorOP();
  }

  volverAlResumen(): void {
    this.vistaActual = 'resumen';
    this.opBuscadaUbicaciones = '';
    this.itemsUbicacionesDistintas = [];
    this.currentUbicDistItems = [];
  }

  // ===== BÚSQUEDA =====

  async buscarUbicacionesPorOP(): Promise<void> {
    if (!this.opBuscadaUbicaciones || this.opBuscadaUbicaciones.trim() === '') {
      Swal.fire('Atención', 'Debe ingresar un número de OP', 'warning');
      return;
    }

    this.vistaActual = 'detalle';
    this.cargandoUbicaciones = true;
    this.itemsUbicacionesDistintas = [];
    this.currentUbicDistItems = [];

    try {
      const items = await this.terminacionEmpaqueService
        .obtenerItemsConUbicacionesDistintas(Number(this.opBuscadaUbicaciones))
        .toPromise();

      this.itemsUbicacionesDistintas = items.filter((i: any) =>
        i.ubicacion && i.ubicacion.toLowerCase() !== 'empaque'
      );

      if (this.itemsUbicacionesDistintas.length === 0) {
        Swal.fire('Sin resultados', `No hay items con ubicaciones distintas a Empaque para la OP ${this.opBuscadaUbicaciones}`, 'info');
      }

      this.ubicDistFilters = {
        busqueda: '',
        ubicacion: ''
      };

      this.initializarPaginacionUbicDist();
      this.cargandoUbicaciones = false;

    } catch (err) {
      console.error('Error cargando ubicaciones distintas:', err);
      Swal.fire('Error', 'No se pudieron cargar las ubicaciones para esta OP', 'error');
      this.cargandoUbicaciones = false;
    }
  }

  // ===== PAGINACIÓN =====

  initializarPaginacionUbicDist(): void {
    if (this.itemsUbicacionesDistintas.length > 0) {
      this.paginationService.initializePaginator(
        this.ubicDistPaginatorId,
        this.itemsUbicacionesDistintas,
        10,
        this.ubicDistFilters,
        this.ubicDistFilterFunction
      ).subscribe(state => {
        this.currentUbicDistItems = state.currentData || [];
      });
    }
  }

  applyUbicDistFilters(): void {
    this.paginationService.updatePaginator(
      this.ubicDistPaginatorId,
      this.itemsUbicacionesDistintas,
      undefined,
      this.ubicDistFilters,
      this.ubicDistFilterFunction,
      true
    );

    const state = this.paginationService.getPaginatorState(this.ubicDistPaginatorId);
    this.currentUbicDistItems = state?.currentData || [];
  }

  ubicDistFilterFunction: FilterFunction = (item: any, filtros) => {
    const texto = (filtros.busqueda || '').toLowerCase().trim();
    let pasaBusqueda = true;

    if (texto) {
      const descripcionCorta = (item.descripcion_corta || '').toLowerCase();
      const descripcion = (item.descripcion || '').toLowerCase();
      const itemId = `${item.f120_id}-${item.id_color}-${item.id_talla}`.toLowerCase();
      const ubicacion = (item.ubicacion || '').toLowerCase();

      pasaBusqueda = descripcionCorta.includes(texto) ||
                    descripcion.includes(texto) ||
                    itemId.includes(texto) ||
                    ubicacion.includes(texto);
    }

    let pasaUbicacion = true;
    if (filtros.ubicacion) {
      pasaUbicacion = item.ubicacion === filtros.ubicacion;
    }

    return pasaBusqueda && pasaUbicacion;
  };

  // ===== CAMBIO DE UBICACIÓN =====

  cambiarUbicacionItem(item: any, nuevaUbicacion: string): void {
    if (this.guardandoCambioUbicacion) return;

    if ((nuevaUbicacion === 'Bordado' || nuevaUbicacion === 'Estampado') && !item.comentario) {
      Swal.fire({
        title: 'Comentario requerido',
        input: 'textarea',
        inputLabel: 'Ingrese el motivo del cambio:',
        inputPlaceholder: 'Escriba aquí...',
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (result.isConfirmed && result.value) {
          this.ejecutarCambioUbicacion(item, nuevaUbicacion, result.value);
        }
      });
    } else {
      Swal.fire({
        title: '¿Cambiar ubicación?',
        html: `¿Mover ${item.cantidad} unidades de <strong>${item.ubicacion}</strong> a <strong>${nuevaUbicacion}</strong>?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cambiar',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (result.isConfirmed) {
          this.ejecutarCambioUbicacion(item, nuevaUbicacion, item.comentario);
        }
      });
    }
  }

  private ejecutarCambioUbicacion(item: any, nuevaUbicacion: string, comentario?: string): void {
    this.guardandoCambioUbicacion = true;

    const payload = {
      op_codigo: this.opBuscadaUbicaciones,
      item_hash: item.item_hash,
      referencia: item.codigo,
      id_item: item.f120_id,
      descripcion: item.descripcion,
      id_color: item.id_color,
      id_talla: item.id_talla,
      cantidad_recibida: parseFloat(String(item.cantidad)) || 0,
      precio_unitario: item.precio_unitario || 0,
      usuario: this.AuthService.user.id,
      ubicacion_actual: item.ubicacion,
      ubicacion: nuevaUbicacion,
      comentario: comentario || ''
    };

    this.terminacionEmpaqueService.actualizarUbicacion(payload).subscribe({
      next: () => {
        item.ubicacion = nuevaUbicacion;
        item.comentario = comentario || '';
        this.applyUbicDistFilters();
        Swal.fire('Éxito', 'Ubicación actualizada correctamente', 'success');
        this.guardandoCambioUbicacion = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo actualizar la ubicación', 'error');
        this.guardandoCambioUbicacion = false;
      }
    });
  }
}
