import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Proyecto } from '../../../../services/proyectos.service';

@Component({
  selector: 'app-modal-plantilla-proyecto',
  templateUrl: './modal-plantilla-proyecto.component.html',
})
export class ModalPlantillaProyectoComponent {
  @Input() show = false;
  @Input() loading = false;
  @Input() plantillas: Proyecto[] = [];

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onSeleccionar = new EventEmitter<Proyecto>();
}
