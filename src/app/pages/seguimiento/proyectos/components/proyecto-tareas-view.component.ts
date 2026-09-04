import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Proyecto } from 'src/app/services/proyectos.service';

@Component({
  selector: 'app-proyecto-tareas-view',
  templateUrl: './proyecto-tareas-view.component.html',
})
export class ProyectoTareasViewComponent {
  @Input() set proyecto(val: Proyecto | null | undefined) {
    this._proyecto = val ?? null;
    if (val) {
      this.extraerTareasDeProyecto(val);
    } else {
      this._tareas = [];
    }
    this.cdr.detectChanges();
  }
  get proyecto(): Proyecto | null { return this._proyecto; }
  private _proyecto: Proyecto | null = null;

  @Input() set tareas(val: any[]) {
    if (val && val.length > 0) {
      this._tareas = val;
      this.cdr.detectChanges();
    }
  }
  get tareas(): any[] { return this._tareas; }
  private _tareas: any[] = [];

  @Input() usuarioId!: number;
  @Input() proyectoId!: number;
  @Input() puedeGestionarModulo = false;
  @Input() puedeCrear = false;
  @Input() puedeEditarProyecto = false;

  @Output() onRefresh = new EventEmitter<boolean>();
  @Output() onEditModal = new EventEmitter<any>();

  showInlineTask = false;
  filtroEstadoTarea = 'todos';
  filtroTipoTarea = 'todas';

  constructor(private cdr: ChangeDetectorRef) {}

  get tareasFiltradas(): any[] {
    let lista = this.tareas;
    if (this.filtroEstadoTarea !== 'todos') lista = lista.filter(t => t.estado === this.filtroEstadoTarea);
    if (this.filtroTipoTarea === 'conActividad')  lista = lista.filter(t => !t.esGeneral);
    if (this.filtroTipoTarea === 'sinActividad')  lista = lista.filter(t =>  t.esGeneral);
    return lista;
  }

  limpiarFiltros(): void {
    this.filtroEstadoTarea = 'todos';
    this.filtroTipoTarea = 'todas';
  }

  extraerTareasDeProyecto(p: Proyecto): void {
    const list: any[] = [];
    for (const act of (p.actividades ?? [])) {
      for (const t of (act.tareas ?? [])) {
        list.push({
          ...t,
          actividadTitulo:       act.titulo,
          actividadId:           act.id,
          actividadSemaforo:     act.semaforo ?? null,
          actividadResponsables: act.responsables ?? null,
          esGeneral:             false,
        });
      }
    }
    for (const t of (p.tareas_sin_actividad ?? [])) {
      list.push({
        ...t,
        actividadTitulo:       'Sin actividad',
        actividadId:           null,
        actividadSemaforo:     null,
        actividadResponsables: null,
        esGeneral:             true,
      });
    }

    const ordenSemaforo: Record<string, number> = { rojo: 1, amarillo: 2, verde: 3, azul: 4, gris: 5 };
    list.sort((a, b) => {
      if (a.estado === 'completado' && b.estado !== 'completado') return 1;
      if (a.estado !== 'completado' && b.estado === 'completado') return -1;
      const pesoA = ordenSemaforo[a.semaforo] ?? 99;
      const pesoB = ordenSemaforo[b.semaforo] ?? 99;
      return pesoA - pesoB;
    });

    this._tareas = list;
  }
}
