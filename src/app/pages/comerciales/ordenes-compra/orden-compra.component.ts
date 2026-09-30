import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { OrdenCompraService, OcrItemExtraido, OcrAnalysisResult, SugerenciaSiesa } from 'src/app/services/orden-compra.service';
import { generarHtmlDetalleOrdenCompra } from 'src/app/shared/templates/orden-compra-popup.template';
import { FileService } from 'src/app/services/file.service';
import Swal from 'sweetalert2';
import { AuthService } from 'src/app/services/auth.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

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
    estado: '',
    periodo: 'este_mes',
    fechaDesde: '',
    fechaHasta: ''
  };
  filtroCliente = '';
  busquedaClienteInput = '';
  mostrarDropdownClientes = false;
  clientesAgrupados: Array<{ cliente: string; total: number; pendientes: number; procesadas: number }> = [];

  mostrarModalNuevaOrden = false;
  nuevaOrden = {
    clienteId: null as number | null,
    clienteNombre: '',
    numeroOrden: '',
    archivo: null as File | null,
    diasEntrega: '',
    fechaEntregaEstimada: null as Date | null
  };

  // OCR
  isAnalizandoOcr = false;
  ocrCompletado = false;
  ocrError = '';
  ocrItems: OcrItemExtraido[] = [];
  ocrTextoRaw = '';
  ocrClienteConfianza = 0;
  isDraggingOver = false;
  mostrarTextoRaw = false;
  archivoPreviewUrl: SafeResourceUrl | null = null;
  busquedaSugerencia$ = new Subject<{ texto: string; index: number }>();

  mostrarModalDocumento = false;
  documentoUrl: SafeResourceUrl | null = null;
  documentoOrdenNumero = '';

  // Modal rechazo
  mostrarModalRechazo = false;
  ordenArechazar: OrdenCompra | null = null;
  motivoRechazo = '';

  // Modal Detalle e Ítems OC
  mostrarModalDetalleOC = false;
  ordenSeleccionada: any = null;
  itemsOrdenSeleccionada: any[] = [];
  itemsSiesaOrden: any[] = [];
  isLoadingDetalleOC = false;

  // Modal Vinculación Interactiva PV
  mostrarModalVincularPV = false;
  ordenParaVincular: any = null;
  pvInput = '';
  isBuscandoPVSiesa = false;
  isGuardandoVinculacion = false;
  infoPVSiesa: any = null;
  errorBusquedaPV = '';
  busquedaAutomaticaCompletada = false;

  constructor(
    public paginationService: PaginationService,
    private ordenCompraService: OrdenCompraService,
    private fileService: FileService,
    private sanitizer: DomSanitizer,
    public authService: AuthService,
    @Inject(DOCUMENT) private document: Document
  ) { }

  ngOnInit(): void {
    this.loadTailwind();
    this.setupPopupHandlers();
    this.cargarOrdenes();
  }

  private setupPopupHandlers(): void {
    (window as any).desvincularDesdePopup = (id: number) => {
      const ord = this.ordenes.find(o => o.id === id) || { id };
      this.desvincularPVSiesa(ord);
    };
    (window as any).verDocumentoDesdePopup = (id: number) => {
      const ord = this.ordenes.find(o => o.id === id) || { id };
      this.verDocumento(ord as any);
    };
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

  cargarOrdenes(): void {
    this.isLoading = true;
    this.ordenCompraService.obtenerOrdenes().subscribe({
      next: (res) => {
        this.ordenes = res['data'] || [];
        this.totalOrdenes = this.ordenes.length;
        this.construirAgrupacionClientes();
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

  construirAgrupacionClientes(): void {
    const map = new Map<string, { cliente: string; total: number; pendientes: number; procesadas: number }>();
    this.ordenes.forEach(o => {
      const cli = (o.cliente || 'Sin Cliente').trim();
      if (!map.has(cli)) {
        map.set(cli, { cliente: cli, total: 0, pendientes: 0, procesadas: 0 });
      }
      const item = map.get(cli)!;
      item.total++;
      if (o.estado === 'PENDIENTE') item.pendientes++;
      if (o.estado === 'PROCESADA') item.procesadas++;
    });
    this.clientesAgrupados = Array.from(map.values()).sort((a, b) => b.pendientes - a.pendientes || b.total - a.total);
  }

  getClientesFiltrados(): Array<{ cliente: string; total: number; pendientes: number; procesadas: number }> {
    if (!this.busquedaClienteInput.trim()) {
      return this.clientesAgrupados.slice(0, 8);
    }
    const q = this.busquedaClienteInput.toLowerCase().trim();
    return this.clientesAgrupados.filter(c => c.cliente.toLowerCase().includes(q));
  }

  seleccionarCliente(cliente: string): void {
    this.filtroCliente = cliente;
    this.busquedaClienteInput = '';
    this.mostrarDropdownClientes = false;
    this.applyFilters();
  }

  limpiarFiltroCliente(event?: Event): void {
    if (event) event.stopPropagation();
    this.filtroCliente = '';
    this.busquedaClienteInput = '';
    this.mostrarDropdownClientes = false;
    this.applyFilters();
  }

  toggleDropdownClientes(abrir?: boolean): void {
    this.mostrarDropdownClientes = abrir !== undefined ? abrir : !this.mostrarDropdownClientes;
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

    let cumpleCliente = true;
    if (this.filtroCliente) {
      cumpleCliente = (orden.cliente || '').trim().toLowerCase() === this.filtroCliente.trim().toLowerCase();
    }

    // Filtro por Fecha / Período
    let cumpleFecha = true;
    const fechaRegistro = (orden.fecha_registro || (orden as any).created_at || '').substring(0, 10);
    const fechaEntrega = ((orden as any).fecha_entrega_estimada || '').substring(0, 10);

    const ahora = new Date();
    const mesActualStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    const mesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const mesAnteriorStr = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}`;

    if (filtros.periodo === 'este_mes') {
      const subidoEsteMes = fechaRegistro.startsWith(mesActualStr);
      const entregaEsteMes = fechaEntrega.startsWith(mesActualStr);
      cumpleFecha = subidoEsteMes || entregaEsteMes;
    } else if (filtros.periodo === 'subidos_mes') {
      cumpleFecha = fechaRegistro.startsWith(mesActualStr);
    } else if (filtros.periodo === 'entrega_mes') {
      cumpleFecha = fechaEntrega.startsWith(mesActualStr);
    } else if (filtros.periodo === 'mes_anterior') {
      cumpleFecha = fechaRegistro.startsWith(mesAnteriorStr) || fechaEntrega.startsWith(mesAnteriorStr);
    } else if (filtros.periodo === 'personalizado') {
      if (filtros.fechaDesde && fechaRegistro < filtros.fechaDesde) cumpleFecha = false;
      if (filtros.fechaHasta && fechaRegistro > filtros.fechaHasta) cumpleFecha = false;
    }

    return cumpleBusqueda && cumpleEstado && cumpleCliente && cumpleFecha;
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

  seleccionarDiasEntrega(dias: number): void {
    this.nuevaOrden.diasEntrega = dias.toString();
    this.calcularFechaEntrega();
  }

  resetearFormulario(): void {
    this.nuevaOrden = {
      clienteId: null,
      clienteNombre: '',
      numeroOrden: '',
      archivo: null,
      diasEntrega: '30',
      fechaEntregaEstimada: null
    };
    this.calcularFechaEntrega();
    this.ocrCompletado = false;
    this.ocrError = '';
    this.ocrItems = [];
    this.ocrTextoRaw = '';
    this.ocrClienteConfianza = 0;
    this.isAnalizandoOcr = false;
    this.mostrarTextoRaw = false;
    this.archivoPreviewUrl = null;
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
      this.generarPreviewArchivo(file);
      this.ejecutarOcr(file);
    }
  }

  generarPreviewArchivo(file: File): void {
    try {
      const url = URL.createObjectURL(file);
      this.archivoPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    } catch (e) {
      this.archivoPreviewUrl = null;
    }
  }

  // ========== OCR: DRAG & DROP ==========
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (this.validarArchivo(file)) {
        this.nuevaOrden.archivo = file;
        this.generarPreviewArchivo(file);
        this.ejecutarOcr(file);
      }
    }
  }

  // ========== OCR: CÁLCULOS TOTALES ==========
  calcularTotalGeneral(): number {
    return this.ocrItems.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario), 0);
  }

  calcularTotalCantidad(): number {
    return this.ocrItems.reduce((acc, item) => acc + (item.cantidad || 0), 0);
  }

  // ========== OCR: EJECUCIÓN ==========
  ejecutarOcr(file: File): void {
    this.isAnalizandoOcr = true;
    this.ocrCompletado = false;
    this.ocrError = '';
    this.ocrItems = [];

    this.ordenCompraService.analizarDocumentoOcr(file).subscribe({
      next: (res: OcrAnalysisResult) => {
        if (res.success && res.data) {
          // Autocompletar número de orden
          if (res.data.numero_orden) {
            this.nuevaOrden.numeroOrden = res.data.numero_orden;
          }

          // Autocompletar cliente
          if (res.data.cliente && res.data.cliente.id) {
            this.ocrClienteConfianza = res.data.cliente.confianza;
            const clienteLocal = this.clientes.find(c => c.id === res.data!.cliente.id);
            if (clienteLocal) {
              this.nuevaOrden.clienteId = clienteLocal.id;
              this.nuevaOrden.clienteNombre = clienteLocal.razon_social;
            } else {
              this.nuevaOrden.clienteNombre = res.data.cliente.razon_social;
            }
          }

          // Autocompletar fecha de entrega
          if (res.data.dias_entrega) {
            this.nuevaOrden.diasEntrega = res.data.dias_entrega.toString();
            this.calcularFechaEntrega();
          }

          // Ítems extraídos
          this.ocrItems = res.data.items || [];
          this.ocrTextoRaw = res.data.texto_raw || '';
          this.ocrCompletado = true;
        } else {
          this.ocrError = res.message || 'No se pudo analizar el documento';
        }
      },
      error: (err) => {
        this.ocrError = err.error?.message || 'Error al procesar el documento con OCR';
        console.error('OCR Error:', err);
      },
      complete: () => {
        this.isAnalizandoOcr = false;
      }
    });
  }

  // ========== OCR: BUSCAR SUGERENCIAS SIESA POR ÍTEM ==========
  buscarSugerenciasParaItem(index: number): void {
    const item = this.ocrItems[index];
    if (!item || !item.descripcion || item.descripcion.length < 3) return;

    this.ordenCompraService.buscarSugerenciasSiesa(
      item.descripcion,
      this.nuevaOrden.clienteId ?? undefined
    ).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.ocrItems[index].sugerencias_siesa = res.data;
        }
      },
      error: (err) => console.warn('Error buscando sugerencias Siesa:', err)
    });
  }

  seleccionarSugerencia(itemIndex: number, sug: SugerenciaSiesa): void {
    this.ocrItems[itemIndex].rowid_siesa = sug.rowid_siesa;
    this.ocrItems[itemIndex].referencia = sug.referencia;
    this.ocrItems[itemIndex].codigo_item = sug.codigo_item;
    // Cerrar dropdown de sugerencias
    this.ocrItems[itemIndex].sugerencias_siesa = [];
  }

  eliminarItemOcr(index: number): void {
    this.ocrItems.splice(index, 1);
  }

  validarArchivo(file: File): boolean {
    const formatosValidos = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];
    const maxSize = 25 * 1024 * 1024; // 25MB

    if (!formatosValidos.includes(file.type)) {
      Swal.fire('Error', 'Solo se permiten archivos PDF, PNG, JPG o TIFF', 'error');
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
        next: (res) => {
          const ordenCreada = res.data;

          // Guardar ítems OCR como items temporales
          if (this.ocrItems.length > 0 && ordenCreada?.id) {
            const itemsParaGuardar = this.ocrItems.map(item => ({
              codigo_item: item.codigo_item || '',
              descripcion: item.descripcion,
              referencia: item.referencia || '',
              cantidad: item.cantidad,
              precio_unitario: item.precio_unitario,
              precio_total: item.precio_total,
              unidad_medida: item.unidad_medida || 'UND',
              rowid_siesa: item.rowid_siesa
            }));

            this.ordenCompraService.guardarItems(ordenCreada.id, itemsParaGuardar).subscribe({
              error: (err) => console.warn('Error al guardar ítems OCR:', err)
            });

            // Guardar mapeos aprendidos (ítems con rowid_siesa confirmados)
            const itemsConMapeo = this.ocrItems
              .filter(i => i.rowid_siesa)
              .map(i => ({
                descripcion_cliente: i.descripcion,
                rowid_siesa: i.rowid_siesa!,
                codigo_siesa: i.codigo_item,
                referencia_siesa: i.referencia,
                descripcion_siesa: i.descripcion
              }));

            if (itemsConMapeo.length > 0 && this.nuevaOrden.clienteId) {
              this.ordenCompraService.guardarMapeoCliente(
                this.nuevaOrden.clienteId,
                itemsConMapeo
              ).subscribe({
                error: (err) => console.warn('Error al guardar mapeo cliente:', err)
              });
            }
          }

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
    if (!orden || !orden.id) return;

    const win = window.open('', '_blank', 'width=1050,height=850,scrollbars=yes,resizable=yes');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head><title>Documento OC ${orden.numero_orden || ''}</title></head>
        <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f8fafc;color:#64748b;">
          <div style="text-align:center;">
            <p style="font-size:16px;font-weight:600;margin-bottom:6px;">Cargando documento original...</p>
            <p style="font-size:12px;color:#94a3b8;">OC ${orden.numero_orden || ''}</p>
          </div>
        </body>
        </html>
      `);
    }

    this.fileService.getTemporaryUrl(orden.id, 'orden_compra', 30).subscribe({
      next: (res) => {
        if (res && res.url) {
          if (win && !win.closed) {
            win.location.href = res.url;
          }
        } else {
          if (win && !win.closed) win.close();
          Swal.fire('Atención', 'No se encontró archivo adjunto para esta orden', 'info');
        }
      },
      error: (err) => {
        if (win && !win.closed) win.close();
        console.error('Error al obtener URL:', err);
        Swal.fire('Error', 'No se pudo obtener el documento', 'error');
      }
    });
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

  // ========== DETALLE E ÍTEMS OC ==========
  verDetalleOC(orden: any): void {
    this.ordenSeleccionada = orden;
    this.itemsOrdenSeleccionada = [];
    this.itemsSiesaOrden = [];
    this.mostrarModalDetalleOC = true;
    this.isLoadingDetalleOC = true;

    this.ordenCompraService.obtenerDetalle(orden.id).subscribe({
      next: (res) => {
        if (res.data) {
          this.ordenSeleccionada = { ...orden, ...res.data };
          this.itemsOrdenSeleccionada = res.data.items || [];
          this.itemsSiesaOrden = res.data.items_siesa || [];
          if (!this.itemsOrdenSeleccionada || this.itemsOrdenSeleccionada.length === 0) {
            this.ordenCompraService.obtenerItems(orden.id).subscribe({
              next: (itemsRes) => {
                if (itemsRes && itemsRes.data) {
                  this.itemsOrdenSeleccionada = itemsRes.data;
                }
              }
            });
          }
        }
        this.isLoadingDetalleOC = false;
      },
      error: () => {
        this.isLoadingDetalleOC = false;
      }
    });
  }

  cerrarModalDetalleOC(): void {
    this.mostrarModalDetalleOC = false;
    this.ordenSeleccionada = null;
    this.itemsOrdenSeleccionada = [];
    this.itemsSiesaOrden = [];
  }

  // ========== MODAL UNIFICADO VINCULAR PV (AUTO / MANUAL + VALIDACIÓN SIESA) ==========
  abrirModalVincularPV(orden: any): void {
    if (!orden || !orden.id) return;
    this.ordenParaVincular = orden;
    this.pvInput = '';
    this.infoPVSiesa = null;
    this.errorBusquedaPV = '';
    this.busquedaAutomaticaCompletada = false;
    this.mostrarModalVincularPV = true;

    // Intentar búsqueda automática con el número de OC registrado
    if (orden.numero_orden) {
      this.consultarInfoPV(orden.numero_orden, true);
    }
  }

  cerrarModalVincularPV(): void {
    this.mostrarModalVincularPV = false;
    this.ordenParaVincular = null;
    this.pvInput = '';
    this.infoPVSiesa = null;
    this.errorBusquedaPV = '';
    this.busquedaAutomaticaCompletada = false;
    this.isBuscandoPVSiesa = false;
    this.isGuardandoVinculacion = false;
  }

  consultarInfoPV(numero?: string, esAuto = false): void {
    const valor = (numero !== undefined ? numero : this.pvInput).trim();
    if (!valor) {
      this.errorBusquedaPV = 'Por favor ingrese un número de PV o referencia para consultar.';
      this.infoPVSiesa = null;
      return;
    }

    this.isBuscandoPVSiesa = true;
    this.errorBusquedaPV = '';

    this.ordenCompraService.consultarPV(valor).subscribe({
      next: (res) => {
        this.isBuscandoPVSiesa = false;
        if (esAuto) this.busquedaAutomaticaCompletada = true;

        if (res.success && res.pv) {
          this.infoPVSiesa = res.pv;
          this.pvInput = res.pv.numero_pv || valor;
          this.errorBusquedaPV = '';
        } else {
          this.infoPVSiesa = null;
          this.errorBusquedaPV = res.message || `No se encontró el PV "${valor}" en Siesa.`;
        }
      },
      error: (err) => {
        this.isBuscandoPVSiesa = false;
        if (esAuto) this.busquedaAutomaticaCompletada = true;
        this.infoPVSiesa = null;
        this.errorBusquedaPV = err.error?.message || 'Error al conectar con Siesa para consultar el PV.';
      }
    });
  }

  coincideOC(): boolean {
    if (!this.infoPVSiesa || !this.ordenParaVincular) return false;
    const refSiesa = (this.infoPVSiesa.oc_referencia_siesa || '').trim().toLowerCase();
    const ocActual = (this.ordenParaVincular.numero_orden || '').trim().toLowerCase();
    if (!refSiesa || !ocActual) return false;
    return refSiesa === ocActual || refSiesa.includes(ocActual) || ocActual.includes(refSiesa);
  }

  confirmarVinculacionPV(): void {
    if (!this.ordenParaVincular || !this.pvInput.trim()) return;

    const pvNumero = (this.infoPVSiesa?.numero_pv || this.pvInput).trim();

    // Si ya está vinculada en Saint a otra OC, advertir con confirmación
    if (this.infoPVSiesa?.ya_vinculada_en_saint && this.infoPVSiesa.orden_saint_vinculada?.id !== this.ordenParaVincular.id) {
      Swal.fire({
        title: '¡PV ya vinculado en Saint!',
        html: `
          <p class="text-sm text-slate-700 mb-2">Este PV <strong>#${pvNumero}</strong> ya se encuentra asociado a la orden <strong>#${this.infoPVSiesa.orden_saint_vinculada.numero_orden}</strong> (Cliente: ${this.infoPVSiesa.orden_saint_vinculada.cliente}).</p>
          <p class="text-xs text-amber-700 bg-amber-50 p-2 rounded-md font-medium border border-amber-200">¿Desea continuar y vincularlo a esta orden actual de todas formas?</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, vincular',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d97706'
      }).then((res) => {
        if (res.isConfirmed) {
          this.ejecutarVinculacionPV(pvNumero);
        }
      });
      return;
    }

    this.ejecutarVinculacionPV(pvNumero);
  }

  private ejecutarVinculacionPV(pvNumero: string): void {
    this.isGuardandoVinculacion = true;

    this.ordenCompraService.vincularPVManual(this.ordenParaVincular.id, pvNumero).subscribe({
      next: (res) => {
        this.isGuardandoVinculacion = false;
        this.cerrarModalVincularPV();
        Swal.fire({
          title: '¡Vinculada con éxito!',
          text: res.message || `PV ${pvNumero} vinculado exitosamente a la OC ${this.ordenParaVincular?.numero_orden}`,
          icon: 'success',
          timer: 2200,
          showConfirmButton: false
        });
        this.cargarOrdenes();
      },
      error: (err) => {
        this.isGuardandoVinculacion = false;
        Swal.fire('Error', err.error?.message || 'No se pudo vincular el PV a la orden', 'error');
      }
    });
  }

  getTotalCantidadSiesa(): number {
    return (this.itemsSiesaOrden || []).reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);
  }

  getTotalValorSiesa(): number {
    return (this.itemsSiesaOrden || []).reduce((acc, item) => acc + (Number(item.valor_total) || 0), 0);
  }

  desvincularPVSiesa(orden: any, event?: Event): void {
    if (event) event.stopPropagation();
    if (!orden || !orden.id) return;

    Swal.fire({
      title: '¿Desvincular PV de esta OC?',
      html: `<p class="text-sm text-slate-600">Se desvinculará el <strong>PV ${orden.pv_asociado}</strong> de la <strong>OC ${orden.numero_orden}</strong>.</p><p class="text-xs text-amber-600 mt-2 font-medium">La orden volverá a estado PENDIENTE.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-link-45deg"></i> Sí, desvincular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f59e0b'
    }).then((result) => {
      if (result.isConfirmed) {
        this.ordenCompraService.desvincularPV(orden.id).subscribe({
          next: (res) => {
            Swal.fire({
              title: 'PV Desvinculado',
              text: res.message || 'La orden volvió a estado PENDIENTE.',
              icon: 'success',
              timer: 1800,
              showConfirmButton: false
            });
            if (this.ordenSeleccionada && this.ordenSeleccionada.id === orden.id) {
              this.ordenSeleccionada.pv_asociado = null;
              this.ordenSeleccionada.estado = 'PENDIENTE';
            }
            this.cargarOrdenes();
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo desvincular el PV', 'error');
          }
        });
      }
    });
  }

  calcularDiasRestantes(fechaEntrega: string | null): { dias: number; texto: string; clase: string } | null {
    if (!fechaEntrega) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const entrega = new Date(fechaEntrega);
    entrega.setHours(0, 0, 0, 0);
    const diffMs = entrega.getTime() - hoy.getTime();
    const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (dias < 0) {
      return { dias: Math.abs(dias), texto: `Vencida hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`, clase: 'text-rose-600 bg-rose-50 border-rose-200' };
    } else if (dias === 0) {
      return { dias: 0, texto: 'Entrega hoy', clase: 'text-amber-700 bg-amber-50 border-amber-200' };
    } else if (dias <= 3) {
      return { dias, texto: `${dias} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`, clase: 'text-amber-700 bg-amber-50 border-amber-200' };
    } else {
      return { dias, texto: `${dias} días restantes`, clase: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    }
  }

  calcularPlazoPactado(fechaInicio: string | null, fechaFin: string | null, diasOriginal?: any): string {
    if (diasOriginal && Number(diasOriginal) > 0) {
      return `${diasOriginal} días`;
    }
    if (!fechaInicio || !fechaFin) return 'N/A';
    try {
      const inicio = new Date(fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      const fin = new Date(fechaFin);
      fin.setHours(0, 0, 0, 0);
      const diffMs = fin.getTime() - inicio.getTime();
      const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (dias < 0) return 'N/A';
      return dias > 0 ? `${dias} días` : 'Mismo día';
    } catch {
      return 'N/A';
    }
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