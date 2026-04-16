import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-modal-migrar-items',
  templateUrl: './modal-migrar-items.component.html',
})
export class ModalMigrarItemsComponent {
  @Input() show = false;
  @Input() zonas: any[] = [];
  @Input() itemsCount = 0;
  @Input() saving = false;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardar = new EventEmitter<any>();

  id_zona_destino: number | null = null;

  cerrar() {
    this.id_zona_destino = null;
    this.onCerrar.emit();
  }

  guardar() {
    if (!this.id_zona_destino || this.saving) return;
    this.onGuardar.emit(this.id_zona_destino);
    this.id_zona_destino = null;
  }
}
