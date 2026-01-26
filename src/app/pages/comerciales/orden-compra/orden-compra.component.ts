import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { OrdenCompraService } from 'src/app/services/orden-compra.service';
import { FileService } from 'src/app/services/file.service';
import Swal from 'sweetalert2';
import { AuthService } from 'src/app/services/auth.service';

interface OrdenCompra {
  id: number;
  numero_orden: string;
  pv_asociado?: string;
  cliente: string;
  fecha_registro: string;
  usuario_registro: string;
  estado: 'PENDIENTE' | 'PROCESADA' | 'RECHAZADA';
  archivo_url: string;
  observaciones?: string;
}

@Component({
  selector: 'app-orden-compra',
  templateUrl: './orden-compra.component.html',
  styleUrls: ['./orden-compra.component.css']
})
export class OrdenCompraComponent implements OnInit, OnDestroy {
  paginatorId = 'orden-compra-paginator';

  isLoading = false;
  isSubiendo = false;
  isLoadingDocument = false;
  isProcesando = false;

  ordenes: OrdenCompra[] = [];
  currentOrdenes: OrdenCompra[] = [];
  totalOrdenes = 0;
  clientes: Array<{ id: number; razon_social: string }> = [];

  filters = {
    busqueda: '',
    estado: ''
  };

  mostrarModalNuevaOrden = false;
  nuevaOrden = {
    clienteId: null as number | null,
    clienteNombre: '',
    numeroOrden: '',
    archivo: null as File | null,
    diasEntrega: '',
    fechaEntregaEstimada: null as Date | null
  };

  mostrarModalDocumento = false;
  documentoUrl: SafeResourceUrl | null = null;
  documentoOrdenNumero = '';

  // Modal rechazo
  mostrarModalRechazo = false;
  ordenArechazar: OrdenCompra | null = null;
  motivoRechazo = '';

  constructor(
    public paginationService: PaginationService,
    private ordenCompraService: OrdenCompraService,
    private fileService: FileService,
    private sanitizer: DomSanitizer,
    public authService: AuthService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.cargarClientes();
    this.cargarOrdenes();
  }

  private loadTailwind(): void {
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
    this.document.head.appendChild(link);

    const icons = this.document.createElement('link');
    icons.rel = 'stylesheet';
    icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
    this.document.head.appendChild(icons);
  }

  ngOnDestroy(): void {
    const links = this.document.head.querySelectorAll('link[href*="tailwindcss"], link[href*="bootstrap-icons"]');
    links.forEach(link => link.remove());
  }

  cargarClientes(): void {
    this.ordenCompraService.obtenerClientes().subscribe({
      next: (res) => {
        this.clientes = (res['data'] || []).map((cliente: any) => ({
          id: cliente.id,
          razon_social: cliente.razon_social || cliente.nombre || ''
        }));
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
      cumpleBusqueda = orden.numero_orden.toLowerCase().includes(texto) ||
        orden.cliente.toLowerCase().includes(texto) ||
        (orden.pv_asociado || '').toLowerCase().includes(texto);
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

  // ========== MODAL NUEVA ORDEN ==========
  abrirModalNuevaOrden(): void {
    this.mostrarModalNuevaOrden = true;
    this.resetearFormulario();
  }

  cerrarModalNuevaOrden(): void {
    this.mostrarModalNuevaOrden = false;
    this.resetearFormulario();
  }

  calcularFechaEntrega() {
    if (!this.nuevaOrden.diasEntrega) return;

    const hoy = new Date();
    const dias = Number(this.nuevaOrden.diasEntrega);
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + dias);

    this.nuevaOrden.fechaEntregaEstimada = fecha;
  }

  resetearFormulario(): void {
    this.nuevaOrden = {
      clienteId: null,
      clienteNombre: '',
      numeroOrden: '',
      archivo: null,
      diasEntrega: '',
      fechaEntregaEstimada: null
    };
  }

  onClienteInput(): void {
    const cliente = this.clientes.find(
      c => c.razon_social === this.nuevaOrden.clienteNombre
    );
    this.nuevaOrden.clienteId = cliente ? cliente.id : null;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && this.validarArchivo(file)) {
      this.nuevaOrden.archivo = file;
    }
  }

  validarArchivo(file: File): boolean {
    const formatosValidos = ['application/pdf'];
    const maxSize = 25 * 1024 * 1024; // 25MB

    if (!formatosValidos.includes(file.type)) {
      Swal.fire('Error', 'Solo se permiten archivos PDF', 'error');
      return false;
    }

    if (file.size > maxSize) {
      Swal.fire('Error', 'El archivo excede el tamaño máximo de 25MB', 'error');
      return false;
    }

    return true;
  }

  formularioValido(): boolean {
    return !!(this.nuevaOrden.clienteId &&
      this.nuevaOrden.numeroOrden.trim() &&
      this.nuevaOrden.archivo);
  }

  async registrarOrden(): Promise<void> {
    if (!this.formularioValido()) {
      Swal.fire('Atención', 'Complete todos los campos requeridos', 'warning');
      return;
    }

    this.isSubiendo = true;

    try {
      const archivoUrl = await this.subirArchivo(
        this.nuevaOrden.archivo!,
        'ordenes_compra'
      );

      const formData = new FormData();
      formData.append('cliente_id', this.nuevaOrden.clienteId!.toString());
      formData.append('fecha_entrega_estimada', this.nuevaOrden.fechaEntregaEstimada ? this.nuevaOrden.fechaEntregaEstimada.toISOString().split('T')[0] : '');
      formData.append('dias_entrega', this.nuevaOrden.diasEntrega);
      formData.append('numero_orden', this.nuevaOrden.numeroOrden.trim());
      formData.append('archivo_url', archivoUrl);

      this.ordenCompraService.registrarOrden(formData).subscribe({
        next: () => {
          Swal.fire({
            title: '¡Éxito!',
            text: 'Orden registrada correctamente',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
          this.cerrarModalNuevaOrden();
          this.cargarOrdenes();
        },
        error: (err) => {
          console.error('Error al registrar:', err);
          Swal.fire('Error', err.error?.message || 'No se pudo registrar la orden', 'error');
        },
        complete: () => {
          this.isSubiendo = false;
        }
      });

    } catch (error) {
      console.error('Error al subir archivo:', error);
      Swal.fire('Error', 'No se pudo subir el archivo', 'error');
      this.isSubiendo = false;
    }
  }

  private subirArchivo(file: File, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.fileService.uploadFile(file, path).subscribe({
        next: (res) => resolve(res.url),
        error: (err) => reject(err)
      });
    });
  }

  // ========== PROCESAR ORDEN (Vincular PV) ==========
  procesarOrden(orden: OrdenCompra): void {
    Swal.fire({
      title: 'Procesando orden...',
      html: `
        <p>Se buscará el Pedido de Venta (PV) asociado a la OC <strong>${orden.numero_orden}</strong> en Siesa.</p>
        <p class="text-sm text-gray-600 mt-2">Este proceso puede tardar unos segundos.</p>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Procesar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isProcesando = true;
        this.ordenCompraService.procesarOrden(orden.id).subscribe({
          next: (res) => {
            Swal.fire({
              title: '¡Orden procesada!',
              html: `
                <p>PV vinculado: <strong>${res.data.pv_encontrado}</strong></p>
              `,
              icon: 'success',
              timer: 3000
            });
            this.cargarOrdenes();
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo procesar la orden', 'error');
          },
          complete: () => {
            this.isProcesando = false;
          }
        });
      }
    });
  }

  // ========== RECHAZAR ORDEN ==========
  abrirModalRechazo(orden: OrdenCompra): void {
    this.ordenArechazar = orden;
    this.motivoRechazo = '';
    this.mostrarModalRechazo = true;
  }

  cerrarModalRechazo(): void {
    this.mostrarModalRechazo = false;
    this.ordenArechazar = null;
    this.motivoRechazo = '';
  }

  confirmarRechazo(): void {
    if (!this.motivoRechazo.trim() || this.motivoRechazo.length < 10) {
      Swal.fire('Atención', 'El motivo de rechazo debe tener al menos 10 caracteres', 'warning');
      return;
    }

    if (!this.ordenArechazar) return;

    this.ordenCompraService.rechazarOrden(this.ordenArechazar.id, this.motivoRechazo).subscribe({
      next: () => {
        Swal.fire({
          title: '¡Orden rechazada!',
          text: 'La orden ha sido rechazada correctamente',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        this.cerrarModalRechazo();
        this.cargarOrdenes();
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo rechazar la orden', 'error');
      }
    });
  }

  // ========== DOCUMENTOS ==========
  verDocumento(orden: OrdenCompra): void {
    this.isLoadingDocument = true;
    this.documentoOrdenNumero = orden.numero_orden;

    this.fileService.getTemporaryUrl(orden.id, 'orden_compra', 15).subscribe({
      next: (res) => {
        this.documentoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(res.url);
        this.mostrarModalDocumento = true;
        this.isLoadingDocument = false;
      },
      error: (err) => {
        console.error('Error al obtener URL:', err);
        Swal.fire('Error', 'No se pudo obtener el documento', 'error');
        this.isLoadingDocument = false;
      }
    });
  }

  cerrarModalDocumento(): void {
    this.mostrarModalDocumento = false;
    this.documentoUrl = null;
    this.documentoOrdenNumero = '';
  }

  descargarDocumento(orden: OrdenCompra): void {
    this.fileService.getTemporaryUrl(orden.id, 'orden_compra', 5).subscribe({
      next: (res) => {
        const link = document.createElement('a');
        link.href = res.url;
        link.download = `orden_${orden.numero_orden}.pdf`;
        link.click();
      },
      error: (err) => {
        console.error('Error al descargar:', err);
        Swal.fire('Error', 'No se pudo descargar el documento', 'error');
      }
    });
  }

  // ========== UTILIDADES ==========
  getEstadoBadgeClass(estado: string): string {
    const clases = {
      'PENDIENTE': 'bg-yellow-100 text-yellow-800',
      'PROCESADA': 'bg-green-100 text-green-800',
      'RECHAZADA': 'bg-red-100 text-red-800'
    };
    return clases[estado as keyof typeof clases] || 'bg-gray-100 text-gray-800';
  }

  getEstadoTexto(estado: string): string {
    const textos = {
      'PENDIENTE': 'Pendiente',
      'PROCESADA': 'Procesada',
      'RECHAZADA': 'Rechazada'
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