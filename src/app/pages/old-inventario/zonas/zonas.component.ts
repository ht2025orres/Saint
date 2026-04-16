import { Component, OnInit } from '@angular/core';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { InventarioOldService } from 'src/app/services/inventario-old.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-zonas',
  templateUrl: './zonas.component.html',
  styleUrls: ['./zonas.component.css']
})
export class ZonasComponent implements OnInit {
  paginatorId = 'zonas-list-paginator';

  isLoadingZonas: boolean = false;

  // Datos zonas
  zonas: any[] = [];
  currentZonas: any[] = [];
  totalZonas: number = 0;

  // Filtros
  filters = { busqueda: '' };

  // Modal
  mostrarModal: boolean = false;
  modoEdicion: boolean = false;
  zonaForm: any = {
    id: null,
    nombre: '',
    descripcion: '',
    total_items: 0
  };

  constructor(
    public paginationService: PaginationService,
    private inventarioService: InventarioOldService
  ) {}

  ngOnInit(): void {
    this.cargarZonas();
  }

  /** -------------------------
   *  CARGAR ZONAS
   ------------------------- */
  cargarZonas(): void {
    this.isLoadingZonas = true;
    this.inventarioService.obtenerZonas().subscribe({
      next: (res) => {
        this.zonas = res['data'] || [];
        this.totalZonas = this.zonas.length;
        this.inicializarPaginacion();
      },
      error: (err) => {
        console.error('Error al cargar zonas:', err);
        Swal.fire('Error', 'No se pudieron cargar las zonas', 'error');
      },
      complete: () => {
        this.isLoadingZonas = false;
      }
    });
  }

  /** -------------------------
   *  PAGINACIÓN Y FILTROS
   ------------------------- */
  inicializarPaginacion(): void {
    if (this.zonas.length > 0) {
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.zonas,
        10,
        this.filters,
        this.filterZonas
      ).subscribe(state => {
        this.currentZonas = state.currentData;
      });
    }
  }

  filterZonas: FilterFunction = (zona: any, filtros) => {
    const texto = (filtros.busqueda || '').toLowerCase().trim();
    if (!texto) return true;

    return zona.nombre?.toLowerCase().includes(texto) ||
           zona.descripcion?.toLowerCase().includes(texto) ||
           zona.id?.toString().includes(texto);
  };

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.zonas,
      undefined,
      this.filters,
      this.filterZonas
    );
  }

  /** -------------------------
   *  MODAL CREAR/EDITAR
   ------------------------- */
  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.zonaForm = {
      id: null,
      nombre: '',
      descripcion: '',
      total_items: 0
    };
    this.mostrarModal = true;
  }

  abrirModalEditar(zona: any): void {
    this.modoEdicion = true;
    this.zonaForm = {
      id: zona.id,
      nombre: zona.nombre,
      descripcion: zona.descripcion || '',
      total_items: zona.total_items || 0
    };
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.modoEdicion = false;
    this.zonaForm = {
      id: null,
      nombre: '',
      descripcion: '',
      total_items: 0
    };
  }

  /** -------------------------
   *  VALIDACIÓN
   ------------------------- */
  validarCampo(campo: string): boolean {
    if (campo === 'nombre') {
      return this.zonaForm.nombre.trim() === '';
    }
    return false;
  }

  formularioValido(): boolean {
    return this.zonaForm.nombre.trim() !== '';
  }

  /** -------------------------
   *  GUARDAR ZONA
   ------------------------- */
  guardarZona(): void {
    if (!this.formularioValido()) {
      Swal.fire('Atención', 'Por favor completa el nombre de la zona', 'warning');
      return;
    }

    const payload = {
      nombre: this.zonaForm.nombre.trim(),
      descripcion: this.zonaForm.descripcion.trim() || null
    };

    if (this.modoEdicion) {
      // Actualizar zona existente
      this.inventarioService.actualizarZona(this.zonaForm.id, payload).subscribe({
        next: () => {
          Swal.fire('¡Éxito!', 'Zona actualizada correctamente', 'success');
          this.cargarZonas();
          this.cerrarModal();
        },
        error: (err) => {
          console.error('Error al actualizar zona:', err);
          Swal.fire('Error', 'No se pudo actualizar la zona', 'error');
        }
      });
    } else {
      // Crear nueva zona
      this.inventarioService.crearZona(payload).subscribe({
        next: () => {
          Swal.fire('¡Éxito!', 'Zona creada correctamente', 'success');
          this.cargarZonas();
          this.cerrarModal();
        },
        error: (err) => {
          console.error('Error al crear zona:', err);
          Swal.fire('Error', 'No se pudo crear la zona', 'error');
        }
      });
    }
  }

  /** -------------------------
   *  ELIMINAR ZONA
   ------------------------- */
  eliminarZona(zona: any): void {
    // Verificar si tiene ítems asignados
    if (zona.total_items > 0) {
      Swal.fire({
        title: '⚠️ Zona con ítems asignados',
        html: `Esta zona tiene <strong>${zona.total_items}</strong> ítem(s) asignado(s).<br><br>
               Si eliminas esta zona, los ítems quedarán sin asignación.<br><br>
               ¿Estás seguro de continuar?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33'
      }).then((result) => {
        if (result.isConfirmed) {
          this.ejecutarEliminacion(zona.id);
        }
      });
    } else {
      Swal.fire({
        title: '¿Eliminar zona?',
        text: `¿Deseas eliminar la zona "${zona.nombre}"?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33'
      }).then((result) => {
        if (result.isConfirmed) {
          this.ejecutarEliminacion(zona.id);
        }
      });
    }
  }

  ejecutarEliminacion(idZona: number): void {
    this.inventarioService.eliminarZona(idZona).subscribe({
      next: () => {
        Swal.fire('¡Eliminado!', 'Zona eliminada correctamente', 'success');
        this.cargarZonas();
      },
      error: (err) => {
        console.error('Error al eliminar zona:', err);
        Swal.fire('Error', 'No se pudo eliminar la zona', 'error');
      }
    });
  }

  /** -------------------------
   *  PAGINACIÓN - HELPERS
   ------------------------- */
  getStartIndex(): number {
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    return state ? state.paginator.number * state.paginator.size + 1 : 0;
  }

  getEndIndex(): number {
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    if (!state) return 0;
    const end = (state.paginator.number + 1) * state.paginator.size;
    return Math.min(end, state.paginator.totalElements);
  }
}