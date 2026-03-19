import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal-flujo-diario',
  templateUrl: './modal-flujo-diario.component.html',
  host: { class: 'contents' }
})
export class ModalFlujoDiarioComponent {
  @Input() showModalFlujo = false;
  @Input() flujoForm: { titulo: string; fecha: string } = { titulo: '', fecha: '' };

  @Input() showModalCompromiso = false;
  @Input() compromisoModalTitle = 'Nuevo compromiso';
  @Input() compromisoForm: { titulo: string; descripcion: string; responsables: number[] } = {
    titulo: '',
    descripcion: '',
    responsables: [],
  };
  @Input() participantes: Array<{ id: number; nombre: string }> = [];
  @Input() colorPorId: Record<number, string> = {};
  @Input() inicialesPorId: Record<number, string> = {};

  @Output() cerrarModalFlujo = new EventEmitter<void>();
  @Output() guardarFlujo = new EventEmitter<void>();
  @Output() cerrarModalCompromiso = new EventEmitter<void>();
  @Output() guardarCompromiso = new EventEmitter<void>();

  isResponsableSeleccionado(id: number): boolean {
    return this.compromisoForm.responsables.includes(id);
  }

  toggleResponsable(id: number): void {
    if (this.isResponsableSeleccionado(id)) {
      this.compromisoForm.responsables = this.compromisoForm.responsables.filter(rid => rid !== id);
      return;
    }

    this.compromisoForm.responsables = [...this.compromisoForm.responsables, id];
  }
}
