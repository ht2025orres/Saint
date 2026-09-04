import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy
} from '@angular/core';

export interface TareaDetalleEstadistica {
  id: number;
  titulo: string;
  descripcion?: string;
  estado: string;
  prioridad?: number;
  fecha_limite_entrega?: string;
  fecha_completado?: string;
  proyecto_nombre?: string;
  actividad_titulo?: string;
}

@Component({
  selector: 'app-modal-detalle-tareas-estadisticas',
  templateUrl: './modal-detalle-tareas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalDetalleTareasEstadisticasComponent {
  @Input() show = false;
  @Input() nombreMiembro = '';
  @Input() cargoMiembro = '';
  @Input() tareas: TareaDetalleEstadistica[] = [];

  @Output() onCerrar = new EventEmitter<void>();

  filtroEstado = 'todos';

  get tareasFiltradas(): TareaDetalleEstadistica[] {
    if (!this.tareas) return [];
    if (this.filtroEstado === 'todos') return this.tareas;
    if (this.filtroEstado === 'completadas') return this.tareas.filter(t => t.estado === 'completado');
    if (this.filtroEstado === 'pendientes') return this.tareas.filter(t => t.estado !== 'completado');
    return this.tareas;
  }

  cerrar(): void {
    this.onCerrar.emit();
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'completado':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'en_progreso':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'en_espera':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }
}
