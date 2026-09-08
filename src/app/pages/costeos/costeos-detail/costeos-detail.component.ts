import { Component, OnInit, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, Solicitud } from '../../../services/comercial.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-costeos-detail',
  templateUrl: './costeos-detail.component.html',
  styleUrls: ['./costeos-detail.component.css']
})
export class CosteosDetailComponent implements OnInit {
  solicitudId!: number;
  costeo: Solicitud | null = null;
  isLoading = false;
  activeTab: 'versiones' | 'items' = 'versiones';
  selectedOpmItem: any = null;
  hoveredOpmPart: any = null;
  pinnedOpmPart: any = null;
  opmActiveView: 'front' | 'back' = 'front';

  openOpmModal(item: any): void {
    this.selectedOpmItem = item;
    this.hoveredOpmPart = null;
    this.pinnedOpmPart = null;
    this.opmActiveView = 'front';
  }

  closeOpmModal(): void {
    this.selectedOpmItem = null;
    this.hoveredOpmPart = null;
    this.pinnedOpmPart = null;
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
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.solicitudId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadSolicitud();
  }

  private loadTailwind(): void {
    if (!this.document.getElementById('tw-cdn-costeos-detail')) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      link.id = 'tw-cdn-costeos-detail';
      this.document.head.appendChild(link);
    }
    if (!this.document.getElementById('bi-cdn-costeos-detail')) {
      const icons = this.document.createElement('link');
      icons.rel = 'stylesheet';
      icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
      icons.id = 'bi-cdn-costeos-detail';
      this.document.head.appendChild(icons);
    }
  }

  loadSolicitud(): void {
    this.isLoading = true;
    this.comercialService.detalleSolicitud(this.solicitudId).subscribe({
      next: (res) => {
        this.costeo = res.data;
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo cargar el detalle del costeo', 'error');
        this.isLoading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/costeos']);
  }

  cambiarEstadoCosteo(nuevoEstado: string): void {
    if (!this.costeo?.id) return;
    this.comercialService.cambiarEstadoCosteo(this.costeo.id, nuevoEstado).subscribe({
      next: (res) => {
        if (this.costeo) {
          this.costeo.estado_costeo = nuevoEstado as any;
          if (res.data) {
            this.costeo.fecha_inicio_costeo = res.data.fecha_inicio_costeo;
            this.costeo.fecha_fin_costeo = res.data.fecha_fin_costeo;
          }
        }
        Swal.fire({ title: 'Estado de Costeo Actualizado', icon: 'success', timer: 1200, showConfirmButton: false });
      },
      error: () => Swal.fire('Error', 'No se pudo actualizar el estado de costeo', 'error')
    });
  }

  // Modal Nueva Versión de Cotización (Calculadora de Costos)
  showVersionModal = false;
  newVersionData = {
    precio_tela: 0,
    promedio_trazo: 0,
    costo_mano_obra: 0,
    costo_insumos: 0,
    margen_ganancia: 25,
    notas: ''
  };

  openVersionModal(): void {
    this.newVersionData = {
      precio_tela: 0,
      promedio_trazo: 0,
      costo_mano_obra: 0,
      costo_insumos: 0,
      margen_ganancia: 25,
      notas: ''
    };
    this.showVersionModal = true;
  }

  closeVersionModal(): void {
    this.showVersionModal = false;
  }

  get calculoCostoTela(): number {
    return (this.newVersionData.precio_tela || 0) * (this.newVersionData.promedio_trazo || 0);
  }

  get calculoCostoTotalUnitario(): number {
    return this.calculoCostoTela + (this.newVersionData.costo_mano_obra || 0) + (this.newVersionData.costo_insumos || 0);
  }

  get calculoPrecioVenta(): number {
    const costo = this.calculoCostoTotalUnitario;
    const margen = (this.newVersionData.margen_ganancia || 0) / 100;
    if (margen >= 1) return costo;
    return costo / (1 - margen);
  }

  guardarVersionCotizacion(): void {
    const payload = {
      precio_tela: this.newVersionData.precio_tela,
      promedio_trazo: this.newVersionData.promedio_trazo,
      costo_total_unitario: Math.round(this.calculoCostoTotalUnitario * 100) / 100,
      precio_venta_unitario: Math.round(this.calculoPrecioVenta * 100) / 100,
      notas: this.newVersionData.notas ? `[MO: $${this.newVersionData.costo_mano_obra} | Insumos: $${this.newVersionData.costo_insumos} | Margen: ${this.newVersionData.margen_ganancia}%] ${this.newVersionData.notas}` : `[MO: $${this.newVersionData.costo_mano_obra} | Insumos: $${this.newVersionData.costo_insumos} | Margen: ${this.newVersionData.margen_ganancia}%]`
    };

    this.comercialService.crearVersion(this.solicitudId, payload).subscribe({
      next: () => {
        this.closeVersionModal();
        this.loadSolicitud();
        Swal.fire({ title: 'Versión de Cotización Creada', icon: 'success', timer: 1500, showConfirmButton: false });
      },
      error: () => Swal.fire('Error', 'No se pudo guardar la versión de cotización', 'error')
    });
  }

  crearVersion(): void {
    this.openVersionModal();
  }

  getTotalUnidades(): number {
    if (!this.costeo?.items) return 0;
    return this.costeo.items.reduce((acc, item) => {
      if (item.tallas?.length) {
        return acc + item.tallas.reduce((tAcc, t) => tAcc + (t.cantidad || 0), 0);
      }
      return acc + (item.cantidad_muestra || 0);
    }, 0);
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
}
