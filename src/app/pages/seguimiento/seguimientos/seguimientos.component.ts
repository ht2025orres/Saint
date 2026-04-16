import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { Subscription, Observable } from 'rxjs';
import { ProyectoService, FlujoDiario, Compromiso, SeguimientoAnual } from 'src/app/services/proyectos.service';
import { SeguimientoStateService } from '../seguimiento-state.service';
import { CompromisoForm } from '../modals/modal-compromiso/modal-compromiso.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-seguimientos',
  templateUrl: './seguimientos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeguimientosComponent implements OnInit, OnDestroy {
  @Input() usuarioId = 0;
  @Input() puedeGestionarModulo = false;

  loading            = false;
  loadingFlujo       = false;
  loadingSaturacion  = false;
  flujoActivo: FlujoDiario | null  = null;
  seguimientoActual: SeguimientoAnual | null = null;
  saturacion: any[]  = [];
  totalSaturacion: any = {};

  showModalCompromiso  = false;
  compromisoParaEditar: Compromiso | null = null;
  savingCompromiso     = false;

  // Inline edit
  compromisoInline: { id: number | null, titulo: string, responsables: number[], notas: string, descripcion: string } | null = null;
  compromisoOriginal: string | null = null; // Para detección de cambios
  savingInline = false;
  mostrarNotasInline = false;

  // Navegación por fechas
  fechaSeleccionada: string = ''; 
  historialFlujos: any[] = []; // Para el carrusel/calendario
  showSelectorCalendario = false;
  
  // Estado del calendario (mes visualizado)
  mesCalendario = new Date();

  private _subs = new Subscription();

  constructor(
    private _proy: ProyectoService,
    public  state: SeguimientoStateService,
    private _cdr: ChangeDetectorRef,
    private _el: ElementRef,
  ) {
    this.fechaSeleccionada = this.formatLocal(new Date());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const isInsideComponent = this._el.nativeElement.contains(target);
    const isModal = target.closest('.swal2-container');
    
    // Cerrar selector de calendario si se hace clic fuera del grupo que lo contiene
    if (this.showSelectorCalendario && !target.closest('.relative.group')) {
      this.showSelectorCalendario = false;
      this._cdr.markForCheck();
    }

    if (!this.compromisoInline) return;
    
    // Guardar inline solo si se hace clic fuera del componente, no hay un modal abierto, 
    // y el elemento clickeado sigue conectado al DOM (para evitar cierres por *ngIf)
    if (!isInsideComponent && !isModal && target.isConnected) {
      this.guardarInline();
    }
  }

  // Nueva función para parsear fechas de la API a Date local correctamente
  parseFechaAPI(fechaStr: string): Date {
    const parts = (fechaStr.includes('T') ? fechaStr.split('T')[0] : fechaStr.split(' ')[0]).split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  get esGestor(): boolean {
    return this.puedeGestionarModulo || (this.seguimientoActual?.es_gestor ?? false);
  }

  saturacionPct(total: number): number {
    return Math.min(Math.round((total / 15) * 100), 100);
  }

  getSaturacionClasses(nivel: string): { badge: string; bar: string } {
    return {
      alto:  { badge: 'bg-rose-50 text-rose-600 border-rose-200',     bar: 'bg-rose-500'    },
      medio: { badge: 'bg-amber-50 text-amber-600 border-amber-200',   bar: 'bg-amber-500'   },
      bajo:  { badge: 'bg-emerald-50 text-emerald-600 border-emerald-200', bar: 'bg-emerald-500' },
    }[nivel] ?? { badge: 'bg-slate-100 text-slate-500 border-slate-200', bar: 'bg-slate-300' };
  }

  ngOnInit(): void { this.cargarDatos(); }
  ngOnDestroy(): void { this._subs.unsubscribe(); }

  cargarDatos(): void {
    if (!this.seguimientoActual) {
      this.loading = true;
      this._cdr.markForCheck();
      this._proy.getSeguimientosAnuales(this.usuarioId).subscribe({
        next: (res) => {
          const seg = res.data?.find(s => s.estado === 'activo') ?? null;
          this.seguimientoActual = seg;
          if (!seg) { this.loading = false; this._cdr.markForCheck(); return; }
          this._cargarFlujoYHistorial(seg.id);
          if (this.esGestor) this._cargarSaturacion(seg.id);
        },
        error: () => { this.loading = false; this._cdr.markForCheck(); },
      });
    } else {
      // Ya tenemos seguimiento, solo cargamos los datos del día
      this._cargarFlujoYHistorial(this.seguimientoActual.id);
      if (this.esGestor) this._cargarSaturacion(this.seguimientoActual.id);
    }
  }

  formatLocal(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private _cargarFlujoYHistorial(segId: number): void {
    this.loadingFlujo = true;
    this._cdr.markForCheck();

    // 1. Cargar historial (para indicadores en calendario y carrusel)
    this._proy.getFlujos(segId, this.usuarioId).subscribe(h => {
      const seen = new Set();
      this.historialFlujos = (h.data || []).filter((f: any) => {
        const date = f.fecha.includes('T') ? f.fecha.split('T')[0] : f.fecha.split(' ')[0];
        const duplicate = seen.has(date);
        seen.add(date);
        return !duplicate;
      }).sort((a: any, b: any) => b.fecha.localeCompare(a.fecha));
      this._cdr.markForCheck();
    });

    // 2. Cargar flujo específico del día
    this._proy.getFlujoActivo(segId, this.usuarioId, this.fechaSeleccionada).subscribe({
      next: (res) => {
        this.flujoActivo = res.data || null;
        this.loadingFlujo = false;
        this.loading = false;
        
        // Si no hay flujo y es hoy, creamos uno
        const hoy = this.formatLocal(new Date());
        if (!this.flujoActivo && this.fechaSeleccionada === hoy && this.esGestor) {
          this._proy.crearFlujo({
            seguimiento_id: segId,
            usuario_id: this.usuarioId,
            fecha: hoy,
          }).subscribe(resNuevo => {
            this.flujoActivo = resNuevo.data;
            this._cdr.markForCheck();
          });
        }
        
        this._cdr.markForCheck();
      },
      error: () => { this.loadingFlujo = false; this.loading = false; this._cdr.markForCheck(); },
    });
  }

  cambiarFecha(offset: number): void {
    const parts = this.fechaSeleccionada.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + offset);
    this.fechaSeleccionada = this.formatLocal(d);
    
    // Si cambiamos de mes, actualizar el mes del calendario
    if (d.getMonth() !== this.mesCalendario.getMonth() || d.getFullYear() !== this.mesCalendario.getFullYear()) {
      this.mesCalendario = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    
    this.cargarDatos();
  }

  seleccionarFecha(fecha: string): void {
    this.fechaSeleccionada = fecha;
    this.showSelectorCalendario = false;
    
    // Sincronizar mes del calendario con la fecha seleccionada
    const parts = fecha.split('-').map(Number);
    this.mesCalendario = new Date(parts[0], parts[1] - 1, 1);
    
    this.cargarDatos();
  }

  // ── Acciones Compromisos ──────────────────────────────────────────────

  onCompromisoClick(c: Compromiso, event: MouseEvent): void {
    if (this.esGestor || c.responsables.includes(this.usuarioId)) {
      this.editarInline(c);
      event.stopPropagation();
    }
  }

  onToggleCompromiso(c: Compromiso, event: MouseEvent): void {
    event.stopPropagation();
    this.toggleCompromiso(c);
  }

  onEliminarCompromiso(c: Compromiso, event: MouseEvent): void {
    event.stopPropagation();
    this.eliminarCompromiso(c);
  }

  onIniciarNuevoInline(event: MouseEvent): void {
    event.stopPropagation();
    this.iniciarNuevoInline();
  }

  get esHoy(): boolean {
    return this.fechaSeleccionada === this.formatLocal(new Date());
  }

  get infoFlujoSeleccionado(): any {
    return this.historialFlujos.find(f => {
      const fFecha = f.fecha.includes('T') ? f.fecha.split('T')[0] : f.fecha.split(' ')[0];
      return fFecha === this.fechaSeleccionada;
    });
  }

  get diasCalendario(): Date[] {
    const year = this.mesCalendario.getFullYear();
    const month = this.mesCalendario.getMonth();
    
    // Primer día del mes
    const primerDia = new Date(year, month, 1);
    // Último día del mes
    const ultimoDia = new Date(year, month + 1, 0);
    
    // Ajustar para que la semana empiece en Lunes (0=Dom, 1=Lun, ..., 6=Sáb)
    // En JS getDay() es 0=Dom. Queremos 0=Lun, ..., 6=Dom.
    let startDay = primerDia.getDay();
    if (startDay === 0) startDay = 7; // Domingo es 7
    startDay--; // Ahora 0=Lun, ..., 6=Dom
    
    const dias: Date[] = [];
    
    // Días del mes anterior para rellenar la primera semana
    for (let i = startDay; i > 0; i--) {
      dias.push(new Date(year, month, 1 - i));
    }
    
    // Días del mes actual
    for (let i = 1; i <= ultimoDia.getDate(); i++) {
      dias.push(new Date(year, month, i));
    }
    
    // Días del mes siguiente para rellenar hasta completar 42 celdas (6 semanas)
    const remaining = 42 - dias.length;
    for (let i = 1; i <= remaining; i++) {
      dias.push(new Date(year, month + 1, i));
    }
    
    return dias;
  }

  cambiarMesCalendario(offset: number): void {
    this.mesCalendario = new Date(this.mesCalendario.getFullYear(), this.mesCalendario.getMonth() + offset, 1);
    this._cdr.markForCheck();
  }

  getFlujoEnFecha(fecha: Date): any {
    const fStr = this.formatLocal(fecha);
    // Asegurar que solo comparamos la fecha sin hora
    return this.historialFlujos.find(h => {
      const hFecha = h.fecha.includes('T') ? h.fecha.split('T')[0] : h.fecha.split(' ')[0];
      return hFecha === fStr;
    });
  }

  esMismoMes(fecha: Date): boolean {
    return fecha.getMonth() === this.mesCalendario.getMonth();
  }



  private _cargarSaturacion(segId: number): void {
    this.loadingSaturacion = true;
    this._cdr.markForCheck();

    this._proy.getSaturacionParticipantes(segId, this.usuarioId).subscribe({
      next: (res) => {
        this.saturacion = res.data ?? [];
        this.totalSaturacion = {
          compromisos_total: this.saturacion.reduce((acc, s) => acc + s.compromisos_total, 0),
          tareas_proyecto: this.saturacion.reduce((acc, s) => acc + s.tareas_proyecto, 0),
          tareas_seguimiento: this.saturacion.reduce((acc, s) => acc + s.tareas_seguimiento, 0),
          tareas_informe: this.saturacion.reduce((acc, s) => acc + (s.tareas_informe || 0), 0),
          tareas_glpi: this.saturacion.reduce((acc, s) => acc + (s.tareas_glpi || 0), 0),
          total_activas: this.saturacion.reduce((acc, s) => acc + s.total_activas, 0),
        };
        this.loadingSaturacion = false;
        this._cdr.markForCheck();
      },
      error: ()  => { this.loadingSaturacion = false; this._cdr.markForCheck(); },
    });
  }

  // ── Compromisos ──────────────────────────────────────────────────────────

  abrirNuevoCompromiso(): void {
    this.compromisoParaEditar = null;
    this.showModalCompromiso  = true;
    this._cdr.markForCheck();
  }

  abrirEditarCompromiso(c: Compromiso): void {
    this.compromisoParaEditar = c;
    this.showModalCompromiso  = true;
    this._cdr.markForCheck();
  }

  onGuardarCompromiso(form: CompromisoForm): void {
    if (!this.flujoActivo) return;
    this.savingCompromiso = true;
    this._cdr.markForCheck();

    let req$: Observable<any>;

    if (this.compromisoParaEditar) {
      // Actualización
      const parts = this.fechaSeleccionada.split('-').map(Number);
      const body = {
        flujo_id: this.flujoActivo.id, // Añadimos flujo_id por si el backend lo requiere (error de ruta)
        anio: parts[0],
        mes: parts[1],
        titulo: form.titulo,
        usuario_id: this.usuarioId,
        responsables: form.responsables,
        notas: form.descripcion // En el modal descripcion se usa como notas
      };
      req$ = this._proy.actualizarCompromiso(this.compromisoParaEditar.id, body as any);
    } else {
      // Creación
      const body = {
        flujo_id: this.flujoActivo.id,
        titulo: form.titulo,
        usuario_id: this.usuarioId,
        responsables: form.responsables,
        descripcion: form.descripcion
      };
      req$ = this._proy.crearCompromiso(body);
    }

    req$.subscribe({
      next: (res: any) => { 
        this.savingCompromiso = false; 
        this.showModalCompromiso = false; 
        this.state.showToast('Compromiso guardado'); 
        
        if (this.compromisoParaEditar && this.flujoActivo) {
          // Actualización local sin recarga
          const idx = this.flujoActivo.compromisos.findIndex(c => c.id === this.compromisoParaEditar!.id);
          if (idx > -1) {
            this.flujoActivo.compromisos[idx] = { 
              ...this.flujoActivo.compromisos[idx], 
              titulo: form.titulo,
              responsables: [...form.responsables],
              notas: form.descripcion
            };
          }
        } else {
          // Si es nuevo, sí recargamos para obtener el ID y orden real
          this.cargarDatos(); 
        }
        this._cdr.markForCheck();
      },
      error: () => { this.savingCompromiso = false; this.state.showToast('Error al guardar', 'error'); this._cdr.markForCheck(); },
    });
  }

  toggleCompromiso(c: Compromiso): void {
    const req$ = c.estado === 'completado'
      ? this._proy.reabrirCompromiso(c.id, this.usuarioId)
      : this._proy.completarCompromiso(c.id, this.usuarioId);

    req$.subscribe({
      next: () => { this.state.showToast('Estado actualizado'); this.cargarDatos(); },
      error: () => this.state.showToast('Error al actualizar', 'error'),
    });
  }

  eliminarCompromiso(c: Compromiso): void {
    Swal.fire({
      title: '¿Eliminar compromiso?', text: `"${c.titulo}"`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc2626', confirmButtonText: 'Sí, eliminar',
    }).then(r => {
      if (!r.isConfirmed) return;
      this._proy.eliminarCompromiso(c.id, this.usuarioId).subscribe({
        next: () => { this.state.showToast('Compromiso eliminado'); this.cargarDatos(); },
        error: () => this.state.showToast('Error', 'error'),
      });
    });
  }

  // ── Inline Edit ──────────────────────────────────────────────────────────

  iniciarNuevoInline(): void {
    const data = { id: null, titulo: '', responsables: [], notas: '', descripcion: '' };
    this.compromisoInline = { ...data };
    this.compromisoOriginal = JSON.stringify(data);
    this.mostrarNotasInline = false;
    this._cdr.markForCheck();
  }

  editarInline(c: Compromiso): void {
    const data = { 
      id: c.id, 
      titulo: c.titulo, 
      responsables: c.responsables || [], 
      notas: c.notas || '',
      descripcion: c.descripcion || '' 
    };
    this.compromisoInline = { ...data };
    this.compromisoOriginal = JSON.stringify(data);
    this.mostrarNotasInline = !!(c.notas || c.descripcion);
    this._cdr.markForCheck();
  }

  verNotaCompromiso(c: Compromiso, event: MouseEvent): void {
    event.stopPropagation();
    const content = `
      <div class="text-left">
        ${c.descripcion ? `<div class="mb-4"><b class="text-slate-400 uppercase text-[10px] tracking-widest">Descripción:</b><p class="text-slate-700 mt-1">${c.descripcion}</p></div>` : ''}
        ${c.notas ? `<div><b class="text-amber-500 uppercase text-[10px] tracking-widest">Nota:</b><p class="text-amber-700 mt-1">${c.notas}</p></div>` : ''}
      </div>
    `;
    
    Swal.fire({
      title: 'Información del compromiso',
      html: content,
      icon: 'info',
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#3b82f6',
      customClass: {
        popup: 'rounded-3xl border-none shadow-2xl',
        confirmButton: 'rounded-xl px-8 py-2.5 text-xs font-black uppercase tracking-widest'
      }
    });
  }

  cancelarInline(): void {
    this.compromisoInline = null;
    this.compromisoOriginal = null;
    this._cdr.markForCheck();
  }

  guardarInline(): void {
    if (!this.compromisoInline) return;
    
    // Si no tiene título, cancelamos (para nuevos) o restauramos (para existentes)
    if (!this.compromisoInline.titulo.trim()) {
      this.cancelarInline();
      return;
    }

    // Detección de cambios: si es igual al original, simplemente cerramos
    if (this.compromisoOriginal === JSON.stringify(this.compromisoInline)) {
      this.cancelarInline();
      return;
    }

    if (!this.flujoActivo) return;

    this.savingInline = true;
    this._cdr.markForCheck();

    let req$: Observable<any>;

    if (this.compromisoInline.id) {
      // Actualización
      const parts = this.fechaSeleccionada.split('-').map(Number);
      const body = {
        flujo_id: this.flujoActivo.id,
        anio: parts[0],
        mes: parts[1],
        titulo: this.compromisoInline.titulo,
        usuario_id: this.usuarioId,
        responsables: this.compromisoInline.responsables,
        notas: this.compromisoInline.notas,
        descripcion: this.compromisoInline.descripcion
      };
      req$ = this._proy.actualizarCompromiso(this.compromisoInline.id, body as any);
    } else {
      // Creación
      const body = {
        flujo_id: this.flujoActivo.id,
        titulo: this.compromisoInline.titulo,
        usuario_id: this.usuarioId,
        responsables: this.compromisoInline.responsables,
        descripcion: this.compromisoInline.descripcion,
        notas: this.compromisoInline.notas,
      };
      req$ = this._proy.crearCompromiso(body);
    }

    req$.subscribe({
      next: (res: any) => {
        this.savingInline = false;
        
        if (this.compromisoInline!.id && this.flujoActivo) {
          // Actualización local
          const idx = this.flujoActivo.compromisos.findIndex(c => c.id === this.compromisoInline!.id);
          if (idx > -1) {
            this.flujoActivo.compromisos[idx] = {
              ...this.flujoActivo.compromisos[idx],
              titulo: this.compromisoInline!.titulo,
              responsables: [...this.compromisoInline!.responsables],
              notas: this.compromisoInline!.notas
            };
          }
        } else {
          // Si es nuevo, recargamos para obtener el ID real
          this.cargarDatos();
        }

        this.compromisoInline = null;
        this.compromisoOriginal = null;
        this.state.showToast('Compromiso guardado');
        this._cdr.markForCheck();
      },
      error: () => {
        this.savingInline = false;
        this.state.showToast('Error al guardar', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  toggleResponsableInline(uid: number): void {
    if (!this.compromisoInline) return;
    const idx = this.compromisoInline.responsables.indexOf(uid);
    if (idx > -1) {
      this.compromisoInline.responsables.splice(idx, 1);
    } else {
      this.compromisoInline.responsables.push(uid);
    }
    this._cdr.markForCheck();
  }

  esResponsableInline(uid: number): boolean {
    return this.compromisoInline?.responsables.includes(uid) ?? false;
  }

  // ── Flujo ────────────────────────────────────────────────────────────────



  get fechaActual(): Date { return new Date(); }
}