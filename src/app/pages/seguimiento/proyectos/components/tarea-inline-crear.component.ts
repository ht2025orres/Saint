import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { ProyectoService, EstadoTarea } from 'src/app/services/proyectos.service';
import { SeguimientoStateService, UsuarioCache } from '../../seguimiento-state.service';

interface InlineTaskForm {
  titulo:               string;
  descripcion:          string;
  estado:               EstadoTarea;
  fecha_limite_entrega: string;
  actividad_id:         number | null;
  asignado_id:          number | null;
}

@Component({
  selector: 'app-tarea-inline-crear',
  templateUrl: './tarea-inline-crear.component.html',
})
export class TareaInlineCrearComponent {
  @Input() proyectoId!: number;
  @Input() actividadId: number | null = null;
  @Input() usuarioId!: number;

  @Output() onRefresh = new EventEmitter<boolean>();
  @Output() onCancel = new EventEmitter<void>();

  inlineTaskForm: InlineTaskForm = this._emptyInlineTaskForm();
  showInlineEstado = false;
  showInlineAsignado = false;
  inlineBusqResp = '';
  saving = false;

  constructor(
    public state: SeguimientoStateService,
    private proyServ: ProyectoService,
    private cdr: ChangeDetectorRef,
    private el: ElementRef
  ) {}

  @HostListener('document:mousedown', ['$event'])
  onDocClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.swal2-container')) return;

    if (this.showInlineEstado && !target.closest('[data-inline-estado]')) {
      this.showInlineEstado = false;
    }
    if (this.showInlineAsignado && !target.closest('[data-inline-asignado]')) {
      this.showInlineAsignado = false;
    }

    if (this.saving) return;

    // Si el click es fuera de este componente de creación
    if (!this.el.nativeElement.contains(target)) {
      if (this.inlineTaskForm.titulo?.trim()) {
        this.guardarTareaInline();
      } else {
        this.onCancel.emit();
      }
    }
    this.cdr.markForCheck();
  }

  get inlineAsignadoNombre(): string {
    return this.state.usuariosAdministradores.find(u => u.id === this.inlineTaskForm.asignado_id)?.nombre ?? '';
  }

  get inlineUsuariosFiltrados(): UsuarioCache[] {
    const q = this.inlineBusqResp.toLowerCase();
    return q
      ? this.state.usuariosAdministradores.filter(u => u.nombre.toLowerCase().includes(q)).slice(0, 8)
      : this.state.usuariosAdministradores.slice(0, 8);
  }

  guardarTareaInline(): void {
    if (!this.inlineTaskForm.titulo.trim() || this.saving) return;
    this.saving = true;
    this.cdr.markForCheck();

    const body = {
      titulo:               this.inlineTaskForm.titulo,
      descripcion:          this.inlineTaskForm.descripcion,
      estado:               this.inlineTaskForm.estado as EstadoTarea,
      fecha_limite_entrega: this.inlineTaskForm.fecha_limite_entrega,
      actividad_id:         this.actividadId,
      proyecto_id:          this.proyectoId,
      usuario_id:           this.usuarioId,
      responsables:         this.inlineTaskForm.asignado_id ? [this.inlineTaskForm.asignado_id] : [],
    };

    this.proyServ.crearTarea(body).subscribe({
      next: () => {
        this.state.showToast('Tarea creada');
        this.onCancel.emit();       // ✅ cierra después
      },
      error: () => {
        this.state.showToast('Error al crear tarea', 'error');
        this.saving = false;
        this.cdr.markForCheck();    // deja el form abierto para reintentar
      },
    });
  }

  onInlineKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter')  this.guardarTareaInline();
    if (ev.key === 'Escape') this.onCancel.emit();
  }

  private _emptyInlineTaskForm(): InlineTaskForm {
    return {
      titulo: '', descripcion: '', estado: 'pendiente',
      fecha_limite_entrega: '', actividad_id: null, asignado_id: this.usuarioId,
    };
  }
}
