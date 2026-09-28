import { Component, Input, Output, EventEmitter } from '@angular/core';
import { SharedOperation } from '../../partes-catalog.component';

@Component({
  selector: 'app-modal-standard-op-form',
  templateUrl: './modal-standard-op-form.component.html',
  styleUrls: ['./modal-standard-op-form.component.css']
})
export class ModalStandardOpFormComponent {
  @Input() isOpen = false;
  @Input() isEditing = false;
  @Input() standardOpForm: SharedOperation = {
    operation_name: '',
    machine_name: 'PLANA',
    execution_time: 0.50,
    category: 'Ensamble'
  };
  @Input() machines: any[] = [];
  @Input() categoriesList: string[] = [];

  @Output() saveOp = new EventEmitter<void>();
  @Output() closeOp = new EventEmitter<void>();

  onSave(): void {
    this.saveOp.emit();
  }

  onClose(): void {
    this.closeOp.emit();
  }
}
