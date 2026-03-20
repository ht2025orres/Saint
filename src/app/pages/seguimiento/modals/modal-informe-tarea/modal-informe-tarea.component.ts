import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InformeTarea, EstadoInformeTarea } from 'src/app/services/proyectos.service';
import { UsuarioCache } from '../../seguimiento-state.service';

export interface InformeTareaForm {
  titulo:               string;
  descripcion:          string;
  responsable_id:       number;
  estado:               EstadoInformeTarea;
  fecha_limite_entrega: string;
}

@Component({
  selector: 'app-modal-informe-tarea',
  templateUrl: './modal-informe-tarea.component.html',
})
export class ModalInformeTareaComponent implements OnChanges {
  @Input() show = false;
  @Input() tarea: InformeTarea | null = null;
  @Input() usuarios: UsuarioCache[] = [];
  @Input() saving = false;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardar = new EventEmitter<InformeTareaForm>();

  form: FormGroup;

  readonly estados: EstadoInformeTarea[] = ['pendiente', 'en_ejecucion', 'completado'];

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      titulo:               ['', [Validators.required, Validators.minLength(3)]],
      descripcion:          [''],
      responsable_id:       [null, [Validators.required]],
      estado:               ['pendiente', [Validators.required]],
      fecha_limite_entrega: ['', [Validators.required]],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue) {
      if (this.tarea) {
        this.form.patchValue({
          titulo:               this.tarea.titulo,
          descripcion:          this.tarea.descripcion || '',
          responsable_id:       this.tarea.responsable_id,
          estado:               this.tarea.estado,
          fecha_limite_entrega: this.tarea.fecha_limite_entrega || '',
        });
      } else {
        this.form.reset({
          titulo: '', descripcion: '', responsable_id: null, 
          estado: 'pendiente', fecha_limite_entrega: ''
        });
      }
    }
  }

  submit(): void {
    if (this.form.invalid || this.saving) return;
    this.onGuardar.emit(this.form.value);
  }
}
