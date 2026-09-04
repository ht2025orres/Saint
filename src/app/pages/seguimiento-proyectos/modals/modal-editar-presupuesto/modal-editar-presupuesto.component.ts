import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SeguimientoProyectosService, ProyectoFinanciero } from 'src/app/services/seguimiento-proyectos.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-editar-presupuesto',
  templateUrl: './modal-editar-presupuesto.component.html'
})
export class ModalEditarPresupuestoComponent implements OnInit {
  @Input() proyecto: ProyectoFinanciero | null = null;
  @Output() cerrar = new EventEmitter<boolean>();

  form!: FormGroup;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private spService: SeguimientoProyectosService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      codigo_proyecto: [this.proyecto?.codigo_proyecto || '', [Validators.required]],
      nombre_proyecto: [this.proyecto?.nombre_proyecto || ''],
      cliente: [this.proyecto?.cliente || ''],
      estado: [this.proyecto?.estado || 'activo', [Validators.required]],
      facturacion_presupuestada: [this.proyecto?.facturacion_presupuestada || 0, [Validators.required, Validators.min(0)]],
      costo_presupuestado: [this.proyecto?.costo_presupuestado || 0, [Validators.required, Validators.min(0)]],
      admin_mano_obra_presupuestada: [this.proyecto?.admin_mano_obra_presupuestada || 0, [Validators.min(0)]],
      comision_presupuestada: [this.proyecto?.comision_presupuestada || 0, [Validators.min(0)]],
      observaciones: [this.proyecto?.observaciones || '']
    });

    if (this.proyecto) {
      this.form.get('codigo_proyecto')?.disable();
    }
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const rawValue = this.form.getRawValue();

    if (this.proyecto) {
      this.spService.actualizarProyecto(this.proyecto.id, rawValue).subscribe({
        next: () => {
          Swal.fire('Guardado', 'Proyecto actualizado exitosamente', 'success');
          this.cerrar.emit(true);
        },
        error: () => {
          Swal.fire('Error', 'No se pudo actualizar el proyecto', 'error');
          this.saving = false;
        }
      });
    } else {
      this.spService.crearProyecto(rawValue).subscribe({
        next: () => {
          Swal.fire('Creado', 'Proyecto registrado exitosamente', 'success');
          this.cerrar.emit(true);
        },
        error: (err) => {
          const msg = err.error?.message || 'No se pudo crear el proyecto';
          Swal.fire('Error', msg, 'error');
          this.saving = false;
        }
      });
    }
  }

  onCerrar(): void {
    this.cerrar.emit(false);
  }
}
