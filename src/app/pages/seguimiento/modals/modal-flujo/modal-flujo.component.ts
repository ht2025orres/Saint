import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-modal-flujo',
  templateUrl: './modal-flujo.component.html',
})
export class ModalFlujoComponent {
  @Input() show = false;
  @Input() saving = false;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onConfirmar = new EventEmitter<void>();
}
