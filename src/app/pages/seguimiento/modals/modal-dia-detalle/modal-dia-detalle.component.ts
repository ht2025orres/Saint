import { Component, Input, Output, EventEmitter } from '@angular/core';

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

  get tareasAgrupadas(): TareaAgrupada[] {
    if (!this.dia) return [];

    const grupos: { [key: number]: TareaAgrupada } = {};

    // Procesar tareas de seguimiento
    (this.dia.tareas || []).forEach((t: any) => {
      const uid = t.tarea.usuario_id;
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

    return Object.values(grupos);
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
