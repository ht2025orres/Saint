import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Tarea, Actividad, ProyectoService } from 'src/app/services/proyectos.service';
import { SeguimientoStateService, UsuarioCache } from '../../seguimiento-state.service';
import Swal from 'sweetalert2';
import { AuthService } from 'src/app/services/auth.service';

export interface TareaForm {
  actividad_id?:        number | null;
  proyecto_id?:         number | null;
  titulo:               string;
  descripcion:          string;
  estado:               string;
  notas:                string;
  fecha_limite_entrega: string;
  responsables:         number[];
  titulo_reapertura?:    string;
  descripcion_reapertura?: string;
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
  @Input() proyecto: any | null = null;
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

  evidencias: any[] = [];
  loadingEvidencias = false;
  verHistoricoEvidencias = false;

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
    return this.state.usuariosResponsables
      .filter(u => !ids.has(u.id) && (!q || u.nombre.toLowerCase().includes(q)))
      .slice(0, 8);
  }

  constructor(
    private fb: FormBuilder,
    private _proyectoService: ProyectoService,
    private _cdr: ChangeDetectorRef,
    public state: SeguimientoStateService,
    private _auth: AuthService
  ) {
    this.form = this.fb.group({
      proyecto_id:          [null],
      actividad_id:         [null],
      titulo:               ['', [Validators.required, Validators.maxLength(250)]],
      descripcion:          [''],
      estado:               ['pendiente'],
      notas:                [''],
      fecha_limite_entrega: [''],
      titulo_reapertura:    [''],
      descripcion_reapertura: [''],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue === true) {
      this._resetForm();
      if (this.tarea) {
        this.cargarEvidencias();
      }
    }
  }

  private _resetForm(): void {
    this.busquedaResp     = '';
    this.showRespDropdown = false;
    this.evidencias = [];
    this.verHistoricoEvidencias = false;

    if (this.tarea) {
      this.form.patchValue({
        proyecto_id:          this.tarea.proyecto_id ?? null,
        actividad_id:         this.tarea.actividad_id ?? null,
        titulo:               this.tarea.titulo ?? '',
        descripcion:          this.tarea.descripcion ?? '',
        estado:               this.tarea.estado ?? 'pendiente',
        notas:                this.tarea.notas ?? '',
        fecha_limite_entrega: this._toLocal(this.tarea.fecha_limite_entrega),
        titulo_reapertura:    '',
        descripcion_reapertura: '',
      });
      // Resolver responsables desde cache
      this.responsablesSelec = (this.tarea.responsables ?? [])
        .map(id => this.usuariosDisponibles.find(u => u.id === id))
        .filter((u): u is UsuarioCache => !!u);
    } else {
      this.form.reset({
        proyecto_id:  this.proyectoId ?? null,
        actividad_id: this.actividadId ?? null,
        titulo: '', descripcion: '', estado: 'pendiente', notas: '', fecha_limite_entrega: '',
        titulo_reapertura: '',
        descripcion_reapertura: '',
      });
      
      // Si no es admin, auto-asignarse como único responsable al crear
      if (!this.esAdmin) {
        const miId = this._getMiId();
        const miUsuario = this.usuariosDisponibles.find(u => u.id === miId);
        if (miUsuario) {
          this.responsablesSelec = [miUsuario];
        } else {
          this.responsablesSelec = [];
        }
      } else {
        this.responsablesSelec = [];
      }
    }
  }

  cargarEvidencias(): void {
    if (!this.tarea) return;
    this.loadingEvidencias = true;
    const tipo = this.tarea.origen === 'seguimiento' ? 'seguimiento_tarea' : 'tarea';
    const miId = this._getMiId();
    
    this._proyectoService.getEvidencias(tipo as any, this.tarea.id, this.verHistoricoEvidencias, miId).subscribe({
      next: (res: any) => {
        this.evidencias = res.data;
        this.loadingEvidencias = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loadingEvidencias = false;
        this._cdr.markForCheck();
      }
    });
  }

  onSubirArchivo(event: any): void {
    const file = event.target.files[0];
    if (!file || !this.tarea) return;

    const tipo = this.tarea.origen === 'seguimiento' ? 'seguimiento_tarea' : 'tarea';
    const miId = this._getMiId();

    this.loadingEvidencias = true;
    this._proyectoService.subirEvidencia(tipo as any, this.tarea.id, file, miId).subscribe({
      next: () => {
        this.state.showToast('Evidencia subida');
        this.cargarEvidencias();
      },
      error: () => {
        this.loadingEvidencias = false;
        this.state.showToast('Error al subir evidencia', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  verEvidencia(ev: any): void {
    this._proyectoService.getUrlEvidencia(ev.id).subscribe({
      next: (res) => {
        if (res.url) {
          window.open(res.url, '_blank');
        }
      },
      error: () => this.state.showToast('No se pudo obtener el archivo', 'error')
    });
  }

  deshabilitarEvidencia(ev: any): void {
    Swal.fire({
      title: '¿Deshabilitar evidencia?',
      text: 'El archivo ya no será visible en la tarea, pero permanecerá en el sistema por auditoría.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, deshabilitar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then(result => {
      if (result.isConfirmed) {
        this._proyectoService.eliminarEvidencia(ev.id, this._getMiId()).subscribe({
          next: () => {
            this.state.showToast('Evidencia deshabilitada');
            this.cargarEvidencias();
          },
          error: () => this.state.showToast('Error al deshabilitar', 'error')
        });
      }
    });
  }

  restaurarEvidencia(ev: any): void {
    this._proyectoService.restaurarEvidencia(ev.id, this._getMiId()).subscribe({
      next: () => {
        this.state.showToast('Evidencia restaurada');
        this.cargarEvidencias();
      },
      error: () => this.state.showToast('Error al restaurar', 'error')
    });
  }

  private _getMiId(): number {
    return this._auth.user?.id || 0;
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