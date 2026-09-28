import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-modal-zone-selector',
  templateUrl: './modal-zone-selector.component.html',
  styleUrls: ['./modal-zone-selector.component.css']
})
export class ModalZoneSelectorComponent {
  @Input() isOpen = false;
  @Input() isEdit = false;
  @Input() pendingZoneType = 'pecho';
  @Input() zoneTypeOptions: any[] = [];

  @Output() selectZoneType = new EventEmitter<string>();
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onSelectOption(type: string): void {
    this.selectZoneType.emit(type);
  }

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  getZoneColor(type: string): string {
    const opt = this.zoneTypeOptions.find(o => o.value === type);
    return opt ? opt.color : '#4f46e5';
  }

  getZoneLabel(type: string): string {
    const opt = this.zoneTypeOptions.find(o => o.value === type);
    return opt ? opt.label : type;
  }
}
