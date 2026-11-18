import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, Solicitud } from '../../../services/comercial.service';
import { MoldService } from '../../../services/mold.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-costeo-detail',
  templateUrl: './costeo-detail.component.html',
  styleUrls: ['./costeo-detail.component.css']
})
export class CosteoDetailComponent implements OnInit {
  solicitudId!: number;
  costeo: Solicitud | null = null;
  isLoading = false;

  materialesTrackingData: any = null;
  isLoadingMaterialesTracking = false;

  activeTab: 'items' | 'versiones' = 'items';

  // â”€â”€â”€ Modal OPM (Consulta Ficha / FigurÃ­n) â”€â”€â”€
  selectedOpmItem: any = null;
  opmActiveView: 'front' | 'back' = 'front';
  selectedZone: any = null;
  expandedSidebarZoneKey: string | null = null;

  constructor(
    private comercialService: ComercialService,
    private moldService: MoldService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.solicitudId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadSolicitud();
  }

  loadSolicitud(): void {
    this.isLoading = true;
    this.comercialService.detalleSolicitud(this.solicitudId).subscribe({
      next: (res) => {
        this.costeo = res.data;
        if (this.costeo?.items) {
          // By default expand the first item if there are items
          this.costeo.items = this.costeo.items.map((it: any, idx: number) => ({
            ...it,
            expanded: idx === 0
          }));
        }
        this.isLoading = false;
        this.loadMaterialesAbastecimiento();
      },
      error: () => {
        Swal.fire('Error', 'No se pudo cargar la solicitud', 'error');
        this.isLoading = false;
      }
    });
  }

  loadMaterialesAbastecimiento(): void {
    if (!this.solicitudId) return;
    this.isLoadingMaterialesTracking = true;
    this.comercialService.listarMaterialesSolicitud(this.solicitudId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.materialesTrackingData = res.data;
        }
        this.isLoadingMaterialesTracking = false;
      },
      error: () => {
        this.isLoadingMaterialesTracking = false;
      }
    });
  }

  get trackingMetricas(): any {
    return this.materialesTrackingData?.metricas || {
      total: 0,
      entregados: 0,
      parciales: 0,
      pendientes: 0,
      no_disponibles: 0,
      porcentaje_entrega: 0,
      semaforo: 'PENDIENTE'
    };
  }

  get trackingMateriales(): any[] {
    return this.materialesTrackingData?.materiales || [];
  }

  get conteoCostosValidados(): number {
    return this.trackingMateriales.filter(m => m.estado_costo === 'VIGENTE' || (m.costo_vigente_final && m.costo_vigente_final > 0)).length;
  }

  get conteoCostosPendientes(): number {
    return this.trackingMateriales.filter(m => this.esInsumoPendiente(m)).length;
  }

  get conteoConsultaProveedor(): number {
    return this.trackingMateriales.filter(m => !!m.en_consulta_proveedor).length;
  }

  get conteoMaterialesRetrasados(): number {
    return this.trackingMateriales.filter(m => this.esLlegadaPosterior(m.fecha_estimada_llegada)).length;
  }

  get totalCostoInsumosSolicitud(): number {
    return this.trackingMateriales.reduce((acc, m) => acc + this.getCostoTotalInsumo(m), 0);
  }

  getMaterialesItem(itemId?: number): any[] {
    if (!this.trackingMateriales || this.trackingMateriales.length === 0) return [];
    if (!itemId) return [];
    return this.trackingMateriales.filter((m: any) => m.solicitud_item_id === itemId);
  }

  getMaterialesGlobales(): any[] {
    if (!this.trackingMateriales || this.trackingMateriales.length === 0) return [];
    return this.trackingMateriales.filter((m: any) => !m.solicitud_item_id);
  }

  getCostoUnitarioInsumo(m: any): number {
    if (!m) return 0;
    return Number(m.costo_vigente_final ?? m.costo_vigente_logistica ?? m.ultimo_costo_siesa ?? 0);
  }

  getCostoTotalInsumo(m: any): number {
    if (!m) return 0;
    const cant = Number(m.cantidad_requerida ?? 0);
    return cant * this.getCostoUnitarioInsumo(m);
  }

  getTotalCostoInsumosItem(itemId: number): number {
    const mats = this.getMaterialesItem(itemId);
    return mats.reduce((acc, m) => acc + this.getCostoTotalInsumo(m), 0);
  }

  getCostoUnitarioInsumosPorPrenda(itemId: number): number {
    const totalLote = this.getTotalCostoInsumosItem(itemId);
    const item = this.costeo?.items?.find((i: any) => i.id === itemId);
    const totalPrendas = item ? this.getItemTotal(item) : 1;
    return totalPrendas > 0 ? (totalLote / totalPrendas) : totalLote;
  }

  esInsumoPendiente(m: any): boolean {
    if (!m) return true;
    const costo = this.getCostoUnitarioInsumo(m);
    // Si no tiene costo ingresado ni en Siesa ni en LogÃ­stica, estÃ¡ sin costear
    if (costo <= 0) return true;
    // Si logÃ­stica ya definiÃ³ el costo, estÃ¡ totalmente vigente
    if (m.costo_vigente_logistica !== null && Number(m.costo_vigente_logistica) > 0) return false;
    // Si viene de Siesa y estÃ¡ vigente o en alerta
    if (m.estado_costo === 'VIGENTE' || m.estado_costo === 'ALERTA') return false;
    return m.estado_costo === 'DESACTUALIZADO' || m.estado_costo === 'SIN_MOVIMIENTO';
  }

  getFechaLimiteSolicitud(): string | null {
    if (this.costeo?.fecha_entrega_muestra && this.costeo?.fecha_entrega_cotizacion) {
      const dMuestra = this.parseDateOnly(this.costeo.fecha_entrega_muestra);
      const dCotiz = this.parseDateOnly(this.costeo.fecha_entrega_cotizacion);
      if (dMuestra && dCotiz) {
        return dMuestra.getTime() <= dCotiz.getTime()
          ? this.costeo.fecha_entrega_muestra
          : this.costeo.fecha_entrega_cotizacion;
      }
    }
    return this.costeo?.fecha_entrega_cotizacion || this.costeo?.fecha_entrega_muestra || null;
  }

  getFechaLimiteLabel(): string {
    if (this.costeo?.fecha_entrega_muestra && this.costeo?.fecha_entrega_cotizacion) {
      const dMuestra = this.parseDateOnly(this.costeo.fecha_entrega_muestra);
      const dCotiz = this.parseDateOnly(this.costeo.fecha_entrega_cotizacion);
      if (dMuestra && dCotiz) {
        return dMuestra.getTime() <= dCotiz.getTime() ? 'Muestra' : 'CotizaciÃ³n';
      }
    }
    if (this.costeo?.fecha_entrega_cotizacion) return 'CotizaciÃ³n';
    if (this.costeo?.fecha_entrega_muestra) return 'Muestra';
    return 'Compromiso';
  }

  parseDateOnly(str?: string | null): Date | null {
    if (!str) return null;
    const parts = str.split(/[-T ]/);
    if (parts.length >= 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  esLlegadaPosterior(fechaLlegada?: string | null): boolean {
    if (!fechaLlegada) return false;
    const limiteStr = this.getFechaLimiteSolicitud();
    if (!limiteStr) return false;

    const dLlegada = this.parseDateOnly(fechaLlegada);
    const dLimite = this.parseDateOnly(limiteStr);
    if (!dLlegada || !dLimite) return false;

    return dLlegada.getTime() > dLimite.getTime();
  }

  getDiasRetrasoLlegada(fechaLlegada?: string | null): number {
    if (!fechaLlegada) return 0;
    const limiteStr = this.getFechaLimiteSolicitud();
    if (!limiteStr) return 0;

    const dLlegada = this.parseDateOnly(fechaLlegada);
    const dLimite = this.parseDateOnly(limiteStr);
    if (!dLlegada || !dLimite) return 0;

    const diffMs = dLlegada.getTime() - dLimite.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  getResumenItemInsumos(itemId: number) {
    const mats = this.getMaterialesItem(itemId);
    const total = mats.length;
    const pendientes = mats.filter(m => this.esInsumoPendiente(m)).length;
    const conCosto = total - pendientes;
    const enConsulta = mats.filter(m => !!m.en_consulta_proveedor).length;
    const retrasados = mats.filter(m => this.esLlegadaPosterior(m.fecha_estimada_llegada)).length;
    const costoTotal = mats.reduce((acc, m) => acc + this.getCostoTotalInsumo(m), 0);

    return { total, conCosto, pendientes, enConsulta, retrasados, costoTotal };
  }

  getInsumosRetrasadosItem(itemId: number): any[] {
    return this.getMaterialesItem(itemId).filter(m => this.esLlegadaPosterior(m.fecha_estimada_llegada));
  }

  getInsumosRetrasadosNombres(itemId: number): string {
    const list = this.getInsumosRetrasadosItem(itemId);
    return list.map(m => m.nombre_material || m.siesa_descripcion || 'Insumo').join(', ');
  }

  getFuenteCostoInfo(m: any): { label: string; badgeClass: string; icon: string } {
    if (m.costo_vigente_logistica && m.costo_vigente_logistica > 0) {
      return {
        label: 'LogÃ­stica',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: 'bi-truck'
      };
    }
    if (m.ultimo_costo_siesa && m.ultimo_costo_siesa > 0) {
      return {
        label: 'SIESA',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: 'bi-database-check'
      };
    }
    if (m.costo_vigente_final && m.costo_vigente_final > 0) {
      return {
        label: 'Vigente',
        badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
        icon: 'bi-check2'
      };
    }
    return {
      label: 'Sin Costo',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: 'bi-clock-history'
    };
  }

  toggleItem(item: any): void {
    item.expanded = !item.expanded;
  }

  toggleAllItems(expand: boolean): void {
    if (this.costeo?.items) {
      this.costeo.items.forEach((it: any) => it.expanded = expand);
    }
  }

  editCosteo(): void {
    this.router.navigate(['/comerciales/solicitud', this.solicitudId, 'editar']);
  }

  goToClient(): void {
    if (this.costeo && this.costeo.cliente_id) {
      this.router.navigate(['/comerciales/cliente', this.costeo.cliente_id], {
        queryParams: {
          nombre: this.costeo.cliente_nombre || '',
          nit: this.costeo.cliente_nit || '',
          tab: 'solicitudes'
        }
      });
    }
  }

  goBack(): void {
    const from = this.route.snapshot.queryParamMap.get('from');

    // Si viene explÃ­citamente desde la pestaÃ±a global de solicitudes
    if (from === 'solicitudes') {
      this.router.navigate(['/comerciales'], { queryParams: { tab: 'solicitudes' } });
      return;
    }

    // Por defecto: Regresar al detalle del cliente al que pertenece esta solicitud
    if (this.costeo && this.costeo.cliente_id) {
      this.goToClient();
      return;
    }

    // Fallback: Si no ha cargado costeo pero viene con queryParams
    const qClienteId = this.route.snapshot.queryParamMap.get('clienteId');
    if (qClienteId) {
      this.router.navigate(['/comerciales/cliente', qClienteId], {
        queryParams: {
          nombre: this.route.snapshot.queryParamMap.get('nombre') || '',
          nit: this.route.snapshot.queryParamMap.get('nit') || '',
          tab: 'solicitudes'
        }
      });
      return;
    }

    // Si no tiene cliente asociado, regresar al directorio general
    this.router.navigate(['/comerciales']);
  }

  puedeVolverABorrador(sol: any): boolean {
    if (!sol || sol.estado === 'BORRADOR') return false;
    const costeoIniciado = !!sol.fecha_inicio_costeo || ['EN_PROCESO', 'COMPLETADO'].includes(sol.estado_costeo);
    const muestraIniciada = !!sol.fecha_inicio_muestra || ['EN_PROCESO', 'COMPLETADO'].includes(sol.estado_muestra);
    return !costeoIniciado && !muestraIniciada;
  }

  cambiarEstado(estado: string): void {
    Swal.fire({
      title: 'Â¿Cambiar estado?',
      text: `La solicitud pasarÃ¡ a estado: ${this.getEstadoLabel(estado)}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.cambiarEstado(this.solicitudId, estado).subscribe({
          next: () => {
            if (this.costeo) {
              this.costeo.estado = estado;
              if (estado === 'BORRADOR') {
                if (this.costeo.requiere_costeo) this.costeo.estado_costeo = 'PENDIENTE';
                if (this.costeo.requiere_muestra) this.costeo.estado_muestra = 'PENDIENTE';
              }
            }
            Swal.fire({ title: 'Actualizado', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: (err) => {
            const msg = err.error?.message || 'No se pudo cambiar el estado';
            Swal.fire('AtenciÃ³n', msg, 'error');
          }
        });
      }
    });
  }

  // â”€â”€â”€ Modal Historial de Cotizaciones por Prenda (Aislado en Componente) â”€â”€â”€
  isModalHistorialPrendaOpen = false;
  selectedPrendaForHistorial: any = null;

  abrirHistorialPrenda(item: any): void {
    this.selectedPrendaForHistorial = item;
    this.isModalHistorialPrendaOpen = true;
  }

  cerrarHistorialPrenda(): void {
    this.isModalHistorialPrendaOpen = false;
    this.selectedPrendaForHistorial = null;
  }

  crearVersion(): void {
    Swal.fire({
      title: 'Nueva VersiÃ³n',
      input: 'textarea',
      inputLabel: 'Notas (opcional)',
      inputPlaceholder: 'DescripciÃ³n de los cambios...',
      showCancelButton: true,
      confirmButtonText: 'Crear versiÃ³n',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.crearVersion(this.solicitudId, result.value).subscribe({
          next: () => {
            this.loadSolicitud();
            Swal.fire({ title: 'VersiÃ³n creada', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo crear la versiÃ³n', 'error')
        });
      }
    });
  }

  eliminarCosteo(): void {
    Swal.fire({
      title: 'Â¿Eliminar solicitud?',
      text: `Se eliminarÃ¡ ${this.costeo?.codigo} permanentemente`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.eliminarSolicitud(this.solicitudId).subscribe({
          next: () => {
            Swal.fire({ title: 'Eliminado', icon: 'success', timer: 1500, showConfirmButton: false });
            setTimeout(() => this.goBack(), 1200);
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  getEstadoBadge(estado: string): string {
    const map: Record<string, string> = {
      'BORRADOR': 'badge-borrador', 'ENVIADO': 'badge-enviado',
      'EN_COSTEO': 'badge-en-costeo', 'COSTEADO': 'badge-costeado',
      'APROBADO': 'badge-aprobado', 'RECHAZADO': 'badge-rechazado',
    };
    return map[estado] || 'badge-default';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      'BORRADOR': 'Borrador', 'ENVIADO': 'Enviado', 'EN_COSTEO': 'En Costeo',
      'COSTEADO': 'Costeado', 'APROBADO': 'Aprobado', 'RECHAZADO': 'Rechazado',
    };
    return map[estado] || estado;
  }

  cambiarEstadoCosteo(estado: string): void {
    Swal.fire({
      title: 'Â¿Cambiar estado de costeo?',
      text: `El proceso de costeo pasarÃ¡ a: ${this.getProcesoLabel(estado)}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.cambiarEstadoCosteo(this.solicitudId, estado).subscribe({
          next: (res) => {
            if (this.costeo) {
              this.costeo.estado_costeo = estado as any;
              if (res.data) {
                this.costeo.fecha_inicio_costeo = res.data.fecha_inicio_costeo;
                this.costeo.fecha_fin_costeo = res.data.fecha_fin_costeo;
              }
            }
            Swal.fire({ title: 'Costeo Actualizado', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo cambiar el estado de costeo', 'error')
        });
      }
    });
  }

  cambiarEstadoMuestra(estado: string): void {
    Swal.fire({
      title: 'Â¿Cambiar estado de muestra?',
      text: `El proceso de desarrollo de muestra pasarÃ¡ a: ${this.getProcesoLabel(estado)}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.cambiarEstadoMuestra(this.solicitudId, estado).subscribe({
          next: (res) => {
            if (this.costeo) {
              this.costeo.estado_muestra = estado as any;
              if (res.data) {
                this.costeo.fecha_inicio_muestra = res.data.fecha_inicio_muestra;
                this.costeo.fecha_fin_muestra = res.data.fecha_fin_muestra;
              }
            }
            Swal.fire({ title: 'Muestra Actualizada', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo cambiar el estado de muestra', 'error')
        });
      }
    });
  }

  getProcesoLabel(estado: string | undefined, requiere: boolean = false): string {
    if (requiere && (!estado || estado === 'NO_REQUERIDO')) {
      return 'Sin Iniciar';
    }
    const map: Record<string, string> = {
      'PENDIENTE': 'Sin Iniciar',
      'EN_PROCESO': 'En Proceso',
      'COMPLETADO': 'Completado',
      'RECHAZADO': 'Rechazado',
      'NO_REQUERIDO': 'No Requerido',
    };
    return map[estado || 'PENDIENTE'] || (estado || 'Sin Iniciar');
  }

  getProcesoBadgeClass(estado: string | undefined, requiere: boolean = false): string {
    if (requiere && (!estado || estado === 'NO_REQUERIDO')) {
      return 'badge-en-costeo';
    }
    const map: Record<string, string> = {
      'PENDIENTE': 'badge-en-costeo',
      'EN_PROCESO': 'badge-enviado',
      'COMPLETADO': 'badge-costeado',
      'RECHAZADO': 'badge-rechazado',
      'NO_REQUERIDO': 'badge-borrador',
    };
    return map[estado || 'PENDIENTE'] || 'badge-borrador';
  }

  getTotalUnidades(): number {
    return (this.costeo?.items || []).reduce((sum, it) => {
      return sum + this.getItemTotal(it);
    }, 0);
  }

  getItemTotal(item: any): number {
    if (!item?.tallas) return 0;
    return item.tallas.reduce((sum: number, t: any) => sum + (Number(t.cantidad) || 0), 0);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // OPM MODAL & CONSULTATION STATE (MIRROR OF SPEC-GENERATOR)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // ─── Tracking de Materiales ───
  mostrarModalMateriales = false;

  abrirModalTrackingMateriales(): void {
    this.mostrarModalMateriales = true;
  }

  cerrarModalTrackingMateriales(): void {
    this.mostrarModalMateriales = false;
  }

  // ─── Modal OPM (Aislado en FichaOpmModalComponent) ───
  openOpmModal(item: any): void {
    this.selectedOpmItem = item;
  }

  closeOpmModal(): void {
    this.selectedOpmItem = null;
  }
  getFallbackFrontImage(mold?: any): string | null {
    if (!mold) return null;
    const name = (mold.name || '').toLowerCase();
    if (name.includes('camisa')) return 'assets/garments/camisa_front.png';
    if (name.includes('chaqueta')) return 'assets/garments/chaqueta_front.png';
    if (name.includes('pantalon') || name.includes('pantalÃ³n')) return 'assets/garments/pantalon_front.png';
    if (name.includes('overol')) return 'assets/garments/overol_front.png';
    if (name.includes('polo')) return 'assets/garments/polo_front.png';
    if (name.includes('buzo')) return 'assets/garments/buzo_front.png';
    if (name.includes('camiseta')) return 'assets/garments/camiseta_front.png';
    if (name.includes('chaleco')) return 'assets/garments/chaleco_front.png';
    if (name.includes('delantal')) return 'assets/garments/delantal_front.png';
    if (name.includes('gorra')) return 'assets/garments/gorra_front.png';
    return null;
  }

  getFallbackBackImage(mold?: any): string | null {
    if (!mold) return null;
    const name = (mold.name || '').toLowerCase();
    if (name.includes('camisa')) return 'assets/garments/camisa_back.png';
    if (name.includes('chaqueta')) return 'assets/garments/chaqueta_back.png';
    if (name.includes('pantalon') || name.includes('pantalÃ³n')) return 'assets/garments/pantalon_back.png';
    if (name.includes('overol')) return 'assets/garments/overol_back.png';
    if (name.includes('polo')) return 'assets/garments/polo_back.png';
    if (name.includes('buzo')) return 'assets/garments/buzo_back.png';
    if (name.includes('camiseta')) return 'assets/garments/camiseta_back.png';
    if (name.includes('chaleco')) return 'assets/garments/chaleco_back.png';
    if (name.includes('delantal')) return 'assets/garments/delantal_back.png';
    if (name.includes('gorra')) return 'assets/garments/gorra_back.png';
    return null;
  }


  getOpmState(item: any): 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETO' {
    if (!item) return 'PENDIENTE';
    const spec = item.technical_spec;
    if (spec?.status === 'COMPLETADO' || spec?.status === 'PUBLICADO' || spec?.status === 'APROBADO') {
      return 'COMPLETO';
    }
    if (spec?.status === 'EN_PROCESO') {
      return 'EN_PROCESO';
    }

    const parts = spec?.parts || item.mold?.parts || [];
    if (!parts || parts.length === 0) return 'PENDIENTE';

    let filledCount = 0;
    for (const p of parts) {
      if (!!p.technical_spec || !!p.inventory_reference || !!p.inventory_description) {
        filledCount++;
      }
    }

    if (filledCount >= parts.length) {
      return 'COMPLETO';
    } else if (filledCount > 0) {
      return 'EN_PROCESO';
    }

    return 'PENDIENTE';
  }

  esOpmTecnicaCompleta(item: any): boolean {
    return this.getOpmState(item) === 'COMPLETO';
  }

  getSolicitudObservaciones(): string {
    return this.costeo?.observaciones || '';
  }

  getOpmBadgeInfo(item: any): { label: string; bgClass: string; icon: string } {
    const state = this.getOpmState(item);
    if (state === 'COMPLETO') {
      return {
        label: 'EspecificaciÃ³n Completa',
        bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: 'bi-check-circle-fill'
      };
    } else if (state === 'EN_PROCESO') {
      return {
        label: 'EspecificaciÃ³n en Proceso',
        bgClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        icon: 'bi-gear-fill'
      };
    }
    return {
      label: 'Borrador Comercial',
      bgClass: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: 'bi-clock-history'
    };
  }

  getSemaforoFecha(fechaStr?: string | null, estado?: string | null): { label: string; badgeClass: string; icon: string; dias: number | null } {
    if (!fechaStr) {
      return { label: 'Sin fecha', badgeClass: 'bg-slate-50 text-slate-400 border-slate-200', icon: 'bi-dash', dias: null };
    }
    if (estado === 'COMPLETADO' || estado === 'FINALIZADO' || estado === 'COSTEADO' || estado === 'APROBADO') {
      return { label: 'Completado', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold', icon: 'bi-check-circle-fill', dias: 0 };
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
}

