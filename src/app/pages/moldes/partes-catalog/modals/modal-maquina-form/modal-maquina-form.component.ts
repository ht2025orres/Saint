import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-modal-maquina-form',
  templateUrl: './modal-maquina-form.component.html',
  styleUrls: ['./modal-maquina-form.component.css']
})
export class ModalMaquinaFormComponent {
  @Input() isOpen = false;
  @Input() isEditing = false;
  @Input() machineForm: any = {
    id: null,
    name: '',
    code: '',
    description: '',
    is_active: true
  };

  @Output() saveMachine = new EventEmitter<void>();
  @Output() closeMachine = new EventEmitter<void>();

  onSave(): void {
    this.saveMachine.emit();
  }

  onClose(): void {
    this.closeMachine.emit();
  }
}
