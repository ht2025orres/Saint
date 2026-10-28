import { Component, Input, Output, EventEmitter } from '@angular/core';
import { LocalItem } from '../../costeo-form/costeo-form.component';

@Component({
  selector: 'app-figurin-opm-modal',
  templateUrl: './figurin-opm-modal.component.html',
  styleUrls: ['./figurin-opm-modal.component.css']
})
export class FigurinOpmModalComponent {
  @Input() item: LocalItem | null = null;
  @Input() itemIndex = 0;

  @Output() onOpmSaved = new EventEmitter<any>();
  @Output() onChangeMold = new EventEmitter<void>();
  @Output() onRemoveMold = new EventEmitter<void>();
  @Output() onClose = new EventEmitter<void>();

  handleOpmSaved(event: any): void {
    this.onOpmSaved.emit(event);
  }

  handleChangeMold(): void {
    this.onChangeMold.emit();
  }

  handleRemoveMold(): void {
    this.onRemoveMold.emit();
  }

  close(): void {
    this.onClose.emit();
  }
}

