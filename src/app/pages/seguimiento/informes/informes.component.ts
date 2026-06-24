import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProyectoService, Informe, InformeTarea, TipoInforme, NivelImpacto } from 'src/app/services/proyectos.service';
import { SeguimientoStateService } from '../seguimiento-state.service';
import { InformeForm } from '../modals/modal-informe/modal-informe.component';
import { InformeTareaForm } from '../modals/modal-informe-tarea/modal-informe-tarea.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-informes',
  templateUrl: './informes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InformesComponent implements OnInit, OnDestroy {
  @Input() usuarioId = 0;
  @Input() puedeGestionarModulo = false;
  @Input() vistaMode: 'member' | undefined;

  informes: Informe[] = [];
  loading = false;
  
  // Detalle
  showDetalle = false;
  detalle: Informe | null = null;
  loadingDetalle = false;

  // Modales
  showModalInforme = false;
  informeParaEditar: Informe | null = null;
  savingInforme = false;

  showModalTarea = false;
  tareaParaEditar: InformeTarea | null = null;
  savingTarea = false;

  private _subs = new Subscription();

  constructor(
    private _proyectoService: ProyectoService,
    public state: SeguimientoStateService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarInformes();
  }

  ngOnDestroy(): void {
    this._subs.unsubscribe();
  }

  cargarInformes(): void {
    this.loading = true;
    this._cdr.markForCheck();
    this._proyectoService.getInformes(this.usuarioId).subscribe({
      next: (res) => {
        this.informes = res.data || [];
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this._cdr.markForCheck();
      }
    });
  }

  verDetalle(informe: Informe): void {
    this.loadingDetalle = true;
    this.showDetalle = true;
    this._cdr.markForCheck();

    this._proyectoService.getInformeDetalle(informe.id, this.usuarioId).subscribe({
      next: (res) => {
        this.detalle = res.data;
        this.loadingDetalle = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loadingDetalle = false;
        this.showDetalle = false;
        this._cdr.markForCheck();
      }
    });
  }

  cerrarDetalle(): void {
    this.showDetalle = false;
    this.detalle = null;
    this._cdr.markForCheck();
  }

  stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  }

  getImpactoClass(nivel: NivelImpacto): string {
    switch (nivel) {
      case 'Crítico': return 'bg-red-100 text-red-700 border-red-200';
      case 'Alto':    return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Medio':   return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Bajo':    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  // ── ACCIONES INFORME ─────────────────────────────────────────────

  abrirModalNuevoInforme(): void {
    this.informeParaEditar = null;
    this.showModalInforme = true;
    this._cdr.markForCheck();
  }

  editarInforme(inf: Informe): void {
    this.informeParaEditar = inf;
    this.showModalInforme = true;
    this._cdr.markForCheck();
  }

  onGuardarInforme(form: InformeForm): void {
    this.savingInforme = true;
    this._cdr.markForCheck();

    const body = {
      ...form,
      usuario_id: this.usuarioId
    };

    const req$ = this.informeParaEditar
      ? this._proyectoService.actualizarInforme(this.informeParaEditar.id, body)
      : this._proyectoService.crearInforme(body);

    req$.subscribe({
      next: () => {
        this.savingInforme = false;
        this.showModalInforme = false;
        this.state.showToast('Informe guardado');
        this.cargarInformes();
        if (this.detalle && this.informeParaEditar?.id === this.detalle.id) {
          this.verDetalle(this.detalle);
        }
      },
      error: () => {
        this.savingInforme = false;
        this.state.showToast('Error al guardar', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  eliminarInforme(inf: Informe): void {
    Swal.fire({
      title: '¿Eliminar informe?',
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar'
    }).then(res => {
      if (res.isConfirmed) {
        this._proyectoService.eliminarInforme(inf.id, this.usuarioId).subscribe({
          next: () => {
            this.state.showToast('Informe eliminado');
            this.cargarInformes();
            if (this.showDetalle) this.cerrarDetalle();
          },
          error: () => this.state.showToast('No se pudo eliminar', 'error')
        });
      }
    });
  }

  // ── ACCIONES TAREAS ──────────────────────────────────────────────

  abrirModalNuevaTarea(): void {
    this.tareaParaEditar = null;
    this.showModalTarea = true;
    this._cdr.markForCheck();
  }

  editarTarea(t: InformeTarea): void {
    this.tareaParaEditar = t;
    this.showModalTarea = true;
    this._cdr.markForCheck();
  }

  onGuardarTarea(form: InformeTareaForm): void {
    if (!this.detalle) return;
    this.savingTarea = true;
    this._cdr.markForCheck();

    const body = {
      ...form,
      informe_id: this.detalle.id,
      usuario_id: this.usuarioId
    };

    const req$ = this.tareaParaEditar
      ? this._proyectoService.actualizarInformeTarea(this.tareaParaEditar.id, body)
      : this._proyectoService.crearInformeTarea(body);

    req$.subscribe({
      next: () => {
        this.savingTarea = false;
        this.showModalTarea = false;
        this.state.showToast('Tarea guardada');
        this.verDetalle(this.detalle!);
      },
      error: () => {
        this.savingTarea = false;
        this.state.showToast('Error al guardar', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  eliminarTarea(t: InformeTarea): void {
    Swal.fire({
      title: '¿Eliminar tarea?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar'
    }).then(res => {
      if (res.isConfirmed) {
        this._proyectoService.eliminarInformeTarea(t.id, this.usuarioId).subscribe({
          next: () => {
            this.state.showToast('Tarea eliminada');
            this.verDetalle(this.detalle!);
          },
          error: () => this.state.showToast('No se pudo eliminar', 'error')
        });
      }
    });
  }

  completarTarea(t: InformeTarea): void {
    this._proyectoService.completarInformeTarea(t.id, this.usuarioId).subscribe({
      next: () => {
        this.state.showToast('Tarea completada');
        this.verDetalle(this.detalle!);
      }
    });
  }

  // ── DESCARGA PDF ──────────────────────────────────────────────────

  descargarPdf(): void {
    if (!this.detalle) return;
    const url = this._proyectoService.descargarPdfInformeUrl(this.detalle.id, this.usuarioId);
    window.open(url, '_blank');
  }
}
