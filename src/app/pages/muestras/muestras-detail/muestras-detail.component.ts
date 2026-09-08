import { Component, OnInit, Inject, ViewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, Solicitud } from '../../../services/comercial.service';
import { SpecGeneratorComponent } from '../../moldes/spec-generator/spec-generator.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-muestras-detail',
  templateUrl: './muestras-detail.component.html',
  styleUrls: ['./muestras-detail.component.css']
})
export class MuestrasDetailComponent implements OnInit {
  @ViewChild('specGenRef') specGeneratorRef?: SpecGeneratorComponent;

  solicitudId!: number;
  muestra: Solicitud | null = null;
  isLoading = false;
  selectedOpmItem: any = null;
  hoveredOpmPart: any = null;
  pinnedOpmPart: any = null;
  opmActiveView: 'front' | 'back' = 'front';

  isEditingOpmSpec = false;
  editingOpmItem: any = null;

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

  isSavingOpm = false;

  openEditOpmModal(item: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingOpmItem = item;
    this.isEditingOpmSpec = true;
    this.isSavingOpm = false;
  }

  closeEditOpmModal(): void {
    if (this.isEditingOpmSpec && this.editingOpmItem && this.specGeneratorRef) {
      if (this.isSavingOpm) return;
      this.isSavingOpm = true;

      this.specGeneratorRef.saveSpec().subscribe({
        next: (specId) => {
          this.isSavingOpm = false;
          if (specId && this.editingOpmItem?.id) {
            this.comercialService.actualizarItem(this.solicitudId, this.editingOpmItem.id, {
              technical_spec_id: specId
            }).subscribe({
              next: () => {
                this.isEditingOpmSpec = false;
                this.editingOpmItem = null;
                this.loadSolicitud();
              },
              error: () => {
                this.isEditingOpmSpec = false;
                this.editingOpmItem = null;
                this.loadSolicitud();
              }
            });
          } else {
            this.isEditingOpmSpec = false;
            this.editingOpmItem = null;
            this.loadSolicitud();
          }
        },
        error: () => {
          this.isSavingOpm = false;
          this.isEditingOpmSpec = false;
          this.editingOpmItem = null;
          this.loadSolicitud();
        }
      });
    } else {
      this.isEditingOpmSpec = false;
      this.editingOpmItem = null;
    }
  }

  onOpmSpecSaved(specId: number): void {
    this.closeEditOpmModal();
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
    if (!this.document.getElementById('tw-cdn-muestras-detail')) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      link.id = 'tw-cdn-muestras-detail';
      this.document.head.appendChild(link);
    }
    if (!this.document.getElementById('bi-cdn-muestras-detail')) {
      const icons = this.document.createElement('link');
      icons.rel = 'stylesheet';
      icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
      icons.id = 'bi-cdn-muestras-detail';
      this.document.head.appendChild(icons);
    }
  }

  loadSolicitud(): void {
    this.isLoading = true;
    this.comercialService.detalleSolicitud(this.solicitudId).subscribe({
      next: (res) => {
        this.muestra = res.data;
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo cargar el detalle de la muestra', 'error');
        this.isLoading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/muestras']);
  }

  cambiarEstadoMuestra(nuevoEstado: string): void {
    if (!this.muestra?.id) return;
    this.comercialService.cambiarEstadoMuestra(this.muestra.id, nuevoEstado).subscribe({
      next: (res) => {
        if (this.muestra) {
          this.muestra.estado_muestra = nuevoEstado as any;
          if (res.data) {
            this.muestra.fecha_inicio_muestra = res.data.fecha_inicio_muestra;
            this.muestra.fecha_fin_muestra = res.data.fecha_fin_muestra;
          }
        }
        Swal.fire({ title: 'Estado de Muestra Actualizado', icon: 'success', timer: 1200, showConfirmButton: false });
      },
      error: () => Swal.fire('Error', 'No se pudo actualizar el estado de muestra', 'error')
    });
  }

  getTotalUnidades(): number {
    if (!this.muestra?.items) return 0;
    return this.muestra.items.reduce((acc, item) => {
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
    return this.muestra?.observaciones || '';
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
