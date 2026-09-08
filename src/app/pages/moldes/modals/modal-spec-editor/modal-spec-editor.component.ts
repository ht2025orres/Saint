import { Component, EventEmitter, Input, Output } from '@angular/core';

interface MaterialException {
  assignment_source: 'siesa' | 'manual';
  descripcion: string;
  referencia?: string;
  id_item?: string;
  id_color?: string;
  color?: string;
}

interface SpecComponent {
  name: string;
  material_exception?: MaterialException | null;
  client_material_exception?: MaterialException | null;
}

@Component({
  selector: 'app-modal-spec-editor',
  templateUrl: './modal-spec-editor.component.html',
  styleUrls: ['./modal-spec-editor.component.css']
})
export class ModalSpecEditorComponent {
  @Input() component: SpecComponent | null = null;
  @Input() mode: 'ficha' | 'opm' = 'ficha';
  @Input() context: 'comercial' | 'muestras' | 'molde' = 'comercial';
  @Input() clientSpec: string = '';
  @Input() technicalSpec: string = '';
  @Input() itemData: any = null;
  @Input() solicitudData: any = null;

  @Output() save = new EventEmitter<{ clientSpec: string; technicalSpec: string }>();
  @Output() cancel = new EventEmitter<void>();
  @Output() removeException = new EventEmitter<void>();
  @Output() addExceptionSiesa = new EventEmitter<void>();
  @Output() addExceptionManual = new EventEmitter<void>();
  @Output() removeClientException = new EventEmitter<void>();
  @Output() addClientExceptionSiesa = new EventEmitter<void>();
  @Output() addClientExceptionManual = new EventEmitter<void>();

  isManualTextActive = false;

  onSelectManualMode(): void {
    this.isManualTextActive = true;
    if (!this.clientSpec) {
      this.clientSpec = '';
    }
  }

  onClientSpecTextChange(text: string): void {
    this.clientSpec = text;
  }

  onSave(): void {
    this.save.emit({
      clientSpec: this.clientSpec,
      technicalSpec: this.technicalSpec
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onRemoveException(): void {
    this.removeException.emit();
  }

  onAddExceptionSiesa(): void {
    this.addExceptionSiesa.emit();
  }

  onAddExceptionManual(): void {
    this.addExceptionManual.emit();
  }

  onRemoveClientException(): void {
    this.removeClientException.emit();
  }

  onAddClientExceptionSiesa(): void {
    this.addClientExceptionSiesa.emit();
  }

  onAddClientExceptionManual(): void {
    this.addClientExceptionManual.emit();
  }
}
