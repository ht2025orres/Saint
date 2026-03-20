import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Actividad, Proyecto } from 'src/app/services/proyectos.service';

export interface ActividadForm {
  proyecto_id:          number | null;
  titulo:               string;
  descripcion:          string;
  estado:               string;
  fecha_limite_entrega: string;
}

@Component({
  selector: 'app-modal-actividad',
  templateUrl: './modal-actividad.component.html',
})
export class ModalActividadComponent implements OnChanges {

  @Input() show       = false;
  @Input() actividad: Actividad | null = null;
  @Input() proyecto:  Proyecto  | null = null;
  @Input() saving     = false;

  @Output() onCerrar  = new EventEmitter<void>();
  @Output() onGuardar = new EventEmitter<ActividadForm>();

  form: FormGroup;

  readonly estadoOpciones = [
    { v: 'pendiente',    l: 'Pendiente'    },
    { v: 'en_ejecucion', l: 'En ejecución' },
    { v: 'completado',   l: 'Completado'   },
    { v: 'pausado',      l: 'Pausado'      },
  ];

  get esEdicion(): boolean { return !!this.actividad; }
  get titulo():    string  { return this.esEdicion ? 'Editar Actividad' : 'Nueva Actividad'; }

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      proyecto_id:          [null],
      titulo:               ['', [Validators.required, Validators.maxLength(200)]],
      descripcion:          [''],
      estado:               ['pendiente'],
      fecha_limite_entrega: [''],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue === true) {
      this._resetForm();
    }
  }

  private _resetForm(): void {
    if (this.actividad) {
      this.form.patchValue({
        proyecto_id:          this.proyecto?.id ?? null,
        titulo:               this.actividad.titulo ?? '',
        descripcion:          this.actividad.descripcion ?? '',
        estado:               this.actividad.estado ?? 'pendiente',
        fecha_limite_entrega: this._toLocal(this.actividad.fecha_limite_entrega),
      });
    } else {
      this.form.reset({
        proyecto_id: this.proyecto?.id ?? null,
        titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '',
      });
    }
  }

  private _toLocal(value?: string | null): string {
    if (!value) return '';
    const [date, time] = value.split('T');
    return `${date}T${time?.substring(0, 5) ?? ''}`;
  }

  guardar(): void {
    if (this.form.invalid || this.saving) return;
    this.onGuardar.emit(this.form.value as ActividadForm);
  }

  cerrar(): void { this.onCerrar.emit(); }
}