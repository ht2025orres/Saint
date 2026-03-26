import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { Proyecto, Tarea, Actividad } from '../../../../services/proyectos.service';
import { SeguimientoStateService } from '../../seguimiento-state.service';

type VistaDetalle = 'tareas' | 'actividades';

@Component({
  selector: 'app-proyecto-detalle',
  templateUrl: './proyecto-detalle.component.html',
  changeDetection: ChangeDetectionStrategy.Default
})
export class ProyectoDetalleComponent {
  @Input() show = false;
  @Input() detalle: Proyecto | null = null;
  @Input() loading = false;
  @Input() vistaDetalle: VistaDetalle = 'tareas';
  @Input() tareasPlanas: any[] = [];
  @Input() usuarioId = 0;
  @Input() puedeGestionarModulo = false;
  @Input() aplicandoPlantilla = false;
  @Input() calculandoFechas = false;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onAbrirPermisos = new EventEmitter<void>();
  @Output() onAbrirPlantillas = new EventEmitter<void>();
  @Output() onCalcularFechas = new EventEmitter<void>();
  @Output() onRefresh = new EventEmitter<boolean>();
  @Output() onEditTarea = new EventEmitter<any>();
  @Output() onEditActividad = new EventEmitter<any>();
  @Output() onChangeVista = new EventEmitter<VistaDetalle>();

  constructor(public state: SeguimientoStateService) {}

  // Helpers de permisos (copiados de ProyectosComponent para lógica local)
  puedeEditarProyecto(p: Proyecto): boolean {
    if (this.puedeGestionarModulo) return true;
    if (p.usuario_creador_id === this.usuarioId) return true;
    return p.mis_permisos?.puede_editar ?? false;
  }

  puedeGestionarPermisos(p: Proyecto): boolean {
    if (this.puedeGestionarModulo) return true;
    if (p.usuario_creador_id === this.usuarioId) return true;
    return p.mis_permisos?.puede_gestionar_permisos ?? false;
  }

  puedeCrearEnProyecto(p: Proyecto | null): boolean {
    if (!p) return false;
    if (this.puedeGestionarModulo) return true;
    if (p.usuario_creador_id === this.usuarioId) return true;
    return p.mis_permisos?.puede_crear ?? false;
  }

  esAdminProyecto(p: Proyecto): boolean {
    if (this.puedeGestionarModulo) return true;
    return p.usuario_creador_id === this.usuarioId || (p.mis_permisos?.puede_gestionar_permisos ?? false);
  }
}
