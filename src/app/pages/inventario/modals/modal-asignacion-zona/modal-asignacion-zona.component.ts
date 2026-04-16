import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-modal-asignacion-zona',
  templateUrl: './modal-asignacion-zona.component.html',
})
export class ModalAsignacionZonaComponent {
  @Input() show = false;
  @Input() zonas: any[] = [];
  @Input() contadores: any[] = [];
  @Input() idInventario: number | null = null;
  @Input() saving = false;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardar = new EventEmitter<any>();

  asignacion = {
    id_zona: null,
    id_usuario: null
  };

  cerrar() {
    this.asignacion = { id_zona: null, id_usuario: null };
    this.onCerrar.emit();
  }

  guardar() {
    if (!this.asignacion.id_zona || !this.asignacion.id_usuario || !this.idInventario || this.saving) return;
    this.onGuardar.emit({
      ...this.asignacion,
      id_inventario: this.idInventario
    });
    this.asignacion = { id_zona: null, id_usuario: null };
  }
}
