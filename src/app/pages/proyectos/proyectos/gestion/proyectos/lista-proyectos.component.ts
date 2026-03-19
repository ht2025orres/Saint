import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Proyecto, Semaforo } from 'src/app/services/proyectos.service';

@Component({
  selector: 'app-lista-proyectos',
  templateUrl: './lista-proyectos.component.html',
  styleUrls: ['./lista-proyectos.component.css']
})
export class ListaProyectosComponent {
  @Input() proyectos: Proyecto[] = [];
  @Input() loading = false;
  @Input() filtroEstado = 'todos';
  @Input() busquedaProyectos = '';
  @Input() vistaProyectos: 'tarjetas' | 'lista' = 'tarjetas';
  @Input() proyectosPaginados: Proyecto[] = [];
  @Input() puedeGestionarModulo = false;
  @Input() esAdminSistema = false;
  @Input() usuariosCache: any[] = [];

  @Output() onVerDetalle = new EventEmitter<Proyecto>();
  @Output() onEditar = new EventEmitter<Proyecto>();
  @Output() onCambiarEstado = new EventEmitter<{proyecto: Proyecto, nuevoEstado: string}>();
  @Output() onEliminar = new EventEmitter<Proyecto>();
  @Output() onCrearProyecto = new EventEmitter<void>();
  @Output() onCambiarFiltro = new EventEmitter<string>();
  @Output() onCambiarVistaProy = new EventEmitter<'tarjetas' | 'lista'>();
  @Output() onBusquedaChange = new EventEmitter<string>();
  @Output() onLimpiarBusqueda = new EventEmitter<void>();
  @Output() onAbrirModalPermisos = new EventEmitter<{tipo: 'proyecto', id: number}>();

  // Helper methods duplicated from main component for now
  getSemaforoClass(semaforo?: Semaforo | string): string {
    return ({ rojo: 'bg-red-500', amarillo: 'bg-yellow-400', verde: 'bg-green-500', gris: 'bg-gray-300' })[semaforo ?? 'gris'] ?? 'bg-gray-300';
  }
  getSemaforoBorderClass(semaforo?: Semaforo): string {
    return ({ rojo: 'border-red-500', amarillo: 'border-yellow-400', verde: 'border-green-500', gris: 'border-gray-300' })[semaforo ?? 'gris'] ?? 'border-gray-300';
  }
  getSemaforoLabel(semaforo?: Semaforo): string {
    return ({ rojo: 'Urgente – revisar inmediatamente', amarillo: 'Próximo vencimiento', verde: 'A tiempo', gris: 'Sin fecha límite' })[semaforo ?? 'gris'] ?? '';
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
  getEstadoIcon(estado: string): string {
    const map: Record<string, string> = {
      pendiente:    'bi-clock',
      en_ejecucion: 'bi-play-circle',
      en_proceso:   'bi-play-circle',
      completado:   'bi-check-circle-fill',
      pausado:      'bi-pause-circle',
      cancelado:    'bi-x-circle',
      bloqueado:    'bi-lock',
      activo:       'bi-play-circle',
      cerrado:      'bi-lock-fill',
    };
    return map[estado] ?? 'bi-circle';
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

  puedeEditarProyecto(p: Proyecto): boolean {
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_editar ?? false);
  }
  esAdminProyecto(p: Proyecto): boolean {
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_gestionar_permisos ?? false);
  }
  puedeEliminarProyecto(p: Proyecto): boolean {
    return this.puedeGestionarModulo || (p.mis_permisos?.puede_eliminar ?? false);
  }
}
