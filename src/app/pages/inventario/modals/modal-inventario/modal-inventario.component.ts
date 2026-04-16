import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-modal-inventario',
  templateUrl: './modal-inventario.component.html',
})
export class ModalInventarioComponent {
  @Input() show = false;
  @Input() saving = false;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardar = new EventEmitter<any>();

  nuevoInventario = {
    nombre: '',
    descripcion: '',
    fecha_inicio: ''
  };

  cerrar() {
    this.nuevoInventario = { nombre: '', descripcion: '', fecha_inicio: '' };
    this.onCerrar.emit();
  }

  guardar() {
    if (!this.nuevoInventario.nombre || !this.nuevoInventario.fecha_inicio || this.saving) return;
    this.onGuardar.emit(this.nuevoInventario);
    this.nuevoInventario = { nombre: '', descripcion: '', fecha_inicio: '' };
  }
}
