import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
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
  get usuariosDisponibles(): UsuarioCache[] { return this.state.usuariosResponsables; }

  get usuariosFiltrados(): UsuarioCache[] {
    const ids = new Set(this.responsablesSelec.map(r => r.id));
    const q   = this.busquedaResp.toLowerCase().trim();
    return this.state.usuariosResponsables
      .filter(u => !ids.has(u.id) && (!q || u.nombre.toLowerCase().includes(q)))
      .slice(0, 8);
  }

  constructor(
    private fb: FormBuilder,
    public state: SeguimientoStateService,
    private _cdr: ChangeDetectorRef
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
    if (changes['show']?.currentValue === true || (this.show && (changes['actividad'] || changes['usuariosDisponibles']))) {
      this._resetForm();
    }
  }

  private _resolverResponsables(obj: any): UsuarioCache[] {
    if (!obj) return [];

    let rawResp: any[] = [];
    if (Array.isArray(obj.responsables) && obj.responsables.length > 0) {
      rawResp = obj.responsables;
    } else if (Array.isArray(obj.responsables_ids) && obj.responsables_ids.length > 0) {
      rawResp = obj.responsables_ids;
    } else if (Array.isArray(obj.responsables_info) && obj.responsables_info.length > 0) {
      rawResp = obj.responsables_info;
    } else if (obj.responsable_id != null) {
      rawResp = [obj.responsable_id];
    } else if (obj.usuario_id != null) {
      rawResp = [obj.usuario_id];
    } else if (obj.responsables != null && !Array.isArray(obj.responsables)) {
      rawResp = [obj.responsables];
    }

    const resolvedList: UsuarioCache[] = [];

    for (const item of rawResp) {
      if (item === null || item === undefined || item === '') continue;

      let numId = 0;
      let itemObj: any = null;

      if (typeof item === 'number') {
        numId = item;
      } else if (typeof item === 'string') {
        numId = Number(item);
      } else if (typeof item === 'object') {
        itemObj = item;
        numId = Number(item.id || item.usuario_id || item.user_id || 0);
      }

      if (isNaN(numId) || numId <= 0) continue;

      if (resolvedList.some(u => Number(u.id) === numId)) continue;

      let uMatch = this.usuariosDisponibles.find(u => Number(u.id) === numId)
                || this.state.usuariosCache.find(u => Number(u.id) === numId)
                || this.state.usuariosResponsables.find(u => Number(u.id) === numId);

      if (!uMatch) {
        const nombreStr = itemObj?.nombre || itemObj?.name || itemObj?.nombre_completo || this.state.nombreUsuario(numId) || `Usuario ${numId}`;
        const inicStr   = itemObj?.iniciales || this.state.getInicialesResponsable(numId) || (nombreStr ? nombreStr.substring(0, 2).toUpperCase() : `${numId}`);
        const colorStr  = itemObj?.color || this.state.getColorPorId(numId) || 'bg-blue-600';

        uMatch = {
          id: numId,
          nombre: nombreStr,
          iniciales: inicStr,
          color: colorStr,
          permiso_seguimiento_id: 1,
          cargo_id: 0,
          cargo_nombre: ''
        };
      }

      if (uMatch) {
        resolvedList.push(uMatch);
      }
    }

    return resolvedList;
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
      // Resolver responsables de forma exhaustiva
      this.responsablesSelec = this._resolverResponsables(this.actividad);
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

  agregarResponsable(u: UsuarioCache, ev?: Event): void {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    const targetId = Number(u.id);
    if (!this.responsablesSelec.find(r => Number(r.id) === targetId))
      this.responsablesSelec = [...this.responsablesSelec, u];
    this.busquedaResp     = '';
    this.showRespDropdown = false;
    this._cdr.detectChanges();
  }

  quitarResponsable(id: number | string, ev?: Event): void {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    const targetId = Number(id);
    this.responsablesSelec = this.responsablesSelec.filter(r => Number(r.id) !== targetId);
    this._cdr.detectChanges();
  }

  guardar(): void {
    if (this.form.invalid || this.saving) return;
    if (!this.responsablesSelec || this.responsablesSelec.length === 0) {
      this.state.showToast('Debe asignar al menos un responsable a la actividad', 'warning');
      return;
    }
    this.onGuardar.emit({
      ...this.form.value,
      responsables: this.responsablesSelec.map(r => r.id)
    } as ActividadForm);
  }

  cerrar(): void { this.onCerrar.emit(); }
}