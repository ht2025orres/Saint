import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Proyecto } from 'src/app/services/proyectos.service';

export interface ProyectoForm {
  titulo:               string;
  descripcion:          string;
  estado:               string;
  fecha_limite_entrega: string;
  es_plantilla:         boolean;
}

@Component({
  selector: 'app-modal-proyecto',
  templateUrl: './modal-proyecto.component.html',
})
export class ModalProyectoComponent implements OnChanges {

  @Input() show    = false;
  @Input() proyecto: Proyecto | null = null;  // null = crear, object = editar
  @Input() saving  = false;

  @Output() onCerrar  = new EventEmitter<void>();
  @Output() onGuardar = new EventEmitter<ProyectoForm>();

  form: FormGroup;

  readonly estadoOpciones = [
    { v: 'pendiente',    l: 'Pendiente'    },
    { v: 'en_ejecucion', l: 'En ejecución' },
    { v: 'completado',   l: 'Completado'   },
    { v: 'pausado',      l: 'Pausado'      },
    { v: 'cancelado',    l: 'Cancelado'    },
  ];

  get esEdicion(): boolean { return !!this.proyecto; }
  get tituloModal(): string  { return this.esEdicion ? 'Editar Proyecto' : 'Nuevo Proyecto'; }

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      titulo:               ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      descripcion:          [''],
      estado:               ['pendiente'],
      fecha_limite_entrega: [''],
      es_plantilla:         [false],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue === true) {
      this._resetForm();
    }
  }

  private _resetForm(): void {
    if (this.proyecto) {
      this.form.patchValue({
        titulo:               this.proyecto.titulo ?? '',
        descripcion:          this.proyecto.descripcion ?? '',
        estado:               this.proyecto.estado ?? 'pendiente',
        fecha_limite_entrega: this._toLocal(this.proyecto.fecha_limite_entrega),
        es_plantilla:         this.proyecto.es_plantilla ?? false,
      });
    } else {
      this.form.reset({ 
        titulo: '', 
        descripcion: '', 
        estado: 'pendiente', 
        fecha_limite_entrega: '',
        es_plantilla: false 
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
    this.onGuardar.emit(this.form.value as ProyectoForm);
  }

  cerrar(): void { this.onCerrar.emit(); }
}