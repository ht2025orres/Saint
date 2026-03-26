import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-proyecto-tareas-view',
  templateUrl: './proyecto-tareas-view.component.html',
})
export class ProyectoTareasViewComponent {
  @Input() set tareas(val: any[]) {
    this._tareas = val;
    this.cdr.detectChanges();
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
}
