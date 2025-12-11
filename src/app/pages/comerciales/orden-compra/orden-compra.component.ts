import { Component, OnInit } from '@angular/core';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { OrdenCompraService } from 'src/app/services/orden-compra.service';
import Swal from 'sweetalert2';

interface OrdenCompra {
  id: number;
  numero_orden: string;
  cliente: string;
  fecha_recepcion: string;
  total_productos: number;
  total_items: number;
  valor_total: number;
  estado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADA';
  archivo_url?: string;
}

interface ProductoDetectado {
  codigo: string;
  producto: string;
  cantidad: number;
}

@Component({
  selector: 'app-orden-compra',
  templateUrl: './orden-compra.component.html',
  styleUrls: ['./orden-compra.component.css']
})
export class OrdenCompraComponent implements OnInit {
  paginatorId = 'orden-compra-paginator';

  // Estados de carga
  isLoading = false;
  isProcesando = false;

  // Datos
  ordenes: OrdenCompra[] = [];
  currentOrdenes: OrdenCompra[] = [];
  totalOrdenes = 0;

  // Filtros
  filters = {
    busqueda: '',
    busquedaExacta: false,
    estado: ''
  };

  // Modal upload
  mostrarModalUpload = false;
  archivoSeleccionado: File | null = null;
  clienteSeleccionado = '';
  clientes: Array<{ id: number; nombre: string }> = [];

  // Modal procesamiento
  mostrarModalProcesar = false;
  documentoProcesado = false;
  datosDocumento = {
    cliente: '',
    fechaLlegada: '',
    numeroOrden: '',
    totalProductos: 0,
    totalEstimado: 0
  };
  productosDetectados: ProductoDetectado[] = [];

  // Modal resumen
  mostrarModalResumen = false;
  ordenCreada: OrdenCompra | null = null;

  constructor(
    public paginationService: PaginationService,
    private ordenCompraService: OrdenCompraService
  ) {}

  ngOnInit(): void {
    this.cargarClientes();
    this.cargarOrdenes();
  }

  cargarClientes(): void {
    this.ordenCompraService.obtenerClientes().subscribe({
      next: (res) => {
        this.clientes = res['data'] || [];
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los clientes', 'error');
      }
    });
  }

  cargarOrdenes(): void {
    this.isLoading = true;
    this.ordenCompraService.obtenerOrdenes().subscribe({
      next: (res) => {
        this.ordenes = res['data'] || [];
        this.totalOrdenes = this.ordenes.length;
        this.inicializarPaginacion();
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar las órdenes', 'error');
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  inicializarPaginacion(): void {
    if (this.ordenes.length > 0) {
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.ordenes,
        10,
        this.filters,
        this.filterOrdenes
      ).subscribe(state => {
        this.currentOrdenes = state.currentData;
      });
    }
  }

  filterOrdenes: FilterFunction = (orden: OrdenCompra, filtros) => {
    const texto = (filtros.busqueda || '').trim().toLowerCase();
    
    let cumpleBusqueda = true;
    if (texto) {
      if (filtros.busquedaExacta) {
        cumpleBusqueda = orden.numero_orden.toLowerCase() === texto ||
                        orden.cliente.toLowerCase() === texto;
      } else {
        cumpleBusqueda = orden.numero_orden.toLowerCase().includes(texto) ||
                        orden.cliente.toLowerCase().includes(texto);
      }
    }

    let cumpleEstado = true;
    if (filtros.estado) {
      cumpleEstado = orden.estado === filtros.estado;
    }

    return cumpleBusqueda && cumpleEstado;
  };

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.ordenes,
      undefined,
      this.filters,
      this.filterOrdenes
    );
  }

  // ========== MODAL UPLOAD ==========
  abrirModalUpload(): void {
    this.mostrarModalUpload = true;
    this.archivoSeleccionado = null;
    this.clienteSeleccionado = '';
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && this.validarArchivo(file)) {
      this.archivoSeleccionado = file;
    }
  }

  validarArchivo(file: File): boolean {
    const formatosValidos = ['application/pdf', 'image/jpeg', 'image/png'];
    const maxSize = 25 * 1024 * 1024; // 25MB

    if (!formatosValidos.includes(file.type)) {
      Swal.fire('Error', 'Formato no válido. Use PDF, JPG o PNG', 'error');
      return false;
    }

    if (file.size > maxSize) {
      Swal.fire('Error', 'El archivo excede el tamaño máximo de 25MB', 'error');
      return false;
    }

    return true;
  }

  procesarDocumento(): void {
    if (!this.archivoSeleccionado || !this.clienteSeleccionado) {
      Swal.fire('Atención', 'Seleccione un cliente y un archivo', 'warning');
      return;
    }

    this.isProcesando = true;
    const formData = new FormData();
    formData.append('archivo', this.archivoSeleccionado);
    formData.append('cliente_id', this.clienteSeleccionado);

    this.ordenCompraService.procesarDocumento(formData).subscribe({
      next: (res) => {
        this.documentoProcesado = true;
        this.datosDocumento = res.data.informacion_general;
        this.productosDetectados = res.data.productos;
        
        this.mostrarModalUpload = false;
        this.mostrarModalProcesar = true;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo procesar el documento', 'error');
      },
      complete: () => {
        this.isProcesando = false;
      }
    });
  }

  cerrarModalUpload(): void {
    this.mostrarModalUpload = false;
    this.archivoSeleccionado = null;
    this.clienteSeleccionado = '';
  }

  // ========== MODAL PROCESAR ==========
  volverAUpload(): void {
    this.mostrarModalProcesar = false;
    this.documentoProcesado = false;
    this.abrirModalUpload();
  }

  confirmarOrden(): void {
    const payload = {
      cliente: this.datosDocumento.cliente,
      fecha_llegada: this.datosDocumento.fechaLlegada,
      numero_orden: this.datosDocumento.numeroOrden,
      productos: this.productosDetectados
    };

    this.ordenCompraService.crearOrden(payload).subscribe({
      next: (res) => {
        this.ordenCreada = res.data;
        this.mostrarModalProcesar = false;
        this.mostrarModalResumen = true;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo crear la orden', 'error');
      }
    });
  }

  cerrarModalProcesar(): void {
    this.mostrarModalProcesar = false;
    this.documentoProcesado = false;
  }

  // ========== MODAL RESUMEN ==========
  verOrdenCompleta(): void {
    this.mostrarModalResumen = false;
    this.cargarOrdenes();
  }

  finalizarYGuardar(): void {
    this.mostrarModalResumen = false;
    Swal.fire({
      title: '¡Éxito!',
      text: 'Orden de compra registrada correctamente',
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    });
    this.cargarOrdenes();
  }

  cerrarModalResumen(): void {
    this.mostrarModalResumen = false;
    this.ordenCreada = null;
  }

  // ========== UTILIDADES ==========
  getEstadoBadgeClass(estado: string): string {
    const clases = {
      'PENDIENTE': 'bg-yellow-100 text-yellow-800',
      'EN_PROCESO': 'bg-blue-100 text-blue-800',
      'COMPLETADA': 'bg-green-100 text-green-800'
    };
    return clases[estado as keyof typeof clases] || 'bg-gray-100 text-gray-800';
  }

  getEstadoTexto(estado: string): string {
    const textos = {
      'PENDIENTE': 'Pendiente',
      'EN_PROCESO': 'En Proceso',
      'COMPLETADA': 'Completada'
    };
    return textos[estado as keyof typeof textos] || estado;
  }

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