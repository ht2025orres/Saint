import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, Solicitud } from '../../../services/comercial.service';
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

  activeTab: 'items' | 'versiones' = 'items';
  selectedOpmItem: any = null;
  hoveredOpmPart: any = null;
  pinnedOpmPart: any = null;

  openOpmModal(item: any): void {
    this.selectedOpmItem = item;
    this.hoveredOpmPart = null;
    this.pinnedOpmPart = null;
  }

  closeOpmModal(): void {
    this.selectedOpmItem = null;
    this.hoveredOpmPart = null;
    this.pinnedOpmPart = null;
  }

  onPartHover(part: any): void {
    this.hoveredOpmPart = part;
  }

  onPartLeave(): void {
    this.hoveredOpmPart = null;
  }

  togglePinPart(part: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.pinnedOpmPart === part) {
      this.pinnedOpmPart = null;
    } else {
      this.pinnedOpmPart = part;
      this.hoveredOpmPart = null;
    }
  }

  clearPinnedPart(): void {
    this.pinnedOpmPart = null;
  }

  get activeOpmPopoverPart(): any {
    return this.pinnedOpmPart || this.hoveredOpmPart;
  }

  isPartActive(part: any): boolean {
    return (this.hoveredOpmPart === part) || (this.pinnedOpmPart === part);
  }

  constructor(
    private comercialService: ComercialService,
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
      },
      error: () => {
        Swal.fire('Error', 'No se pudo cargar la solicitud', 'error');
        this.isLoading = false;
      }
    });
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
    if (this.costeo) {
      this.router.navigate(['/comerciales/cliente', this.costeo.cliente_id], {
        queryParams: { nombre: this.costeo.cliente_nombre, nit: this.costeo.cliente_nit }
      });
    }
  }

  goBack(): void {
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
      title: '¿Cambiar estado?',
      text: `La solicitud pasará a estado: ${this.getEstadoLabel(estado)}`,
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
            Swal.fire('Atención', msg, 'error');
          }
        });
      }
    });
  }

  crearVersion(): void {
    Swal.fire({
      title: 'Nueva Versión',
      input: 'textarea',
      inputLabel: 'Notas (opcional)',
      inputPlaceholder: 'Descripción de los cambios...',
      showCancelButton: true,
      confirmButtonText: 'Crear versión',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.crearVersion(this.solicitudId, result.value).subscribe({
          next: () => {
            this.loadSolicitud();
            Swal.fire({ title: 'Versión creada', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo crear la versión', 'error')
        });
      }
    });
  }

  eliminarCosteo(): void {
    Swal.fire({
      title: '¿Eliminar solicitud?',
      text: `Se eliminará ${this.costeo?.codigo} permanentemente`,
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
            setTimeout(() => this.router.navigate(['/comerciales']), 1200);
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
      title: '¿Cambiar estado de costeo?',
      text: `El proceso de costeo pasará a: ${this.getProcesoLabel(estado)}`,
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
      title: '¿Cambiar estado de muestra?',
      text: `El proceso de desarrollo de muestra pasará a: ${this.getProcesoLabel(estado)}`,
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
      return sum + (it.tallas || []).reduce((ts, t) => ts + (t.cantidad || 0), 0);
    }, 0);
  }

  // ==================== OPM MODAL HELPERS ====================
  private getAllParts(): any[] {
    if (!this.selectedOpmItem) return [];
    return this.selectedOpmItem.technical_spec?.parts || this.selectedOpmItem.mold?.parts || [];
  }

  getGeneralParts(): any[] {
    return this.getAllParts().filter(p => p.position_x === null || p.position_x === undefined);
  }

  getPositionedParts(): any[] {
    return this.getAllParts().filter(p => p.position_x !== null && p.position_x !== undefined);
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
        label: 'ESPECIFICACIÓN TÉCNICA COMPLETA',
        bgClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        icon: 'bi-patch-check-fill'
      };
    } else if (state === 'EN_PROCESO') {
      return {
        label: 'ESPECIFICACIÓN TÉCNICA EN PROCESO',
        bgClass: 'bg-sky-100 text-sky-800 border-sky-300',
        icon: 'bi-hourglass-split'
      };
    }
    return {
      label: 'OPM BÁSICA (COMERCIAL) · PENDIENTE',
      bgClass: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: 'bi-clock-history'
    };
  }

  opmActiveView: 'front' | 'back' = 'front';

  toggleOpmView(view: 'front' | 'back'): void {
    this.opmActiveView = view;
  }

  getActiveOpmImage(): string {
    if (!this.selectedOpmItem?.mold) return '';
    if (this.opmActiveView === 'back' && this.selectedOpmItem.mold.back_image_signed_url) {
      return this.selectedOpmItem.mold.back_image_signed_url;
    }
    return this.selectedOpmItem.mold.image_signed_url || this.selectedOpmItem.mold.back_image_signed_url || '';
  }
}
