import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-modal-dia-detalle',
  templateUrl: './modal-dia-detalle.component.html',
})
export class ModalDiaDetalleComponent {
  @Input() show = false;
  @Input() dia: any = null;

  @Output() onCerrar = new EventEmitter<void>();
}
