import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { TerminacionEmpaqueService } from 'src/app/services/terminacion-empaque.service';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { Component, OnInit, TemplateRef, ViewChild, ElementRef } from '@angular/core';
import Swal from 'sweetalert2';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import * as QRCode from 'qrcode';

interface PVAsignada {
  id: number;
  pv_codigo: string;
  fecha_asignado: string;
  empacado: number;
  teorico: number;
  op_id?: number;
  items?: any[];
}

@Component({
  selector: 'app-registrar-empaque',
  templateUrl: './registrar-empaque.component.html',
  styleUrls: ['./registrar-empaque.component.css']
})
export class RegistrarEmpaqueComponent implements OnInit {
  Math = Math;
  paginatorId = 'registrar-empaque-paginator';
  paginatorItemsId = 'registrar-empaque-items-paginator';

  filters = {
    busqueda: ''
  };

  filtersItems = {
    busqueda: ''
  };

  pvs: PVAsignada[] = [];
  currentPvs: PVAsignada[] = [];

  pvSeleccionada: PVAsignada | null = null;
  ptSeleccionada: string | null = null;
  itemsPV: any[] = [];
  currentItemsPV: any[] = [];

  loadingPVs = false;

  empaquesPV: any[] = [];
  filteredEmpaques: any[] = [];
  currentEmpaques: any[] = [];

  searchEmpaques: string = '';
  expandedEmpaques = new Set<string>();

  paginacionEmpaques = {
    currentPage: 1,
    pageSize: 5,
    totalPages: 1
  };

  etiquetaData: any = {};
  etiquetaTitle = '';
  etiquetaSubtitle = '';

  fechaActual = new Date();
  etiquetaElementRef!: ElementRef;

  qrImageUrl: string | null = null;
  qrTitle = '';
  qrSubtitle = '';
  qrType = '';
  qrCode = '';
  qrCliente = '';
  qrEmpacador = '';
  qrData: any = {};

  guardandoEmpaque = false;

  @ViewChild('tmplVerItems', { static: true }) tmplVerItems!: TemplateRef<any>;
  @ViewChild('tmplRegistrarEmpaque', { static: true }) tmplRegistrarEmpaque!: TemplateRef<any>;
  @ViewChild('tmplVerEmpaques', { static: true }) tmplVerEmpaques!: TemplateRef<any>;
  @ViewChild('qrTemplate', { static: true }) qrTemplate!: TemplateRef<any>;
  @ViewChild('etiquetaTemplate', { static: true }) etiquetaTemplate!: TemplateRef<any>;

  constructor(
    private terminacionEmpaqueService: TerminacionEmpaqueService,
    public paginationService: PaginationService,
    private authService: AuthService,
    private userService: UserService,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.cargarPVsAsignadas();
  }

  cargarPVsAsignadas(): void {
    this.loadingPVs = true;
    const empacadorId = this.authService.user.id;
    
    // Usando la nueva función para API Laravel
    this.terminacionEmpaqueService.obtenerPVsAsignadas(empacadorId).subscribe({
      next: (res: any[]) => {
        console.log(res[empacadorId])
        const listaLimpia: PVAsignada[] = res[empacadorId]['pvs'].map(pv => ({
          ...pv,
          pv_codigo: pv.codigo?.replace(',', ''),
          empacado: Number(pv.empacado),
          teorico: Number(pv.teorico),
        }))
        // .filter(pv => pv.empacado < pv.teorico); // Solo las que aún tienen unidades pendientes

        this.pvs = listaLimpia;

        // Usar la lista ordenada para la paginación
        this.paginationService.initializePaginator(
          this.paginatorId,
          this.listaPVsOrdenada,
          10,
          this.filters,
          this.filterFunction
        ).subscribe(state => this.currentPvs = state.currentData);
        this.loadingPVs = false;
      },
      error: () => Swal.fire('Error', 'No se pudieron cargar las PV asignadas', 'error')
    });
  }

  get listaPVsOrdenada() {
    return [...this.pvs].sort((a, b) => {
      const estadoA = this.obtenerEstado(a);
      const estadoB = this.obtenerEstado(b);
      const prioridad = {
        'Con asignación': 1,
        'En espera': 2,
        'Terminada': 3
      };
      return prioridad[estadoA] - prioridad[estadoB];
    });
  }

  obtenerEstado(pv: any): string {
    const asignado = parseFloat(pv.asignado ?? 0);
    const empacado = parseFloat(pv.empacado ?? 0);
    const teorico = parseFloat(pv.teorico ?? 0);

    if ((asignado > empacado) && empacado < teorico) {
      return 'Con asignación';
    } else if (asignado === empacado && empacado < teorico) {
      return 'En espera';
    } else if (teorico == 0 || empacado == 0 || asignado == 0) {
      return 'Sin disponibles';
    } else if (empacado >= teorico) {
      return 'Terminada';
    } else {
      return 'Desconocido';
    }
  }

  abrirVerItems(pv: any): void {
    this.pvSeleccionada = pv.pv_codigo;
    this.ptSeleccionada = pv.pt || null;
    const empacadorId = this.authService.user.id;

    this.terminacionEmpaqueService.obtenerItemsPV(pv.pv_codigo, empacadorId, true).subscribe({
      next: (res: any) => {
        if (res.success) {
          // Marcar de dónde viene cada ítem
          const distribucion = res.items_distribucion.map((i: any) => ({
            ...i,
            es_pt: false
          }));

          const recepcion = res.items_recepcion.map((i: any) => ({
            ...i,
            es_pt: true
          }));

          // Unificar
          this.itemsPV = [...distribucion, ...recepcion];
        } else {
          this.itemsPV = [];
        }

        // Inicializar paginador
        this.paginationService.initializePaginator(
          this.paginatorItemsId,
          this.itemsPV,
          10,
          this.filtersItems,
          this.filterFunctionItems
        ).subscribe(state => this.currentItemsPV = state.currentData);

        this.modalService.open(this.tmplVerItems, { size: 'lg' });
      },
      error: () => Swal.fire('Error', 'Error al obtener los ítems de la PV.', 'error')
    });
  }

  abrirRegistrarEmpaque(pv: any): void {
    this.pvSeleccionada = pv.pv_codigo;
    this.ptSeleccionada = pv.pt || null;
    const empacadorId = this.authService.user.id;

    this.terminacionEmpaqueService.obtenerItemsPV(pv.pv_codigo, empacadorId, false).subscribe({
      next: (res: any) => {
        if (res.success) {
          const distribucion = res.items_distribucion.map((i: any) => ({
            ...i,
            es_pt: false,
            cantidad_a_registrar: 0
          }));

          const recepcion = res.items_recepcion.map((i: any) => ({
            ...i,
            es_pt: true,
            cantidad_a_registrar: 0
          }));

          this.itemsPV = [...distribucion, ...recepcion];
        } else {
          this.itemsPV = [];
        }

        this.paginationService.initializePaginator(
          this.paginatorItemsId,
          this.itemsPV,
          10,
          this.filtersItems,
          this.filterFunctionItems
        ).subscribe(state => this.currentItemsPV = state.currentData);
        console.log(this.itemsPV);
        this.modalService.open(this.tmplRegistrarEmpaque, { size: 'xl' });
      },
      error: () => Swal.fire('Error', 'No se pudieron cargar los ítems para registrar empaque', 'error')
    });
  }

  validarNumeroEmpaque(item: any): boolean {
    // Valida si el numero_empaque existe y no está vacío (solo si la cantidad a registrar es > 0)
    return !!item.numero_empaque && item.numero_empaque.trim().length > 0;
  }

  formularioEsValido(): boolean {
    // Verificar que al menos una cantidad a registrar sea mayor que 0
    const hayCantidadARegistrar = this.itemsPV.some(item => Number(item.cantidad_a_registrar || 0) > 0);
    if (!hayCantidadARegistrar) {
      return false;
    }

    // Verificar que todas las cantidades a registrar válidas tengan un número de empaque
    const todosLosNumerosEmpaqueValidos = this.itemsPV.every(item => {
      const cantidadARegistrar = Number(item.cantidad_a_registrar || 0);
      if (cantidadARegistrar > 0) {
        return this.validarNumeroEmpaque(item);
      }
      return true; // Si no hay cantidad a registrar, no se requiere número de empaque
    });

    return todosLosNumerosEmpaqueValidos;
  }

  registrarEmpaque(): void {
    if (this.guardandoEmpaque) return;

    // Validación adicional para número de empaque
    if (!this.formularioEsValido()) {
      Swal.fire({
        title: 'Formulario incompleto',
        html: 'Por favor, asegúrate de que todos los ítems con cantidad a registrar tengan un número de empaque válido.',
        icon: 'error'
      });
      return;
    }

    const itemsInvalidos = this.itemsPV.filter(item => {
      const asignado = Number(item.asignado) || 0;
      const empacado = Number(item.empacado) || 0;
      const teorico = Number(item.teorico) || 0;
      const cantidad = Number(item.cantidad_a_registrar) || 0;

      if (cantidad <= 0) return false;

      const nuevoTotal = empacado + cantidad;
      const limite = Math.min(asignado, teorico);

      return nuevoTotal > limite;
    });

    if (itemsInvalidos.length > 0) {
      const mensajes = itemsInvalidos.map(item => {
        const asignado = Number(item.asignado) || 0;
        const empacado = Number(item.empacado) || 0;
        const teorico = Number(item.teorico) || 0;
        const limite = Math.min(asignado, teorico);

        return `- ${item.id_item.trim()} - ${item.id_color.trim()} - ${item.id_talla.trim()}: |
      Intentas registrar ${item.cantidad_a_registrar}, máximo permitido: ${limite - empacado}`;
      }).join('\n');

      Swal.fire({
        title: 'Cantidades inválidas',
        html: `<pre style="text-align: left;">${mensajes}</pre>`,
        icon: 'error'
      });
      return;
    }

    const registros = this.itemsPV
      .filter(item => item.cantidad_a_registrar > 0)
      .map(item => ({
        pv_id: this.pvSeleccionada,
        item_id: item.id_item,
        item_hash: item.item_hash,
        cantidad: item.cantidad_a_registrar,
        tipo_empaque: item.tipo_empaque || 'otro',
        numero_empaque: item.numero_empaque || '',
        empacador_id: this.authService.user.id
      }));

    if (registros.length === 0) {
      Swal.fire('Advertencia', 'No hay cantidades para registrar.', 'warning');
      return;
    }

    this.guardandoEmpaque = true;

    this.terminacionEmpaqueService.registrarEmpaqueApiLaravel(registros).subscribe({
      next: () => {
        this.itemsPV.forEach(item => {
          item.cantidad_a_registrar = 0;
          item.tipo_empaque = '';
          item.numero_empaque = '';
        });
        
        Swal.fire('Éxito', 'Empaque registrado correctamente.', 'success');
        this.modalService.dismissAll();
        this.cargarPVsAsignadas();
        this.guardandoEmpaque = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo registrar el empaque.', 'error');
        this.guardandoEmpaque = false;
      }
    });
  }

  validarCantidad(item: any): boolean {
    if (!item.cantidad_a_registrar || item.cantidad_a_registrar <= 0) return true;
    const nuevoTotal = (item.empacado || 0) + item.cantidad_a_registrar;
    const maxPermitido = Math.min(item.asignado - item.empacado, item.teorico - item.empacado);
    return item.cantidad_a_registrar <= maxPermitido;
  }

  obtenerMaximo(item: any): number {
    return Math.min(item.asignado - (item.empacado || 0), item.teorico - (item.empacado || 0));
  }

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.listaPVsOrdenada,
      undefined,
      this.filters,
      this.filterFunction
    );
    this.currentPvs = this.paginationService.getPaginatorState(this.paginatorId)?.currentData || [];
  }

  applyFiltersItems(): void {
    this.paginationService.updatePaginator(
      this.paginatorItemsId,
      this.itemsPV,
      undefined,
      this.filtersItems,
      this.filterFunctionItems
    );
    this.currentItemsPV = this.paginationService.getPaginatorState(this.paginatorItemsId)?.currentData || [];
  }

  filterFunction: FilterFunction = (item, filtros) => {
    const texto = filtros.busqueda.toLowerCase();
    return !texto || Object.values(item).some(v => v?.toString().toLowerCase().includes(texto));
  };

  filterFunctionItems: FilterFunction = (item, filtros) => {
    const texto = filtros.busqueda.toLowerCase();
    if (!texto) return true;
    
    // Crear el string de búsqueda como aparece en la tabla: "id_item - id_color - id_talla"
    const itemSearchString = `${item.id_item} - ${String(item.id_color).trim()} - ${String(item.id_talla).trim()}`.toLowerCase();
    
    // Buscar en el string concatenado o en otros campos
    return itemSearchString.includes(texto) || 
           item.referencia?.toString().toLowerCase().includes(texto) ||
           item.descripcion?.toString().toLowerCase().includes(texto);
  };

  abrirVerEmpaques(pv: any): void {
    this.pvSeleccionada = pv;
    const empacadorId = this.authService.user.id;

    this.terminacionEmpaqueService.obtenerEmpaquesPorPV(pv.pv_codigo, empacadorId).subscribe({
      next: (res: any) => {
        if (res.success && (res.data && res.data.length > 0)) {
          this.empaquesPV = res.data;
          this.filteredEmpaques = [...this.empaquesPV];
          this.paginacionEmpaques.currentPage = 1;
          this.actualizarPaginaEmpaques();
          this.modalService.open(this.tmplVerEmpaques, { size: 'lg' });
        } else {
          Swal.fire('Info', 'No hay empaques registrados para esta PV.', 'info');
        }
      },
      error: () => Swal.fire('Error', 'Error al obtener los empaques de la PV.', 'error')
    });
  }

  aplicarBusquedaEmpaques() {
    const term = this.searchEmpaques.toLowerCase();
    this.currentEmpaques = this.empaquesPV.filter(e =>
      e.numero_empaque.toLowerCase().includes(term) ||
      e.tipo_empaque.toLowerCase().includes(term) ||
      e.items.some(i =>
        i.item_id.toLowerCase().includes(term) ||
        (i.item_hash?.toLowerCase().includes(term)) ||
        (i.comentario?.toLowerCase().includes(term))
      )
    );
  }

  actualizarPaginaEmpaques(): void {
    const start = (this.paginacionEmpaques.currentPage - 1) * this.paginacionEmpaques.pageSize;
    const end = start + this.paginacionEmpaques.pageSize;

    this.paginacionEmpaques.totalPages = Math.ceil(this.filteredEmpaques.length / this.paginacionEmpaques.pageSize) || 1;
    this.currentEmpaques = this.filteredEmpaques.slice(start, end);
  }

  cambiarPaginaEmpaques(page: number): void {
    if (page >= 1 && page <= this.paginacionEmpaques.totalPages) {
      this.paginacionEmpaques.currentPage = page;
      this.actualizarPaginaEmpaques();
    }
  }

  toggleEmpaque(numero: string) {
    if (this.expandedEmpaques.has(numero)) {
      this.expandedEmpaques.delete(numero);
    } else {
      this.expandedEmpaques.add(numero);
    }
  }

  // Agregar en la configuración del modal para obtener referencia
  abrirModalEtiqueta() {
    const modalRef = this.modalService.open(this.etiquetaTemplate, { size: 'lg' });
    modalRef.shown.subscribe(() => {
      this.etiquetaElementRef = new ElementRef(document.getElementById('etiquetaContenido'));
    });
  }

  calcularTotalItems(): number {
    if (!this.etiquetaData.items) return 0;
    return this.etiquetaData.items.reduce((total: number, item: any) => total + item.cantidad, 0);
  }

  contarItemsUnicos(empaque: any): number {
    if (!empaque.items) return 0;
    const itemsUnicos = new Set();
    empaque.items.forEach((item: any) => {
      itemsUnicos.add(item.item_id);
    });
    return itemsUnicos.size;
  }

  async generarEtiquetaTexto(empaque: any) {
    console.log('Generando etiqueta para empaque:', empaque);
    try {
      const itemsMap = new Map<string, any>();

      for (const item of empaque.items) {
        const key = `${item.item_id}_${item.id_talla}`;
        if (!itemsMap.has(key)) {
          itemsMap.set(key, {
            item_id: item.item_id,
            descripcion: item.descripcion,
            talla: item.id_talla,
            cantidad: parseFloat(item.cantidad)
          });
        } else {
          itemsMap.get(key).cantidad += parseFloat(item.cantidad);
        }
      }

      const itemsConsolidados = Array.from(itemsMap.values());

      let EmpacadorNombre = 'N/A';
      await new Promise<void>((resolve) => {
        this.userService.getById(empaque.empacador_id).subscribe({
          next: (user) => {
            EmpacadorNombre = (user.firstName && user.lastName)
              ? `${user.firstName} ${user.lastName}`
              : 'N/A';
            resolve();
          },
          error: () => {
            EmpacadorNombre = 'N/A';
            resolve();
          }
        });
      });

      this.etiquetaTitle = `Etiqueta - ${empaque.numero_empaque}`;
      this.etiquetaSubtitle = empaque.tipo_empaque;
      this.etiquetaData = {
        op: empaque.op || 'N/A',
        pv: empaque.pv || 'N/A',
        oc: empaque.oc || 'N/A',
        cliente: empaque.cliente || 'N/A',
        empacador: EmpacadorNombre,
        tipo_empaque: empaque.tipo_empaque,
        numero_empaque: empaque.numero_empaque,
        items: itemsConsolidados
      };

      this.modalService.open(this.etiquetaTemplate, { size: 'lg' });

    } catch (err) {
      console.error("Error generando etiqueta:", err);
    }
  }

  async descargarEtiquetaImagen() {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const element = document.getElementById('etiquetaContenido');
      
      if (!element) {
        console.error('No se encontró el elemento de la etiqueta');
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#f8f9fa',
        logging: false
      });

      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = image;
      link.download = `Etiqueta_${this.etiquetaData.numero_empaque}_${new Date().getTime()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error al generar imagen:', error);
    }
  }

  imprimirEtiqueta() {
    const contenido = document.getElementById('etiquetaContenido')?.innerHTML;
    if (!contenido) return;
    
    const estilos = `
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0; 
          padding: 20px; 
          background: #f8f9fa;
        }
        .etiqueta-imprimir {
          border: 2px solid #000;
          padding: 20px;
          background: white;
          max-width: 800px;
          margin: 0 auto;
        }
        .encabezado { 
          border-bottom: 2px solid #000; 
          padding-bottom: 10px; 
          margin-bottom: 15px;
        }
        .barcode-text {
          font-family: 'Courier New', monospace;
          letter-spacing: 2px;
          font-weight: bold;
        }
        .barcode-lines {
          display: flex;
          justify-content: center;
          gap: 2px;
          margin: 5px 0;
        }
        .barcode-line {
          height: 40px;
          background: black;
          margin: 0 1px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th {
          background: #343a40;
          color: white;
          padding: 8px;
        }
        td {
          padding: 6px;
          border: 1px solid #dee2e6;
        }
        .total-row {
          background: #e9ecef;
          font-weight: bold;
        }
      </style>
    `;

    const ventana = window.open('', '_blank');
    if (!ventana) return;
    
    ventana.document.write(`
      <html>
        <head>
          <title>Etiqueta ${this.etiquetaData.numero_empaque}</title>
          ${estilos}
        </head>
        <body>
          <div class="etiqueta-imprimir">
            ${contenido}
          </div>
          <script>
            window.onload = function() { 
              window.focus();
              window.print(); 
            }
          </script>
        </body>
      </html>
    `);
    ventana.document.close();
  }

  // async generarQR(empaque: any) {
  //   console.log('Generando QR para empaque:', empaque);
  //   try {
  //     // 1. Consolidar items (sumar cantidades por item_id + id_talla)
  //     const itemsMap = new Map<string, any>();

  //     for (const item of empaque.items) {
  //       const key = `${item.item_id}_${item.id_talla}`;
  //       if (!itemsMap.has(key)) {
  //         itemsMap.set(key, {
  //           descripcion: item.descripcion,
  //           talla: item.id_talla,
  //           cantidad: parseFloat(item.cantidad)
  //         });
  //       } else {
  //         itemsMap.get(key).cantidad += parseFloat(item.cantidad);
  //       }
  //     }

  //     const itemsConsolidados = Array.from(itemsMap.values());

  //     let EmpacadorNombre = 'N/A';
  //     await new Promise<void>((resolve) => {
  //       this.userService.getById(empaque.empacador_id).subscribe({
  //         next: (user) => {
  //           EmpacadorNombre = (user.firstName && user.lastName)
  //             ? `${user.firstName} ${user.lastName}`
  //             : 'N/A';
  //           resolve();
  //         },
  //         error: () => {
  //           EmpacadorNombre = 'N/A';
  //           resolve();
  //         }
  //       });
  //     });

  //     // 2. Formatear el texto legible - asegurar UTF-8
  //     let qrText = `OP: ${empaque.op || 'N/A'}\n`;
  //     qrText += `PV: ${empaque.pv || 'N/A'}\n`;
  //     qrText += `OC: ${empaque.oc || 'N/A'}\n`;
  //     qrText += `Cliente: ${empaque.cliente || 'N/A'}\n`;
  //     qrText += `Empacador: ${EmpacadorNombre}\n`;
  //     qrText += `Tipo Empaque: ${empaque.tipo_empaque}\n`;
  //     qrText += `Número Empaque: ${empaque.numero_empaque}\n\n`;
  //     qrText += `Items:\n`;

  //     itemsConsolidados.forEach(it => {
  //       qrText += `- ${it.descripcion} (Talla: ${it.talla}) -> ${it.cantidad}\n`;
  //     });

  //     // 3. Convertir explícitamente a UTF-8 usando TextEncoder
  //     const encoder = new TextEncoder();
  //     const utf8Bytes = encoder.encode(qrText);
  //     const utf8Text = new TextDecoder('utf-8').decode(utf8Bytes);

  //     // 4. Generar QR con configuración UTF-8
  //     this.qrImageUrl = await QRCode.toDataURL(utf8Text, {
  //       errorCorrectionLevel: 'M', // Cambiado de 'L' a 'M' para mejor corrección
  //       margin: 2,
  //       scale: 8,
  //       width: 350,
  //       type: 'image/png',
  //       color: {
  //         dark: '#000000',
  //         light: '#FFFFFF'
  //       }
  //     });

  //     // 5. Guardar para mostrar en modal
  //     this.qrTitle = empaque.numero_empaque;
  //     this.qrSubtitle = empaque.tipo_empaque;
  //     this.qrType = empaque.tipo_empaque;
  //     this.qrCode = empaque.numero_empaque;
  //     this.qrCliente = empaque.cliente || 'N/A';
  //     this.qrEmpacador = EmpacadorNombre;
  //     this.qrData = itemsConsolidados;

  //     // Abrir modal
  //     this.modalService.open(this.qrTemplate, { size: 'lg' });

  //   } catch (err) {
  //     console.error("Error generando QR:", err);
  //     console.error("Detalles del error:", err.message);
  //   }
  // }

  // descargarQR() {
  //   if (!this.qrImageUrl) return;
  //   const a = document.createElement('a');
  //   a.href = this.qrImageUrl;
  //   a.download = `QR_${this.qrCode}.png`;
  //   a.click();
  // }

  // imprimirQR() {
  //   if (!this.qrImageUrl) return;
  //   const w = window.open('', '_blank');
  //   if (!w) return;
  //   w.document.write(`
  //     <html><head></head>
  //     <body style="text-align:center; font-family: Arial;">
  //       <h3>Etiqueta ${this.qrCode}</h3>
  //       <img src="${this.qrImageUrl}" />
  //       <script>window.print();</script>
  //     </body></html>
  //   `);
  //   w.document.close();
  // }
}