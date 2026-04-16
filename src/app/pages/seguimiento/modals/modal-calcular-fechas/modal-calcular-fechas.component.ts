import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ProyectoService } from '../../../../services/proyectos.service';
import { SeguimientoStateService, UsuarioCache } from '../../seguimiento-state.service';

@Component({
  selector: 'app-modal-calcular-fechas',
  templateUrl: './modal-calcular-fechas.component.html',
})
export class ModalCalcularFechasComponent {
  @Input() show = false;
  @Input() proyectoId: number | null = null;
  @Input() usuarioId: number | null = null;
  @Input() usuarios: UsuarioCache[] = [];

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onCalculado = new EventEmitter<void>();

  selectedUserIds: number[] = [];
  saving = false;

  constructor(
    private proyServ: ProyectoService,
    public state: SeguimientoStateService
  ) {}

  toggleUsuario(userId: number): void {
    const idx = this.selectedUserIds.indexOf(userId);
    if (idx > -1) {
      this.selectedUserIds.splice(idx, 1);
    } else {
      this.selectedUserIds.push(userId);
    }
  }

  estaSeleccionado(userId: number): boolean {
    return this.selectedUserIds.includes(userId);
  }

  calcular(): void {
    if (!this.proyectoId || !this.usuarioId) return;

    this.saving = true;
    this.proyServ.calcularFechasTareas(this.proyectoId, this.usuarioId, this.selectedUserIds).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.state.showToast(`${res.data?.tareas_actualizadas ?? 0} tareas actualizadas`);
        this.onCalculado.emit();
        this.onCerrar.emit();
        this.selectedUserIds = [];
      },
      error: (err: any) => {
        this.saving = false;
        this.state.showToast(err?.error?.message ?? 'Error al calcular fechas', 'error');
      }
    });
  }
}
