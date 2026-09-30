import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ComercialService, ClienteSiesa, Solicitud } from '../../../services/comercial.service';
import { OrdenCompraService } from '../../../services/orden-compra.service';
import { FileService } from '../../../services/file.service';
import { PaginationService, PaginationState } from '../../../shared/pagination/pagination.service';
import { Subscription, forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

interface ClienteConPendientes extends ClienteSiesa {
  solicitudes_pendientes: number;
  oc_pendientes: number;
  en_costeo: number;
}

@Component({
  selector: 'app-cliente-list',
  templateUrl: './cliente-list.component.html',
  styleUrls: ['./cliente-list.component.css']
})
export class ClienteListComponent implements OnInit, OnDestroy {
  // Tabs: solicitudes | clientes | ordenes
  viewMode: 'solicitudes' | 'clientes' | 'ordenes' = 'solicitudes';
  showAllClientes = false;

  // Clientes
  clientes: ClienteSiesa[] = [];
  clientesConPendientes: ClienteConPendientes[] = [];
  filteredClientes: ClienteConPendientes[] = [];
  pagedClientes: ClienteConPendientes[] = [];
  searchTerm = '';
  isLoading = false;

  // Solicitudes
  solicitudes: Solicitud[] = [];
  filteredSolicitudes: Solicitud[] = [];
  pagedSolicitudes: Solicitud[] = [];
  solicitudSearch = '';
  solicitudEstadoFilter = '';
  solicitudTipoFilter: '' | 'costeo' | 'muestra' = '';
  isLoadingSolicitudes = false;

  // Dedicated Costeos View
  filteredCosteos: Solicitud[] = [];
  pagedCosteos: Solicitud[] = [];
  costeoSearch = '';
  costeoEstadoFilter = '';

  // Dedicated Muestras View
  filteredMuestras: Solicitud[] = [];
  pagedMuestras: Solicitud[] = [];
  muestraSearch = '';
  muestraEstadoFilter = '';

  // Órdenes de Compra
  ordenes: any[] = [];
  filteredOrdenes: any[] = [];
  pagedOrdenes: any[] = [];
  ordenSearch = '';
  ordenEstadoFilter = '';
  isLoadingOrdenes = false;
  estadisticasOC: any = null;

  // Modal Documento OC
  mostrarModalDocumento = false;
  documentoUrl: SafeResourceUrl | null = null;
  documentoOrdenNumero = '';
  isLoadingDocument = false;

  // Modal Detalle e Ítems OC
  mostrarModalDetalleOC = false;
  ordenSeleccionada: any = null;
  itemsOrdenSeleccionada: any[] = [];
  isLoadingDetalleOC = false;

  // Acciones OC
  isBuscandoPVSiesa = false;
  mostrarModalRechazo = false;
  ordenARechazar: any = null;
  motivoRechazo = '';

  // KPI computed
  totalSolicitudesPendientes = 0;
  totalOCPendientes = 0;
  costeoStats = { total: 0, sinIniciar: 0, enProceso: 0, completados: 0 };
  muestraStats = { total: 0, sinIniciar: 0, enProceso: 0, completados: 0 };

  // Pagination
  readonly clientesPaginatorId = 'comerciales-clientes';
  readonly solicitudesPaginatorId = 'comerciales-solicitudes-list';
  readonly costeosPaginatorId = 'comerciales-costeos-list';
  readonly muestrasPaginatorId = 'comerciales-muestras-list';
  readonly ordenesPaginatorId = 'comerciales-ordenes-list';
  private paginationSubs: Subscription[] = [];

  constructor(
    private comercialService: ComercialService,
    private ordenCompraService: OrdenCompraService,
    private fileService: FileService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private route: ActivatedRoute,
    public paginationService: PaginationService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    const mode = this.route.snapshot.data['mode'];
    if (mode === 'solicitudes') {
      this.viewMode = 'solicitudes';
      this.loadSolicitudes();
    } else {
      this.loadAllData();
    }
  }

  private loadTailwind(): void {
    if (!this.document.getElementById('tw-cdn-comerciales')) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      link.id = 'tw-cdn-comerciales';
      this.document.head.appendChild(link);
    }
    if (!this.document.getElementById('bi-cdn-comerciales')) {
      const icons = this.document.createElement('link');
      icons.rel = 'stylesheet';
      icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
      icons.id = 'bi-cdn-comerciales';
      this.document.head.appendChild(icons);
    }
  }

  ngOnDestroy(): void {
    this.paginationSubs.forEach(s => s.unsubscribe());
    this.paginationService.destroyPaginator(this.clientesPaginatorId);
    this.paginationService.destroyPaginator(this.solicitudesPaginatorId);
    this.paginationService.destroyPaginator(this.costeosPaginatorId);
    this.paginationService.destroyPaginator(this.muestrasPaginatorId);
    this.paginationService.destroyPaginator(this.ordenesPaginatorId);
  }

  // ==================== LOAD ALL DATA ====================
  loadAllData(): void {
    this.isLoading = true;
    forkJoin({
      solicitudes: this.comercialService.listarSolicitudes(),
      ordenes: this.ordenCompraService.obtenerOrdenes()
    }).subscribe({
      next: (results) => {
        this.solicitudes = results.solicitudes.data || [];
        this.ordenes = results.ordenes.data || [];
        this.buildClientesConPendientes();
        this.computeKPIs();
        this.applyClienteFilters();
        this.applySolicitudFilters();
        this.applyCosteoFilters();
        this.applyMuestraFilters();
        this.applyOrdenFilters();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        Swal.fire('Error', 'No se pudieron cargar los datos', 'error');
      }
    });
    this.ordenCompraService.obtenerEstadisticas().subscribe({
      next: (res) => { this.estadisticasOC = res.data; },
      error: () => {}
    });
  }

  private buildClientesConPendientes(): void {
    const clienteMap = new Map<string, ClienteConPendientes>();

    // Count pending solicitudes per client
    const pendientesEstados = ['BORRADOR', 'ENVIADO'];
    for (const sol of this.solicitudes) {
      if (pendientesEstados.includes(sol.estado || '') || sol.estado_costeo === 'EN_PROCESO' || sol.estado_muestra === 'EN_PROCESO') {
        const key = sol.cliente_nombre || 'Sin nombre';
        if (!clienteMap.has(key)) {
          clienteMap.set(key, {
            id: sol.cliente_id,
            nit: sol.cliente_nit || '',
            razon_social: sol.cliente_nombre,
            solicitudes_pendientes: 0,
            oc_pendientes: 0,
            en_costeo: 0,
          });
        }
        const c = clienteMap.get(key)!;
        c.solicitudes_pendientes++;
        if (sol.estado_costeo === 'EN_PROCESO') {
          c.en_costeo++;
        }
      }
    }

    // Count pending OC per client
    for (const oc of this.ordenes) {
      if (oc.estado === 'PENDIENTE') {
        const key = oc.cliente || 'Sin nombre';
        if (!clienteMap.has(key)) {
          clienteMap.set(key, {
            id: 0,
            nit: '',
            razon_social: oc.cliente,
            solicitudes_pendientes: 0,
            oc_pendientes: 0,
            en_costeo: 0,
          });
        }
        clienteMap.get(key)!.oc_pendientes++;
      }
    }

    this.clientesConPendientes = Array.from(clienteMap.values())
      .sort((a, b) => (b.solicitudes_pendientes + b.oc_pendientes) - (a.solicitudes_pendientes + a.oc_pendientes));
  }

  private computeKPIs(): void {
    const costeoSols = this.solicitudes.filter(s => !!s.requiere_costeo);
    this.costeoStats = {
      total: costeoSols.length,
      sinIniciar: costeoSols.filter(s => !s.estado_costeo || s.estado_costeo === 'PENDIENTE').length,
      enProceso: costeoSols.filter(s => s.estado_costeo === 'EN_PROCESO').length,
      completados: costeoSols.filter(s => s.estado_costeo === 'COMPLETADO').length,
    };

    const muestraSols = this.solicitudes.filter(s => !!s.requiere_muestra);
    this.muestraStats = {
      total: muestraSols.length,
      sinIniciar: muestraSols.filter(s => !s.estado_muestra || s.estado_muestra === 'PENDIENTE').length,
      enProceso: muestraSols.filter(s => s.estado_muestra === 'EN_PROCESO').length,
      completados: muestraSols.filter(s => s.estado_muestra === 'COMPLETADO').length,
    };

    this.totalSolicitudesPendientes = this.solicitudes.filter(s => ['BORRADOR', 'ENVIADO'].includes(s.estado || '')).length;
    this.totalOCPendientes = this.ordenes.filter(o => o.estado === 'PENDIENTE').length;
  }

  // ==================== TABS ====================
  switchView(mode: 'clientes' | 'solicitudes' | 'ordenes'): void {
    this.viewMode = mode;
    if (mode === 'solicitudes') {
      if (this.solicitudes.length === 0) {
        this.loadSolicitudes();
      } else {
        this.applySolicitudFilters();
      }
    }
    if (mode === 'ordenes') {
      if (this.ordenes.length === 0) {
        this.loadOrdenes();
      } else {
        this.applyOrdenFilters();
      }
    }
    if (mode === 'clientes' && this.clientesConPendientes.length === 0) this.loadAllData();
  }

  filterByTipo(tipo: '' | 'costeo' | 'muestra'): void {
    if (tipo === 'costeo') {
      this.router.navigate(['/costeos']);
    } else if (tipo === 'muestra') {
      this.router.navigate(['/muestras']);
    } else {
      this.solicitudTipoFilter = '';
      this.viewMode = 'solicitudes';
      this.applySolicitudFilters();
    }
  }

  // ==================== CLIENTES ====================
  loadClientes(): void {
    this.isLoading = true;
    this.comercialService.listarClientes().subscribe({
      next: (res) => {
        this.clientes = res.data || [];
        if (this.showAllClientes) {
          this.clientesConPendientes = this.clientes.map(c => ({
            ...c,
            solicitudes_pendientes: 0,
            oc_pendientes: 0,
            en_costeo: 0,
          }));
        }
        this.applyClienteFilters();
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los clientes', 'error');
        this.isLoading = false;
      }
    });
  }

  applyClienteFilters(): void {
    let result = [...this.clientesConPendientes];
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(c =>
        c.razon_social.toLowerCase().includes(term) ||
        c.nit?.toLowerCase().includes(term)
      );
    }
    this.filteredClientes = result;
    this.initClientesPaginator();
  }

  private initClientesPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.clientesPaginatorId, this.filteredClientes, 24)
      .subscribe((state: PaginationState) => {
        this.pagedClientes = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  goToCliente(cliente: ClienteConPendientes, targetTab: 'solicitudes' | 'items' | 'ordenes' = 'solicitudes'): void {
    this.router.navigate(['/comerciales/cliente', cliente.id], {
      queryParams: { nombre: cliente.razon_social, nit: cliente.nit, tab: targetTab }
    });
  }

  // ==================== SOLICITUDES ====================
  loadSolicitudes(): void {
    this.isLoadingSolicitudes = true;
    this.comercialService.listarSolicitudes().subscribe({
      next: (res) => {
        this.solicitudes = res.data || [];
        this.computeKPIs();
        this.applySolicitudFilters();
        this.applyCosteoFilters();
        this.applyMuestraFilters();
        this.isLoadingSolicitudes = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar las solicitudes', 'error');
        this.isLoadingSolicitudes = false;
      }
    });
  }

  applySolicitudFilters(): void {
    let result = [...this.solicitudes];
    if (this.solicitudSearch.trim()) {
      const term = this.solicitudSearch.toLowerCase();
      result = result.filter(c =>
        c.codigo?.toLowerCase().includes(term) ||
        c.cliente_nombre?.toLowerCase().includes(term)
      );
    }
    if (this.solicitudEstadoFilter) {
      result = result.filter(c => c.estado === this.solicitudEstadoFilter);
    }
    if (this.solicitudTipoFilter === 'costeo') {
      result = result.filter(c => c.requiere_costeo);
    } else if (this.solicitudTipoFilter === 'muestra') {
      result = result.filter(c => c.requiere_muestra);
    }
    this.filteredSolicitudes = result;
    this.initSolicitudesPaginator();
  }

  private initSolicitudesPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.solicitudesPaginatorId, this.filteredSolicitudes, 10)
      .subscribe((state: PaginationState) => {
        this.pagedSolicitudes = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  puedeVolverABorrador(sol: any): boolean {
    if (!sol || sol.estado === 'BORRADOR') return false;
    const costeoIniciado = !!sol.fecha_inicio_costeo || ['EN_PROCESO', 'COMPLETADO'].includes(sol.estado_costeo);
    const muestraIniciada = !!sol.fecha_inicio_muestra || ['EN_PROCESO', 'COMPLETADO'].includes(sol.estado_muestra);
    return !costeoIniciado && !muestraIniciada;
  }

  cambiarEstadoGlobal(sol: Solicitud, nuevoEstado: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!sol.id) return;
    this.comercialService.cambiarEstado(sol.id, nuevoEstado).subscribe({
      next: () => {
        sol.estado = nuevoEstado;
        if (nuevoEstado === 'BORRADOR') {
          if (sol.requiere_costeo) sol.estado_costeo = 'PENDIENTE';
          if (sol.requiere_muestra) sol.estado_muestra = 'PENDIENTE';
        }
        this.computeKPIs();
        this.applySolicitudFilters();
        const textMsg = nuevoEstado === 'BORRADOR'
          ? `La solicitud ${sol.codigo} regresó a estado BORRADOR`
          : `La solicitud ${sol.codigo} pasó a estado ${nuevoEstado}`;
        Swal.fire({ title: 'Estado Actualizado', text: textMsg, icon: 'success', timer: 1500, showConfirmButton: false });
      },
      error: (err) => {
        const errorMsg = err.error?.message || 'No se pudo cambiar el estado de la solicitud';
        Swal.fire('Atención', errorMsg, 'error');
      }
    });
  }

  // ==================== DEDICATED COSTEOS VIEW ====================
  applyCosteoFilters(): void {
    let result = this.solicitudes.filter(s => !!s.requiere_costeo);
    if (this.costeoSearch.trim()) {
      const term = this.costeoSearch.toLowerCase();
      result = result.filter(s =>
        s.codigo?.toLowerCase().includes(term) ||
        s.cliente_nombre?.toLowerCase().includes(term)
      );
    }
    if (this.costeoEstadoFilter) {
      result = result.filter(s => (s.estado_costeo || 'PENDIENTE') === this.costeoEstadoFilter);
    }
    this.filteredCosteos = result;
    this.initCosteosPaginator();
  }

  private initCosteosPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.costeosPaginatorId, this.filteredCosteos, 10)
      .subscribe((state: PaginationState) => {
        this.pagedCosteos = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  cambiarEstadoCosteoRapido(sol: Solicitud, nuevoEstado: string): void {
    if (!sol.id) return;
    this.comercialService.cambiarEstadoCosteo(sol.id, nuevoEstado).subscribe({
      next: (res) => {
        sol.estado_costeo = nuevoEstado as any;
        if (res.data) {
          sol.fecha_inicio_costeo = res.data.fecha_inicio_costeo;
          sol.fecha_fin_costeo = res.data.fecha_fin_costeo;
        }
        this.computeKPIs();
        this.applyCosteoFilters();
        this.applySolicitudFilters();
        Swal.fire({ title: 'Costeo actualizado', icon: 'success', timer: 1200, showConfirmButton: false });
      },
      error: () => Swal.fire('Error', 'No se pudo actualizar el estado de costeo', 'error')
    });
  }

  // ==================== DEDICATED MUESTRAS VIEW ====================
  applyMuestraFilters(): void {
    let result = this.solicitudes.filter(s => !!s.requiere_muestra);
    if (this.muestraSearch.trim()) {
      const term = this.muestraSearch.toLowerCase();
      result = result.filter(s =>
        s.codigo?.toLowerCase().includes(term) ||
        s.cliente_nombre?.toLowerCase().includes(term)
      );
    }
    if (this.muestraEstadoFilter) {
      result = result.filter(s => (s.estado_muestra || 'PENDIENTE') === this.muestraEstadoFilter);
    }
    this.filteredMuestras = result;
    this.initMuestrasPaginator();
  }

  private initMuestrasPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.muestrasPaginatorId, this.filteredMuestras, 10)
      .subscribe((state: PaginationState) => {
        this.pagedMuestras = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  cambiarEstadoMuestraRapido(sol: Solicitud, nuevoEstado: string): void {
    if (!sol.id) return;
    this.comercialService.cambiarEstadoMuestra(sol.id, nuevoEstado).subscribe({
      next: (res) => {
        sol.estado_muestra = nuevoEstado as any;
        if (res.data) {
          sol.fecha_inicio_muestra = res.data.fecha_inicio_muestra;
          sol.fecha_fin_muestra = res.data.fecha_fin_muestra;
        }
        this.computeKPIs();
        this.applyMuestraFilters();
        this.applySolicitudFilters();
        Swal.fire({ title: 'Muestra actualizada', icon: 'success', timer: 1200, showConfirmButton: false });
      },
      error: () => Swal.fire('Error', 'No se pudo actualizar el estado de muestra', 'error')
    });
  }

  goToSolicitud(solicitud: Solicitud): void {
    this.router.navigate(['/comerciales/solicitud', solicitud.id]);
  }

  nuevaSolicitud(): void {
    this.router.navigate(['/comerciales/solicitud/nuevo']);
  }

  // ==================== ORDENES DE COMPRA ====================
  loadOrdenes(): void {
    this.isLoadingOrdenes = true;
    this.ordenCompraService.obtenerOrdenes().subscribe({
      next: (res) => {
        this.ordenes = res.data || [];
        this.applyOrdenFilters();
        this.isLoadingOrdenes = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar las órdenes', 'error');
        this.isLoadingOrdenes = false;
      }
    });
    this.ordenCompraService.obtenerEstadisticas().subscribe({
      next: (res) => { this.estadisticasOC = res.data; },
      error: () => {}
    });
  }

  applyOrdenFilters(): void {
    let result = [...this.ordenes];
    if (this.ordenSearch.trim()) {
      const term = this.ordenSearch.toLowerCase();
      result = result.filter((o: any) =>
        o.numero_orden?.toLowerCase().includes(term) ||
        o.cliente?.toLowerCase().includes(term) ||
        (o.pv_asociado || '').toLowerCase().includes(term)
      );
    }
    if (this.ordenEstadoFilter) {
      result = result.filter((o: any) => o.estado === this.ordenEstadoFilter);
    }
    this.filteredOrdenes = result;
    this.initOrdenesPaginator();
  }

  private initOrdenesPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.ordenesPaginatorId, this.filteredOrdenes, 10)
      .subscribe((state: PaginationState) => {
        this.pagedOrdenes = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  irACaptura(): void {
    this.router.navigate(['/comerciales/captura']);
  }

  // ==================== VISUALIZACIÓN Y GESTIÓN DE OC ====================

  verDocumentoOC(orden: any, event?: Event): void {
    if (event) event.stopPropagation();
    if (!orden.id) return;

    this.isLoadingDocument = true;
    this.documentoOrdenNumero = orden.numero_orden;

    this.fileService.getTemporaryUrl(orden.id, 'orden_compra', 30).subscribe({
      next: (res) => {
        if (res && res.url) {
          this.documentoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(res.url);
          this.mostrarModalDocumento = true;
        } else {
          Swal.fire('Atención', 'No se encontró archivo adjunto para esta orden', 'info');
        }
        this.isLoadingDocument = false;
      },
      error: (err) => {
        console.warn('Error al obtener URL temporal:', err);
        Swal.fire('Error', 'No se pudo obtener el documento de la orden', 'error');
        this.isLoadingDocument = false;
      }
    });
  }

  cerrarModalDocumento(): void {
    this.mostrarModalDocumento = false;
    this.documentoUrl = null;
    this.documentoOrdenNumero = '';
  }

  descargarDocumentoOC(orden: any, event?: Event): void {
    if (event) event.stopPropagation();
    if (!orden.id) return;

    this.fileService.getTemporaryUrl(orden.id, 'orden_compra', 5).subscribe({
      next: (res) => {
        if (res && res.url) {
          const a = document.createElement('a');
          a.href = res.url;
          a.download = `OC_${orden.numero_orden}.pdf`;
          a.target = '_blank';
          a.click();
        }
      },
      error: () => Swal.fire('Error', 'No se pudo descargar el documento', 'error')
    });
  }

  verDetalleOC(orden: any): void {
    this.ordenSeleccionada = orden;
    this.itemsOrdenSeleccionada = [];
    this.mostrarModalDetalleOC = true;
    this.isLoadingDetalleOC = true;

    this.ordenCompraService.obtenerDetalle(orden.id).subscribe({
      next: (res) => {
        if (res.data) {
          this.ordenSeleccionada = res.data;
          this.itemsOrdenSeleccionada = res.data.items || [];
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
  }

  vincularPVSiesa(orden: any, event?: Event): void {
    if (event) event.stopPropagation();
    if (!orden.id) return;

    Swal.fire({
      title: 'Buscar PV en Siesa',
      html: `<p class="text-sm text-slate-600">Se buscará automáticamente en Siesa el Pedido de Venta (PV) asociado a la <strong>OC ${orden.numero_orden}</strong>.</p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-search"></i> Buscar y Vincular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isBuscandoPVSiesa = true;
        this.ordenCompraService.procesarOrden(orden.id).subscribe({
          next: (res) => {
            this.isBuscandoPVSiesa = false;
            const pv = res.data?.pv_encontrado || res.data?.orden?.pv_asociado;
            Swal.fire({
              title: '¡PV Vinculado con Éxito!',
              html: `<p class="text-sm">La OC <strong>${orden.numero_orden}</strong> fue vinculada al <strong>PV: ${pv}</strong> en Siesa y marcada como PROCESADA.</p>`,
              icon: 'success'
            });
            this.loadOrdenes();
          },
          error: (err) => {
            this.isBuscandoPVSiesa = false;
            Swal.fire('No encontrado', err.error?.message || 'No se encontró un PV asociado a esta OC en Siesa todavía.', 'warning');
          }
        });
      }
    });
  }

  abrirModalRechazoOC(orden: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.ordenARechazar = orden;
    this.motivoRechazo = '';
    this.mostrarModalRechazo = true;
  }

  cerrarModalRechazoOC(): void {
    this.mostrarModalRechazo = false;
    this.ordenARechazar = null;
    this.motivoRechazo = '';
  }

  confirmarRechazoOC(): void {
    if (!this.ordenARechazar || !this.motivoRechazo.trim() || this.motivoRechazo.trim().length < 10) {
      Swal.fire('Atención', 'El motivo de rechazo debe contener al menos 10 caracteres', 'warning');
      return;
    }

    this.ordenCompraService.rechazarOrden(this.ordenARechazar.id, this.motivoRechazo.trim()).subscribe({
      next: () => {
        Swal.fire({ title: 'Orden Rechazada', text: 'La orden ha sido rechazada y notificada.', icon: 'success', timer: 1500, showConfirmButton: false });
        this.cerrarModalRechazoOC();
        this.loadOrdenes();
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo rechazar la orden', 'error');
      }
    });
  }

  eliminarOC(orden: any, event?: Event): void {
    if (event) event.stopPropagation();
    if (!orden || !orden.id) return;

    Swal.fire({
      title: '¿Eliminar Orden de Compra?',
      html: `<p class="text-sm text-slate-600">¿Estás seguro de eliminar la <strong>OC ${orden.numero_orden}</strong> de <strong>${orden.cliente}</strong>?</p><p class="text-xs text-rose-500 mt-2 font-medium">Esta acción no se puede deshacer.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-trash3"></i> Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e11d48'
    }).then((result) => {
      if (result.isConfirmed) {
        this.ordenCompraService.eliminarOrden(orden.id).subscribe({
          next: () => {
            Swal.fire({
              title: 'Orden Eliminada',
              text: 'La orden de compra ha sido eliminada correctamente.',
              icon: 'success',
              timer: 1500,
              showConfirmButton: false
            });
            this.loadOrdenes();
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo eliminar la orden', 'error');
          }
        });
      }
    });
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
            // Actualizar la orden seleccionada si el modal sigue abierto
            if (this.ordenSeleccionada && this.ordenSeleccionada.id === orden.id) {
              this.ordenSeleccionada.pv_asociado = null;
              this.ordenSeleccionada.estado = 'PENDIENTE';
            }
            this.loadOrdenes();
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

  // ==================== HELPERS ====================
  getEstadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      'BORRADOR': 'bg-slate-100 text-slate-600',
      'ENVIADO': 'bg-blue-50 text-blue-700 border border-blue-100',
      'EN_COSTEO': 'bg-amber-50 text-amber-700 border border-amber-100',
      'COSTEADO': 'bg-violet-50 text-violet-700 border border-violet-100',
      'APROBADO': 'bg-emerald-50 text-emerald-700 border border-emerald-100',
      'RECHAZADO': 'bg-rose-50 text-rose-700 border border-rose-100',
      'PENDIENTE': 'bg-amber-50 text-amber-700 border border-amber-100',
      'PROCESADA': 'bg-emerald-50 text-emerald-700 border border-emerald-100',
      'RECHAZADA': 'bg-rose-50 text-rose-700 border border-rose-100',
    };
    return map[estado] || 'bg-slate-100 text-slate-600';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      'BORRADOR': 'Borrador', 'ENVIADO': 'Enviado', 'EN_COSTEO': 'En Costeo',
      'COSTEADO': 'Costeado', 'APROBADO': 'Aprobado', 'RECHAZADO': 'Rechazado',
      'PENDIENTE': 'Pendiente', 'PROCESADA': 'Procesada', 'RECHAZADA': 'Rechazada',
    };
    return map[estado] || estado;
  }

  getProcesoBadgeClass(estado: string | undefined): string {
    const map: Record<string, string> = {
      'PENDIENTE': 'bg-amber-50 text-amber-700 border border-amber-200',
      'EN_PROCESO': 'bg-blue-50 text-blue-700 border border-blue-200',
      'COMPLETADO': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      'RECHAZADO': 'bg-rose-50 text-rose-700 border border-rose-200',
      'NO_REQUERIDO': 'bg-slate-50 text-slate-400 border border-slate-200',
    };
    return map[estado || 'PENDIENTE'] || 'bg-slate-100 text-slate-600';
  }

  getProcesoLabel(estado: string | undefined): string {
    const map: Record<string, string> = {
      'PENDIENTE': 'Sin Iniciar',
      'EN_PROCESO': 'En Proceso',
      'COMPLETADO': 'Completado',
      'RECHAZADO': 'Rechazado',
      'NO_REQUERIDO': 'No Requerido',
    };
    return map[estado || 'PENDIENTE'] || (estado || 'Sin Iniciar');
  }
}
