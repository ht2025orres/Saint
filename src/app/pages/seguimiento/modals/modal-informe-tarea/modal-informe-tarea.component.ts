import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InformeTarea, EstadoInformeTarea, ProyectoService } from 'src/app/services/proyectos.service';
import { SeguimientoStateService, UsuarioCache } from '../../seguimiento-state.service';
import Swal from 'sweetalert2';

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
  @Input() esAdmin = false;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardar = new EventEmitter<InformeTareaForm>();

  form: FormGroup;
  evidencias: any[] = [];
  loadingEvidencias = false;
  verHistoricoEvidencias = false;

  readonly estados: EstadoInformeTarea[] = ['pendiente', 'en_ejecucion', 'completado'];

  constructor(
    private fb: FormBuilder,
    private _proyectoService: ProyectoService,
    private _cdr: ChangeDetectorRef,
    public state: SeguimientoStateService
  ) {
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
      this.evidencias = [];
      this.verHistoricoEvidencias = false;
      if (this.tarea) {
        this.form.patchValue({
          titulo:               this.tarea.titulo,
          descripcion:          this.tarea.descripcion || '',
          responsable_id:       this.tarea.responsable_id,
          estado:               this.tarea.estado,
          fecha_limite_entrega: this.tarea.fecha_limite_entrega || '',
        });
        this.cargarEvidencias();
      } else {
        this.form.reset({
          titulo: '', descripcion: '', responsable_id: null, 
          estado: 'pendiente', fecha_limite_entrega: ''
        });
      }
    }
  }

  cargarEvidencias(): void {
    if (!this.tarea) return;
    this.loadingEvidencias = true;
    const miId = this._getMiId();
    
    this._proyectoService.getEvidencias('informe_tarea', this.tarea.id, this.verHistoricoEvidencias, miId).subscribe({
      next: (res) => {
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

    const miId = this._getMiId();
    this.loadingEvidencias = true;
    this._proyectoService.subirEvidencia('informe_tarea', this.tarea.id, file, miId).subscribe({
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
        if (res.url) window.open(res.url, '_blank');
      },
      error: () => this.state.showToast('No se pudo obtener el archivo', 'error')
    });
  }

  deshabilitarEvidencia(ev: any): void {
    Swal.fire({
      title: '¿Deshabilitar evidencia?',
      text: 'El archivo ya no será visible, pero permanecerá en el sistema por auditoría.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, deshabilitar',
      cancelButtonColor: '#ef4444'
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
    return Number(localStorage.getItem('userId') || 0);
  }

  get usuariosFiltrados(): UsuarioCache[] {
    return this.usuarios.filter(u => 
      u.roles?.some((r: any) => r.nombre.toLowerCase().includes('administrador del sistema'))
    );
  }

  submit(): void {
    if (this.form.invalid || this.saving) return;
    this.onGuardar.emit(this.form.value);
  }
}
