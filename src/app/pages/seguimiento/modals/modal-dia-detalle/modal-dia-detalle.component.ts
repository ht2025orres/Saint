import { Component, Input, Output, EventEmitter } from '@angular/core';
import { SeguimientoStateService } from '../../seguimiento-state.service';

interface TareaAgrupada {
  usuarioId: number;
  nombre: string;
  iniciales: string;
  color: string;
  tareas: {
    titulo: string;
    origen: string;
    estado: string;
    colorEstado: string;
  }[];
}

@Component({
  selector: 'app-modal-dia-detalle',
  templateUrl: './modal-dia-detalle.component.html',
})
export class ModalDiaDetalleComponent {
  @Input() show = false;
  @Input() dia: any = null;

  @Output() onCerrar = new EventEmitter<void>();

  constructor(private state: SeguimientoStateService) {}

  get tareasAgrupadas(): TareaAgrupada[] {
    if (!this.dia) return [];

    const grupos: { [key: number]: TareaAgrupada } = {};

    // Procesar tareas de seguimiento
    (this.dia.tareas || []).forEach((t: any) => {
      const uid = t.tarea.usuario_id;
      // FILTRO: Solo administradores del sistema
      if (!this._esAdminSist(uid)) return;

      if (!grupos[uid]) {
        grupos[uid] = this._crearGrupo(uid, t.nombreUsuario, t.iniciales, t.color);
      }
      grupos[uid].tareas.push({
        titulo: t.tarea.titulo,
        origen: 'Seguimiento',
        estado: t.tarea.estado,
        colorEstado: 'text-indigo-600 bg-indigo-50'
      });
    });

    // Procesar tareas externas (Proyectos/GLPI)
    (this.dia.tareasExternas || []).forEach((t: any) => {
      const uid = t.usuario_id;
      // FILTRO: Solo administradores del sistema
      if (!this._esAdminSist(uid)) return;

      if (!grupos[uid]) {
        grupos[uid] = this._crearGrupo(uid, t.nombre_completo || 'Usuario', t.iniciales, t.color);
      }
      grupos[uid].tareas.push({
        titulo: t.titulo,
        origen: t.origen === 'proyecto' ? 'Proyecto' : 'GLPI',
        estado: t.estado,
        colorEstado: t.origen === 'proyecto' ? 'text-teal-600 bg-teal-50' : 'text-orange-600 bg-orange-50'
      });
    });

    // Procesar tareas de informes
    (this.dia.tareasInforme || []).forEach((t: any) => {
      const uid = t.responsable_id;
      // FILTRO: Solo administradores del sistema
      if (!this._esAdminSist(uid)) return;

      if (!grupos[uid]) {
        grupos[uid] = this._crearGrupo(uid, t.nombreUsuario, t.iniciales, t.color);
      }
      grupos[uid].tareas.push({
        titulo: t.titulo,
        origen: 'Informe',
        estado: t.estado,
        colorEstado: 'text-amber-600 bg-amber-50'
      });
    });

    // Procesar compromisos
    (this.dia.compromisos || []).forEach((c: any) => {
      // Los compromisos pueden tener múltiples responsables o uno solo
      const responsables = c.responsables && c.responsables.length > 0 
        ? c.responsables 
        : [c.usuario_id || c.responsable_id];

      responsables.forEach((uid: number) => {
        if (!uid || !this._esAdminSist(uid)) return;

        if (!grupos[uid]) {
          grupos[uid] = this._crearGrupo(
            uid, 
            this.state.nombreUsuario(uid), 
            this.state.getInicialesResponsable(uid), 
            this.state.getColorPorId(uid)
          );
        }
        grupos[uid].tareas.push({
          titulo: c.titulo,
          origen: 'Compromiso',
          estado: c.estado,
          colorEstado: 'text-blue-600 bg-blue-50'
        });
      });
    });

    return Object.values(grupos);
  }

  private _esAdminSist(uid: number): boolean {
    const u = this.state.usuariosCache.find(user => user.id === uid);
    if (!u) return false;
    return u.roles?.some(r => (r.nombre || '').toLowerCase().includes('administrador del sistema')) ?? false;
  }

  private _crearGrupo(id: number, nombre: string, iniciales: string, color: string): TareaAgrupada {
    return {
      usuarioId: id,
      nombre,
      iniciales,
      color,
      tareas: []
    };
  }
}
