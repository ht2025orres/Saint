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
  Actividad,
  Proyecto
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
  compromisos: (Compromiso & { iniciales: string; color: string })[];
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
  countCompromiso: number;
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
  filtroOrigenesSelec: string[] = ['seguimiento', 'proyecto', 'informe', 'glpi', 'compromiso'];

  // Tareas originales (sin filtrar)
  tareasSegRaw: SeguimientoTarea[] = [];
  tareasProyRaw: TareaConsolidada[] = [];
  tareasInformeRaw: InformeTarea[] = [];
  tareasGlpiRaw: TareaConsolidada[] = [];
  tareasCompromisoRaw: any[] = [];

  proyectosRaw: Proyecto[] = [];

  // Tareas filtradas y paginadas
  tareasSegFiltradas: SeguimientoTarea[] = [];
  tareasProyFiltradas: TareaConsolidada[] = [];
  tareasInformeFiltradas: InformeTarea[] = [];
  tareasGlpiFiltradas: TareaConsolidada[] = [];
  tareasCompromisoFiltradas: any[] = [];

  // Lista directa (unificada)
  tareasUnificadasFiltradas: any[] = [];
  tareasUnificadasPaginadas: any[] = [];
  readonly paginadorUnificadoId = 'unificado-tareas';

  // Modales
  showModalDia = false;
  diaSeleccionado: CalendarioDia | null = null;

  showModalTarea = false;
  tareaParaEditar: Tarea | null = null;
  proyectoSeleccionado: Proyecto | null = null;
  savingTarea = false;

  showModalInformeTarea = false;
  informeTareaParaEditar: InformeTarea | null = null;
  savingInformeTarea = false;

  showModalCompromiso = false;
  compromisoParaEditar: Compromiso | null = null;
  savingCompromiso = false;

  actividadesProyecto: Actividad[] = [];

  tareasSegPaginadas: SeguimientoTarea[] = [];
  tareasProyPaginadas: TareaConsolidada[] = [];
  tareasInformePaginadas: InformeTarea[] = [];
  tareasGlpiPaginadas: TareaConsolidada[] = [];
  tareasCompromisoPaginadas: any[] = [];

  readonly paginadorSegId = 'seg-tareas';
  readonly paginadorProyId = 'proy-tareas';
  readonly paginadorInfId = 'inf-tareas';
  readonly paginadorGlpiId = 'glpi-tareas';
  readonly paginadorCompId = 'comp-tareas';

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

    this._subs.add(
      this._proyectoService.refresh$.subscribe(() => {
        if (this.mostrandoMes && this.seguimientoActual) {
          this._cargarDetalleMes(this.seguimientoActual.id, this.mesActual, this.anioActual);
        } else {
          this.cargarDatos();
        }
      })
    );
  }

  private cargarConfiguracion(): void {
    const config = localStorage.getItem('tareas-filtros-config');
    if (config) {
      try {
        const parsed = JSON.parse(config);
        this.filtroGlobalEstados = parsed.estados || ['pendiente', 'en_progreso'];
        this.filtroUsuariosSelec = parsed.usuarios || [];
        this.modoListaDirecta = parsed.modoListaDirecta || false;
        
        // Manejo robusto de orígenes para evitar problemas de caché con nuevos tipos (como compromisos)
        const orígenesDefault = ['seguimiento', 'proyecto', 'informe', 'glpi', 'compromiso'];
        this.filtroOrigenesSelec = parsed.origenes || orígenesDefault;
        
        // Si la configuración guardada es antigua y le faltan orígenes nuevos, los forzamos
        orígenesDefault.forEach(orig => {
          if (!this.filtroOrigenesSelec.includes(orig)) {
            this.filtroOrigenesSelec.push(orig);
          }
        });

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
      consolidadas: this._proyectoService.getTareasConsolidadas(this.usuarioId, mes, anio, ['proyecto', 'glpi', 'compromiso']),
      informes: this._proyectoService.getMisInformeTareas(this.usuarioId),
      proyectos: this._proyectoService.getProyectos(this.usuarioId)
    }).subscribe({
      next: (res: any) => {
        this.vistaMes = res.vistaMes.data;
        const consolidadas = res.consolidadas.data || [];
        this.proyectosRaw = res.proyectos?.data || [];
        
        // Intentar obtener actividades de un proyecto activo para el modal
        const proyectoConActividades = this.proyectosRaw.find((p: any) => p.total_actividades > 0);
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
        this.tareasCompromisoRaw = consolidadas.filter((t: any) => t.origen === 'compromiso');
        
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
      // Normalizar el estado de la tarea para el filtro
      // Soporta tanto 'en_ejecucion' como 'en_proceso' normalizándolos a 'en_progreso'
      let estadoTareaNormalizado = t.estado;
      if (t.estado === 'en_ejecucion' || t.estado === 'en_proceso') {
        estadoTareaNormalizado = 'en_progreso';
      }
      
      const cumpleEstado = this.filtroGlobalEstados.length === 0 || this.filtroGlobalEstados.includes(estadoTareaNormalizado);
      
      let cumpleUsuario = this.filtroUsuariosSelec.length === 0;
      if (!cumpleUsuario) {
        // Si tiene un array de responsables, verificamos si alguno coincide
        if (Array.isArray(t.responsables) && t.responsables.length > 0) {
          cumpleUsuario = t.responsables.some((rId: any) => this.filtroUsuariosSelec.includes(Number(rId)));
        } else {
          cumpleUsuario = this.filtroUsuariosSelec.includes(t[uidKey]);
        }
      }

      return cumpleEstado && cumpleUsuario;
    };

    // Aplicar filtros a cada categoría
    this.tareasSegFiltradas = this.tareasSegRaw.filter(t => filtrarPorEstadoYUsuario(t));
    this.tareasProyFiltradas = this.tareasProyRaw.filter(t => filtrarPorEstadoYUsuario(t));
    this.tareasInformeFiltradas = this.tareasInformeRaw.filter(t => filtrarPorEstadoYUsuario(t, 'responsable_id'));
    this.tareasGlpiFiltradas = this.tareasGlpiRaw.filter(t => filtrarPorEstadoYUsuario(t));
    this.tareasCompromisoFiltradas = this.tareasCompromisoRaw
      .filter(t => filtrarPorEstadoYUsuario(t))
      .map(t => {
        const responsableId = t.responsable_id || (t.responsables && t.responsables.length > 0 ? t.responsables[0] : t.usuario_id);
        
        // El backend envía la fecha en el campo 'fecha'. La usamos como fecha límite.
        // Como ya está en hora local según el usuario, la tratamos como tal.
        const fechaOriginal = t.fecha || t.created_at;
        
        return {
          ...t,
          responsable_id: responsableId,
          fecha_limite_entrega: fechaOriginal
        };
      });

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
      if (this.filtroOrigenesSelec.includes('compromiso')) {
        unificadas = [...unificadas, ...this.tareasCompromisoFiltradas.map(t => {
          return { 
            ...t, 
            _origen_label: 'Compromiso', 
            _color: 'bg-blue-600', 
            origen: 'compromiso'
          };
        })];
      }

      // Ordenar por fecha límite de entrega
      unificadas.sort((a, b) => {
        const dateA = a.fecha_limite_entrega ? new Date(a.fecha_limite_entrega).getTime() : 0;
        const dateB = b.fecha_limite_entrega ? new Date(b.fecha_limite_entrega).getTime() : 0;
        return dateA - dateB;
      });

      this.tareasUnificadasFiltradas = unificadas;
      this._initPaginador(this.paginadorUnificadoId, this.tareasUnificadasFiltradas, items => this.tareasUnificadasPaginadas = items);
    } else {
      // Iniciar paginadores individuales
      this._initPaginador(this.paginadorSegId, this.tareasSegFiltradas, items => this.tareasSegPaginadas = items);
      this._initPaginador(this.paginadorProyId, this.tareasProyFiltradas, items => this.tareasProyPaginadas = items);
      this._initPaginador(this.paginadorInfId, this.tareasInformeFiltradas, items => this.tareasInformePaginadas = items);
      this._initPaginador(this.paginadorGlpiId, this.tareasGlpiFiltradas, items => this.tareasGlpiPaginadas = items);
      this._initPaginador(this.paginadorCompId, this.tareasCompromisoFiltradas, items => this.tareasCompromisoPaginadas = items);
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
    
    const resumenMap: { [uid: number]: ResumenUsuarioDia } = {};

    const getResumen = (uid: number) => {
      if (!uid) return null;
      if (!resumenMap[uid]) {
        resumenMap[uid] = {
          uid,
          iniciales: this.state.getInicialesResponsable(uid),
          nombre: this.state.nombreUsuario(uid),
          total: 0,
          completadas: 0,
          semaforo: 'gris',
          countSeguimiento: 0,
          countProyecto: 0,
          countGlpi: 0,
          countInforme: 0,
          countCompromiso: 0
        };
      }
      return resumenMap[uid];
    };

    // Acumular conteos para el resumen
    (tareasDelDia.seguimiento || []).forEach(t => {
      const r = getResumen(t.usuario_id);
      if (r) { r.countSeguimiento++; r.total++; if (t.estado === 'completado') r.completadas++; }
    });
    (tareasDelDia.proyectos || []).forEach(t => {
      const r = getResumen(t.usuario_id);
      if (r) { r.countProyecto++; r.total++; if (t.estado === 'completado') r.completadas++; }
    });
    (tareasDelDia.glpi || []).forEach(t => {
      const r = getResumen(t.usuario_id);
      if (r) { r.countGlpi++; r.total++; if (t.estado === 'completado') r.completadas++; }
    });
    (tareasDelDia.informes || []).forEach(t => {
      const r = getResumen(t.responsable_id);
      if (r) { r.countInforme++; r.total++; if (t.estado === 'completado') r.completadas++; }
    });
    
    // Compromisos (pueden tener múltiples responsables)
    (tareasDelDia.compromisos || []).forEach(t => {
      const responsables = Array.isArray(t.responsables) && t.responsables.length > 0 
        ? t.responsables 
        : [t.responsable_id || t.usuario_id];
        
      responsables.forEach((uid: any) => {
        const r = getResumen(Number(uid));
        if (r) { 
          r.countCompromiso++; 
          r.total++; 
          if (t.estado === 'completado') r.completadas++; 
        }
      });
    });

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
      compromisos: (tareasDelDia.compromisos || []).map(t => {
        const rId = t.responsable_id || (t.responsables && t.responsables.length > 0 ? t.responsables[0] : t.usuario_id);
        return {
          ...t,
          responsable_id: rId,
          iniciales: this.state.getInicialesResponsable(rId),
          color: this.state.getColorPorId(rId)
        };
      }),
      resumenPorUsuario: Object.values(resumenMap)
    };
  }

  abrirDetalleDia(dia: CalendarioDia): void {
    if (this.vistaCalendarioModo === 'dia') return;
    this.diaSeleccionado = dia;
    this.showModalDia = true;
    this._cdr.markForCheck();
  }

  abrirTareaEspecifica(t: any, origen: string): void {
    this.proyectoSeleccionado = null; // Reset

    if (origen === 'proyecto') {
      // 1. Intentar obtener el proyecto_id desde el objeto consolidado, o buscarlo por nombre
      let pId = t.proyecto_id;
      if (!pId && t.proyecto_nombre) {
        const pMatch = this.proyectosRaw.find(p => p.titulo === t.proyecto_nombre);
        pId = pMatch?.id;
        this.proyectoSeleccionado = pMatch || null;
      } else if (pId) {
        this.proyectoSeleccionado = this.proyectosRaw.find(p => p.id === pId) || null;
      }
      
      // Si aún no tenemos pId, no podemos llamar al detalle completo
      if (!pId) {
        console.warn('No se pudo encontrar el proyecto para la tarea:', t);
        // Al menos abrimos el modal con lo básico que tenemos
        this.tareaParaEditar = { ...t, origen: 'proyecto' };
        this.showModalTarea = true;
        this._cdr.markForCheck();
        return;
      }

      // 2. Cargar el detalle completo para obtener responsables reales y actividades
      this._proyectoService.getDetalleCompleto(pId, this.usuarioId).subscribe({
        next: (det: any) => {
          this.actividadesProyecto = det.data?.actividades || [];
          
          // 3. Buscar la tarea REAL en el árbol del proyecto para tener sus responsables
          let tareaReal: any = null;
          // Buscar en actividades
          this.actividadesProyecto.forEach(act => {
            const found = act.tareas?.find(ts => ts.id === t.id);
            if (found) tareaReal = found;
          });
          // Si no, buscar en tareas sin actividad
          if (!tareaReal && det.data?.tareas_sin_actividad) {
            tareaReal = det.data.tareas_sin_actividad.find((ts: any) => ts.id === t.id);
          }

          // Si encontramos la tarea real, la usamos (contiene responsables[] y más detalle)
          // Si no, usamos la consolidada como fallback
          this.tareaParaEditar = tareaReal 
            ? { ...tareaReal, proyecto_id: pId, origen: 'proyecto' }
            : { ...t, proyecto_id: pId, origen: 'proyecto' };
          
          this.showModalTarea = true;
          this._cdr.markForCheck();
        },
        error: () => {
          this.tareaParaEditar = { ...t, proyecto_id: pId, origen: 'proyecto' };
          this.showModalTarea = true;
          this._cdr.markForCheck();
        }
      });

    } else if (origen === 'informe') {
      this.informeTareaParaEditar = t;
      this.showModalInformeTarea = true;
    } else if (origen === 'seguimiento') {
      // Intentar encontrar la tarea real en la lista de seguimiento (que tiene los responsables reales)
      const tareaSegReal = this.tareasSegRaw.find(ts => ts.id === t.id);
      
      this.tareaParaEditar = {
        ...(tareaSegReal || t),
        actividad_id: undefined,
        proyecto_id: undefined,
        creado_por: (tareaSegReal || t).usuario_id,
        origen: 'seguimiento'
      } as any;
      this.showModalTarea = true;
    } else if (origen === 'glpi') {
      this.abrirDetalleGlpi(t);
    } else if (origen === 'compromiso') {
      this.compromisoParaEditar = t;
      this.showModalCompromiso = true;
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
    this.proyectoSeleccionado = null;
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
        } else if (origen === 'compromiso') {
          obs$ = this._proyectoService.completarCompromiso(t.id, this.usuarioId);
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

  reabrirTareaRapido(t: any, origen: string, event: MouseEvent): void {
    event.stopPropagation();
    
    Swal.fire({
      title: '¿Reabrir tarea?',
      text: `Vas a marcar como pendiente: ${t.titulo}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, reabrir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3b82f6',
    }).then(result => {
      if (result.value) {
        let obs$: Observable<any>;
        if (origen === 'compromiso') {
          obs$ = this._proyectoService.reabrirCompromiso(t.id, this.usuarioId);
        } else {
          return;
        }

        obs$.subscribe({
          next: () => {
            this.state.showToast('Tarea reabierta con éxito');
            if (this.seguimientoActual) {
              this._cargarDetalleMes(this.seguimientoActual.id, this.mesActual, this.anioActual);
            }
          },
          error: () => this.state.showToast('Error al reabrir la tarea', 'error')
        });
      }
    });
  }

  onGuardarTarea(form: TareaForm): void {
    this.savingTarea = true;
    this._cdr.markForCheck();

    const body = { 
      ...form, 
      usuario_id: this.usuarioId,
      titulo_reapertura:      form.titulo_reapertura,
      descripcion_reapertura: form.descripcion_reapertura
    };
    
    let obs$: Observable<any>;
    if (this.tareaParaEditar) {
      // EDICIÓN
      const isSeguimiento = this.tareaParaEditar.origen === 'seguimiento';
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

  onGuardarCompromiso(form: any): void {
    if (!this.compromisoParaEditar) return;
    this.savingCompromiso = true;
    this._cdr.markForCheck();

    const body = { 
      ...form, 
      usuario_id: this.usuarioId,
      anio: this.anioActual,
      mes: this.mesActual
    };
    
    this._proyectoService.actualizarCompromiso(this.compromisoParaEditar.id, body).subscribe({
      next: () => {
        this.savingCompromiso = false;
        this.showModalCompromiso = false;
        this.state.showToast('Compromiso actualizado');
        if (this.seguimientoActual) {
          this._cargarDetalleMes(this.seguimientoActual.id, this.mesActual, this.anioActual);
        }
      },
      error: () => {
        this.savingCompromiso = false;
        this.state.showToast('Error al actualizar compromiso', 'error');
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
      // Si está completada y tiene fecha_completado, usamos esa para el calendario
      if (t.estado === 'completado' && t.fecha_completado) {
        return t.fecha_completado.startsWith(fechaStr);
      }
      
      // Obtenemos la fecha límite (ya mapeada para compromisos)
      // Usamos split para evitar cualquier conversión de zona horaria si la fecha viene con T o offset
      const dateRaw = t.fecha_limite_entrega || t.fecha;
      if (!dateRaw) return false;

      const fLimite = dateRaw.split('T')[0].split(' ')[0];
      return fLimite === fechaStr;
    };

    return {
      seguimiento: this.tareasSegFiltradas.filter(t => matchDate(t)),
      proyectos: this.tareasProyFiltradas.filter(t => matchDate(t)),
      glpi: this.tareasGlpiFiltradas.filter(t => matchDate(t)),
      informes: this.tareasInformeFiltradas.filter(t => matchDate(t)),
      compromisos: this.tareasCompromisoFiltradas.filter(t => matchDate(t))
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
