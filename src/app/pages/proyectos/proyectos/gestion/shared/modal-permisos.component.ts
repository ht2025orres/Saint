import { Component, Input, Output, EventEmitter } from '@angular/core';
import { PermisoGranular } from 'src/app/services/proyectos.service';

@Component({
  selector: 'app-modal-permisos',
  templateUrl: './modal-permisos.component.html',
  styleUrls: ['./modal-permisos.component.css']
})
export class ModalPermisosComponent {
  @Input() showModalPermisos = false;
  @Input() permisosEntidad: { tipo: 'proyecto' | 'actividad' | 'tarea'; id: number } | null = null;
  @Input() permisosActuales: PermisoGranular[] = [];
  @Input() nuevaAsignacion: PermisoGranular | null = null;
  @Input() plantillasRol: string[] = [];
  @Input() usuariosFiltrados: any[] = [];
  @Input() busquedaUsuario = '';
  @Input() loadingUsuarios = false;

  @Output() onCerrarModalPermisos = new EventEmitter<void>();
  @Output() onGuardarPermisos = new EventEmitter<void>();
  @Output() onAplicarPlantilla = new EventEmitter<{permiso: PermisoGranular, plantilla: string}>();
  @Output() onQuitarPermiso = new EventEmitter<number>();
  @Output() onFiltrarUsuarios = new EventEmitter<string>();
  @Output() onSeleccionarUsuarioPermiso = new EventEmitter<any>();
  @Output() onAgregarPermiso = new EventEmitter<void>();
}
