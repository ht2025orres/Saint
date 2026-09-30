import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-rechazo-oc-modal',
  templateUrl: './rechazo-oc-modal.component.html',
  styleUrls: ['./rechazo-oc-modal.component.css']
})
export class RechazoOcModalComponent implements OnChanges {
  @Input() visible: boolean = false;
  @Input() orden: any = null;

  @Output() onClose = new EventEmitter<void>();
  @Output() onConfirmar = new EventEmitter<string>();

  motivoRechazo: string = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.motivoRechazo = '';
    }
  }

  close(): void {
    this.motivoRechazo = '';
    this.onClose.emit();
  }

  confirmar(): void {
    if (!this.motivoRechazo.trim() || this.motivoRechazo.length < 10) return;
    this.onConfirmar.emit(this.motivoRechazo.trim());
  }
}
