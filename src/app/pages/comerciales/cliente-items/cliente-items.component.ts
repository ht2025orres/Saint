import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, ItemSiesa, Solicitud } from '../../../services/comercial.service';
import { OrdenCompraService } from '../../../services/orden-compra.service';
import { PaginationService, PaginationState } from '../../../shared/pagination/pagination.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cliente-items',
  templateUrl: './cliente-items.component.html',
  styleUrls: ['./cliente-items.component.css']
})
export class ClienteItemsComponent implements OnInit, OnDestroy {
  clienteId!: number;
  clienteNombre = '';
  clienteNit = '';

  // Items
  items: ItemSiesa[] = [];
  filteredItems: ItemSiesa[] = [];
  pagedItems: ItemSiesa[] = [];
  searchTerm = '';
  isLoading = false;
  isDeepSearch = false;

  // Solicitudes del cliente
  solicitudes: Solicitud[] = [];
  filteredSolicitudes: Solicitud[] = [];
  pagedSolicitudes: Solicitud[] = [];
  solicitudSearch = '';
  solicitudEstadoFilter = '';
  solicitudUrgenciaFilter: '' | 'vencidas' | 'por_vencer' | 'en_plazo' = '';
  isLoadingSolicitudes = false;

  // Órdenes del cliente
  ordenes: any[] = [];
  pagedOrdenes: any[] = [];
  isLoadingOrdenes = false;

  activeTab: 'solicitudes' | 'items' | 'ordenes' = 'solicitudes';

  // Métricas del cliente
  metricasCliente = {
    vencidas: 0,
    porVencer: 0,
    enPlazo: 0,
    totalActivas: 0,
    totalItems: 0,
    totalOC: 0,
    ocPendientes: 0
  };

  // Pagination
  readonly itemsPaginatorId = 'comerciales-items';
  readonly solicitudesPaginatorId = 'comerciales-cliente-solicitudes';
  readonly ordenesPaginatorId = 'comerciales-cliente-ordenes';
  private paginationSubs: Subscription[] = [];

  constructor(
    private comercialService: ComercialService,
    private ordenCompraService: OrdenCompraService,
    private route: ActivatedRoute,
    private router: Router,
    public paginationService: PaginationService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.clienteId = Number(this.route.snapshot.paramMap.get('id'));
    this.clienteNombre = this.route.snapshot.queryParamMap.get('nombre') || '';
    this.clienteNit = this.route.snapshot.queryParamMap.get('nit') || '';

    const initialTab = this.route.snapshot.queryParamMap.get('tab');
    if (initialTab === 'items' || initialTab === 'solicitudes' || initialTab === 'ordenes') {
      this.activeTab = initialTab;
    } else {
      this.activeTab = 'solicitudes';
    }

    // Carga rápida: solicitudes y órdenes primero
    this.loadSolicitudes();
    this.loadOrdenes();

    // Si la pestaña inicial es items, cargar items de inmediato; si no, diferirlo
    if (this.activeTab === 'items') {
      this.loadItems();
    } else {
      setTimeout(() => this.loadItemsSilencioso(), 400);
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
    this.paginationService.destroyPaginator(this.itemsPaginatorId);
    this.paginationService.destroyPaginator(this.solicitudesPaginatorId);
    this.paginationService.destroyPaginator(this.ordenesPaginatorId);
  }

  switchTab(tab: 'solicitudes' | 'items' | 'ordenes'): void {
    this.activeTab = tab;
    if (tab === 'items' && this.items.length === 0 && !this.isLoading) {
      this.loadItems();
    }
    if (tab === 'ordenes' && this.ordenes.length === 0 && !this.isLoadingOrdenes) {
      this.loadOrdenes();
    }
    if (tab === 'solicitudes' && this.solicitudes.length === 0 && !this.isLoadingSolicitudes) {
      this.loadSolicitudes();
    }
  }

  // ==================== ITEMS ====================
  loadItems(): void {
    this.isLoading = true;
    this.comercialService.itemsCliente(this.clienteId).subscribe({
      next: (res) => {
        this.items = res.data || [];
        this.applyFilters();
        this.metricasCliente.totalItems = this.items.length;
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los ítems del cliente', 'error');
        this.isLoading = false;
      }
    });
  }

  private loadItemsSilencioso(): void {
    if (this.items.length > 0 || this.isLoading) return;
    this.comercialService.itemsCliente(this.clienteId).subscribe({
      next: (res) => {
        this.items = res.data || [];
        this.filteredItems = [...this.items];
        this.metricasCliente.totalItems = this.items.length;
      },
      error: () => {}
    });
  }

  applyFilters(): void {
    if (!this.searchTerm.trim()) {
      this.filteredItems = [...this.items];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredItems = this.items.filter(i =>
        (i.f120_descripcion || i.descripcion || '').toLowerCase().includes(term) ||
        (i.f120_referencia || i.referencia || '').toLowerCase().includes(term) ||
        (i.color || '').toLowerCase().includes(term) ||
        (i.talla || '').toLowerCase().includes(term)
      );
    }
    this.initItemsPaginator();
  }

  private initItemsPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.itemsPaginatorId, this.filteredItems, 25)
      .subscribe((state: PaginationState) => {
        this.pagedItems = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  searchItems(deep: boolean = false): void {
    if (this.searchTerm.length >= 2) {
      this.isLoading = true;
      this.isDeepSearch = deep;
      this.comercialService.buscarItemsCliente(this.clienteId, this.searchTerm, deep).subscribe({
        next: (res) => {
          this.filteredItems = res.data || [];
          this.initItemsPaginator();
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; }
      });
    } else if (this.searchTerm.length === 0) {
      this.isDeepSearch = false;
      this.applyFilters();
    }
  }

  deepSearch(): void { this.searchItems(true); }

  // ==================== SOLICITUDES ====================
  loadSolicitudes(): void {
    this.isLoadingSolicitudes = true;
    this.comercialService.listarSolicitudes({ 
      cliente_id: this.clienteId,
      cliente_nit: this.clienteNit,
      cliente_nombre: this.clienteNombre
    }).subscribe({
      next: (res) => {
        this.solicitudes = res.data || [];
        this.computeMetricasCliente();
        this.applySolicitudFilters();
        this.isLoadingSolicitudes = false;
      },
      error: () => { this.isLoadingSolicitudes = false; }
    });
  }

  applySolicitudFilters(): void {
    let result = [...this.solicitudes];
    if (this.solicitudSearch.trim()) {
      const term = this.solicitudSearch.toLowerCase();
      result = result.filter(s =>
        s.codigo?.toLowerCase().includes(term) ||
        s.cliente_nombre?.toLowerCase().includes(term)
      );
    }
    if (this.solicitudEstadoFilter) {
      result = result.filter(s => s.estado === this.solicitudEstadoFilter);
    }
    if (this.solicitudUrgenciaFilter) {
      result = result.filter(s => {
        const urg = this.evaluarUrgenciaSolicitud(s);
        if (this.solicitudUrgenciaFilter === 'vencidas') return urg.tipo === 'VENCIDA';
        if (this.solicitudUrgenciaFilter === 'por_vencer') return urg.tipo === 'POR_VENCER';
        if (this.solicitudUrgenciaFilter === 'en_plazo') return urg.tipo === 'EN_PLAZO';
        return true;
      });
    }
    this.filteredSolicitudes = result;
    this.initSolicitudesPaginator();
  }

  setFiltroUrgenciaSolicitudes(filtro: '' | 'vencidas' | 'por_vencer' | 'en_plazo'): void {
    this.solicitudUrgenciaFilter = filtro;
    this.applySolicitudFilters();
  }

  private initSolicitudesPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.solicitudesPaginatorId, this.filteredSolicitudes, 10)
      .subscribe((state: PaginationState) => {
        this.pagedSolicitudes = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  computeMetricasCliente(): void {
    let vencidas = 0;
    let porVencer = 0;
    let enPlazo = 0;
    let totalActivas = 0;

    for (const sol of this.solicitudes) {
      const urg = this.evaluarUrgenciaSolicitud(sol);
      if (urg.tipo !== 'COMPLETADA') {
        totalActivas++;
        if (urg.tipo === 'VENCIDA') vencidas++;
        else if (urg.tipo === 'POR_VENCER') porVencer++;
        else if (urg.tipo === 'EN_PLAZO') enPlazo++;
      }
    }

    this.metricasCliente.vencidas = vencidas;
    this.metricasCliente.porVencer = porVencer;
    this.metricasCliente.enPlazo = enPlazo;
    this.metricasCliente.totalActivas = totalActivas;
  }

  evaluarUrgenciaSolicitud(sol: Solicitud): {
    tipo: 'VENCIDA' | 'POR_VENCER' | 'EN_PLAZO' | 'COMPLETADA' | 'SIN_FECHA';
    diasDiferencia: number | null;
    diasTexto: string;
    badgeClass: string;
  } {
    const estado = sol.estado || '';
    if (['APROBADO', 'RECHAZADO'].includes(estado)) {
      return { tipo: 'COMPLETADA', diasDiferencia: null, diasTexto: 'Completada', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }

    const costeoListo = !sol.requiere_costeo || sol.estado_costeo === 'COMPLETADO';
    const muestraLista = !sol.requiere_muestra || sol.estado_muestra === 'COMPLETADO';
    if (costeoListo && muestraLista && estado === 'COSTEADO') {
      return { tipo: 'COMPLETADA', diasDiferencia: null, diasTexto: 'Completada', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let menorDiffDias: number | null = null;

    const parseFechaDiff = (fechaStr: string): number => {
      const parts = fechaStr.split(/[-T ]/);
      let d: Date;
      if (parts.length >= 3) {
        d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        d = new Date(fechaStr);
      }
      d.setHours(0, 0, 0, 0);
      return Math.ceil((d.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    };

    if (sol.requiere_costeo && sol.estado_costeo !== 'COMPLETADO' && sol.fecha_entrega_cotizacion) {
      const diff = parseFechaDiff(sol.fecha_entrega_cotizacion);
      menorDiffDias = (menorDiffDias === null) ? diff : Math.min(menorDiffDias, diff);
    }

    if (sol.requiere_muestra && sol.estado_muestra !== 'COMPLETADO' && sol.fecha_entrega_muestra) {
      const diff = parseFechaDiff(sol.fecha_entrega_muestra);
      menorDiffDias = (menorDiffDias === null) ? diff : Math.min(menorDiffDias, diff);
    }

    if (menorDiffDias === null) {
      return { tipo: 'SIN_FECHA', diasDiferencia: null, diasTexto: 'Sin fecha límite', badgeClass: 'bg-slate-50 text-slate-400 border-slate-200' };
    }

    if (menorDiffDias < 0) {
      const dias = Math.abs(menorDiffDias);
      return {
        tipo: 'VENCIDA',
        diasDiferencia: menorDiffDias,
        diasTexto: `Vencida hace ${dias}d`,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
      };
    } else if (menorDiffDias === 0) {
      return {
        tipo: 'POR_VENCER',
        diasDiferencia: 0,
        diasTexto: 'Vence hoy',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
      };
    } else if (menorDiffDias <= 3) {
      return {
        tipo: 'POR_VENCER',
        diasDiferencia: menorDiffDias,
        diasTexto: `Vence en ${menorDiffDias}d`,
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 font-bold'
      };
    } else {
      return {
        tipo: 'EN_PLAZO',
        diasDiferencia: menorDiffDias,
        diasTexto: `En plazo (${menorDiffDias}d)`,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium'
      };
    }
  }

  getSemaforoFecha(fechaStr?: string | null, estado?: string | null): { label: string; badgeClass: string; icon: string; dias: number | null } {
    if (!fechaStr) {
      return { label: 'Sin fecha', badgeClass: 'bg-slate-50 text-slate-400 border-slate-200', icon: 'bi-dash', dias: null };
    }
    if (estado === 'COMPLETADO' || estado === 'FINALIZADO' || estado === 'COSTEADO' || estado === 'APROBADO') {
      return { label: 'Completado', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'bi-check-circle-fill', dias: 0 };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const parts = fechaStr.split(/[-T ]/);
    let fecha: Date;
    if (parts.length >= 3) {
      fecha = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      fecha = new Date(fechaStr);
    }
    fecha.setHours(0, 0, 0, 0);

    const diffMs = fecha.getTime() - hoy.getTime();
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      return {
        label: `Vencido (${Math.abs(diffDias)}d)`,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
        icon: 'bi-exclamation-triangle-fill',
        dias: diffDias
      };
    } else if (diffDias === 0) {
      return {
        label: 'Vence hoy',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
        icon: 'bi-clock-fill',
        dias: diffDias
      };
    } else if (diffDias <= 2) {
      return {
        label: `En ${diffDias}d`,
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
        icon: 'bi-clock-history',
        dias: diffDias
      };
    } else {
      return {
        label: `En ${diffDias}d`,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
        icon: 'bi-calendar-check',
        dias: diffDias
      };
    }
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
        this.computeMetricasCliente();
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

  // ==================== ORDENES ====================
  loadOrdenes(): void {
    this.isLoadingOrdenes = true;
    this.ordenCompraService.obtenerOrdenes({ cliente: this.clienteNombre }).subscribe({
      next: (res) => {
        this.ordenes = (res.data || []).filter((o: any) =>
          o.cliente?.toLowerCase().includes(this.clienteNombre.toLowerCase())
        );
        this.metricasCliente.totalOC = this.ordenes.length;
        this.metricasCliente.ocPendientes = this.ordenes.filter((o: any) => o.estado === 'PENDIENTE').length;
        this.initOrdenesPaginator();
        this.isLoadingOrdenes = false;
      },
      error: () => { this.isLoadingOrdenes = false; }
    });
  }

  private initOrdenesPaginator(): void {
    const sub = this.paginationService
      .initializePaginator(this.ordenesPaginatorId, this.ordenes, 10)
      .subscribe((state: PaginationState) => {
        this.pagedOrdenes = state.currentData;
      });
    this.paginationSubs.push(sub);
  }

  // ==================== NAVIGATION ====================
  nuevaSolicitud(item?: ItemSiesa): void {
    const queryParams: any = { nombre: this.clienteNombre, nit: this.clienteNit };
    if (item) {
      queryParams.pre_item = JSON.stringify({
        descripcion: this.getItemDesc(item),
        referencia: this.getItemRef(item),
        rowid_item_ext: item.f121_rowid || item.rowid_item_ext,
        rowid_item: item.f120_rowid,
        talla: item.talla,
        color: item.color
      });
    }
    this.router.navigate(['/comerciales/solicitud/nuevo', this.clienteId], { queryParams });
  }

  goToSolicitud(solicitud: Solicitud): void {
    this.router.navigate(['/comerciales/solicitud', solicitud.id]);
  }

  goBack(): void {
    this.router.navigate(['/comerciales'], { queryParams: { tab: 'clientes' } });
  }

  irACaptura(): void {
    this.router.navigate(['/comerciales/captura'], { 
      queryParams: { 
        cliente: this.clienteNombre, 
        nit: this.clienteNit,
        clienteId: this.clienteId
      } 
    });
  }

  // ==================== HELPERS ====================
  getItemDesc(item: ItemSiesa): string {
    return item.f120_descripcion || item.descripcion || item.f120_descripcion_corta || '';
  }

  getItemRef(item: ItemSiesa): string {
    return item.f120_referencia || item.referencia || item.f120_id || '';
  }

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
}
