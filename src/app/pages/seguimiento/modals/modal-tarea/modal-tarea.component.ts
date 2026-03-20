import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Tarea, Actividad } from 'src/app/services/proyectos.service';
import { UsuarioCache } from '../../seguimiento-state.service';

export interface TareaForm {
  actividad_id?:        number | null;
  proyecto_id?:         number | null;
  titulo:               string;
  descripcion:          string;
  estado:               string;
  notas:                string;
  fecha_limite_entrega: string;
  responsables:         number[];
}

@Component({
  selector: 'app-modal-tarea',
  templateUrl: './modal-tarea.component.html',
})
export class ModalTareaComponent implements OnChanges {

  @Input() show               = false;
  @Input() tarea: Tarea | null    = null;
  @Input() actividadId: number | null = null;
  @Input() proyectoId: number  | null = null;
  @Input() actividades: Actividad[]   = [];
  @Input() usuariosDisponibles: UsuarioCache[] = [];
  @Input() saving = false;
  /** true = admin/gestor; false = solo puede editar lo básico */
  @Input() esAdmin = true;

  @Output() onCerrar  = new EventEmitter<void>();
  @Output() onGuardar = new EventEmitter<TareaForm>();

  form: FormGroup;
  responsablesSelec: UsuarioCache[] = [];
  busquedaResp = '';
  showRespDropdown = false;

  readonly estadoOpciones = [
    { v: 'pendiente',    l: 'Pendiente'    },
    { v: 'en_ejecucion', l: 'En ejecución' },
    { v: 'completado',   l: 'Completado'   },
    { v: 'bloqueado',    l: 'Bloqueado'    },
    { v: 'pausado',      l: 'Pausado'      },
  ];

  get esEdicion(): boolean { return !!this.tarea; }
  get titulo():    string  { return this.esEdicion ? 'Editar Tarea' : 'Nueva Tarea'; }

  get usuariosFiltrados(): UsuarioCache[] {
    const ids = new Set(this.responsablesSelec.map(r => r.id));
    const q   = this.busquedaResp.toLowerCase().trim();
    return this.usuariosDisponibles
      .filter(u => !ids.has(u.id) && (!q || u.nombre.toLowerCase().includes(q)))
      .slice(0, 8);
  }

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      actividad_id:         [null],
      titulo:               ['', [Validators.required, Validators.maxLength(250)]],
      descripcion:          [''],
      estado:               ['pendiente'],
      notas:                [''],
      fecha_limite_entrega: [''],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue === true) {
      this._resetForm();
    }
  }

  private _resetForm(): void {
    this.busquedaResp     = '';
    this.showRespDropdown = false;

    if (this.tarea) {
      this.form.patchValue({
        actividad_id:         this.tarea.actividad_id ?? null,
        titulo:               this.tarea.titulo ?? '',
        descripcion:          this.tarea.descripcion ?? '',
        estado:               this.tarea.estado ?? 'pendiente',
        notas:                this.tarea.notas ?? '',
        fecha_limite_entrega: this._toLocal(this.tarea.fecha_limite_entrega),
      });
      // Resolver responsables desde cache
      this.responsablesSelec = (this.tarea.responsables ?? [])
        .map(id => this.usuariosDisponibles.find(u => u.id === id))
        .filter((u): u is UsuarioCache => !!u);
    } else {
      this.form.reset({
        actividad_id: this.actividadId ?? null,
        titulo: '', descripcion: '', estado: 'pendiente', notas: '', fecha_limite_entrega: '',
      });
      this.responsablesSelec = [];
    }
  }

  private _toLocal(v?: string | null): string {
    if (!v) return '';
    const [d, t] = v.split('T');
    return `${d}T${t?.substring(0, 5) ?? ''}`;
  }

  agregarResponsable(u: UsuarioCache): void {
    if (!this.responsablesSelec.find(r => r.id === u.id))
      this.responsablesSelec = [...this.responsablesSelec, u];
    this.busquedaResp     = '';
    this.showRespDropdown = false;
  }

  quitarResponsable(id: number): void {
    this.responsablesSelec = this.responsablesSelec.filter(r => r.id !== id);
  }

  guardar(): void {
    if (this.form.invalid || this.saving) return;
    const v = this.form.value;
    this.onGuardar.emit({
      ...v,
      proyecto_id:  this.proyectoId,
      responsables: this.responsablesSelec.map(r => r.id),
    } as TareaForm);
  }

  cerrar(): void { this.onCerrar.emit(); }
}