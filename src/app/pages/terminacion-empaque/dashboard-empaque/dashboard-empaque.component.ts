import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { TerminacionEmpaqueService } from '../../../services/terminacion-empaque.service';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { forkJoin, firstValueFrom } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import * as bootstrap from 'bootstrap';
import Swal from 'sweetalert2';

interface User {
  id: number;
  nombre_completo: string;
  email: string;
  roles: { [key: number]: string };
}

interface ApiResponse {
  success: boolean;
  usuarios: User[];
}

interface OP {
  id: number;
  codigo: string;
  estado: string;
  fecha_creacion: string;
  descripcion: string;
  cantidad_total: number;
  progreso: number;
  pvs?: any[];
  pts?: any[];
}

@Component({
  selector: 'app-dashboard-empaque',
  templateUrl: './dashboard-empaque.component.html',
  styleUrls: ['./dashboard-empaque.component.css']
})
export class DashboardEmpaqueComponent implements OnInit {
  // Paginadores
  paginatorRegistrosId = 'dashboard-registros-paginator';
  paginatorItemsId = 'dashboard-items-paginator';
  paginatorEmpaquesId = 'dashboard-empaques-paginator';
  paginatorMovimientosId = 'dashboard-movimientos-paginator';

  // Filtros
  fechaInicio: string | null = null;
  fechaFin: string | null = null;
  empacadorFiltro: string = '';
  fechaFiltroOP: string = '';
  estadoFiltroOP: string = '';
  numeroOPFiltro: string = '';
  
  filtersRegistros = { busqueda: '' };
  filtersItems = { busqueda: '' };
  filtersEmpaques = { busqueda: '' };
  filtersMovimientos = { busqueda: '' };

  // Data
  kpis: any = {};
  registros: any[] = [];
  currentRegistros: any[] = [];
  empacadoresData: any[] = [];
  empacadoresList: User[] = [];
  kpisOP: any = {};
  opsData: OP[] = [];
  selectedOP: OP | null = null;
  searchTerm: string = '';
  currentPage: number = 1;
  pageSize: number = 10;
  expandedOPs: Set<string> = new Set();
  expandedPVs: Set<string> = new Set();
  filteredOPs: any[] = [];
  paginatedOPs: any[] = [];
  totalPages: number = 0;
  Math = Math;
  costosPorDia: number[] = [];

  // Modales
  selectedItem: any = null;
  selectedItemType: 'OP' | 'PV' = 'OP';
  modoDetallePV: 'recepcionado' | 'empacado' = 'recepcionado';
  empaquesPVDetalle: any[] = [];
  currentEmpaquesPV: any[] = [];
  expandedEmpaquesDetalle = new Set<string>();
  
  // Items consolidados
  itemsPVDetalle: any[] = [];
  currentItemsPV: any[] = [];

  // Edición empaques
  empaqueEditando: any = null;
  itemsEmpaqueEditando: any[] = [];

  editingField: { [key: string]: { [field: string]: boolean } } = {};
  tempValues: { [key: string]: any } = {};

  // Agregar esta propiedad
  empaqueForm = {
    numero_empaque: '',
    tipo_empaque: ''
  };

  // Movimientos
  movimientosPV: any[] = [];
  currentMovimientos: any[] = [];
  pvMovimientos: string = '';

  // Etiquetas
  etiquetaData: any = {};
  fechaActual = new Date();

  // Charts
  barChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: { y: { beginAtZero: true } }
  };
  barChartType: ChartType = 'bar';
  pieChartData: ChartData<'pie'> = { labels: [], datasets: [] };
  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: { legend: { position: 'right' } }
  };
  pieChartType: ChartType = 'pie';

  @ViewChild('etiquetaTemplate', { static: true }) etiquetaTemplate!: TemplateRef<any>;
  @ViewChild('modalEditarEmpaque', { static: true }) modalEditarEmpaque!: TemplateRef<any>;
  @ViewChild('modalMovimientos', { static: true }) modalMovimientos!: TemplateRef<any>;

  constructor(
    private empaqueService: TerminacionEmpaqueService, 
    private userService: UserService,
    private authService: AuthService,
    public paginationService: PaginationService,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.cargarDashboard();
    this.cargarDashboardOPs();
  }

  normalizeText(value: any): string {
    if (!value) return '';
    return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredOPs = [...this.opsData];
    } else {
      const term = this.normalizeText(this.searchTerm);
      this.filteredOPs = this.opsData.filter(op => {
        const opMatches = this.normalizeText(op.codigo).includes(term) || this.normalizeText(op.estado).includes(term);
        const pvMatches = op.pvs?.some(pv => {
          const pvCodeMatches = this.normalizeText(pv.codigo).includes(term);
          const itemMatches = pv.items?.some(item => 
            this.normalizeText(item.descripcion).includes(term) ||
            this.normalizeText(item.referencia).includes(term) ||
            this.normalizeText(item.id_talla).includes(term) ||
            this.normalizeText(item.id_item).includes(term)
          );
          const ptMatches = pv.pts?.some(pt => {
            const ptDirectMatches = this.normalizeText(pt.pt_codigo).includes(term) ||
              this.normalizeText(pt.descripcion).includes(term) ||
              this.normalizeText(pt.referencia).includes(term) ||
              this.normalizeText(pt.id_talla).includes(term) ||
              this.normalizeText(pt.id_item).includes(term);
            const ptItemMatches = pt.items?.some(item =>
              this.normalizeText(item.descripcion).includes(term) ||
              this.normalizeText(item.referencia).includes(term) ||
              this.normalizeText(item.id_talla).includes(term) ||
              this.normalizeText(item.id_item).includes(term)
            );
            return ptDirectMatches || ptItemMatches;
          });
          return pvCodeMatches || itemMatches || ptMatches;
        });
        return opMatches || pvMatches;
      });
    }
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredOPs.length / this.pageSize);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedOPs = this.filteredOPs.slice(startIndex, endIndex);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  getPages(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  setPageSize(event: any): void {
    this.pageSize = Number(event.target.value);
    this.updatePagination();
  }

  toggleOP(opCodigo: string): void {
    if (this.expandedOPs.has(opCodigo)) {
      this.expandedOPs.delete(opCodigo);
    } else {
      this.expandedOPs.add(opCodigo);
    }
  }

  togglePV(pvCodigo: string): void {
    if (this.expandedPVs.has(pvCodigo)) {
      this.expandedPVs.delete(pvCodigo);
    } else {
      this.expandedPVs.add(pvCodigo);
    }
  }

  getTotalPTs(op: any): number {
    return op.pvs?.reduce((acc: number, pv: any) => acc + (pv.pts?.length || 0), 0) || 0;
  }

  procesarDatosOPs(data: any) {
    this.kpisOP = data.kpis;
    this.opsData = (data.ops || []).map((op: any) => ({
      ...op,
      costo_total: parseFloat(op.costo_total) || 0,
      costo_real: parseFloat(op.costo_real) || 0,
      pvs: (op.pvs || []).map((pv: any) => ({
        ...pv,
        costo_total: parseFloat(pv.costo_total) || 0,
        costo_real: parseFloat(pv.costo_real) || 0,
        pts: (pv.pts || []).map((pt: any) => ({
          ...pt,
          costo_total: parseFloat(pt.costo_total) || 0,
          costo_real: parseFloat(pt.costo_real) || 0
        }))
      }))
    }));
    
    this.filteredOPs = [...this.opsData];
    this.updatePagination();
  }

  aplicarFiltros() {
    this.cargarDashboard();
  }

  aplicarFiltrosOP() {
    this.cargarDashboardOPs();
  }

  cargarDashboard() {
    forkJoin({
      empacadores: this.userService.getUserByRoles([16]),
      dashboard: this.empaqueService.getDashboardData({
        fechaInicio: this.fechaInicio,
        fechaFin: this.fechaFin,
        empacador: this.empacadorFiltro
      })
    }).subscribe(({ empacadores, dashboard }) => {
      if (Array.isArray(empacadores)) {
        this.empacadoresList = empacadores.map((u: any) => ({
          ...u,
          roles: Array.isArray(u.roles) ? u.roles.reduce((acc: any, role: any) => {
            acc[role.id] = role.nombre || role.name || String(role.id);
            return acc;
          }, {}) : u.roles
        }));
      } else if (empacadores && typeof empacadores === 'object' && 'usuarios' in empacadores) {
        this.empacadoresList = (empacadores as ApiResponse).usuarios;
      } else {
        this.empacadoresList = [];
      }
      this.procesarDatosDashboard(dashboard);
    });
  }

  cargarDashboardOPs() {
    this.empaqueService.getOPsDashboardData({
      fecha: this.fechaFiltroOP,
      estado: this.estadoFiltroOP,
      numero_op: this.numeroOPFiltro
    }).subscribe((data) => {
      this.procesarDatosOPs(data);
    });
  }

  procesarDatosDashboard(data: any) {
    this.kpis = data.kpis;
    this.actualizarGraficoBarras(data.registros_por_dia);
    const empacadoresIds = this.empacadoresList.map(e => e.id);
    this.empacadoresData = (data.por_empacador || []).filter((emp: any) => 
      empacadoresIds.includes(emp.empacador_id)
    );
    this.actualizarGraficoPie();
    this.registros = (data.detalle || []).filter((reg: any) => 
      empacadoresIds.includes(reg.empacador_id)
    );
    
    // Inicializar paginador de registros
    this.paginationService.initializePaginator(
      this.paginatorRegistrosId,
      this.registros,
      10,
      this.filtersRegistros,
      this.filterFunctionGenerico
    ).subscribe(state => this.currentRegistros = state.currentData);
  }

  actualizarGraficoBarras(registrosPorDia: any[]) {
    this.barChartData = {
      labels: [],
      datasets: [{ label: 'Ítems empacados', data: [], backgroundColor: '#007bff' }]
    };
    this.costosPorDia = [];
    registrosPorDia.forEach(dia => {
      this.barChartData.labels?.push(dia.fecha);
      this.barChartData.datasets[0].data.push(dia.total_items);
      this.costosPorDia.push(dia.total_costo);
    });
    this.barChartOptions = {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const index = context.dataIndex;
              const items = context.parsed.y;
              const costo = this.costosPorDia[index];
              return `Ítems: ${items} | Costo: $${costo.toLocaleString()}`;
            }
          }
        }
      }
    };
  }

  actualizarGraficoPie() {
    this.pieChartData = {
      labels: [],
      datasets: [{ data: [], backgroundColor: this.generarColores(this.empacadoresData.length) }]
    };
    this.empacadoresData.forEach(emp => {
      const nombre = this.getNombreEmpacador(emp.empacador_id);
      this.pieChartData.labels?.push(nombre);
      this.pieChartData.datasets[0].data.push(emp.total_items);
    });
  }

  generarColores(cantidad: number): string[] {
    const colores = [];
    const hueStep = 360 / cantidad;
    for (let i = 0; i < cantidad; i++) {
      const hue = i * hueStep;
      colores.push(`hsl(${hue}, 70%, 50%)`);
    }
    return colores;
  }

  getNombreEmpacador(id: number): string {
    const empacador = this.empacadoresList.find(e => e.id === id);
    return empacador ? empacador.nombre_completo : `Empacador ${id}`;
  }

  verDetalle(item: any, type: 'OP' | 'PV'): void {
    this.selectedItem = item;
    this.selectedItemType = type;
    const modalElement = document.getElementById('detailModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  verDetalleOP(op: any, type: 'OP' = 'OP'): void {
    this.verDetalle(op, type);
  }

  verDetallePV(pv: any, type: 'PV' = 'PV', op: any): void {
    console.log('Ver detalle PV:', pv, 'de OP:', op);
    this.selectedOP = op;
    this.modoDetallePV = 'recepcionado';
    this.verDetalle(pv, type);
    this.cargarEmpaquesPVDetalle(pv);
    this.cargarItemsPVDetalle(pv);
  }

  cargarItemsPVDetalle(pv: any): void {
    if (!pv || !pv.codigo) return;
    
    // Consolidar items de PV
    const itemsMap = new Map<string, any>();
    
    if (pv.items && pv.items.length > 0) {
      pv.items.forEach((item: any) => {
        const key = `${item.referencia}_${item.id_talla}`;
        if (!itemsMap.has(key)) {
          itemsMap.set(key, {
            ...item,
            cantidad_teorica: parseFloat(item.cantidad_teorica || 0),
            cantidad_empacada: parseFloat(item.cantidad_empacada || 0),
            es_pt: false
          });
        } else {
          const existing = itemsMap.get(key);
          existing.cantidad_teorica += parseFloat(item.cantidad_teorica || 0);
          existing.cantidad_empacada += parseFloat(item.cantidad_empacada || 0);
        }
      });
    }

    // Agregar items de PTs
    if (pv.pts && pv.pts.length > 0) {
      pv.pts.forEach((pt: any) => {
        if (pt.items && pt.items.length > 0) {
          pt.items.forEach((item: any) => {
            const key = `${item.referencia}_${item.id_talla}`;
            if (!itemsMap.has(key)) {
              itemsMap.set(key, {
                ...item,
                cantidad_teorica: parseFloat(item.cantidad_teorica || 0),
                cantidad_recibida: parseFloat(item.cantidad_recibida || 0),
                es_pt: true
              });
            } else {
              const existing = itemsMap.get(key);
              existing.cantidad_teorica += parseFloat(item.cantidad_teorica || 0);
              existing.cantidad_recibida = (existing.cantidad_recibida || 0) + parseFloat(item.cantidad_recibida || 0);
              existing.es_pt = true;
            }
          });
        }
      });
    }

    this.itemsPVDetalle = Array.from(itemsMap.values());

    this.paginationService.initializePaginator(
      this.paginatorItemsId,
      this.itemsPVDetalle,
      10,
      this.filtersItems,
      this.filterFunctionGenerico
    ).subscribe(state => this.currentItemsPV = state.currentData);
  }

  cambiarModoDetallePV(modo: 'recepcionado' | 'empacado'): void {
    this.modoDetallePV = modo;
    if (modo === 'empacado' && this.empaquesPVDetalle.length === 0) {
      this.cargarEmpaquesPVDetalle(this.selectedItem);
    }
  }

  cargarEmpaquesPVDetalle(pv: any): void {
    if (!pv || !pv.codigo) return;
    this.empaqueService.EmpaquesPorPV(pv.codigo).subscribe({
      next: (res: any) => {
        if (res.success && res.data && res.data.length > 0) {
          this.empaquesPVDetalle = res.data.map(empaque => ({
            ...empaque,
            codigoOriginal: empaque.numero_empaque
          }));

          this.paginationService.initializePaginator(
            this.paginatorEmpaquesId,
            this.empaquesPVDetalle,
            5,
            this.filtersEmpaques,
            this.filterFunctionGenerico
          ).subscribe(state => this.currentEmpaquesPV = state.currentData);
        } else {
          this.empaquesPVDetalle = [];
          this.currentEmpaquesPV = [];
        }
      },
      error: () => {
        this.empaquesPVDetalle = [];
        this.currentEmpaquesPV = [];
      }
    });
  }

  toggleEmpaqueDetalle(numeroEmpaque: string): void {
    if (this.expandedEmpaquesDetalle.has(numeroEmpaque)) {
      this.expandedEmpaquesDetalle.delete(numeroEmpaque);
    } else {
      this.expandedEmpaquesDetalle.add(numeroEmpaque);
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

iniciarEdicionCampo(empaque: any, campo: string): void {
  const key = empaque.numero_empaque;
  
  if (!this.editingField[key]) {
    this.editingField[key] = {};
  }
  
  if (!this.tempValues[key]) {
    this.tempValues[key] = {};
  }
  
  // Guardar valor original
  if (campo === 'numero') {
    this.tempValues[key].numero = empaque.numero_empaque;
    this.tempValues[key].numeroOriginal = empaque.numero_empaque;
  } else if (campo === 'tipo') {
    this.tempValues[key].tipo = empaque.tipo_empaque;
    this.tempValues[key].tipoOriginal = empaque.tipo_empaque;
  }
  
  this.editingField[key][campo] = true;
  
  // Focus después del render
  setTimeout(() => {
    const inputId = campo === 'numero' 
      ? `input-numero-${key}` 
      : `select-tipo-${key}`;
    const element = document.getElementById(inputId) as HTMLInputElement;
    if (element) {
      element.focus();
      if (element.select) {
        element.select();
      }
    }
  }, 0);
}

iniciarEdicionCantidad(item: any): void {
  const key = item.id;
  
  if (!this.editingField[key]) {
    this.editingField[key] = {};
  }
  
  if (!this.tempValues[key]) {
    this.tempValues[key] = {};
  }
  
  this.tempValues[key].cantidad = item.cantidad;
  this.tempValues[key].cantidadOriginal = item.cantidad;
  this.editingField[key].cantidad = true;
  
  setTimeout(() => {
    const element = document.getElementById(`input-cantidad-${key}`) as HTMLInputElement;
    if (element) {
      element.focus();
      element.select();
    }
  }, 0);
}

cancelarEdicion(item: any, campo: string): void {
  const key = item.numero_empaque || item.id;
  
  if (this.editingField[key]) {
    this.editingField[key][campo] = false;
  }
  
  // Restaurar valor original
  if (campo === 'numero') {
    this.tempValues[key].numero = this.tempValues[key].numeroOriginal;
  } else if (campo === 'tipo') {
    this.tempValues[key].tipo = this.tempValues[key].tipoOriginal;
  } else if (campo === 'cantidad') {
    this.tempValues[key].cantidad = this.tempValues[key].cantidadOriginal;
  }
}

async guardarCampo(empaque: any, campo: string): Promise<void> {
  const key = empaque.numero_empaque;
  const valorNuevo = campo === 'numero' 
    ? this.tempValues[key].numero 
    : this.tempValues[key].tipo;
  const valorOriginal = campo === 'numero'
    ? this.tempValues[key].numeroOriginal
    : this.tempValues[key].tipoOriginal;
  
  // Si no cambió, solo cerrar edición
  if (valorNuevo === valorOriginal) {
    this.editingField[key][campo] = false;
    return;
  }
  
  // Validaciones
  if (campo === 'numero' && !valorNuevo?.trim()) {
    Swal.fire('Error', 'El número de empaque no puede estar vacío', 'error');
    this.cancelarEdicion(empaque, campo);
    return;
  }
  
  const result = await Swal.fire({
    title: '¿Confirmar cambio?',
    text: `${campo === 'numero' ? 'Número' : 'Tipo'}: "${valorOriginal}" → "${valorNuevo}"`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, cambiar',
    cancelButtonText: 'Cancelar'
  });
  
  if (!result.isConfirmed) {
    this.cancelarEdicion(empaque, campo);
    return;
  }
  
  // CORRECCIÓN: Siempre usar el número de empaque original (no el valor original del campo que cambia)
  const numeroEmpaqueOriginal = this.tempValues[key].numeroOriginal;
  console.log(this.tempValues)
  
  const datos = {
    op_codigo: this.selectedOP,
    pv_codigo: this.selectedItem?.codigo,
    numero_empaque_original: numeroEmpaqueOriginal, // SIEMPRE el número original del empaque
    numero_empaque: campo === 'numero' ? valorNuevo : empaque.numero_empaque,
    tipo_empaque: campo === 'tipo' ? valorNuevo : empaque.tipo_empaque,
    campo_actualizar: campo
  };
  
  // Para enviar los hashes si tienes los items
  // Agregar items al request si están disponibles
  if (this.itemsEmpaqueEditando) {
    datos['items'] = this.itemsEmpaqueEditando.map((item: any) => ({
      f120_id: item.f120_id,
      id_color: item.id_color,
      id_talla: item.id_talla
    }));
  }
  console.log('Datos a enviar para actualizar empaque:', datos);
  this.empaqueService.actualizarCampoEmpaque(datos).subscribe({
    next: (response: any) => {
      Swal.fire({
        icon: 'success',
        title: 'Actualizado',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      });
      
      // Actualizar el objeto local
      if (campo === 'numero') {
        empaque.numero_empaque = valorNuevo;
      } else {
        empaque.tipo_empaque = valorNuevo;
      }
      
      this.editingField[key][campo] = false;
      this.cargarEmpaquesPVDetalle(this.selectedItem);
    },
    error: (err) => {
      Swal.fire('Error', err.error?.error || 'No se pudo actualizar', 'error');
      this.cancelarEdicion(empaque, campo);
    }
  });
}

async guardarCantidadItem(empaque: any, item: any): Promise<void> {
  const key = item.id;
  const cantidadNueva = Number(this.tempValues[key].cantidad);
  const cantidadOriginal = this.tempValues[key].cantidadOriginal;
  
  // Si no cambió, solo cerrar edición
  if (cantidadNueva === cantidadOriginal) {
    this.editingField[key].cantidad = false;
    return;
  }
  
  // Validaciones
  if (!cantidadNueva || cantidadNueva < 1) {
    Swal.fire('Error', 'La cantidad debe ser mayor a 0', 'error');
    this.cancelarEdicion(item, 'cantidad');
    return;
  }
  
  const result = await Swal.fire({
    title: '¿Confirmar cambio?',
    text: `Cantidad: ${cantidadOriginal} → ${cantidadNueva}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, cambiar',
    cancelButtonText: 'Cancelar'
  });
  
  if (!result.isConfirmed) {
    this.cancelarEdicion(item, 'cantidad');
    return;
  }

  console.log('Datos de el item:', {item});
  
  const datos = {
    op_codigo: this.selectedOP,
    pv_codigo: this.selectedItem?.codigo,
    numero_empaque: empaque.numero_empaque,
    item_id: item.id,
    descripcion: item.descripcion,
    referencia: item.referencia,
    cantidad: cantidadNueva
  };
  
  this.empaqueService.actualizarCantidadItem(datos).subscribe({
    next: () => {
      Swal.fire({
        icon: 'success',
        title: 'Cantidad actualizada',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      });
      
      // Actualizar el objeto local
      item.cantidad = cantidadNueva;
      this.editingField[key].cantidad = false;
    },
    error: (err) => {
      Swal.fire('Error', err.error?.error || 'No se pudo actualizar', 'error');
      this.cancelarEdicion(item, 'cantidad');
    }
  });
}

  abrirEditarEmpaque(empaque: any): void {
    this.empaqueEditando = { ...empaque };
    
    this.empaqueForm = {
      numero_empaque: empaque.numero_empaque,
      tipo_empaque: empaque.tipo_empaque
    };
    
    // Crear copia profunda de items
    this.itemsEmpaqueEditando = JSON.parse(JSON.stringify(empaque.items.map((item: any) => ({
      id: item.id || `${item.item_id}_${item.id_talla}`,
      item_id: item.item_id,
      referencia: item.referencia || item.item_id,
      descripcion: item.descripcion,
      id_talla: item.id_talla,
      id_color: item.id_color,
      cantidad: Number(item.cantidad)
    }))));
    
    this.modalService.open(this.modalEditarEmpaque, { 
      size: 'lg',
      backdrop: 'static'
    });
  }

  // eliminarItemEmpaque(index: number): void {
  //   Swal.fire({
  //     title: '¿Eliminar item?',
  //     text: 'Esta acción no se puede deshacer',
  //     icon: 'warning',
  //     showCancelButton: true,
  //     confirmButtonText: 'Sí, eliminar',
  //     cancelButtonText: 'Cancelar'
  //   }).then((result) => {
  //     if (result.isConfirmed) {
  //       this.itemsEmpaqueEditando.splice(index, 1);
  //     }
  //   });
  // }

  eliminarItemEmpaque(index: number): void {
    Swal.fire({
      title: '¿Eliminar item?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const itemAEliminar = this.itemsEmpaqueEditando[index];
        
        this.empaqueService.eliminarRegistroEmpaque(
          this.empaqueEditando.numero_empaque,
          itemAEliminar.item_id,
          itemAEliminar.id_talla
        ).subscribe({
          next: () => {
            this.itemsEmpaqueEditando.splice(index, 1);
            Swal.fire('Eliminado', 'Item eliminado correctamente', 'success');
          },
          error: (err) => {
            Swal.fire('Error', err.error?.error || 'No se pudo eliminar', 'error');
          }
        });
      }
    });
  }

  eliminarEmpaqueCompleto(empaque: any): void {
    Swal.fire({
      title: '¿Eliminar empaque completo?',
      html: `Se eliminará el empaque <strong>${empaque.numero_empaque}</strong> con todos sus items`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      confirmButtonColor: '#d33',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.empaqueService.eliminarEmpaqueCompleto(empaque.numero_empaque).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Empaque eliminado correctamente', 'success');
            this.cargarEmpaquesPVDetalle(this.selectedItem);
          },
          error: (err) => {
            Swal.fire('Error', err.error?.error || 'No se pudo eliminar', 'error');
          }
        });
      }
    });
  }

  // guardarCambiosEmpaque(): void {
  //   // Validar que haya al menos un item
  //   if (this.itemsEmpaqueEditando.length === 0) {
  //     Swal.fire('Error', 'Debe haber al menos un item en el empaque', 'error');
  //     return;
  //   }

  //   const cambios = {
  //     numero_empaque: this.empaqueEditando.numero_empaque,
  //     tipo_empaque: this.empaqueEditando.tipo_empaque,
  //     items: this.itemsEmpaqueEditando
  //   };

  //   // Aquí iría la llamada al servicio para guardar
  //   console.log('Guardando cambios:', cambios);
    
  //   Swal.fire('Éxito', 'Cambios guardados correctamente', 'success').then(() => {
  //     this.modalService.dismissAll();
  //     this.cargarEmpaquesPVDetalle(this.selectedItem);
  //   });
  // }

  // guardarCambiosEmpaque(): void {
  //   if (this.itemsEmpaqueEditando.length === 0) {
  //     Swal.fire('Error', 'Debe haber al menos un item en el empaque', 'error');
  //     return;
  //   }

  //   // Validar cantidades
  //   const cantidadesInvalidas = this.itemsEmpaqueEditando.some(item => 
  //     !item.cantidad || item.cantidad <= 0
  //   );
    
  //   if (cantidadesInvalidas) {
  //     Swal.fire('Error', 'Todas las cantidades deben ser mayores a 0', 'error');
  //     return;
  //   }

  //   const cambios = {
  //     op_codigo: this.selectedOP,
  //     pv_codigo: this.selectedItem.codigo,
  //     numero_empaque_original: this.empaqueEditando.codigoOriginal || this.empaqueEditando.numero_empaque,
  //     numero_empaque: this.empaqueForm.numero_empaque,
  //     tipo_empaque: this.empaqueForm.tipo_empaque,
  //     items: this.itemsEmpaqueEditando.map(item => ({
  //       id: item.id,
  //       item_id: item.item_id,
  //       referencia: item.referencia,
  //       id_talla: item.id_talla,
  //       cantidad: Number(item.cantidad)
  //     })),
  //     usuario_id: this.authService.user.id
  //   };

  //   this.empaqueService.actualizarEmpaqueCompleto(cambios).subscribe({
  //     next: () => {
  //       Swal.fire('Éxito', 'Cambios guardados correctamente', 'success');
  //       this.modalService.dismissAll();
  //       this.cargarEmpaquesPVDetalle(this.selectedItem);
  //     },
  //     error: (err) => {
  //       Swal.fire('Error', err.error?.error || 'Hubo un problema al guardar', 'error');
  //     }
  //   });
  // }

  async generarEtiquetaEmpaque(empaque: any): Promise<void> {
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
    let empacadorNombre = 'N/A';
    
    if (empaque.empacador_id) {
      await new Promise<void>((resolve) => {
        this.userService.getById(empaque.empacador_id).subscribe({
          next: (user) => {
            empacadorNombre = (user.firstName && user.lastName)
              ? `${user.firstName} ${user.lastName}`
              : 'N/A';
            resolve();
          },
          error: () => {
            empacadorNombre = 'N/A';
            resolve();
          }
        });
      });
    }

    this.etiquetaData = {
      op: empaque.op || this.selectedOP?.codigo || 'N/A',
      pv: empaque.pv || this.selectedItem?.codigo || 'N/A',
      oc: empaque.oc || 'N/A',
      cliente: empaque.cliente || 'N/A',
      empacador: empacadorNombre,
      tipo_empaque: empaque.tipo_empaque,
      numero_empaque: empaque.numero_empaque,
      items: itemsConsolidados
    };

    this.modalService.open(this.etiquetaTemplate, { size: 'lg' });
  }

  calcularTotalItems(): number {
    if (!this.etiquetaData.items) return 0;
    return this.etiquetaData.items.reduce((total: number, item: any) => total + item.cantidad, 0);
  }

  async descargarEtiquetaImagen() {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const element = document.getElementById('etiquetaContenido');
      if (!element) return;
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
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .etiqueta-imprimir { border: 2px solid #000; padding: 20px; background: white; max-width: 800px; margin: 0 auto; }
        .encabezado { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #343a40; color: white; padding: 8px; }
        td { padding: 6px; border: 1px solid #dee2e6; }
        .total-row { background: #e9ecef; font-weight: bold; }
      </style>
    `;
    const ventana = window.open('', '_blank');
    if (!ventana) return;
    ventana.document.write(`
      <html>
        <head><title>Etiqueta ${this.etiquetaData.numero_empaque}</title>${estilos}</head>
        <body>
          <div class="etiqueta-imprimir">${contenido}</div>
          <script>window.onload = function() { window.focus(); window.print(); }</script>
        </body>
      </html>
    `);
    ventana.document.close();
  }

  verMovimientosPV(pv: any): void {
    this.pvMovimientos = pv.codigo;
    
    this.empaqueService.getMovimientosPorPV(pv.codigo).subscribe({
      next: (response: any) => {
        this.movimientosPV = response.data || [];
        
        this.paginationService.initializePaginator(
          this.paginatorMovimientosId,
          this.movimientosPV,
          10,
          this.filtersMovimientos,
          this.filterFunctionGenerico
        ).subscribe(state => this.currentMovimientos = state.currentData);

        this.modalService.open(this.modalMovimientos, { size: 'xl' });
      },
      error: (err) => {
        Swal.fire('Error', 'No se pudieron cargar los movimientos', 'error');
      }
    });
  }

  aplicarFiltrosRegistros(): void {
    this.paginationService.updatePaginator(
      this.paginatorRegistrosId,
      this.registros,
      undefined,
      this.filtersRegistros,
      this.filterFunctionGenerico
    );
  }

  aplicarFiltrosItems(): void {
    this.paginationService.updatePaginator(
      this.paginatorItemsId,
      this.itemsPVDetalle,
      undefined,
      this.filtersItems,
      this.filterFunctionGenerico
    );
  }

  aplicarFiltrosEmpaques(): void {
    this.paginationService.updatePaginator(
      this.paginatorEmpaquesId,
      this.empaquesPVDetalle,
      undefined,
      this.filtersEmpaques,
      this.filterFunctionGenerico
    );
  }

  aplicarFiltrosMovimientos(): void {
    this.paginationService.updatePaginator(
      this.paginatorMovimientosId,
      this.movimientosPV,
      undefined,
      this.filtersMovimientos,
      this.filterFunctionGenerico
    );
  }

  filterFunctionGenerico: FilterFunction = (item, filtros) => {
    const texto = filtros.busqueda.toLowerCase();
    return !texto || Object.values(item).some(v => v?.toString().toLowerCase().includes(texto));
  };

  getPVTotalPTsCost(pv: any): number {
    return (pv.pts || []).reduce((sum: number, pt: any) => 
      sum + (parseFloat(pt.costo_total) || 0), 0
    );
  }

  getPVRealPTsCost(pv: any): number {
    return (pv.pts || []).reduce((sum: number, pt: any) => 
      sum + (parseFloat(pt.costo_real) || 0), 0
    );
  }

  getOPTotalPTsCost(op: any): number {
    return (op.pvs || []).reduce((sum: number, pv: any) => 
      sum + this.getPVTotalPTsCost(pv), 0
    );
  }

  getOPRealPTsCost(op: any): number {
    return (op.pvs || []).reduce((sum: number, pv: any) => 
      sum + this.getPVRealPTsCost(pv), 0
    );
  }

  getCostoTotal(pv: any): number {
    return (parseFloat(pv.costo_real) || 0) + this.getPVRealPTsCost(pv);
  }

  getSelectedItemInfo(): any {
    if (!this.selectedItem) return {};
    if (this.selectedItemType === 'OP') {
      return {
        title: `OP-${this.selectedItem.codigo}`,
        subtitle: 'Orden de Producción',
        details: [
          { label: 'Estado', value: this.selectedItem.estado },
          { label: 'Cantidad Total', value: this.selectedItem.cantidad_total },
          { label: 'Progreso', value: `${this.selectedItem.progreso || 0}%` },
          { label: 'Fecha Creación', value: new Date(this.selectedItem.fecha_creacion).toLocaleDateString() },
          { label: 'Total PVs', value: this.selectedItem.pvs?.length || 0 },
          { label: 'Total PTs', value: this.getTotalPTs(this.selectedItem) }
        ]
      };
    } else {
      return {
        title: `PV-${this.selectedItem.codigo}`,
        subtitle: 'Pedido de Venta',
        details: [
          { label: 'Código PV', value: this.selectedItem.codigo },
          { label: 'Total Items', value: this.selectedItem.items?.length || 0 },
          { label: 'Total PTs', value: this.selectedItem.pts?.length || 0 }
        ]
      };
    }
  }
}