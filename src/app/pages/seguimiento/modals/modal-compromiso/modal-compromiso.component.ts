import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Compromiso } from 'src/app/services/proyectos.service';
import { SeguimientoStateService, UsuarioCache } from '../../seguimiento-state.service';

export interface CompromisoForm {
  titulo:       string;
  descripcion:  string;
  responsables: number[];
}

@Component({
  selector: 'app-modal-compromiso',
  templateUrl: './modal-compromiso.component.html',
})
export class ModalCompromisoComponent implements OnChanges {
  @Input() show = false;
  @Input() compromiso: Compromiso | null = null;
  @Input() usuarios: UsuarioCache[] = [];
  @Input() saving = false;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardar = new EventEmitter<CompromisoForm>();

  form: FormGroup;

  constructor(private fb: FormBuilder, public state: SeguimientoStateService) {
    this.form = this.fb.group({
      titulo:       ['', [Validators.required, Validators.minLength(3)]],
      descripcion:  [''],
      responsables: [[], [Validators.required]],
    });
  }

  isUsuarioSeleccionado(uid: number): boolean {
    const responsables = this.form.get('responsables')?.value || [];
    return responsables.includes(uid);
  }

  toggleUsuario(uid: number): void {
    const control = this.form.get('responsables');
    if (!control) return;
    const actuales = [...(control.value || [])];
    const index = actuales.indexOf(uid);
    if (index > -1) actuales.splice(index, 1);
    else actuales.push(uid);
    control.setValue(actuales);
    control.markAsDirty();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue) {
      if (this.compromiso) {
        this.form.patchValue({
          titulo:       this.compromiso.titulo,
          descripcion:  this.compromiso.descripcion || '',
          responsables: this.compromiso.responsables || [],
        });
      } else {
        this.form.reset({
          titulo: '', descripcion: '', responsables: [],
        });
      }
    }
  }

  submit(): void {
    if (this.form.invalid || this.saving) return;
    this.onGuardar.emit(this.form.value);
  }
}
