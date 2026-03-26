import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Proyecto, Actividad, ProyectoService } from 'src/app/services/proyectos.service';
import { SeguimientoStateService } from '../../seguimiento-state.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-proyecto-actividades-view',
  templateUrl: './proyecto-actividades-view.component.html',
})
export class ProyectoActividadesViewComponent {
  @Input() set proyecto(val: Proyecto) {
    this._proyecto = val;
    this.cdr.detectChanges();
  }
  get proyecto(): Proyecto { return this._proyecto; }
  private _proyecto!: Proyecto;

  @Input() usuarioId!: number;
  @Input() puedeGestionarModulo = false;
  @Input() puedeCrear = false;
  @Input() puedeEditarProyecto = false;

  @Output() onRefresh = new EventEmitter<boolean>();
  @Output() onEditModalActividad = new EventEmitter<Actividad | null>();
  @Output() onEditModalTarea = new EventEmitter<any>();

  actividadExpandidaId: number | null = null;
  showInlineTaskActId: number | null = null;

  constructor(
    public state: SeguimientoStateService,
    private proyServ: ProyectoService,
    private cdr: ChangeDetectorRef
  ) {}

  toggleActividad(id: number): void {
    this.actividadExpandidaId = this.actividadExpandidaId === id ? null : id;
  }

  calcularProgreso(act: Actividad): number {
    return this.state.calcularProgreso(act.tareas_completadas ?? 0, act.total_tareas ?? 0);
  }

  eliminarActividad(a: Actividad): void {
    Swal.fire({
      title: '¿Eliminar actividad?',
      text: `"${a.titulo}" y todas sus tareas`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc2626', confirmButtonText: 'Sí, eliminar',
    }).then(r => {
      if (!r.isConfirmed) return;

      // Optimista: Filtramos localmente
      const backup = [...(this.proyecto.actividades ?? [])];
      this.proyecto.actividades = (this.proyecto.actividades ?? []).filter(act => act.id !== a.id);
      this.cdr.markForCheck();

      this.proyServ.eliminarActividad(a.id, this.usuarioId).subscribe({
        next:  () => { 
          this.state.showToast('Actividad eliminada'); 
          this.onRefresh.emit(true); 
        },
        error: () => {
          this.proyecto.actividades = backup; // Revertir
          this.state.showToast('No se pudo eliminar', 'error');
          this.cdr.markForCheck();
        },
      });
    });
  }

  async asignarResponsableActividad(a: Actividad): Promise<void> {
    const { value: selectedUserId } = await Swal.fire({
      title: 'Asignar Actividad',
      html: `
        <div class="text-left mb-4">
          <p class="text-sm text-slate-500 mb-4">Selecciona a quién asignar esta actividad. Todas las tareas de la actividad se asignarán automáticamente a esta persona.</p>
          <div class="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
            ${this.state.usuariosAdministradores.map(u => `
              <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                <input type="radio" name="swal-user" value="${u.id}" class="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black ${this.state.getColorPorId(u.id)}">
                  ${this.state.getInicialesResponsable(u.id)}
                </div>
                <span class="text-sm font-bold text-slate-700">${u.nombre}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Asignar a todos',
      confirmButtonColor: '#2563eb',
      preConfirm: () => {
        const selected = document.querySelector('input[name="swal-user"]:checked') as HTMLInputElement;
        if (!selected) {
          Swal.showValidationMessage('Debes seleccionar un responsable');
        }
        return selected ? Number(selected.value) : null;
      }
    });

    if (!selectedUserId) return;

    // Optimista: Actualizamos la actividad y sus tareas
    const backupResponsablesAct = [...(a.responsables ?? [])];
    a.responsables = [selectedUserId];
    (a.tareas ?? []).forEach(t => t.responsables = [selectedUserId]);
    this.cdr.markForCheck();

    this.proyServ.asignarUsuarioActividad(a.id, this.usuarioId, selectedUserId, 'colaborador').subscribe({
      next: () => {
        this.state.showToast('Responsable asignado a la actividad y sus tareas');
        this.onRefresh.emit(true);
      },
      error: () => {
        // Revertir
        a.responsables = backupResponsablesAct;
        this.onRefresh.emit(false); // Refresco completo para restaurar tareas
        this.state.showToast('Error al asignar responsable', 'error');
        this.cdr.markForCheck();
      },
    });
  }
}
