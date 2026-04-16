import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-modal-zona',
  templateUrl: './modal-zona.component.html',
})
export class ModalZonaComponent {
  @Input() show = false;
  @Input() bodegas: any[] = [];
  @Input() saving = false;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardar = new EventEmitter<any>();

  nuevaZona = {
    nombre: '',
    descripcion: '',
    codigo_bodega: ''
  };

  cerrar() {
    this.nuevaZona = { nombre: '', descripcion: '', codigo_bodega: '' };
    this.onCerrar.emit();
  }

  guardar() {
    if (!this.nuevaZona.nombre || !this.nuevaZona.codigo_bodega || this.saving) return;
    this.onGuardar.emit(this.nuevaZona);
    this.nuevaZona = { nombre: '', descripcion: '', codigo_bodega: '' };
  }
}
