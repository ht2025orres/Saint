import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Actividad, Proyecto } from 'src/app/services/proyectos.service';
import { SeguimientoStateService, UsuarioCache } from '../../seguimiento-state.service';

export interface ActividadForm {
  proyecto_id:          number | null;
  titulo:               string;
  descripcion:          string;
  estado:               string;
  fecha_limite_entrega: string;
  responsables:         number[];
  titulo_reapertura?:    string;
  descripcion_reapertura?: string;
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
  responsablesSelec: UsuarioCache[] = [];
  busquedaResp = '';
  showRespDropdown = false;

  readonly estadoOpciones = [
    { v: 'pendiente',    l: 'Pendiente'    },
    { v: 'en_ejecucion', l: 'En ejecución' },
    { v: 'completado',   l: 'Completado'   },
    { v: 'pausado',      l: 'Pausado'      },
  ];

  get esEdicion(): boolean { return !!this.actividad; }
  get titulo():    string  { return this.esEdicion ? 'Editar Actividad' : 'Nueva Actividad'; }

  get usuariosFiltrados(): UsuarioCache[] {
    const ids = new Set(this.responsablesSelec.map(r => r.id));
    const q   = this.busquedaResp.toLowerCase().trim();
    return this.state.usuariosResponsables
      .filter(u => !ids.has(u.id) && (!q || u.nombre.toLowerCase().includes(q)))
      .slice(0, 8);
  }

  constructor(
    private fb: FormBuilder,
    public state: SeguimientoStateService
  ) {
    this.form = this.fb.group({
      proyecto_id:          [null],
      titulo:               ['', [Validators.required, Validators.maxLength(200)]],
      descripcion:          [''],
      estado:               ['pendiente'],
      fecha_limite_entrega: [''],
      titulo_reapertura:    [''],
      descripcion_reapertura: [''],
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

    if (this.actividad) {
      this.form.patchValue({
        proyecto_id:          this.proyecto?.id ?? null,
        titulo:               this.actividad.titulo ?? '',
        descripcion:          this.actividad.descripcion ?? '',
        estado:               this.actividad.estado ?? 'pendiente',
        fecha_limite_entrega: this._toLocal(this.actividad.fecha_limite_entrega),
        titulo_reapertura:    '',
        descripcion_reapertura: '',
      });
      // Resolver responsables
      this.responsablesSelec = (this.actividad.responsables ?? [])
        .map(id => this.state.usuariosCache.find(u => u.id === id))
        .filter((u): u is UsuarioCache => !!u);
    } else {
      this.form.reset({
        proyecto_id: this.proyecto?.id ?? null,
        titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '',
        titulo_reapertura: '',
        descripcion_reapertura: '',
      });
      this.responsablesSelec = [];
    }
  }

  private _toLocal(value?: string | null): string {
    if (!value) return '';
    const [date, time] = value.split('T');
    return `${date}T${time?.substring(0, 5) ?? ''}`;
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
    this.onGuardar.emit({
      ...this.form.value,
      responsables: this.responsablesSelec.map(r => r.id)
    } as ActividadForm);
  }

  cerrar(): void { this.onCerrar.emit(); }
}