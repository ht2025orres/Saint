import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { ProyectoService, SeguimientoReunion, SeguimientoTarea } from 'src/app/services/proyectos.service';
import { SeguimientoStateService, UsuarioCache } from '../../seguimiento-state.service';
import Swal from 'sweetalert2';

export interface TareaMinutaFila {
  id?: number;
  idTemp: number;
  titulo: string;
  descripcion: string;
  responsablesSelec: UsuarioCache[];
  fecha_limite_entrega: string;
  busquedaResp: string;
  showRespDropdown: boolean;
}

@Component({
  selector: 'app-modal-reunion',
  templateUrl: './modal-reunion.component.html',
})
export class ModalReunionComponent implements OnChanges {
  @Input() show = false;
  @Input() seguimientoId = 0;
  @Input() usuarioId = 0;
  @Input() usuariosDisponibles: UsuarioCache[] = [];
  @Input() esGestor = true;
  @Input() vistaMode?: 'member' | undefined;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardado = new EventEmitter<void>();

  modoTab: 'nueva' | 'historico' = 'nueva';
  saving = false;
  loadingHistorico = false;
  loadingBusquedaFecha = false;

  // Edición / Estado
  reunionId: number | null = null;
  esEdicionReunion = false;

  // Formulario Nueva / Editar Reunión
  fechaReunion = '';
  tituloReunion = 'Reunión de Avance Diario / Minuta';
  descripcionReunion = '';

  tareasMinuta: TareaMinutaFila[] = [];

  // Histórico de Reuniones
  reunionesHistoricas: SeguimientoReunion[] = [];
  reunionExpandidaId: number | null = null;
  busquedaHistorico = '';

  constructor(
    private _proyectoService: ProyectoService,
    public state: SeguimientoStateService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue === true) {
      this._resetForm();
      if (this.seguimientoId) {
        this.verificarReunionExistenteParaFecha();
        this.cargarHistorico();
      }
    }
  }

  private _resetForm(): void {
    this.modoTab = 'nueva';
    this.saving = false;
    this.reunionId = null;
    this.esEdicionReunion = false;
    this.fechaReunion = this._getFechaActualIso();
    this.tituloReunion = 'Reunión de Avance Diario / Minuta';
    this.descripcionReunion = '';
    this.tareasMinuta = [];
  }

  private _getFechaActualIso(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  onFechaChange(): void {
    this.verificarReunionExistenteParaFecha();
  }

  verificarReunionExistenteParaFecha(): void {
    if (!this.seguimientoId || !this.fechaReunion) return;

    this.loadingBusquedaFecha = true;
    this._cdr.markForCheck();

    const fechaSoloDia = this.fechaReunion.split('T')[0];

    this._proyectoService.buscarReunionPorFecha(this.seguimientoId, fechaSoloDia, this.usuarioId).subscribe({
      next: (res: any) => {
        this.loadingBusquedaFecha = false;
        if (res.data) {
          this.cargarReunionEnFormulario(res.data);
        } else {
          this.reunionId = null;
          this.esEdicionReunion = false;
          this.tituloReunion = 'Reunión de Avance Diario / Minuta';
          this.descripcionReunion = '';
          this.tareasMinuta = [];
          this.agregarFilaTarea();
        }
        this._cdr.markForCheck();
      },
      error: () => {
        this.loadingBusquedaFecha = false;
        this.reunionId = null;
        this.esEdicionReunion = false;
        this._cdr.markForCheck();
      },
    });
  }

  cargarReunionEnFormulario(r: SeguimientoReunion): void {
    this.reunionId = r.id;
    this.esEdicionReunion = true;
    this.modoTab = 'nueva';
    this.fechaReunion = r.fecha ? String(r.fecha).replace(' ', 'T').substring(0, 16) : this._getFechaActualIso();
    this.tituloReunion = r.titulo || 'Reunión de Avance Diario / Minuta';
    this.descripcionReunion = r.descripcion || '';

    const tareasExistentes = r.tareas || [];
    if (tareasExistentes.length > 0) {
      this.tareasMinuta = tareasExistentes.map((t: any) => {
        const respIds: number[] = Array.isArray(t.responsables) && t.responsables.length > 0
          ? t.responsables.map((id: any) => Number(id))
          : (t.usuario_id ? [Number(t.usuario_id)] : []);

        const respList: UsuarioCache[] = respIds.map(uid => {
          const uFound = this.usuariosDisponibles.find(u => Number(u.id) === uid);
          return uFound || { id: uid, nombre: this.state.nombreUsuario(uid) };
        });

        return {
          id: t.id,
          idTemp: t.id,
          titulo: t.titulo || '',
          descripcion: t.descripcion || '',
          responsablesSelec: respList,
          fecha_limite_entrega: t.fecha_limite_entrega ? String(t.fecha_limite_entrega).replace(' ', 'T').substring(0, 16) : this.fechaReunion,
          busquedaResp: '',
          showRespDropdown: false,
        };
      });
    } else {
      this.tareasMinuta = [];
      this.agregarFilaTarea();
    }
    this._cdr.markForCheck();
  }

  cargarReunionParaEditar(r: SeguimientoReunion): void {
    this.cargarReunionEnFormulario(r);
  }

  agregarFilaTarea(): void {
    this.tareasMinuta.push({
      idTemp: Date.now() + Math.random(),
      titulo: '',
      descripcion: '',
      responsablesSelec: [],
      fecha_limite_entrega: this.fechaReunion || this._getFechaActualIso(),
      busquedaResp: '',
      showRespDropdown: false,
    });
    this._cdr.markForCheck();
  }

  onTituloKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (index === this.tareasMinuta.length - 1 && this.tareasMinuta[index].titulo.trim().length > 0) {
        this.agregarFilaTarea();
      }
    }
  }

  eliminarFilaTarea(index: number): void {
    if (this.tareasMinuta.length > 1) {
      this.tareasMinuta.splice(index, 1);
    } else {
      this.tareasMinuta[0] = {
        idTemp: Date.now(),
        titulo: '',
        descripcion: '',
        responsablesSelec: [],
        fecha_limite_entrega: this.fechaReunion || this._getFechaActualIso(),
        busquedaResp: '',
        showRespDropdown: false,
      };
    }
    this._cdr.markForCheck();
  }

  usuariosFiltradosFila(tFila: TareaMinutaFila): UsuarioCache[] {
    const ids = new Set(tFila.responsablesSelec.map((r) => Number(r.id)));
    const q = (tFila.busquedaResp || '').toLowerCase().trim();
    const lista = (this.usuariosDisponibles && this.usuariosDisponibles.length > 0)
      ? this.usuariosDisponibles
      : this.state.usuariosResponsables;
    return (lista || [])
      .filter((u) => u && u.id != null && !ids.has(Number(u.id)) && (!q || (u.nombre || '').toLowerCase().includes(q)))
      .slice(0, 15);
  }

  agregarResponsableFila(tFila: TareaMinutaFila, u: UsuarioCache, ev?: Event): void {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    const targetId = Number(u.id);
    if (!tFila.responsablesSelec.find((r) => Number(r.id) === targetId)) {
      tFila.responsablesSelec.push(u);
    }
    tFila.busquedaResp = '';
    tFila.showRespDropdown = false;
    this._cdr.detectChanges();
  }

  quitarResponsableFila(tFila: TareaMinutaFila, uid: number | string, ev?: Event): void {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    const targetId = Number(uid);
    tFila.responsablesSelec = tFila.responsablesSelec.filter((r) => Number(r.id) !== targetId);
    this._cdr.detectChanges();
  }

  cargarHistorico(): void {
    if (!this.seguimientoId) return;
    this.loadingHistorico = true;
    this._cdr.markForCheck();

    this._proyectoService.getReuniones(this.seguimientoId, this.usuarioId, this.vistaMode).subscribe({
      next: (res: any) => {
        this.reunionesHistoricas = res.data || [];
        if (this.reunionesHistoricas.length > 0 && !this.reunionExpandidaId) {
          this.reunionExpandidaId = this.reunionesHistoricas[0].id;
        }
        this.loadingHistorico = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loadingHistorico = false;
        this._cdr.markForCheck();
      },
    });
  }

  toggleExpandirReunion(rId: number): void {
    this.reunionExpandidaId = this.reunionExpandidaId === rId ? null : rId;
    this._cdr.markForCheck();
  }

  get reunionesFiltradasHistoricas(): SeguimientoReunion[] {
    const q = this.busquedaHistorico.toLowerCase().trim();
    if (!q) return this.reunionesHistoricas;
    return this.reunionesHistoricas.filter(
      (r) =>
        r.titulo.toLowerCase().includes(q) ||
        (r.descripcion && r.descripcion.toLowerCase().includes(q)) ||
        (r.tareas && r.tareas.some((t) => t.titulo.toLowerCase().includes(q)))
    );
  }

  get totalTareasValidas(): number {
    return this.tareasMinuta.filter((t) => t.titulo.trim().length > 0).length;
  }

  guardarReunion(): void {
    if (this.saving) return;

    const tareasValidas = this.tareasMinuta.filter((t) => t.titulo.trim().length > 0);

    if (tareasValidas.length === 0) {
      this.state.showToast('Ingresa al menos una tarea con título para la reunión', 'warning');
      return;
    }

    const tareaSinResp = tareasValidas.find((t) => !t.responsablesSelec || t.responsablesSelec.length === 0);
    if (tareaSinResp) {
      this.state.showToast(`La tarea "${tareaSinResp.titulo}" debe tener al menos un responsable`, 'warning');
      return;
    }

    this.saving = true;
    this._cdr.markForCheck();

    const payload = {
      reunion_id: this.reunionId || undefined,
      seguimiento_id: this.seguimientoId,
      usuario_id: this.usuarioId,
      fecha: this.fechaReunion || this._getFechaActualIso(),
      titulo: this.tituloReunion.trim() || 'Reunión / Minuta del Día',
      descripcion: this.descripcionReunion.trim(),
      tareas: tareasValidas.map((t) => ({
        id: t.id || undefined,
        titulo: t.titulo.trim(),
        descripcion: t.descripcion.trim(),
        responsables: t.responsablesSelec.map((r) => r.id),
        fecha_limite_entrega: t.fecha_limite_entrega || this.fechaReunion,
      })),
    };

    this._proyectoService.crearReunionConTareas(payload).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.state.showToast(this.esEdicionReunion ? 'Reunión del día actualizada correctamente' : 'Reunión y tareas registradas correctamente');
        this.onGuardado.emit();
        this.cerrar();
      },
      error: (err: any) => {
        this.saving = false;
        this.state.showToast(err.error?.message || 'Error al guardar la reunión', 'error');
        this._cdr.markForCheck();
      },
    });
  }

  cerrar(): void {
    this.onCerrar.emit();
  }
}
