import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProyectoService, FlujoDiario, Compromiso, SeguimientoAnual } from 'src/app/services/proyectos.service';
import { SeguimientoStateService } from '../seguimiento-state.service';
import { CompromisoForm } from '../modals/modal-compromiso/modal-compromiso.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-seguimientos',
  templateUrl: './seguimientos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeguimientosComponent implements OnInit, OnDestroy {
  @Input() usuarioId = 0;
  @Input() puedeGestionarModulo = false;

  loading = false;
  flujoActivo: FlujoDiario | null = null;
  seguimientoActual: SeguimientoAnual | null = null;

  // Modales
  showModalCompromiso = false;
  compromisoParaEditar: Compromiso | null = null;
  savingCompromiso = false;

  showModalFlujo = false;
  savingFlujo = false;

  private _subs = new Subscription();

  constructor(
    private _proyectoService: ProyectoService,
    public state: SeguimientoStateService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this._subs.unsubscribe();
  }

  cargarDatos(): void {
    this.loading = true;
    this._cdr.markForCheck();

    this._proyectoService.getSeguimientosAnuales(this.usuarioId).subscribe({
      next: (res) => {
        const seg = res.data?.find(s => s.estado === 'activo');
        if (seg) {
          this.seguimientoActual = seg;
          this._cargarFlujoActivo(seg.id);
        } else {
          this.loading = false;
          this._cdr.markForCheck();
        }
      },
      error: () => {
        this.loading = false;
        this._cdr.markForCheck();
      }
    });
  }

  private _cargarFlujoActivo(seguimientoId: number): void {
    this._proyectoService.getFlujoActivo(seguimientoId, this.usuarioId).subscribe({
      next: (res) => {
        this.flujoActivo = res.data;
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this._cdr.markForCheck();
      }
    });
  }

  // ── ACCIONES DE COMPROMISOS ───────────────────────────────────────
  
  toggleCompromiso(c: Compromiso): void {
    this._proyectoService.completarCompromiso(c.id, this.usuarioId).subscribe({
      next: () => {
        this.state.showToast('Estado actualizado');
        this.cargarDatos();
      },
      error: () => this.state.showToast('Error al actualizar', 'error')
    });
  }

  abrirModalNuevoCompromiso(): void {
    this.compromisoParaEditar = null;
    this.showModalCompromiso = true;
    this._cdr.markForCheck();
  }

  abrirEditarCompromiso(c: Compromiso): void {
    this.compromisoParaEditar = c;
    this.showModalCompromiso = true;
    this._cdr.markForCheck();
  }

  onGuardarCompromiso(form: CompromisoForm): void {
    if (!this.flujoActivo) return;
    this.savingCompromiso = true;
    this._cdr.markForCheck();

    const body = {
      titulo:       form.titulo,
      descripcion:  form.descripcion,
      responsables: form.responsables,
      flujo_id:     this.flujoActivo.id,
      usuario_id:   this.usuarioId
    };

    const req$ = this.compromisoParaEditar
      ? this._proyectoService.actualizarCompromiso(this.compromisoParaEditar.id, body)
      : this._proyectoService.crearCompromiso(body);

    req$.subscribe({
      next: () => {
        this.savingCompromiso = false;
        this.showModalCompromiso = false;
        this.state.showToast('Compromiso guardado');
        this.cargarDatos();
      },
      error: () => {
        this.savingCompromiso = false;
        this.state.showToast('Error al guardar', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  abrirModalNuevoFlujo(): void {
    this.showModalFlujo = true;
    this._cdr.markForCheck();
  }

  onConfirmarFlujo(): void {
    if (!this.seguimientoActual) return;
    this.savingFlujo = true;
    this._cdr.markForCheck();

    const body = {
      seguimiento_id: this.seguimientoActual.id,
      usuario_id:     this.usuarioId,
      fecha:          new Date().toISOString().split('T')[0]
    };

    this._proyectoService.crearFlujo(body).subscribe({
      next: () => {
        this.savingFlujo = false;
        this.showModalFlujo = false;
        this.state.showToast('Jornada iniciada');
        this.cargarDatos();
      },
      error: () => {
        this.savingFlujo = false;
        this.state.showToast('Error al iniciar jornada', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  cerrarFlujo(): void {
    if (!this.flujoActivo) return;
    
    Swal.fire({
      title: '¿Cerrar flujo del día?',
      text: "Se generará un snapshot del estado actual de los compromisos.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, cerrar flujo'
    }).then((result) => {
      if (result.isConfirmed) {
        this._proyectoService.cerrarFlujo(this.flujoActivo!.id, this.usuarioId).subscribe({
          next: () => {
            this.state.showToast('Flujo cerrado correctamente');
            this.cargarDatos();
          }
        });
      }
    });
  }

  get fechaActual(): Date {
    return new Date();
  }

  getPorcentaje(completados: number, total: number): number {
    return total > 0 ? (completados / total * 100) : 0;
  }

  getPorcentajeWidth(completados: number, total: number): number {
    return total > 0 ? (completados / total * 100) : 0;
  }
}
