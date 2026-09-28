import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef, HostListener, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Tarea, Actividad, ProyectoService } from 'src/app/services/proyectos.service';
import { SeguimientoStateService, UsuarioCache } from '../../seguimiento-state.service';
import Swal from 'sweetalert2';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';

export interface TareaForm {
  actividad_id?:        number | null;
  proyecto_id?:         number | null;
  titulo:               string;
  descripcion:          string;
  estado:               string;
  notas:                string;
  fecha_limite_entrega: string;
  responsables:         number[];
  titulo_reapertura?:    string;
  descripcion_reapertura?: string;
}

@Component({
  selector: 'app-modal-tarea',
  templateUrl: './modal-tarea.component.html',
})
export class ModalTareaComponent implements OnChanges {

  @Input() show               = false;
  @Input() tarea: Tarea | null    = null;
  @Input() actividadId: number | null = null;
  @Input() proyectoId: number  | null = null;
  @Input() proyecto: any | null = null;
  @Input() actividades: Actividad[]   = [];
  @Input() usuariosDisponibles: UsuarioCache[] = [];
  @Input() saving = false;
  /** true = admin/gestor; false = solo puede editar lo básico */
  @Input() esAdmin = true;
  @Input() esSeguimiento = false;

  @Output() onCerrar   = new EventEmitter<void>();
  @Output() onGuardar  = new EventEmitter<TareaForm>();
  @Output() onEliminar = new EventEmitter<Tarea>();

  get puedeEliminar(): boolean {
    if (!this.esEdicion || !this.tarea) return false;
    const miId = this._getMiId();
    const creadorId = Number((this.tarea as any).creado_por || (this.tarea as any).usuario_id || 0);
    return this.esAdmin || creadorId === miId;
  }

  eliminar(): void {
    if (this.tarea) {
      this.onEliminar.emit(this.tarea);
    }
  }

  form: FormGroup;
  responsablesSelec: UsuarioCache[] = [];
  busquedaResp = '';
  showRespDropdown = false;

  @HostListener('document:mousedown', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target) return;
    if (!target.closest('.resp-dropdown-container')) {
      this.showRespDropdown = false;
      this._cdr.markForCheck();
    }
  }

  evidencias: any[] = [];
  loadingEvidencias = false;
  verHistoricoEvidencias = false;

  readonly estadoOpciones = [
    { v: 'pendiente',    l: 'Pendiente'    },
    { v: 'en_ejecucion', l: 'En ejecución' },
    { v: 'completado',   l: 'Completado'   },
    { v: 'bloqueado',    l: 'Bloqueado'    },
    { v: 'pausado',      l: 'Pausado'      },
  ];

  get esEdicion(): boolean { return !!this.tarea; }
  get titulo():    string  { return this.esEdicion ? 'Editar Tarea' : 'Nueva Tarea'; }

  get usuariosFiltrados(): UsuarioCache[] {
    const ids = new Set((this.responsablesSelec || []).map(r => Number(r.id)));
    const q   = (this.busquedaResp || '').toLowerCase().trim();

    let baseList: UsuarioCache[] = [];
    if (this.usuariosDisponibles && this.usuariosDisponibles.length > 0) {
      baseList = this.usuariosDisponibles;
    } else if (this.state.usuariosResponsables && this.state.usuariosResponsables.length > 0) {
      baseList = this.state.usuariosResponsables;
    } else if (this.state.usuariosCache && this.state.usuariosCache.length > 0) {
      baseList = this.state.usuariosCache;
    }

    return baseList
      .filter(u => {
        if (!u || u.id == null) return false;
        if (ids.has(Number(u.id))) return false;
        if (!q) return true;
        const nom = (u.nombre || '').toLowerCase();
        const proc = (u.proceso_nombre || '').toLowerCase();
        return nom.includes(q) || proc.includes(q);
      })
      .slice(0, 20);
  }

  cargarUsuariosSiVacio(): void {
    const miId = this._getMiId();

    if (!this.state.usuariosCache || this.state.usuariosCache.length === 0) {
      this.userService.getAllBasic(true, miId || undefined).subscribe({
        next: (us: any[]) => {
          if (Array.isArray(us) && us.length > 0) {
            this.state.setUsuariosCache(
              us.map(u => ({
                id: u.id,
                nombre: u.nombre_completo || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
                proceso_nombre: u.proceso_nombre ?? null,
                procesos: u.procesos ?? [],
                roles: [],
                es_miembro: u.es_miembro
              }))
            );
            this._cdr.markForCheck();
          }
        }
      });
    }
  }

  abrirDropdownResp(): void {
    this.showRespDropdown = true;
    this.cargarUsuariosSiVacio();
    this._cdr.markForCheck();
  }

  constructor(
    private fb: FormBuilder,
    private _proyectoService: ProyectoService,
    private _cdr: ChangeDetectorRef,
    public state: SeguimientoStateService,
    private _auth: AuthService,
    private userService: UserService,
    private elementRef: ElementRef
  ) {
    this.form = this.fb.group({
      proyecto_id:          [null],
      actividad_id:         [null],
      titulo:               ['', [Validators.required, Validators.maxLength(250)]],
      descripcion:          [''],
      estado:               ['pendiente'],
      notas:                [''],
      fecha_limite_entrega: [''],
      titulo_reapertura:    [''],
      descripcion_reapertura: [''],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue === true || (this.show && changes['tarea'] && !changes['tarea'].firstChange)) {
      this._resetForm();
      this.cargarUsuariosSiVacio();
      if (this.tarea && changes['show']?.currentValue === true) {
        this.cargarEvidencias();
      }
    }
  }

  private _resolverResponsables(obj: any): UsuarioCache[] {
    if (!obj) return [];

    let rawResp: any[] = [];
    if (Array.isArray(obj.responsables) && obj.responsables.length > 0) {
      rawResp = obj.responsables;
    } else if (Array.isArray(obj.responsables_ids) && obj.responsables_ids.length > 0) {
      rawResp = obj.responsables_ids;
    } else if (Array.isArray(obj.responsables_info) && obj.responsables_info.length > 0) {
      rawResp = obj.responsables_info;
    } else if (Array.isArray(obj.actividadResponsables) && obj.actividadResponsables.length > 0) {
      rawResp = obj.actividadResponsables;
    } else if (Array.isArray(obj.actividad_responsables) && obj.actividad_responsables.length > 0) {
      rawResp = obj.actividad_responsables;
    } else if (obj.responsable_id != null) {
      rawResp = [obj.responsable_id];
    } else if (obj.usuario_id != null) {
      rawResp = [obj.usuario_id];
    } else if (obj.responsables != null && !Array.isArray(obj.responsables)) {
      rawResp = [obj.responsables];
    }

    const resolvedList: UsuarioCache[] = [];

    for (const item of rawResp) {
      if (item === null || item === undefined || item === '') continue;

      let numId = 0;
      let itemObj: any = null;

      if (typeof item === 'number') {
        numId = item;
      } else if (typeof item === 'string') {
        numId = Number(item);
      } else if (typeof item === 'object') {
        itemObj = item;
        numId = Number(item.id || item.usuario_id || item.user_id || 0);
      }

      if (isNaN(numId) || numId <= 0) continue;

      if (resolvedList.some(u => Number(u.id) === numId)) continue;

      let uMatch = this.usuariosDisponibles.find(u => Number(u.id) === numId)
                || this.state.usuariosCache.find(u => Number(u.id) === numId)
                || this.state.usuariosResponsables.find(u => Number(u.id) === numId);

      if (!uMatch) {
        const nombreStr = itemObj?.nombre || itemObj?.name || itemObj?.nombre_completo || this.state.nombreUsuario(numId) || `Usuario ${numId}`;
        const inicStr   = itemObj?.iniciales || this.state.getInicialesResponsable(numId) || (nombreStr ? nombreStr.substring(0, 2).toUpperCase() : `${numId}`);
        const colorStr  = itemObj?.color || this.state.getColorPorId(numId) || 'bg-blue-600';

        uMatch = {
          id: numId,
          nombre: nombreStr,
          iniciales: inicStr,
          color: colorStr,
          permiso_seguimiento_id: 1,
          cargo_id: 0,
          cargo_nombre: ''
        };
      }

      if (uMatch) {
        resolvedList.push(uMatch);
      }
    }

    return resolvedList;
  }

  private _resetForm(): void {
    this.busquedaResp     = '';
    this.showRespDropdown = false;
    this.evidencias = [];
    this.verHistoricoEvidencias = false;

    if (this.tarea) {
      this.form.patchValue({
        proyecto_id:          this.tarea.proyecto_id ?? null,
        actividad_id:         this.tarea.actividad_id ?? null,
        titulo:               this.tarea.titulo ?? '',
        descripcion:          this.tarea.descripcion ?? '',
        estado:               this.tarea.estado ?? 'pendiente',
        notas:                this.tarea.notas ?? '',
        fecha_limite_entrega: this._toLocal(this.tarea.fecha_limite_entrega),
        titulo_reapertura:    '',
        descripcion_reapertura: '',
      });
      // Resolver responsables de forma exhaustiva
      this.responsablesSelec = this._resolverResponsables(this.tarea);
    } else {
      this.form.reset({
        proyecto_id:  this.proyectoId ?? null,
        actividad_id: this.actividadId ?? null,
        titulo: '', descripcion: '', estado: 'pendiente', notas: '', fecha_limite_entrega: '',
        titulo_reapertura: '',
        descripcion_reapertura: '',
      });
      
      // Si no es admin, auto-asignarse como único responsable al crear
      if (!this.esAdmin) {
        const miId = Number(this._getMiId());
        const miUsuario = this.usuariosDisponibles.find(u => Number(u.id) === miId)
                       || this.state.usuariosCache.find(u => Number(u.id) === miId);
        if (miUsuario) {
          this.responsablesSelec = [miUsuario];
        } else {
          const uObj = this._auth.user;
          const nombre = uObj ? `${uObj.firstName ?? ''} ${uObj.lastName ?? ''}`.trim() : 'Tú';
          this.responsablesSelec = [{ id: miId, nombre: nombre || 'Tú' }];
        }
      } else {
        this.responsablesSelec = [];
      }
    }
  }

  cargarEvidencias(): void {
    if (!this.tarea) return;
    this.loadingEvidencias = true;
    const tipo = this.tarea.origen === 'seguimiento' ? 'seguimiento_tarea' : 'tarea';
    const miId = this._getMiId();
    
    this._proyectoService.getEvidencias(tipo as any, this.tarea.id, this.verHistoricoEvidencias, miId).subscribe({
      next: (res: any) => {
        this.evidencias = res.data;
        this.loadingEvidencias = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loadingEvidencias = false;
        this._cdr.markForCheck();
      }
    });
  }

  onSubirArchivo(event: any): void {
    const file = event.target.files[0];
    if (!file || !this.tarea) return;

    const tipo = this.tarea.origen === 'seguimiento' ? 'seguimiento_tarea' : 'tarea';
    const miId = this._getMiId();

    this.loadingEvidencias = true;
    this._proyectoService.subirEvidencia(tipo as any, this.tarea.id, file, miId).subscribe({
      next: () => {
        this.state.showToast('Evidencia subida');
        this.cargarEvidencias();
      },
      error: () => {
        this.loadingEvidencias = false;
        this.state.showToast('Error al subir evidencia', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  verEvidencia(ev: any): void {
    this._proyectoService.getUrlEvidencia(ev.id).subscribe({
      next: (res) => {
        if (res.url) {
          window.open(res.url, '_blank');
        }
      },
      error: () => this.state.showToast('No se pudo obtener el archivo', 'error')
    });
  }

  deshabilitarEvidencia(ev: any): void {
    Swal.fire({
      title: '¿Deshabilitar evidencia?',
      text: 'El archivo ya no será visible en la tarea, pero permanecerá en el sistema por auditoría.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, deshabilitar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then(result => {
      if (result.isConfirmed) {
        this._proyectoService.eliminarEvidencia(ev.id, this._getMiId()).subscribe({
          next: () => {
            this.state.showToast('Evidencia deshabilitada');
            this.cargarEvidencias();
          },
          error: () => this.state.showToast('Error al deshabilitar', 'error')
        });
      }
    });
  }

  restaurarEvidencia(ev: any): void {
    this._proyectoService.restaurarEvidencia(ev.id, this._getMiId()).subscribe({
      next: () => {
        this.state.showToast('Evidencia restaurada');
        this.cargarEvidencias();
      },
      error: () => this.state.showToast('Error al restaurar', 'error')
    });
  }

  private _getMiId(): number {
    if (this._auth.user?.id) return Number(this._auth.user.id);
    try {
      const stored = sessionStorage.getItem('user') || localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u && u.id) return Number(u.id);
      }
    } catch (_) {}
    return 0;
  }

  private _toLocal(v?: string | null): string {
    if (!v) return '';
    const [d, t] = v.split('T');
    return `${d}T${t?.substring(0, 5) ?? ''}`;
  }

  agregarResponsable(u: UsuarioCache): void {
    if (!u) return;
    const targetId = Number(u.id);
    if (!this.responsablesSelec.some(r => Number(r.id) === targetId)) {
      this.responsablesSelec = [...this.responsablesSelec, u];
    }
    this.busquedaResp     = '';
    this.showRespDropdown = false;
    this._cdr.markForCheck();
  }

  quitarResponsable(id: number | string, ev?: Event): void {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    const targetId = Number(id);
    this.responsablesSelec = this.responsablesSelec.filter(r => Number(r.id) !== targetId);
    this._cdr.markForCheck();
  }

  guardar(): void {
    if (this.form.invalid || this.saving) return;
    if (!this.responsablesSelec || this.responsablesSelec.length === 0) {
      this.state.showToast('Debe asignar al menos un responsable a la tarea', 'warning');
      return;
    }
    const v = this.form.value;
    this.onGuardar.emit({
      ...v,
      proyecto_id:  this.proyectoId,
      responsables: this.responsablesSelec.map(r => r.id),
    } as TareaForm);
  }

  cerrar(): void { this.onCerrar.emit(); }
}