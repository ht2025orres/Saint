import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal-manual-assignment',
  templateUrl: './modal-manual-assignment.component.html',
  styleUrls: ['./modal-manual-assignment.component.css']
})
export class ModalManualAssignmentComponent {
  @Input() manualText: string = '';
  @Input() manualColor: string = '';

  @Output() confirm = new EventEmitter<{ text: string; color: string }>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm(): void {
    if (this.manualText.trim()) {
      this.confirm.emit({
        text: this.manualText.trim(),
        color: this.manualColor.trim()
      });
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
