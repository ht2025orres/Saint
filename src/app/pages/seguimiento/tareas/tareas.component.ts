import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { Subscription, forkJoin, Observable } from 'rxjs';
import { 
  ProyectoService, 
  VistaMes, 
  FlujoDiario, 
  Compromiso, 
  SeguimientoTarea,
  TareaConsolidada,
  InformeTarea,
  SeguimientoAnual,
  Tarea,
  Actividad
} from 'src/app/services/proyectos.service';
import { SeguimientoStateService, UsuarioCache } from '../seguimiento-state.service';
import { PaginationService } from 'src/app/shared/pagination/pagination.service';
import { TareaForm } from '../modals/modal-tarea/modal-tarea.component';
import { InformeTareaForm } from '../modals/modal-informe-tarea/modal-informe-tarea.component';
import Swal from 'sweetalert2';

interface CalendarioDia {
  fecha: Date;
  esHoy: boolean;
  esMesActual: boolean;
  tareas: { tarea: SeguimientoTarea; nombreUsuario: string; iniciales: string; color: string }[];
  tareasExternas: (TareaConsolidada & { iniciales: string; color: string })[];
  tareasInforme: (InformeTarea & { nombreUsuario: string; iniciales: string; color: string })[];
  resumenPorUsuario: ResumenUsuarioDia[];
}

interface ResumenUsuarioDia {
  uid: number;
  iniciales: string;
  nombre: string;
  total: number;
  completadas: number;
  semaforo: string;
  countSeguimiento: number;
  countProyecto: number;
  countGlpi: number;
  countInforme: number;
}

@Component({
  selector: 'app-tareas',
  templateUrl: './tareas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TareasComponent implements OnInit, OnDestroy {
  @Input() usuarioId = 0;
  @Input() puedeGestionarModulo = false;

  // ── ESTADO ──────────────────────────────────────────────────────
  loading = false;
  mostrandoMes = false; // Nueva variable para controlar la vista de selección de meses
  vistaMes: VistaMes | null = null;
  seguimientoActual: SeguimientoAnual | null = null;
  
  mesActual = new Date().getMonth() + 1;
  anioActual = new Date().getFullYear();
  diaActual = new Date().getDate();

  vistaCalendario = false; // Por defecto lista según solicitud
  vistaCalendarioModo: 'mes' | 'semana' | 'dia' = 'mes';

  readonly meses = [
    { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' },
    { v: 4, l: 'Abril' }, { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' },
    { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Septiembre' },
    { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
  ];

  // ── CALENDARIO ──────────────────────────────────────────────────
  calendarioDias: CalendarioDia[][] = [];
  readonly diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // ── FILTROS ─────────────────────────────────────────────────────
  filtroGlobalEstados: string[] = ['pendiente', 'en_progreso'];
  filtroUsuariosSelec: number[] = [];
  filtroPersonasBusqueda = '';
  showFiltroPersonas = false;
  showFiltroEstados = false;
  showFiltroOrigenes = false;

  modoListaDirecta = false;
  filtroOrigenesSelec: string[] = ['seguimiento', 'proyecto', 'informe', 'glpi'];

  // Tareas originales (sin filtrar)
  tareasSegRaw: SeguimientoTarea[] = [];
  tareasProyRaw: TareaConsolidada[] = [];
  tareasInformeRaw: InformeTarea[] = [];
  tareasGlpiRaw: TareaConsolidada[] = [];

  // Tareas filtradas y paginadas
  tareasSegFiltradas: SeguimientoTarea[] = [];
  tareasProyFiltradas: TareaConsolidada[] = [];
  tareasInformeFiltradas: InformeTarea[] = [];
  tareasGlpiFiltradas: TareaConsolidada[] = [];

  // Lista directa (unificada)
  tareasUnificadasFiltradas: any[] = [];
  tareasUnificadasPaginadas: any[] = [];
  readonly paginadorUnificadoId = 'unificado-tareas';

  // Modales
  showModalDia = false;
  diaSeleccionado: CalendarioDia | null = null;

  showModalTarea = false;
  tareaParaEditar: Tarea | null = null;
  savingTarea = false;

  showModalInformeTarea = false;
  informeTareaParaEditar: InformeTarea | null = null;
  savingInformeTarea = false;

  actividadesProyecto: Actividad[] = [];

  tareasSegPaginadas: SeguimientoTarea[] = [];
  tareasProyPaginadas: TareaConsolidada[] = [];
  tareasInformePaginadas: InformeTarea[] = [];
  tareasGlpiPaginadas: TareaConsolidada[] = [];

  readonly paginadorSegId = 'seg-tareas';
  readonly paginadorProyId = 'proy-tareas';
  readonly paginadorInfId = 'inf-tareas';
  readonly paginadorGlpiId = 'glpi-tareas';

  private _subs = new Subscription();

  constructor(
    private _proyectoService: ProyectoService,
    public state: SeguimientoStateService,
    private _cdr: ChangeDetectorRef,
    private _pagination: PaginationService,
    private _el: ElementRef
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Si el clic no es dentro de un contenedor de dropdown, cerramos todo
    if (!target.closest('.dropdown-container')) {
      this.showFiltroEstados = false;
      this.showFiltroPersonas = false;
      this.showFiltroOrigenes = false;
      this._cdr.markForCheck();
    }
  }

  toggleFiltro(tipo: 'estados' | 'personas' | 'origenes', event: MouseEvent): void {
    event.stopPropagation();
    if (tipo === 'estados') {
      this.showFiltroEstados = !this.showFiltroEstados;
      this.showFiltroPersonas = false;
      this.showFiltroOrigenes = false;
    } else if (tipo === 'personas') {
      this.showFiltroPersonas = !this.showFiltroPersonas;
      this.showFiltroEstados = false;
      this.showFiltroOrigenes = false;
    } else if (tipo === 'origenes') {
      this.showFiltroOrigenes = !this.showFiltroOrigenes;
      this.showFiltroEstados = false;
      this.showFiltroPersonas = false;
    }
    this._cdr.markForCheck();
  }

  get usuariosFiltrados(): any[] {
    const search = this.filtroPersonasBusqueda.toLowerCase().trim();
    return this.state.usuariosCache.filter(u => {
      // Filtrar por rol "Administrador del sistema"
      const esAdminSist = u.roles?.some((r: any) => 
        r.nombre.toLowerCase().includes('administrador del sistema')
      );
      if (!esAdminSist) return false;

      // Filtrar por búsqueda de nombre
      if (!search) return true;
      return u.nombre.toLowerCase().includes(search);
    });
  }

  ngOnInit(): void {
    this.cargarConfiguracion();
    this.cargarDatos();
  }

  private cargarConfiguracion(): void {
    const config = localStorage.getItem('tareas-filtros-config');
    if (config) {
      try {
        const parsed = JSON.parse(config);
        this.filtroGlobalEstados = parsed.estados || ['pendiente', 'en_progreso'];
        this.filtroUsuariosSelec = parsed.usuarios || [];
        this.modoListaDirecta = parsed.modoListaDirecta || false;
        this.filtroOrigenesSelec = parsed.origenes || ['seguimiento', 'proyecto', 'informe', 'glpi'];
        this.vistaCalendario = parsed.vistaCalendario ?? false;
      } catch (e) {
        console.error('Error al cargar configuración de filtros:', e);
      }
    }
  }

  public guardarConfiguracion(): void {
    const config = {
      estados: this.filtroGlobalEstados,
      usuarios: this.filtroUsuariosSelec,
      modoListaDirecta: this.modoListaDirecta,
      origenes: this.filtroOrigenesSelec,
      vistaCalendario: this.vistaCalendario
    };
    localStorage.setItem('tareas-filtros-config', JSON.stringify(config));
  }

  ngOnDestroy(): void {
    this._subs.unsubscribe();
  }

  cargarDatos(): void {
    this.loading = true;
    this._cdr.markForCheck();

    this._proyectoService.getSeguimientosAnuales(this.usuarioId).subscribe({
      next: (res) => {
        const seg = res.data?.find(s => s.estado === 'activo');
        if (seg) {
          this.seguimientoActual = seg;
          this.anioActual = seg.anio;
          // Cargamos el mes automáticamente según solicitud
          this.seleccionarMes(this.mesActual);
        } else {
          this.loading = false;
          this._cdr.markForCheck();
        }
      },
      error: () => {
        this.loading = false;
        this._cdr.markForCheck();
      }
    });
  }

  seleccionarMes(m: number): void {
    if (!this.seguimientoActual) return;
    this.mesActual = m;
    this.mostrandoMes = true;
    this._cargarDetalleMes(this.seguimientoActual.id, m, this.anioActual);
  }

  irAtras(): void {
    this.mostrandoMes = false;
    this.vistaMes = null;
    this._cdr.markForCheck();
  }

  private _cargarDetalleMes(seguimientoId: number, mes: number, anio: number): void {
    this.loading = true;
    this._cdr.markForCheck();
    
    // Cargar vista mes y tareas consolidadas en paralelo
    forkJoin({
      vistaMes: this._proyectoService.getVistaMes(seguimientoId, mes, anio, this.usuarioId),
      consolidadas: this._proyectoService.getTareasConsolidadas(this.usuarioId, mes, anio, ['proyecto', 'glpi']),
      informes: this._proyectoService.getMisInformeTareas(this.usuarioId),
      proyectos: this._proyectoService.getProyectos(this.usuarioId, { activos: true })
    }).subscribe({
      next: (res: any) => {
        this.vistaMes = res.vistaMes.data;
        const consolidadas = res.consolidadas.data || [];
        
        // Intentar obtener actividades de un proyecto activo para el modal
        const proyectoConActividades = res.proyectos?.data?.find((p: any) => p.total_actividades > 0);
        if (proyectoConActividades) {
          this._proyectoService.getDetalleCompleto(proyectoConActividades.id, this.usuarioId).subscribe({
            next: (det: any) => {
              this.actividadesProyecto = det.data?.actividades || [];
              this._cdr.markForCheck();
            }
          });
        }
        
        // Separar tareas consolidadas
        this.tareasProyRaw = consolidadas.filter((t: any) => t.origen === 'proyecto');
        this.tareasGlpiRaw = consolidadas.filter((t: any) => t.origen === 'glpi');
        
        // Tareas de seguimiento (desde vistaMes)
        if (this.vistaMes?.tareas) {
          if (Array.isArray(this.vistaMes.tareas)) {
            this.tareasSegRaw = this.vistaMes.tareas;
          } else {
            this.tareasSegRaw = Object.values(this.vistaMes.tareas).reduce((acc: any, val: any) => acc.concat(val), [] as SeguimientoTarea[]);
          }
        } else {
          this.tareasSegRaw = [];
        }

        this.tareasInformeRaw = res.informes.data || [];

        this._aplicarFiltrosYPaginar();
        this._construirCalendario();
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error cargando detalle mes:', err);
        this.loading = false;
        this._cdr.markForCheck();
      }
    });
  }

  cambiarModoCalendario(modo: 'mes' | 'semana' | 'dia'): void {
    this.vistaCalendarioModo = modo;
    this._construirCalendario();
    this._cdr.markForCheck();
  }

  public _aplicarFiltrosYPaginar(): void {
    const filtrarPorEstadoYUsuario = (t: any, uidKey: string = 'usuario_id') => {
      const cumpleEstado = this.filtroGlobalEstados.length === 0 || this.filtroGlobalEstados.includes(t.estado);
      const cumpleUsuario = this.filtroUsuariosSelec.length === 0 || this.filtroUsuariosSelec.includes(t[uidKey]);
      return cumpleEstado && cumpleUsuario;
    };

    // Aplicar filtros a cada categoría
    this.tareasSegFiltradas = this.tareasSegRaw.filter(t => filtrarPorEstadoYUsuario(t));
    this.tareasProyFiltradas = this.tareasProyRaw.filter(t => filtrarPorEstadoYUsuario(t));
    this.tareasInformeFiltradas = this.tareasInformeRaw.filter(t => filtrarPorEstadoYUsuario(t, 'responsable_id'));
    this.tareasGlpiFiltradas = this.tareasGlpiRaw.filter(t => filtrarPorEstadoYUsuario(t));

    if (this.modoListaDirecta) {
      // Unificar todas las tareas filtradas por origen
      let unificadas: any[] = [];
      if (this.filtroOrigenesSelec.includes('seguimiento')) {
        unificadas = [...unificadas, ...this.tareasSegFiltradas.map(t => ({ ...t, _origen_label: 'Seguimiento', _color: 'bg-indigo-600', origen: 'seguimiento' }))];
      }
      if (this.filtroOrigenesSelec.includes('proyecto')) {
        unificadas = [...unificadas, ...this.tareasProyFiltradas.map(t => ({ ...t, _origen_label: 'Proyecto', _color: 'bg-teal-600', origen: 'proyecto' }))];
      }
      if (this.filtroOrigenesSelec.includes('informe')) {
        unificadas = [...unificadas, ...this.tareasInformeFiltradas.map(t => ({ ...t, _origen_label: 'Informe', _color: 'bg-amber-600', origen: 'informe' }))];
      }
      if (this.filtroOrigenesSelec.includes('glpi')) {
        unificadas = [...unificadas, ...this.tareasGlpiFiltradas.map(t => ({ ...t, _origen_label: 'GLPI', _color: 'bg-orange-600', origen: 'glpi' }))];
      }

      // Ordenar por fecha límite de entrega
      unificadas.sort((a, b) => {
        if (!a.fecha_limite_entrega) return 1;
        if (!b.fecha_limite_entrega) return -1;
        return new Date(a.fecha_limite_entrega).getTime() - new Date(b.fecha_limite_entrega).getTime();
      });

      this.tareasUnificadasFiltradas = unificadas;
      this._initPaginador(this.paginadorUnificadoId, this.tareasUnificadasFiltradas, items => this.tareasUnificadasPaginadas = items);
    } else {
      // Iniciar paginadores individuales
      this._initPaginador(this.paginadorSegId, this.tareasSegFiltradas, items => this.tareasSegPaginadas = items);
      this._initPaginador(this.paginadorProyId, this.tareasProyFiltradas, items => this.tareasProyPaginadas = items);
      this._initPaginador(this.paginadorInfId, this.tareasInformeFiltradas, items => this.tareasInformePaginadas = items);
      this._initPaginador(this.paginadorGlpiId, this.tareasGlpiFiltradas, items => this.tareasGlpiPaginadas = items);
    }
  }

  toggleFiltroEstado(estado: string): void {
    const idx = this.filtroGlobalEstados.indexOf(estado);
    if (idx > -1) {
      this.filtroGlobalEstados.splice(idx, 1);
    } else {
      this.filtroGlobalEstados.push(estado);
    }
    this.guardarConfiguracion();
    this._aplicarFiltrosYPaginar();
    this._construirCalendario();
    this._cdr.markForCheck();
  }

  toggleFiltroUsuario(uid: number): void {
    const idx = this.filtroUsuariosSelec.indexOf(uid);
    if (idx > -1) {
      this.filtroUsuariosSelec.splice(idx, 1);
    } else {
      this.filtroUsuariosSelec.push(uid);
    }
    this.guardarConfiguracion();
    this._aplicarFiltrosYPaginar();
    this._construirCalendario();
    this._cdr.markForCheck();
  }

  toggleFiltroOrigen(origen: string): void {
    const idx = this.filtroOrigenesSelec.indexOf(origen);
    if (idx > -1) {
      this.filtroOrigenesSelec.splice(idx, 1);
    } else {
      this.filtroOrigenesSelec.push(origen);
    }
    this.guardarConfiguracion();
    this._aplicarFiltrosYPaginar();
    this._cdr.markForCheck();
  }

  toggleModoListaDirecta(): void {
    this.modoListaDirecta = !this.modoListaDirecta;
    this.guardarConfiguracion();
    this._aplicarFiltrosYPaginar();
    this._cdr.markForCheck();
  }

  private _initPaginador(id: string, allItems: any[], callback: (items: any[]) => void): void {
    this._subs.add(
      this._pagination.initializePaginator(id, allItems, 5).subscribe(state => {
        callback(state.currentData);
        this._cdr.markForCheck();
      })
    );
  }

  // ── LÓGICA CALENDARIO ───────────────────────────────────────────
  private _construirCalendario(): void {
    if (!this.vistaMes) return;

    const fechaBase = new Date(this.anioActual, this.mesActual - 1, this.diaActual);
    
    if (this.vistaCalendarioModo === 'mes') {
      this._construirVistaMes(fechaBase);
    } else if (this.vistaCalendarioModo === 'semana') {
      this._construirVistaSemana(fechaBase);
    } else if (this.vistaCalendarioModo === 'dia') {
      this._construirVistaDia(fechaBase);
    }
  }

  private _construirVistaMes(fecha: Date): void {
    const primerDiaMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    let diaInicio = primerDiaMes.getDay(); // 0=Dom, 1=Lun...
    if (diaInicio === 0) diaInicio = 7;
    const primerDiaCal = new Date(primerDiaMes);
    primerDiaCal.setDate(primerDiaMes.getDate() - (diaInicio - 1));

    const semanas: CalendarioDia[][] = [];
    let fechaCorriente = new Date(primerDiaCal);

    for (let s = 0; s < 6; s++) {
      const semana: CalendarioDia[] = [];
      for (let d = 0; d < 7; d++) {
        semana.push(this._crearDiaCalendario(new Date(fechaCorriente), fecha.getMonth()));
        fechaCorriente.setDate(fechaCorriente.getDate() + 1);
      }
      semanas.push(semana);
      if (fechaCorriente.getMonth() !== fecha.getMonth() && s >= 3) break;
    }
    this.calendarioDias = semanas;
  }

  private _construirVistaSemana(fecha: Date): void {
    let diaSemana = fecha.getDay(); // 0=Dom
    if (diaSemana === 0) diaSemana = 7;
    const lunes = new Date(fecha);
    lunes.setDate(fecha.getDate() - (diaSemana - 1));

    const semana: CalendarioDia[] = [];
    let fechaCorriente = new Date(lunes);
    for (let d = 0; d < 7; d++) {
      semana.push(this._crearDiaCalendario(new Date(fechaCorriente), fecha.getMonth()));
      fechaCorriente.setDate(fechaCorriente.getDate() + 1);
    }
    this.calendarioDias = [semana];
  }

  private _construirVistaDia(fecha: Date): void {
    this.calendarioDias = [[this._crearDiaCalendario(new Date(fecha), fecha.getMonth())]];
  }

  private _crearDiaCalendario(fecha: Date, mesReferencia: number): CalendarioDia {
    const tareasDelDia = this._getTareasDelDia(fecha);
    
    return {
      fecha: new Date(fecha),
      esHoy: this._esHoy(fecha),
      esMesActual: fecha.getMonth() === mesReferencia,
      tareas: (tareasDelDia.seguimiento || []).map(t => ({ 
        tarea: t, 
        nombreUsuario: this.state.nombreUsuario(t.usuario_id),
        iniciales: this.state.getInicialesResponsable(t.usuario_id),
        color: this.state.getColorPorId(t.usuario_id)
      })),
      tareasExternas: [...(tareasDelDia.proyectos || []), ...(tareasDelDia.glpi || [])].map(t => ({
        ...t,
        iniciales: this.state.getInicialesResponsable(t.usuario_id),
        color: this.state.getColorPorId(t.usuario_id)
      })),
      tareasInforme: (tareasDelDia.informes || []).map(t => ({ 
        ...t, 
        nombreUsuario: this.state.nombreUsuario(t.responsable_id),
        iniciales: this.state.getInicialesResponsable(t.responsable_id),
        color: this.state.getColorPorId(t.responsable_id)
      })),
      resumenPorUsuario: []
    };
  }

  abrirDetalleDia(dia: CalendarioDia): void {
    if (this.vistaCalendarioModo === 'dia') return;
    this.diaSeleccionado = dia;
    this.showModalDia = true;
    this._cdr.markForCheck();
  }

  abrirTareaEspecifica(t: any, origen: string): void {
    if (origen === 'proyecto') {
      this.tareaParaEditar = { ...t, proyecto_id: t.proyecto_id || 1 }; // Asegurar que tenga proyecto_id para el modal
      this.showModalTarea = true;
    } else if (origen === 'informe') {
      this.informeTareaParaEditar = t;
      this.showModalInformeTarea = true;
    } else if (origen === 'seguimiento') {
      this.tareaParaEditar = {
        ...t,
        actividad_id: undefined,
        proyecto_id: undefined,
        creado_por: t.usuario_id
      } as any;
      this.showModalTarea = true;
    } else if (origen === 'glpi') {
      this.abrirDetalleGlpi(t);
    }
    this._cdr.markForCheck();
  }

  abrirDetalleGlpi(t: any): void {
    // Formatear fecha para evitar desfases (manejo de T y zona horaria)
    let fechaFmt = 'No definida';
    if (t.fecha_limite_entrega) {
      const d = new Date(t.fecha_limite_entrega.replace(' ', 'T'));
      fechaFmt = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    Swal.fire({
      title: `<span class="text-orange-600 font-black">Ticket GLPI #${t.id}</span>`,
      html: `
        <div class="text-left space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Solicitante</h4>
              <p class="text-xs font-bold text-gray-800 truncate">${t.usuario_nombre || t.solicitante || 'Desconocido'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fecha Límite</h4>
              <p class="text-xs font-bold text-gray-800">${fechaFmt}</p>
            </div>
          </div>
          <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Título</h4>
            <p class="text-sm font-bold text-gray-800">${t.titulo}</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Descripción</h4>
            <p class="text-[11px] text-gray-600 leading-relaxed">${t.descripcion || 'Sin descripción detallada'}</p>
          </div>
          <div class="flex items-center justify-center pt-2">
            <span class="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-orange-100 text-orange-700">
              Estado: ${t.estado}
            </span>
          </div>
        </div>
      `,
      showCloseButton: true,
      showConfirmButton: false,
      width: '600px',
      padding: '2.5rem',
      background: '#fff',
      customClass: {
        container: 'backdrop-blur-sm',
        popup: 'rounded-[3rem] shadow-2xl border border-gray-100',
      }
    });
  }

  verNotasRapido(t: any, event: MouseEvent): void {
    event.stopPropagation();
    Swal.fire({
      title: `<span class="text-amber-600 font-black">Notas de Tarea</span>`,
      html: `
        <div class="text-left bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100">
          <p class="text-sm font-bold text-amber-900 leading-relaxed italic whitespace-pre-wrap">${t.notas || 'No hay notas registradas para esta tarea.'}</p>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      width: '500px',
      customClass: { popup: 'rounded-[2.5rem]' }
    });
  }

  verEvidenciaRapida(t: any, event: MouseEvent): void {
    event.stopPropagation();
    // Simulación de visualización de evidencia (podría abrir un carrusel o galería)
    this.state.showToast('Visualización rápida de evidencias en desarrollo', 'info');
  }

  crearNuevaTareaSeguimiento(): void {
    this.tareaParaEditar = null; // null indica creación
    this.showModalTarea = true;
    this._cdr.markForCheck();
  }

  completarTareaRapido(t: any, origen: string, event: MouseEvent): void {
    event.stopPropagation();
    
    Swal.fire({
      title: '¿Completar tarea?',
      text: `Vas a marcar como completada: ${t.titulo}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, completar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
    }).then(result => {
      if (result.value) {
        let obs$: Observable<any>;
        if (origen === 'seguimiento') {
          obs$ = this._proyectoService.completarSeguimientoTarea(t.id, this.usuarioId);
        } else if (origen === 'proyecto') {
          obs$ = this._proyectoService.completarTarea(t.id, this.usuarioId);
        } else if (origen === 'informe') {
          obs$ = this._proyectoService.completarInformeTarea(t.id, this.usuarioId);
        } else {
          return;
        }

        obs$.subscribe({
          next: () => {
            this.state.showToast('Tarea completada con éxito');
            if (this.seguimientoActual) {
              this._cargarDetalleMes(this.seguimientoActual.id, this.mesActual, this.anioActual);
            }
          },
          error: () => this.state.showToast('Error al completar la tarea', 'error')
        });
      }
    });
  }

  onGuardarTarea(form: TareaForm): void {
    this.savingTarea = true;
    this._cdr.markForCheck();

    const body = { ...form, usuario_id: this.usuarioId };
    
    let obs$: Observable<any>;
    if (this.tareaParaEditar) {
      // EDICIÓN
      const isSeguimiento = !this.tareaParaEditar.proyecto_id || this.tareaParaEditar.proyecto_id === 1;
      obs$ = isSeguimiento 
        ? this._proyectoService.actualizarSeguimientoTarea(this.tareaParaEditar.id, body as any)
        : this._proyectoService.actualizarTarea(this.tareaParaEditar.id, body as any);
    } else {
      // CREACIÓN (Siempre Seguimiento en esta vista)
      obs$ = this._proyectoService.crearSeguimientoTarea({
        ...body,
        seguimiento_id: this.seguimientoActual?.id
      });
    }

    obs$.subscribe({
      next: () => {
        this.savingTarea = false;
        this.showModalTarea = false;
        this.state.showToast(this.tareaParaEditar ? 'Tarea actualizada' : 'Tarea creada');
        if (this.seguimientoActual) {
          this._cargarDetalleMes(this.seguimientoActual.id, this.mesActual, this.anioActual);
        }
      },
      error: () => {
        this.savingTarea = false;
        this.state.showToast('Error al procesar la tarea', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  onGuardarInformeTarea(form: InformeTareaForm): void {
    if (!this.informeTareaParaEditar) return;
    this.savingInformeTarea = true;
    this._cdr.markForCheck();

    const body = { ...form, usuario_id: this.usuarioId };
    this._proyectoService.actualizarInformeTarea(this.informeTareaParaEditar.id, body).subscribe({
      next: () => {
        this.savingInformeTarea = false;
        this.showModalInformeTarea = false;
        this.state.showToast('Tarea de informe actualizada');
        if (this.seguimientoActual) {
          this._cargarDetalleMes(this.seguimientoActual.id, this.mesActual, this.anioActual);
        }
      },
      error: () => {
        this.savingInformeTarea = false;
        this.state.showToast('Error al actualizar', 'error');
        this._cdr.markForCheck();
      }
    });
  }

  private _getTareasDelDia(fecha: Date) {
    const format = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const fechaStr = format(fecha);

    const matchDate = (t: any) => {
      if (t.estado === 'completado' && t.fecha_completado) {
        return t.fecha_completado.startsWith(fechaStr);
      }
      // Manejar fechas con T o espacio
      const fLimite = t.fecha_limite_entrega ? t.fecha_limite_entrega.split('T')[0].split(' ')[0] : null;
      return fLimite === fechaStr;
    };

    return {
      seguimiento: this.tareasSegFiltradas.filter(matchDate),
      proyectos: this.tareasProyFiltradas.filter(matchDate),
      glpi: this.tareasGlpiFiltradas.filter(matchDate),
      informes: this.tareasInformeFiltradas.filter(matchDate)
    };
  }

  navegar(delta: number): void {
    if (this.vistaCalendarioModo === 'mes') {
      const nuevaFecha = new Date(this.anioActual, this.mesActual - 1 + delta, 1);
      this.anioActual = nuevaFecha.getFullYear();
      this.mesActual = nuevaFecha.getMonth() + 1;
    } else if (this.vistaCalendarioModo === 'semana') {
      const nuevaFecha = new Date(this.anioActual, this.mesActual - 1, this.diaActual + (delta * 7));
      this.anioActual = nuevaFecha.getFullYear();
      this.mesActual = nuevaFecha.getMonth() + 1;
      this.diaActual = nuevaFecha.getDate();
    } else {
      const nuevaFecha = new Date(this.anioActual, this.mesActual - 1, this.diaActual + delta);
      this.anioActual = nuevaFecha.getFullYear();
      this.mesActual = nuevaFecha.getMonth() + 1;
      this.diaActual = nuevaFecha.getDate();
    }
    
    if (this.seguimientoActual) {
      this._cargarDetalleMes(this.seguimientoActual.id, this.mesActual, this.anioActual);
    }
  }

  irHoy(): void {
    const hoy = new Date();
    this.diaActual = hoy.getDate();
    this.mesActual = hoy.getMonth() + 1;
    this.anioActual = hoy.getFullYear();
    if (this.seguimientoActual) {
      this._cargarDetalleMes(this.seguimientoActual.id, this.mesActual, this.anioActual);
    }
  }

  private _esHoy(d: Date): boolean {
    const hoy = new Date();
    return d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
  }

  toggleVistaCalendario(): void {
    this.vistaCalendario = !this.vistaCalendario;
    if (this.vistaCalendario) this._construirCalendario();
    this._cdr.markForCheck();
  }

  nombreMes(m: number): string {
    const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return nombres[m - 1] || '';
  }
}
