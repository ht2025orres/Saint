import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { Tarea, ProyectoService, EstadoTarea } from 'src/app/services/proyectos.service';
import { SeguimientoStateService, UsuarioCache } from '../../seguimiento-state.service';
import Swal from 'sweetalert2';

interface InlineEditForm {
  titulo:               string;
  descripcion:          string;
  estado:               EstadoTarea;
  fecha_limite_entrega: string;
  asignado_id:          number | null;
}

@Component({
  selector: 'app-tarea-item',
  templateUrl: './tarea-item.component.html',
})
export class TareaItemComponent {
  @Input() tarea!: any;
  @Input() usuarioId!: number;
  @Input() proyectoId!: number;
  @Input() puedeGestionarModulo = false;
  @Input() esGeneral = false;
  @Input() puedeEditarProyecto = false;

  @Output() onRefresh = new EventEmitter<boolean>();
  @Output() onEditModal = new EventEmitter<any>();

  inlineEditId: number | null = null;
  inlineEditForm: InlineEditForm = this._emptyInlineEditForm();
  inlineEditOriginal: InlineEditForm | null = null;
  showInlineEditEstado = false;
  showInlineEditAsignado = false;
  inlineEditBusqResp = '';
  saving = false;

  isDeleted = false;

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

    // Dropdowns internos
    if (this.showInlineEditEstado && !target.closest('[data-inline-edit-estado]')) {
      this.showInlineEditEstado = false;
    }
    if (this.showInlineEditAsignado && !target.closest('[data-inline-edit-asignado]')) {
      this.showInlineEditAsignado = false;
    }

    // Si estamos editando y el click es fuera de este componente completo
    if (this.inlineEditId && !this.saving) {
      if (!this.el.nativeElement.contains(target)) {
        if (this.inlineEditForm.titulo?.trim() && this._inlineEditChanged()) {
          this.guardarEdicionInline();
        } else {
          this.cancelarEdicionInline();
        }
      }
    }
    this.cdr.markForCheck();
  }

  get inlineEditAsignadoNombre(): string {
    return this.state.usuariosAdministradores.find(u => u.id === this.inlineEditForm.asignado_id)?.nombre ?? '';
  }

  get inlineEditUsuariosFiltrados(): UsuarioCache[] {
    const q = this.inlineEditBusqResp.toLowerCase();
    return q
      ? this.state.usuariosAdministradores.filter(u => u.nombre.toLowerCase().includes(q)).slice(0, 8)
      : this.state.usuariosAdministradores.slice(0, 8);
  }

  puedeCompletarTarea(): boolean {
    if (this.puedeGestionarModulo) return true;
    if (this.tarea.creado_por === this.usuarioId) return true;
    if ((this.tarea.responsables ?? []).includes(this.usuarioId)) return true;
    return this.puedeEditarProyecto;
  }

  activarEdicionInline(): void {
    if (this.inlineEditId === this.tarea.id || this.saving) return;

    this.inlineEditId = this.tarea.id;
    this.inlineEditForm = {
      titulo:               this.tarea.titulo,
      descripcion:          this.tarea.descripcion ?? '',
      estado:               this.tarea.estado ?? 'pendiente',
      fecha_limite_entrega: this._toLocal(this.tarea.fecha_limite_entrega),
      asignado_id:          (this.tarea.responsables && this.tarea.responsables.length > 0) ? this.tarea.responsables[0] : null,
    };
    this.inlineEditOriginal = { ...this.inlineEditForm };

    this.inlineEditBusqResp = '';
    this.showInlineEditEstado = false;
    this.showInlineEditAsignado = false;

    this.cdr.markForCheck();
    setTimeout(() => {
      const input = this.el.nativeElement.querySelector('[data-edit-title]');
      input?.focus();
      input?.select();
    }, 100);
  }

  guardarEdicionInline(): void {
    if (!this.inlineEditId || !this.inlineEditForm.titulo.trim() || this.saving) return;
    if (!this._inlineEditChanged()) return this.cancelarEdicionInline();

    // Guardar estado original para revertir en caso de error
    const backup = { ...this.tarea };

    // Actualización optimista: Reflejamos los cambios en el objeto tarea inmediatamente
    this.tarea.titulo = this.inlineEditForm.titulo;
    this.tarea.descripcion = this.inlineEditForm.descripcion;
    this.tarea.estado = this.inlineEditForm.estado;
    this.tarea.fecha_limite_entrega = this.inlineEditForm.fecha_limite_entrega;
    // Responsables es un poco más complejo porque es un array
    if (this.inlineEditForm.asignado_id) {
      this.tarea.responsables = [this.inlineEditForm.asignado_id];
    } else {
      this.tarea.responsables = [];
    }

    this.saving = true;
    this.inlineEditId = null; // Cerramos el editor inmediatamente
    this.cdr.markForCheck();

    const body = {
      titulo:               this.inlineEditForm.titulo,
      descripcion:          this.inlineEditForm.descripcion,
      estado:               this.inlineEditForm.estado as EstadoTarea,
      fecha_limite_entrega: this.inlineEditForm.fecha_limite_entrega,
      usuario_id:           this.usuarioId,
      responsables:         this.inlineEditForm.asignado_id ? [this.inlineEditForm.asignado_id] : [],
    };

    this.proyServ.actualizarTarea(backup.id, body).subscribe({
      next: () => {
        this.state.showToast('Tarea actualizada');
        this.saving = false;
        this.onRefresh.emit(true); // Refrescamos por detrás (silencioso) para sincronizar otros datos
        this.cdr.markForCheck();
      },
      error: () => {
        // Revertimos cambios en caso de error
        Object.assign(this.tarea, backup);
        this.saving = false;
        this.state.showToast('Error al actualizar', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  cancelarEdicionInline(): void {
    if (this.inlineEditForm && this.inlineEditOriginal) {
      this.inlineEditForm.titulo = this.inlineEditOriginal.titulo;
    }
    this.inlineEditId = null;
    this.inlineEditOriginal = null;
    this.cdr.markForCheck();
  }

  onInlineEditKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter')  this.guardarEdicionInline();
    if (ev.key === 'Escape') this.cancelarEdicionInline();
  }

  async completarTarea(): Promise<void> {
    const t = this.tarea;
    const yaTieneAdjuntos = (t.notas && t.notas.trim().length > 0) || (t.evidencias_count && t.evidencias_count > 0);

    if (yaTieneAdjuntos || t.estado === 'completado') {
      this._ejecutarCambioEstadoTarea(t);
      return;
    }

    const { value: formValue } = await Swal.fire({
      title: 'Completar Tarea',
      html: `
        <div class="text-left">
          <p class="text-sm text-slate-500 mb-4">Puedes adjuntar una nota o evidencia para finalizar esta tarea.</p>
          <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Nota / Comentario</label>
          <textarea id="swal-notas" class="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-400 h-24 mb-4" placeholder="Escribe algo sobre el cumplimiento..."></textarea>
          
          <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Evidencia (Opcional)</label>
          <input type="file" id="swal-archivo" class="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Completar con adjuntos',
      denyButtonText: 'Completar sin nada',
      showDenyButton: true,
      confirmButtonColor: '#10b981',
      denyButtonColor: '#64748b',
      preConfirm: () => {
        const notas = (document.getElementById('swal-notas') as HTMLTextAreaElement).value;
        const archivoInput = document.getElementById('swal-archivo') as HTMLInputElement;
        const archivo = archivoInput.files ? archivoInput.files[0] : null;
        return { notas, archivo };
      }
    });

    if (formValue === undefined) return;

    if (formValue === false) {
      const confirm = await Swal.fire({
        title: '¿Estás seguro?',
        text: 'Vas a completar la tarea sin adjuntar ninguna nota ni evidencia.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, completar así',
        confirmButtonColor: '#10b981',
      });
      if (confirm.isConfirmed) {
        this._ejecutarCambioEstadoTarea(t);
      }
      return;
    }

    if (formValue) {
      const formData = new FormData();
      if (formValue.notas) formData.append('notas', formValue.notas);
      if (formValue.archivo) formData.append('archivo', formValue.archivo);
      this._ejecutarCambioEstadoTarea(t, formData);
    }
  }

  private _ejecutarCambioEstadoTarea(t: Tarea, data?: FormData): void {
    const backup = { ...t };
    const nuevoEstado: EstadoTarea = t.estado === 'completado' ? 'pendiente' : 'completado';
    const payload = nuevoEstado === 'pendiente' ? undefined : data;

    // Actualización optimista
    t.estado = nuevoEstado;
    this.saving = true;
    this.cdr.markForCheck();

    this.proyServ.completarTarea(t.id, this.usuarioId, payload as any).subscribe({
      next: () => {
        this.state.showToast(nuevoEstado === 'completado' ? 'Tarea completada' : 'Tarea pendiente');
        this.saving = false;
        this.onRefresh.emit(true); // Silent refresh
      },
      error: () => {
        // Revertir
        t.estado = backup.estado;
        this.saving = false;
        this.state.showToast('Error al actualizar tarea', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  eliminarTarea(): void {
    Swal.fire({
      title: '¿Eliminar tarea?',
      text: `"${this.tarea.titulo}"`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc2626', confirmButtonText: 'Sí, eliminar',
    }).then(r => {
      if (!r.isConfirmed) return;

      // Actualización optimista: ocultamos la tarea inmediatamente
      this.isDeleted = true;
      this.cdr.markForCheck();

      this.proyServ.eliminarTarea(this.tarea.id, this.usuarioId).subscribe({
        next:  () => { 
          this.state.showToast('Tarea eliminada'); 
          this.onRefresh.emit(true); // Silent refresh
        },
        error: () => {
          this.isDeleted = false; // Revertir si falla
          this.state.showToast('No se pudo eliminar', 'error');
          this.cdr.markForCheck();
        }
      });
    });
  }

  verNotas(): void {
    if (!this.tarea.notas) return;
    Swal.fire({
      title: 'Notas de la Tarea',
      html: `<div class="text-left text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">${this.tarea.notas}</div>`,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#64748b'
    });
  }

  verEvidencias(): void {
    if (!this.tarea.evidencias_count) return;
    
    this.state.showToast('Cargando evidencias...', 'info');
    this.proyServ.getEvidencias('tarea', this.tarea.id).subscribe({
      next: (res) => {
        const evidencias = res.data || [];
        if (evidencias.length === 0) {
          this.state.showToast('No se encontraron evidencias', 'warning');
          return;
        }

        Swal.fire({
          title: 'Evidencias',
          html: `
            <div class="text-left space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              ${evidencias.map(e => `
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-blue-500 shadow-sm">
                      <i class="mdi ${this._getIconoArchivo(e.nombre_archivo)} text-xl"></i>
                    </div>
                    <div class="min-w-0">
                      <p class="text-xs font-bold text-slate-700 truncate">${e.nombre_archivo}</p>
                      <p class="text-[10px] text-slate-400">${e.created_at}</p>
                    </div>
                  </div>
                  <button data-evid-id="${e.id}" class="swal-download-btn w-8 h-8 flex items-center justify-center bg-white text-blue-600 rounded-lg shadow-sm hover:bg-blue-600 hover:text-white transition-all">
                    <i class="mdi mdi-download"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          `,
          showConfirmButton: false,
          showCloseButton: true,
          didOpen: () => {
            const container = Swal.getHtmlContainer();
            container?.querySelectorAll('.swal-download-btn').forEach(btn => {
              btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-evid-id'));
                this.descargarEvidencia(id);
              });
            });
          }
        });
      },
      error: () => this.state.showToast('Error al cargar evidencias', 'error')
    });
  }

  descargarEvidencia(id: number): void {
    this.proyServ.getUrlEvidencia(id).subscribe({
      next: (res) => {
        if (res.success && res.url) {
          window.open(res.url, '_blank');
        } else {
          this.state.showToast('No se pudo obtener la URL de descarga', 'error');
        }
      },
      error: () => this.state.showToast('Error al obtener archivo', 'error')
    });
  }

  private _getIconoArchivo(nombre: string): string {
    const ext = nombre.split('.').pop()?.toLowerCase();
    switch(ext) {
      case 'pdf': return 'mdi-file-pdf-box';
      case 'doc': case 'docx': return 'mdi-file-word-box';
      case 'xls': case 'xlsx': return 'mdi-file-excel-box';
      case 'png': case 'jpg': case 'jpeg': return 'mdi-file-image-outline';
      default: return 'mdi-file-document-outline';
    }
  }

  private _inlineEditChanged(): boolean {
    if (!this.inlineEditOriginal) return false;
    return JSON.stringify(this.inlineEditForm) !== JSON.stringify(this.inlineEditOriginal);
  }

  private _emptyInlineEditForm(): InlineEditForm {
    return { titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', asignado_id: null };
  }

  private _toLocal(v?: string | null): string {
    if (!v) return '';
    const [d, t] = v.split('T');
    return `${d}T${t?.substring(0, 5) ?? ''}`;
  }
}
