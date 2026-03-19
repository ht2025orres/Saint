import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Proyecto, Actividad, Tarea, NivelTarea } from 'src/app/services/proyectos.service';

@Component({
  selector: 'app-modal-proyecto',
  templateUrl: './modal-proyecto.component.html'
})
export class ModalProyectoComponent {
  // Project Modal
  @Input() showModalProyecto = false;
  @Input() modalProyectoTitle = '';
  @Input() proyectoForm: any = {};
  @Input() selectedProyecto: Proyecto | null = null;
  @Output() onCerrarModalProyecto = new EventEmitter<void>();
  @Output() onGuardarProyecto = new EventEmitter<void>();

  // Activity Modal
  @Input() showModalActividad = false;
  @Input() modalActividadTitle = '';
  @Input() actividadForm: any = {};
  @Input() selectedActividad: Actividad | null = null;
  @Input() detalleProyecto: Proyecto | null = null;
  @Output() onCerrarModalActividad = new EventEmitter<void>();
  @Output() onGuardarActividad = new EventEmitter<void>();

  // Task Modal
  @Input() showModalTarea = false;
  @Input() modalTareaTitle = '';
  @Input() tareaForm: any = {};
  @Input() selectedTarea: Tarea | null = null;
  @Input() nivelTareaActual: NivelTarea = 'sin_acceso';
  @Input() actividadesProyecto: any[] = [];
  @Input() responsablesSelec: any[] = [];
  @Input() usuariosAsignablesFiltrados: any[] = [];
  @Input() busquedaAsignable = '';
  @Output() onCerrarModalTarea = new EventEmitter<void>();
  @Output() onGuardarTarea = new EventEmitter<void>();
  @Output() onAgregarResponsable = new EventEmitter<any>();
  @Output() onQuitarResponsable = new EventEmitter<number>();
  @Output() onBusquedaAsignableChange = new EventEmitter<string>();

  // Assign User to Activity Modal
  @Input() showModalAsignarActividad = false;
  @Input() asignarActividadForm: any = {};
  @Input() asignarActividadGuardando = false;
  @Output() onCerrarModalAsignarActividad = new EventEmitter<void>();
  @Output() onGuardarAsignarActividad = new EventEmitter<void>();

  // Helpers
  puedeCambiarFechas(p: Proyecto): boolean {
    return (p.mis_permisos?.puede_cambiar_fechas ?? false);
  }
}
