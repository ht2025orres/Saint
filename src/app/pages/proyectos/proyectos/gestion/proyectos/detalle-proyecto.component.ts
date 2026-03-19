import { Component, Input, Output, EventEmitter, ElementRef, ViewChild } from '@angular/core';
import { Proyecto, Actividad, Tarea, NivelTarea, Semaforo } from 'src/app/services/proyectos.service';

@Component({
  selector: 'app-detalle-proyecto',
  templateUrl: './detalle-proyecto.component.html',
  styleUrls: ['./detalle-proyecto.component.css']
})
export class DetalleProyectoComponent {
  @Input() showDetalleModal = false;
  @Input() loadingDetalle = false;
  @Input() detalleProyecto: Proyecto | null = null;
  @Input() actividadExpandidaId: number | null = null;
  @Input() filtroEstadoTarea = 'todos';
  @Input() filtroTipoTarea = 'todas';
  @Input() usuariosAsignables: any[] = [];
  @Input() usuariosCache: any[] = [];
  @Input() usuarioId = 0;
  
  // Inline Task State
  @Input() showInlineTask = false;
  @Input() inlineTaskForm: any = {};
  @Input() inlineTaskGuardando = false;
  @Input() showInlineEstado = false;
  @Input() showInlineAsignado = false;
  @Input() inlineAsignadoBusqueda = '';
  @Input() hoveredTaskId: number | null = null;

  // Inline Edit State
  @Input() inlineEditingTaskId: number | null = null;
  @Input() inlineEditForm: any = {};
  @Input() inlineEditShowEstado = false;
  @Input() showInlineEditAsignado = false;
  @Input() inlineEditAsignadoBusqueda = '';

  @Input() vistaTareas = true;
  @Input() calculandoFechas = false;

  @Output() onCerrarDetalle = new EventEmitter<void>();
  @Output() onToggleActividad = new EventEmitter<number>();
  @Output() onCalcularFechas = new EventEmitter<void>();
  @Output() onCambiarVistaTareas = new EventEmitter<boolean>();
  @Output() onLimpiarFiltrosTareas = new EventEmitter<void>();
  
  // Inline Task Actions
  @Output() onAbrirFilaInline = new EventEmitter<number | null>();
  @Output() onCancelarFilaInline = new EventEmitter<void>();
  @Output() onGuardarTareaInline = new EventEmitter<void>();
  @Output() onInlineTitleKeydown = new EventEmitter<KeyboardEvent>();
  
  // Inline Edit Actions
  @Output() onAbrirEdicionInline = new EventEmitter<Tarea>();
  @Output() onCancelarEdicionInline = new EventEmitter<void>();
  @Output() onGuardarEdicionInline = new EventEmitter<void>();
  @Output() onInlineEditKeydown = new EventEmitter<KeyboardEvent>();
  
  // Task Actions
  @Output() onCompletarTarea = new EventEmitter<Tarea>();
  @Output() onEliminarTarea = new EventEmitter<Tarea>();
  @Output() onMoverTarea = new EventEmitter<Tarea>();
  @Output() onAbrirModalEditarTarea = new EventEmitter<{tarea: Tarea, modo: 'admin' | 'parcial'}>();
  @Output() onAbrirModalPermisos = new EventEmitter<{tipo: 'tarea' | 'actividad', id: number}>();
  @Output() onAbrirModalEvidencia = new EventEmitter<{tipo: 'tarea', id: number, titulo: string}>();
  
  // Activity Actions
  @Output() onAbrirModalCrearActividad = new EventEmitter<Proyecto>();
  @Output() onAbrirModalEditarActividad = new EventEmitter<Actividad>();
  @Output() onEliminarActividad = new EventEmitter<Actividad>();
  @Output() onAbrirModalAsignarActividad = new EventEmitter<Actividad>();
  @Output() onAbrirModalCrearTareaGeneral = new EventEmitter<void>();

  // Getters moved from parent
  get tareasPlanasFiltradas(): any[] {
    // This logic should ideally stay in the parent or a service, 
    // but for now we'll expect the parent to pass the filtered list 
    // OR we re-implement it here if we have all dependencies.
    // For simplicity, let's assume the parent passes 'tareasPlanasFiltradas' as an Input.
    return this._tareasPlanasFiltradas;
  }
  @Input() set tareasPlanasFiltradas(val: any[]) { this._tareasPlanasFiltradas = val; }
  private _tareasPlanasFiltradas: any[] = [];

  // Helper methods (duplicated or moved)
  getSemaforoClass(semaforo?: Semaforo | string): string {
    return ({ rojo: 'bg-red-500', amarillo: 'bg-yellow-400', verde: 'bg-green-500', gris: 'bg-gray-300' })[semaforo ?? 'gris'] ?? 'bg-gray-300';
  }
  getEstadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente:    'bg-gray-100 text-gray-700 border border-gray-300',
      en_ejecucion: 'bg-blue-100 text-blue-700 border border-blue-200',
      en_proceso:   'bg-blue-100 text-blue-700 border border-blue-200',
      completado:   'bg-green-100 text-green-700 border border-green-200',
      pausado:      'bg-yellow-100 text-yellow-700 border border-yellow-200',
      cancelado:    'bg-red-100 text-red-700 border border-red-200',
      bloqueado:    'bg-orange-100 text-orange-700 border border-orange-200',
      activo:       'bg-blue-100 text-blue-700 border border-blue-200',
      cerrado:      'bg-gray-100 text-gray-600 border border-gray-300',
    };
    return map[estado] ?? 'bg-gray-100 text-gray-700';
  }
  
  getInicialesResponsable(usuarioId: number): string {
    if (!usuarioId) return '??';
    const usuario = this.usuariosCache.find(u => u.id === usuarioId);
    if (!usuario) return '??';
    const nombreCompleto = usuario.nombre;
    if (!nombreCompleto) return '??';
    const partes = nombreCompleto.split(' ').filter((p: string) => p.length > 0);
    if (partes.length === 0) return '??';
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return partes[0].charAt(0).toUpperCase() + (partes.length > 1 ? partes[1].charAt(0).toUpperCase() : '');
  }

  getColorPorId(id: number): string {
    const colores = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
    return colores[id % colores.length];
  }

  nombreUsuario(uid: string | number): string {
    return this.usuariosCache.find(u => u.id === +uid)?.nombre ?? `Usuario #${uid}`;
  }

  getEstadoLabel(estado: string): string {
    return ({ pendiente: 'Pendiente', en_ejecucion: 'En ejecución', completado: 'Completado', bloqueado: 'Bloqueado' })[estado] ?? estado;
  }

  get inlineAsignadoNombre(): string {
    if (!this.inlineTaskForm.asignado_id) return '';
    return this.usuariosAsignables.find(u => u.id === this.inlineTaskForm.asignado_id)?.nombre ?? '';
  }

  get inlineEditAsignadoNombre(): string {
    if (!this.inlineEditForm.asignado_id) return '';
    return this.usuariosAsignables.find(u => u.id === this.inlineEditForm.asignado_id)?.nombre ?? '';
  }

  get inlineUsuariosFiltrados(): any[] {
    const q = this.inlineAsignadoBusqueda.toLowerCase();
    return q ? this.usuariosAsignables.filter(u => u.nombre.toLowerCase().includes(q)) : this.usuariosAsignables;
  }

  get inlineEditUsuariosFiltrados(): any[] {
    const q = this.inlineEditAsignadoBusqueda.toLowerCase();
    return q ? this.usuariosAsignables.filter(u => u.nombre.toLowerCase().includes(q)) : this.usuariosAsignables;
  }

  calcularProgresoActividad(actividad: Actividad): number {
    const total = actividad.total_tareas ?? 0;
    return total === 0 ? 0 : Math.round(((actividad.tareas_completadas ?? 0) / total) * 100);
  }

  esAdminProyecto(p: Proyecto | null): boolean {
    if (!p) return false;
    // Assuming 'puedeGestionarModulo' is passed or calculated. 
    // For now, let's use the property from the project itself.
    return (p.mis_permisos?.puede_gestionar_permisos ?? false);
  }

  puedeEditarProyecto(p: Proyecto | null): boolean {
    if (!p) return false;
    return (p.mis_permisos?.puede_editar ?? false);
  }

  puedeCrearEnProyecto(p: Proyecto | null): boolean {
    if (!p) return false;
    return (p.mis_permisos?.puede_crear ?? false);
  }

  puedeCompletarTarea(tarea: Tarea): boolean {
    if (!this.detalleProyecto) return false;
    return this.esAdminProyecto(this.detalleProyecto)
      || tarea.creado_por === this.usuarioId
      || (tarea.responsables ?? []).includes(this.usuarioId);
  }
}
