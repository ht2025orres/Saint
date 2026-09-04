import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { ProyectoService, PermisoGranular } from '../../../../services/proyectos.service';
import { SeguimientoStateService } from '../../seguimiento-state.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-permisos-proyecto',
  templateUrl: './modal-permisos-proyecto.component.html',
})
export class ModalPermisosProyectoComponent implements OnChanges {
  @Input() show = false;
  @Input() proyectoId: number | null = null;
  @Input() usuarioId: number | null = null;
  @Input() usuarios: any[] = []; // Para añadir nuevos usuarios

  @Output() onCerrar = new EventEmitter<void>();

  asignaciones: PermisoGranular[] = [];
  loading = false;
  saving = false;
  usuarioSeleccionadoId: number | null = null;

  constructor(
    private proyServ: ProyectoService,
    public state: SeguimientoStateService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue === true && this.proyectoId && this.usuarioId) {
      this.cargarPermisos();
    }
  }

  cargarPermisos(): void {
    if (!this.proyectoId || !this.usuarioId) return;
    this.loading = true;
    this.proyServ.getPermisosEntidad('proyecto', this.proyectoId, this.usuarioId).subscribe({
      next: (res) => {
        this.asignaciones = res.data ?? [];
        this.loading = false;
      },
      error: () => {
        this.state.showToast('Error al cargar permisos', 'error');
        this.loading = false;
      }
    });
  }

  agregarUsuario(): void {
    if (!this.usuarioSeleccionadoId) return;
    
    const existe = this.asignaciones.find(a => a.usuario_id === Number(this.usuarioSeleccionadoId));
    if (existe) {
      this.state.showToast('El usuario ya tiene permisos asignados', 'warning');
      return;
    }

    const user = this.usuarios.find(u => u.id === Number(this.usuarioSeleccionadoId));
    this.asignaciones.push({
      usuario_id: Number(this.usuarioSeleccionadoId),
      nombre: user?.nombre || 'Usuario',
      proceso_nombre: user?.proceso_nombre || null,
      puede_ver: true,
      puede_crear: true,
      puede_editar: true,
      puede_eliminar: true,
      puede_asignar: true,
      puede_cambiar_fechas: true,
      puede_gestionar_permisos: true
    });
    this.usuarioSeleccionadoId = null;
  }

  quitarUsuario(index: number): void {
    this.asignaciones.splice(index, 1);
  }

  guardar(): void {
    if (!this.proyectoId || !this.usuarioId) return;
    this.saving = true;
    this.proyServ.sincronizarPermisosEntidad('proyecto', this.proyectoId, this.usuarioId, this.asignaciones).subscribe({
      next: () => {
        this.state.showToast('Permisos actualizados correctamente');
        this.saving = false;
        this.onCerrar.emit();
      },
      error: () => {
        this.state.showToast('Error al guardar permisos', 'error');
        this.saving = false;
      }
    });
  }
}
