import { Component, Input, Output, EventEmitter, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { Tarea, ProyectoService, EstadoTarea } from 'src/app/services/proyectos.service';
import { SeguimientoStateService, UsuarioCache } from '../../seguimiento-state.service';
import Swal from 'sweetalert2';

interface InlineEditForm {
  titulo:               string;
  descripcion:          string;
  estado:               EstadoTarea;
  fecha_limite_entrega: string;
  responsables_ids:     number[];
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

  /** Tracked array of responsable info for the inline edit chips (NOT a getter) */
  inlineEditResponsablesInfoList: { id: number; iniciales: string; nombre: string }[] = [];

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
      if (target.isConnected && !this.el.nativeElement.contains(target)) {
        if (this.inlineEditForm.titulo?.trim() && this._inlineEditChanged()) {
          this.guardarEdicionInline();
        } else {
          this.cancelarEdicionInline();
        }
      }
    }
    this.cdr.markForCheck();
  }

  /** Rebuild the tracked responsables info list from the current form IDs */
  private _rebuildResponsablesInfo(): void {
    this.inlineEditResponsablesInfoList = this.inlineEditForm.responsables_ids.map(id => {
      const numId = Number(id);
      return {
        id: numId,
        iniciales: this.state.getInicialesCorta(numId),
        nombre: this.state.nombreUsuario(numId) || '?',
      };
    });
  }

  get inlineEditUsuariosFiltrados(): UsuarioCache[] {
    const ids = new Set(this.inlineEditForm.responsables_ids.map(id => Number(id)));
    const q = this.inlineEditBusqResp.toLowerCase();
    return this.state.usuariosAdministradores
      .filter(u => !ids.has(Number(u.id)) && (!q || u.nombre.toLowerCase().includes(q)))
      .slice(0, 8);
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
      responsables_ids:     (this.tarea.responsables ?? []).map((r: any) => Number(r)),
    };
    this.inlineEditOriginal = { ...this.inlineEditForm };

    this.inlineEditBusqResp = '';
    this.showInlineEditEstado = false;
    this.showInlineEditAsignado = false;

    this._rebuildResponsablesInfo();
    this.cdr.detectChanges();
    setTimeout(() => {
      const input = this.el.nativeElement.querySelector('[data-edit-title]');
      input?.focus();
      input?.select();
    }, 100);
  }

  guardarEdicionInline(): void {
    if (!this.inlineEditId || !this.inlineEditForm.titulo.trim() || this.saving) return;
    if (!this._inlineEditChanged()) return this.cancelarEdicionInline();

    if (!this.inlineEditForm.responsables_ids || this.inlineEditForm.responsables_ids.length === 0) {
      this.state.showToast('Debe asignar al menos un responsable a la tarea', 'warning');
      return;
    }

    // Guardar estado original para revertir en caso de error
    const backup = { ...this.tarea };

    // Actualización optimista: Reflejamos los cambios en el objeto tarea inmediatamente
    this.tarea.titulo = this.inlineEditForm.titulo;
    this.tarea.descripcion = this.inlineEditForm.descripcion;
    this.tarea.estado = this.inlineEditForm.estado;
    this.tarea.fecha_limite_entrega = this.inlineEditForm.fecha_limite_entrega;
    this.tarea.responsables = [...this.inlineEditForm.responsables_ids];

    this.saving = true;
    this.inlineEditId = null; // Cerramos el editor inmediatamente
    this.cdr.markForCheck();

    const body = {
      titulo:               this.inlineEditForm.titulo,
      descripcion:          this.inlineEditForm.descripcion,
      estado:               this.inlineEditForm.estado as EstadoTarea,
      fecha_limite_entrega: this.inlineEditForm.fecha_limite_entrega,
      usuario_id:           this.usuarioId,
      responsables:         [...this.inlineEditForm.responsables_ids],
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

  async promptCompletarTarea(tituloTarea: string): Promise<{ notas: string; archivo: File | null } | null> {
    let archivoSeleccionado: File | null = null;

    const res = await Swal.fire({
      title: '',
      html: `
        <div class="p-2 text-left font-sans">
          <div class="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100">
            <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-200 flex-shrink-0">
              <i class="bi bi-check-circle-fill text-2xl"></i>
            </div>
            <div class="min-w-0">
              <h3 class="text-base font-black text-slate-800 tracking-tight">Finalizar y Completar Tarea</h3>
              <p class="text-xs font-semibold text-slate-400 truncate max-w-[320px]">${tituloTarea}</p>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <i class="bi bi-journal-text text-emerald-500"></i>
              Nota o Comentario de Cumplimiento
            </label>
            <textarea id="swal-comp-notas" rows="3"
              class="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 transition-all outline-none resize-none shadow-xs"
              placeholder="Describe brevemente el resultado, observaciones o entregables de esta tarea..."></textarea>
          </div>

          <div>
            <label class="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <i class="bi bi-paperclip text-emerald-500"></i>
              Evidencia Adjunta <span class="text-[9px] font-normal text-slate-400 normal-case">(Opcional)</span>
            </label>
            <div class="relative">
              <input type="file" id="swal-comp-file" class="hidden" />
              <button type="button" id="swal-comp-file-btn"
                class="w-full flex items-center justify-between px-4 py-3 bg-emerald-50/60 hover:bg-emerald-100/70 border-2 border-dashed border-emerald-200 rounded-2xl transition-all cursor-pointer group">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs flex-shrink-0 group-hover:scale-105 transition-transform">
                    <i class="bi bi-cloud-arrow-up-fill text-sm"></i>
                  </div>
                  <span id="swal-comp-file-label" class="text-xs font-bold text-emerald-800 truncate">Seleccionar archivo de evidencia...</span>
                </div>
                <span class="text-[10px] font-black text-emerald-600 bg-white px-2 py-1 rounded-lg border border-emerald-100 shadow-2xs">Examinar</span>
              </button>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      showDenyButton: false,
      confirmButtonText: '<i class="bi bi-check2-circle mr-1"></i> Completar Tarea',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#94a3b8',
      customClass: {
        popup: 'rounded-[2rem] p-6 border border-slate-100 shadow-2xl',
        confirmButton: 'rounded-xl text-xs font-bold px-4 py-2.5 shadow-md',
        cancelButton: 'rounded-xl text-xs font-bold px-4 py-2.5',
      },
      didOpen: () => {
        const fileInput = document.getElementById('swal-comp-file') as HTMLInputElement;
        const fileBtn   = document.getElementById('swal-comp-file-btn');
        const fileLabel = document.getElementById('swal-comp-file-label');

        fileBtn?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', () => {
          if (fileInput.files && fileInput.files[0]) {
            archivoSeleccionado = fileInput.files[0];
            if (fileLabel) fileLabel.innerText = `📄 ${archivoSeleccionado.name}`;
          }
        });
      },
      preConfirm: () => {
        const notas = (document.getElementById('swal-comp-notas') as HTMLTextAreaElement)?.value || '';
        return { notas, archivo: archivoSeleccionado };
      }
    });

    if (!res.isConfirmed || !res.value) {
      return null;
    }

    const { notas, archivo } = res.value;

    // Si no hay notas ni archivo, pedir confirmación
    if (!notas.trim() && !archivo) {
      const confirm = await Swal.fire({
        title: '',
        html: `
          <div class="p-2 text-center font-sans">
            <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-400 text-white flex items-center justify-center shadow-lg shadow-amber-200">
              <i class="bi bi-exclamation-triangle-fill text-3xl"></i>
            </div>
            <h3 class="text-base font-black text-slate-800 tracking-tight mb-1">¿Completar sin evidencia?</h3>
            <p class="text-xs font-medium text-slate-500 leading-relaxed">No agregaste notas ni adjuntaste archivos.<br>¿Deseas completar la tarea de todas formas?</p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-check-lg mr-1"></i> Sí, completar',
        cancelButtonText: 'Volver',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#94a3b8',
        customClass: {
          popup: 'rounded-[2rem] p-6 border border-slate-100 shadow-2xl',
          confirmButton: 'rounded-xl text-xs font-bold px-4 py-2.5 shadow-md',
          cancelButton: 'rounded-xl text-xs font-bold px-4 py-2.5',
        },
      });

      if (!confirm.isConfirmed) return null;
    }

    return { notas, archivo };
  }

  async completarTarea(): Promise<void> {
    const t = this.tarea;

    // Si ya está completada, reabrirla directamente
    if (t.estado === 'completado') {
      this._ejecutarCambioEstadoTarea(t);
      return;
    }

    const resultado = await this.promptCompletarTarea(t.titulo);
    if (!resultado) return; // Se canceló la acción

    const formData = new FormData();
    if (resultado.notas) formData.append('notas', resultado.notas);
    if (resultado.archivo) formData.append('archivo', resultado.archivo);

    // Actualización optimista de notas en local
    if (resultado.notas) {
      t.notas = resultado.notas;
    }

    this._ejecutarCambioEstadoTarea(t, formData);
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
        this.onRefresh.emit(true); // Recargar parent para refrescar evidencias y datos del servidor
        this.cdr.markForCheck();
      },
      error: () => {
        // Revertir
        Object.assign(t, backup);
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

  inlineEditAgregarResp(u: UsuarioCache, ev?: Event): void {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    const numId = Number(u.id);
    if (!this.inlineEditForm.responsables_ids.some(r => Number(r) === numId)) {
      this.inlineEditForm.responsables_ids = [...this.inlineEditForm.responsables_ids, numId];
    }
    this.inlineEditBusqResp = '';
    this.showInlineEditAsignado = false;
    this._rebuildResponsablesInfo();
    this.cdr.detectChanges();
  }

  inlineEditQuitarResp(id: number | string, ev?: Event): void {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    const numId = Number(id);
    this.inlineEditForm.responsables_ids = this.inlineEditForm.responsables_ids.filter(r => Number(r) !== numId);
    this._rebuildResponsablesInfo();
    this.cdr.detectChanges();
  }

  private _emptyInlineEditForm(): InlineEditForm {
    return { titulo: '', descripcion: '', estado: 'pendiente', fecha_limite_entrega: '', responsables_ids: [] };
  }

  private _toLocal(v?: string | null): string {
    if (!v) return '';
    const [d, t] = v.split('T');
    return `${d}T${t?.substring(0, 5) ?? ''}`;
  }
}
