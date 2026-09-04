import { Component, EventEmitter, Input, OnInit, Output, OnDestroy } from '@angular/core';
import { InventarioService } from '../../../../services/inventario.service';
import { AuthService } from '../../../../services/auth.service';
import { PaginationService, PaginationState } from '../../../../shared/pagination/pagination.service';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-reconteo-inventario',
  templateUrl: './reconteo.component.html'
})
export class ReconteoInventarioComponent implements OnInit, OnDestroy {
  private _inventarioSeleccionado: any;
  @Input() set inventarioSeleccionado(val: any) {
    this._inventarioSeleccionado = val;
    this.resetearFiltros();
  }
  get inventarioSeleccionado() {
    return this._inventarioSeleccionado;
  }

  private _asignaciones: any[] = [];
  @Input() set asignaciones(val: any[]) {
    this._asignaciones = val || [];
    this.actualizarBodegasDisponibles();
  }
  get asignaciones() {
    return this._asignaciones;
  }

  private _validaciones: any[] = [];
  @Input() set validaciones(val: any[]) {
    this._validaciones = val || [];
    this.actualizarBodegasDisponibles();
    this.actualizarListasFiltradas();
  }
  get validaciones() {
    return this._validaciones;
  }

  @Input() sincronizandoSiesa = false;
  @Input() isReadOnly = false;

  private _modoActual: 'conteo' | 'reconteo1' | 'reconteo2' | 'justificar' = 'conteo';
  @Input() set modoActual(val: 'conteo' | 'reconteo1' | 'reconteo2' | 'justificar') {
    this._modoActual = val;
    this.itemsSeleccionados.clear();
    this.actualizarBodegasDisponibles();
    this.actualizarListasFiltradas();
  }
  get modoActual() {
    return this._modoActual;
  }

  @Output() onValidacionCambiada = new EventEmitter<boolean>();

  // Navegación interna
  vistaActual: 'menu' | 'lista' = 'menu';
  filtroActual: 'contador' | 'zona' | 'items' | null = null;
  itemSeleccionado: any = null;

  // Datos
  cargando = false;

  // Filtros y Búsqueda con Setters para actualizar automáticamente las listas
  private _busquedaItems = '';
  set busquedaItems(val: string) {
    this._busquedaItems = val || '';
    this.actualizarListasFiltradas();
  }
  get busquedaItems(): string {
    return this._busquedaItems;
  }

  private _filtroEstado: 'todos' | 'pendiente' | 'validado' | 'reconteo' | 'sin_conteo' | 'no_asignado' | 'sin_zona' | 'tolerancia' | 'justificacion_pendiente' = 'todos';
  set filtroEstado(val: 'todos' | 'pendiente' | 'validado' | 'reconteo' | 'sin_conteo' | 'no_asignado' | 'sin_zona' | 'tolerancia' | 'justificacion_pendiente') {
    this._filtroEstado = val;
    this.actualizarListasFiltradas();
  }
  get filtroEstado(): 'todos' | 'pendiente' | 'validado' | 'reconteo' | 'sin_conteo' | 'no_asignado' | 'sin_zona' | 'tolerancia' | 'justificacion_pendiente' {
    return this._filtroEstado;
  }

  private _filtroBodega = '';
  set filtroBodega(val: string) {
    this._filtroBodega = val || '';
    this.onFiltroBodegaChange();
  }
  get filtroBodega(): string {
    return this._filtroBodega;
  }

  filtroTipoItem = ''; // '' | 'telas' | 'insumos'
  filtroUmbral: 'todos' | 'unidades' | 'precio' = 'todos';

  private _filtroExclusion: 'todos' | 'excluir_tolerancia' | 'excluir_justificados' = 'todos';
  set filtroExclusion(val: 'todos' | 'excluir_tolerancia' | 'excluir_justificados') {
    this._filtroExclusion = val;
    this.actualizarListasFiltradas();
  }
  get filtroExclusion(): 'todos' | 'excluir_tolerancia' | 'excluir_justificados' {
    return this._filtroExclusion;
  }

  private _filtroCantConteos: 'todos' | '1' | '2' | '3' = 'todos';
  set filtroCantConteos(val: 'todos' | '1' | '2' | '3') {
    this._filtroCantConteos = val;
    this.actualizarListasFiltradas();
  }
  get filtroCantConteos(): 'todos' | '1' | '2' | '3' {
    return this._filtroCantConteos;
  }

  // Selección masiva
  itemsSeleccionados: Set<number> = new Set();

  // Umbrales de Reconteo
  umbralUnidades = 5;
  umbralPrecio = 10000;

  // Listas cacheadas para rendimiento
  validacionesFiltradas: any[] = [];
  itemsAgrupadosJustificacion: any[] = [];
  bodegasDisponibles: string[] = [];
  contadoresAgrupados: any[] = [];
  zonasAgrupadas: any[] = [];

  // Paginación
  itemsPorPagina = 50;
  totalValidacionesFiltradas = 0;
  totalItemsAgrupadosJustificacion = 0;

  // Modal de Comentarios
  mostrarModalComentarios = false;
  comentariosModalItem: any = null;

  // Configuración de Paginador del Aplicativo
  valPaginatorId = 'validaciones-paginator';
  justPaginatorId = 'justificaciones-paginator';
  validacionesFiltradasPaginadas: any[] = [];
  itemsAgrupadosJustificacionPaginados: any[] = [];
  private valPaginationSubscription?: Subscription;
  private justPaginationSubscription?: Subscription;

  constructor(
    private inventarioService: InventarioService,
    private authService: AuthService,
    public paginationService: PaginationService
  ) { }

  ngOnInit(): void {
    // Suscribirse al paginador de validaciones
    this.valPaginationSubscription = this.paginationService
      .initializePaginator(this.valPaginatorId, [], this.itemsPorPagina)
      .subscribe((state: PaginationState) => {
        this.validacionesFiltradasPaginadas = state.currentData;
      });

    // Suscribirse al paginador de justificaciones
    this.justPaginationSubscription = this.paginationService
      .initializePaginator(this.justPaginatorId, [], this.itemsPorPagina)
      .subscribe((state: PaginationState) => {
        this.itemsAgrupadosJustificacionPaginados = state.currentData;
      });
  }

  ngOnDestroy(): void {
    if (this.valPaginationSubscription) {
      this.valPaginationSubscription.unsubscribe();
    }
    if (this.justPaginationSubscription) {
      this.justPaginationSubscription.unsubscribe();
    }
    this.paginationService.destroyPaginator(this.valPaginatorId);
    this.paginationService.destroyPaginator(this.justPaginatorId);
  }

  cargarValidaciones(silencioso: boolean = false) {
    if (!this.inventarioSeleccionado) return;
    // Notificar al padre para que dispare la lógica de carga rápida sin sync SIESA
    this.onValidacionCambiada.emit(false);
  }

  ejecutarSincronizacionSiesa() {
    // Simplemente notificamos al padre para que dispare la sincronización real con SIESA
    this.onValidacionCambiada.emit(true);
  }

  private normalizeModo(modo: string): string {
    const m = String(modo || 'conteo').trim().toLowerCase();
    if (m === '1 reconteo' || m === 'reconteo 1') return 'reconteo1';
    if (m === '2 reconteo' || m === 'reconteo 2') return 'reconteo2';
    return m;
  }

  // Getters para agrupaciones del menú
  get statsBodegaSeleccionada() {
    let base = (this.validaciones || []).filter(v => this.normalizeModo(v.tipo_conteo) === this.modoActual);

    if (this.filtroBodega) {
      base = base.filter(v => v.codigo_bodega === this.filtroBodega);
    }

    if (this.filtroBodega === 'MP001' && this.filtroTipoItem) {
      base = base.filter(v => {
        const esTela = v.referencia?.startsWith('1110');
        return this.filtroTipoItem === 'telas' ? esTela : !esTela;
      });
    }

    return {
      total: base.length,
      pendientes: base.filter(v => v.estado_validacion === 'pendiente').length,
      validados: base.filter(v => v.estado_validacion === 'validado').length,
      reconteo: base.filter(v => v.estado_validacion === 'reconteo').length
    };
  }

  actualizarBodegasDisponibles() {
    let asignacionesFiltradas = this.asignaciones || [];
    let validacionesFiltradas = this.validaciones || [];

    if (this.modoActual !== 'justificar') {
      asignacionesFiltradas = asignacionesFiltradas.filter(a => this.normalizeModo(a.tipo_conteo) === this.modoActual);
      validacionesFiltradas = validacionesFiltradas.filter(v => this.normalizeModo(v.tipo_conteo) === this.modoActual);
    }

    const bodegasAsignadas = asignacionesFiltradas
      .map(a => a.zona?.codigo_bodega)
      .filter(b => !!b);

    const bodegasValidaciones = validacionesFiltradas
      .map(v => v.codigo_bodega);

    const todas = [...bodegasAsignadas, ...bodegasValidaciones];
    this.bodegasDisponibles = Array.from(new Set(todas)).sort();
  }

  onFiltroBodegaChange() {
    if (this.filtroBodega !== 'MP001') {
      this.filtroTipoItem = '';
    }
    this.itemsSeleccionados.clear();
    this.actualizarListasFiltradas();
  }

  onFiltroTipoItemChange() {
    this.itemsSeleccionados.clear();
    this.actualizarListasFiltradas();
  }

  resetearFiltros() {
    this._filtroBodega = '';
    this.filtroTipoItem = '';
    this._filtroEstado = 'todos';
    this._busquedaItems = '';
    this._filtroExclusion = 'todos';
    this._filtroCantConteos = 'todos';
    this.itemsSeleccionados.clear();
    this.vistaActual = 'menu';
    this.filtroActual = null;
    this.itemSeleccionado = null;
    this.actualizarListasFiltradas();
  }

  // Métodos de actualización de listas cacheadas
  actualizarListasFiltradas(preservePage: boolean = false) {
    const modo = this.modoActual;
    const base = this.validaciones || [];

    // --- 1. Filtrar validaciones para la vista de listado regular ---
    let filtrados = base;
    if (modo !== 'justificar') {
      filtrados = base.filter(v => this.normalizeModo(v.tipo_conteo) === modo);
    }

    if (this.filtroBodega) {
      filtrados = filtrados.filter(v => v.codigo_bodega === this.filtroBodega);
    }

    if (this.filtroBodega === 'MP001' && this.filtroTipoItem) {
      filtrados = filtrados.filter(v => {
        const esTela = v.referencia?.startsWith('1110');
        return this.filtroTipoItem === 'telas' ? esTela : !esTela;
      });
    }

    if (this.filtroActual === 'contador' && this.itemSeleccionado) {
      filtrados = filtrados.filter(v => v.responsable === this.itemSeleccionado);
    } else if (this.filtroActual === 'zona' && this.itemSeleccionado) {
      filtrados = filtrados.filter(v => v.zona === this.itemSeleccionado);
    }

    if (this.filtroEstado !== 'todos') {
      if (this.filtroEstado === 'tolerancia') {
        filtrados = filtrados.filter(v => v.justificacion && v.justificacion.toLowerCase().includes('tolerancia'));
      } else if (this.filtroEstado === 'justificacion_pendiente') {
        filtrados = filtrados.filter(v => v.justificacion && v.justificacion.toLowerCase().includes('pendiente'));
      } else {
        filtrados = filtrados.filter(v => v.estado_validacion === this.filtroEstado);
      }
    }

    if (this.filtroUmbral === 'unidades') {
      filtrados = filtrados.filter(v => Math.abs((v.cantidad_conteo || 0) - (v.cantidad_siesa || 0)) >= this.umbralUnidades);
    } else if (this.filtroUmbral === 'precio') {
      filtrados = filtrados.filter(v => (Math.abs((v.cantidad_conteo || 0) - (v.cantidad_siesa || 0)) * (v.costo_unitario || 0)) >= this.umbralPrecio);
    }

    if (this.busquedaItems) {
      const search = this.busquedaItems.toLowerCase();
      filtrados = filtrados.filter(v =>
        (v.referencia && v.referencia.toLowerCase().includes(search)) ||
        (v.descripcion && v.descripcion.toLowerCase().includes(search)) ||
        (v.id_item && String(v.id_item).toLowerCase().includes(search))
      );
    }

    if (this.filtroExclusion === 'excluir_tolerancia') {
      filtrados = filtrados.filter(v => !(v.justificacion && v.justificacion.toLowerCase().includes('tolerancia')));
    } else if (this.filtroExclusion === 'excluir_justificados') {
      filtrados = filtrados.filter(v => !v.justificacion);
    }

    this.validacionesFiltradas = filtrados;
    this.totalValidacionesFiltradas = filtrados.length;
    this.paginationService.updatePaginator(this.valPaginatorId, filtrados, this.itemsPorPagina, null, null, preservePage);

    // --- 2. Agrupar contadores y zonas para el menú principal ---
    const gruposContadores: { [key: string]: any } = {};
    const gruposZonas: { [key: string]: any } = {};

    let validacionesBaseMenu = base;
    if (modo !== 'justificar') {
      validacionesBaseMenu = base.filter(v => this.normalizeModo(v.tipo_conteo) === modo);
    }
    if (this.filtroBodega) {
      validacionesBaseMenu = validacionesBaseMenu.filter(v => v.codigo_bodega === this.filtroBodega);
    }

    if (this.filtroBodega === 'MP001' && this.filtroTipoItem) {
      validacionesBaseMenu = validacionesBaseMenu.filter(v => {
        const esTela = v.referencia?.startsWith('1110');
        return this.filtroTipoItem === 'telas' ? esTela : !esTela;
      });
    }

    validacionesBaseMenu.forEach(v => {
      if (v.responsable) {
        if (!gruposContadores[v.responsable]) {
          gruposContadores[v.responsable] = { nombre: v.responsable, total: 0, pendientes: 0 };
        }
        gruposContadores[v.responsable].total++;
        if (v.estado_validacion === 'pendiente') gruposContadores[v.responsable].pendientes++;
      }

      if (v.zona) {
        if (!gruposZonas[v.zona]) {
          gruposZonas[v.zona] = { nombre: v.zona, total: 0, pendientes: 0 };
        }
        gruposZonas[v.zona].total++;
        if (v.estado_validacion === 'pendiente') gruposZonas[v.zona].pendientes++;
      }
    });

    this.contadoresAgrupados = Object.values(gruposContadores);
    this.zonasAgrupadas = Object.values(gruposZonas);

    // --- 3. Agrupación para Justificación ---
    this.agruparParaJustificacion(preservePage);
  }

  normalizarConteo(conteo: number | null, siesa: number): number | null {
    if (conteo === null || conteo === undefined || isNaN(conteo)) return null;
    if (siesa <= 0 || conteo === 0) return conteo;

    const factores = [1, 10, 100, 1000, 10000, 0.1, 0.01, 0.001];
    let mejorValor = conteo;
    let menorDiff = Math.abs(conteo - siesa);

    for (const f of factores) {
      const candidato = conteo / f;
      const diff = Math.abs(candidato - siesa);
      if (Math.abs(candidato - siesa) < 0.0001) {
        return candidato;
      }
      if (diff < menorDiff) {
        menorDiff = diff;
        mejorValor = candidato;
      }
    }

    return mejorValor;
  }

  obtenerConteoMasCercano(conteo: number | null, reconteo1: number | null, reconteo2: number | null, siesa: number): number {
    const conteosDisponibles: number[] = [];

    const c1 = this.normalizarConteo(conteo, siesa);
    const r1 = this.normalizarConteo(reconteo1, siesa);
    const r2 = this.normalizarConteo(reconteo2, siesa);

    if (c1 !== null) conteosDisponibles.push(c1);
    if (r1 !== null) conteosDisponibles.push(r1);
    if (r2 !== null) conteosDisponibles.push(r2);

    if (conteosDisponibles.length === 0) return 0;

    let mejorConteo = conteosDisponibles[0];
    let menorDiferencia = Math.abs(mejorConteo - siesa);

    for (let i = 1; i < conteosDisponibles.length; i++) {
      const val = conteosDisponibles[i];
      const diff = Math.abs(val - siesa);
      if (diff < menorDiferencia) {
        menorDiferencia = diff;
        mejorConteo = val;
      }
    }

    return mejorConteo;
  }

  agruparParaJustificacion(preservePage = false) {
    const mapa = new Map<string, any>();
    let baseJustificacion = [...(this.validaciones || [])];

    if (this.filtroBodega && this.filtroBodega !== 'TODOS') {
      baseJustificacion = baseJustificacion.filter(v => v.codigo_bodega === this.filtroBodega);
    }

    if (this.filtroBodega === 'MP001' && this.filtroTipoItem) {
      baseJustificacion = baseJustificacion.filter(v => {
        const esTela = v.referencia?.startsWith('1110');
        return this.filtroTipoItem === 'telas' ? esTela : !esTela;
      });
    }

    if (this.busquedaItems) {
      const search = this.busquedaItems.toLowerCase();
      baseJustificacion = baseJustificacion.filter(v =>
        (v.referencia && v.referencia.toLowerCase().includes(search)) ||
        (v.descripcion && v.descripcion.toLowerCase().includes(search)) ||
        (v.id_item && String(v.id_item).toLowerCase().includes(search))
      );
    }

    baseJustificacion.forEach(v => {
      const key = `${v.id_item}|${v.referencia}|${v.id_talla ?? ''}|${v.id_color ?? ''}|${v.zona}`;
      if (!mapa.has(key)) {
        mapa.set(key, {
          id_item: v.id_item,
          id_asignacion: v.id_asignacion,
          referencia: v.referencia,
          descripcion: v.descripcion,
          id_talla: v.id_talla,
          id_color: v.id_color,
          zona: v.zona,
          codigo_bodega: v.codigo_bodega,
          costo_unitario: v.costo_unitario || 0,
          cantidad_siesa: v.cantidad_siesa || 0,
          responsable: v.responsable || 'Sin Asignar',
          estado_validacion: v.estado_validacion,

          conteo: null as number | null,
          reconteo1: null as number | null,
          reconteo2: null as number | null,

          conteoIds: [] as number[],
          justificacion: v.justificacion || '',
          comentarios: [] as string[]
        });
      }

      const item = mapa.get(key);
      const modoReg = this.normalizeModo(v.tipo_conteo);
      if (modoReg === 'conteo') {
        item.conteo = v.cantidad_conteo;
      } else if (modoReg === 'reconteo1') {
        item.reconteo1 = v.cantidad_conteo;
      } else if (modoReg === 'reconteo2') {
        item.reconteo2 = v.cantidad_conteo;
      }

      if (v.id) item.conteoIds.push(v.id);
      if (v.id_asignacion && !item.id_asignacion) {
        item.id_asignacion = v.id_asignacion;
      }

      if (v.justificacion) {
        item.justificacion = v.justificacion;
      }
      if (v.estado_validacion === 'validado') {
        item.estado_validacion = 'validado';
      }

      if (v.observaciones) {
        item.comentarios.push(`${v.tipo_conteo === 'conteo' ? '1° Conteo' : (v.tipo_conteo === 'reconteo1' ? '1° Reconteo' : '2° Reconteo')}: ${v.observaciones}`);
      }
    });

    let itemsList = Array.from(mapa.values()).map(item => {
      const c1Norm = this.normalizarConteo(item.conteo, item.cantidad_siesa);
      const r1Norm = this.normalizarConteo(item.reconteo1, item.cantidad_siesa);
      const r2Norm = this.normalizarConteo(item.reconteo2, item.cantidad_siesa);

      const valorFinalConteo = this.obtenerConteoMasCercano(c1Norm, r1Norm, r2Norm, item.cantidad_siesa);
      const diferencia = valorFinalConteo - item.cantidad_siesa;
      const diferencia_valor = Math.abs(diferencia * item.costo_unitario);

      return {
        ...item,
        conteo: c1Norm,
        reconteo1: r1Norm,
        reconteo2: r2Norm,
        valor_final: valorFinalConteo,
        diferencia: diferencia,
        diferencia_valor: diferencia_valor
      };
    });

    if (this.filtroEstado === 'pendiente') {
      itemsList = itemsList.filter(i => i.diferencia !== 0 && !i.justificacion);
    } else if (this.filtroEstado === 'validado') {
      itemsList = itemsList.filter(i => i.diferencia !== 0 && i.justificacion);
    } else if (this.filtroEstado === 'reconteo') {
      itemsList = itemsList.filter(i => i.diferencia !== 0);
    } else if (this.filtroEstado === 'sin_conteo') {
      itemsList = itemsList.filter(i => i.estado_validacion === 'sin_conteo');
    } else if (this.filtroEstado === 'no_asignado') {
      itemsList = itemsList.filter(i => i.estado_validacion === 'no_asignado');
    } else if (this.filtroEstado === 'sin_zona') {
      itemsList = itemsList.filter(i => i.estado_validacion === 'sin_zona');
    } else if (this.filtroEstado === 'tolerancia') {
      itemsList = itemsList.filter(i => i.justificacion && i.justificacion.toLowerCase().includes('tolerancia'));
    } else if (this.filtroEstado === 'justificacion_pendiente') {
      itemsList = itemsList.filter(i => i.justificacion && i.justificacion.toLowerCase().includes('pendiente'));
    }

    if (this.filtroExclusion === 'excluir_tolerancia') {
      itemsList = itemsList.filter(i => !(i.justificacion && i.justificacion.toLowerCase().includes('tolerancia')));
    } else if (this.filtroExclusion === 'excluir_justificados') {
      itemsList = itemsList.filter(i => !i.justificacion);
    }

    if (this.filtroCantConteos !== 'todos') {
      itemsList = itemsList.filter(i => {
        let count = 0;
        if (i.conteo !== null && i.conteo !== undefined) count++;
        if (i.reconteo1 !== null && i.reconteo1 !== undefined) count++;
        if (i.reconteo2 !== null && i.reconteo2 !== undefined) count++;
        return count.toString() === this.filtroCantConteos;
      });
    }

    if (this.filtroUmbral === 'unidades') {
      itemsList = itemsList.filter(i => Math.abs(i.diferencia) >= this.umbralUnidades);
    } else if (this.filtroUmbral === 'precio') {
      itemsList = itemsList.filter(i => i.diferencia_valor >= this.umbralPrecio);
    }

    this.itemsAgrupadosJustificacion = itemsList;
    this.totalItemsAgrupadosJustificacion = itemsList.length;
    this.paginationService.updatePaginator(this.justPaginatorId, itemsList, this.itemsPorPagina, null, null, preservePage);
  }

  getMathMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  // Navegación
  entrarAVista(tipo: 'contador' | 'zona' | 'items', item: any = null) {
    this.filtroActual = tipo;
    this.itemSeleccionado = item;
    this.vistaActual = 'lista';
    this.itemsSeleccionados.clear();
    // Ya no es necesario refrescar aquí, la carga inicial es suficiente
  }

  irAtras() {
    if (this.vistaActual === 'lista') {
      this.vistaActual = 'menu';
      this.filtroActual = null;
      this.itemSeleccionado = null;
    }
  }

  // Selección masiva
  toggleSeleccion(id: number) {
    if (this.itemsSeleccionados.has(id)) this.itemsSeleccionados.delete(id);
    else this.itemsSeleccionados.add(id);
  }

  toggleSeleccionarTodo() {
    if (this.itemsSeleccionados.size === this.validacionesFiltradas.length) {
      this.itemsSeleccionados.clear();
    } else {
      this.validacionesFiltradas.forEach(v => this.itemsSeleccionados.add(v.id));
    }
  }

  // Acciones Masivas
  async actualizarEstadoMasivo(nuevoEstado: 'validado' | 'reconteo' | 'pendiente') {
    if (this.itemsSeleccionados.size === 0) {
      Swal.fire('Atención', 'Seleccione al menos un ítem', 'warning');
      return;
    }

    let justificacion = '';

    // Si se está validando en reconteo, permitir justificación
    if (nuevoEstado === 'validado' && this.modoActual !== 'conteo') {
      const { value: text } = await Swal.fire({
        input: 'textarea',
        inputLabel: 'Justificación de validación',
        inputPlaceholder: 'Escriba por qué se valida este ítem con diferencia...',
        inputAttributes: {
          'aria-label': 'Escriba su justificación'
        },
        showCancelButton: true,
        confirmButtonText: 'Validar con Justificación',
        cancelButtonText: 'Cancelar'
      });

      if (text === undefined) return; // Cancelado
      justificacion = text;
    } else {
      const result = await Swal.fire({
        title: '¿Actualizar estados?',
        text: `Se marcarán ${this.itemsSeleccionados.size} ítems como ${nuevoEstado.toUpperCase()}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, actualizar'
      });

      if (!result.isConfirmed) return;
    }

    const userId = this.authService.user.id || 0;
    const selectedIds = Array.from(this.itemsSeleccionados);

    this.inventarioService.bulkUpdateValidaciones({
      ids: selectedIds,
      estado: nuevoEstado,
      justificacion: justificacion || undefined
    }, userId).subscribe(resp => {
      if (resp.success) {
        Swal.fire('Éxito', 'Estados actualizados', 'success');

        // Actualización local en memoria
        this.validaciones = this.validaciones.map(v => {
          if (selectedIds.includes(v.id)) {
            return {
              ...v,
              estado_validacion: nuevoEstado,
              justificacion: justificacion || v.justificacion
            };
          }
          return v;
        });

        this.itemsSeleccionados.clear();
        this.actualizarListasFiltradas(true);
      }
    });
  }

  // Cálculos Automáticos
  marcarPorUmbral(tipo: 'unidades' | 'precio') {
    const idsParaReconteo: number[] = [];

    this.validacionesFiltradas.forEach(v => {
      if (tipo === 'unidades') {
        if (Math.abs(v.diferencia) >= this.umbralUnidades) {
          idsParaReconteo.push(v.id);
        }
      } else {
        if (v.diferencia_valor >= this.umbralPrecio) {
          idsParaReconteo.push(v.id);
        }
      }
    });

    if (idsParaReconteo.length === 0) {
      Swal.fire('Info', 'No se encontraron ítems que superen el umbral', 'info');
      return;
    }

    this.itemsSeleccionados = new Set(idsParaReconteo);
    Swal.fire('Seleccionados', `${idsParaReconteo.length} ítems seleccionados por umbral de ${tipo}`, 'success');
  }

  // --- NUEVAS FUNCIONALIDADES PARA JUSTIFICACIÓN Y EXPORTACIÓN ---

  guardandoJustificacion: { [key: string]: boolean } = {};

  guardarJustificacionItem(item: any) {
    if (!item.justificacion || !item.justificacion.trim()) {
      Swal.fire('Atención', 'Escriba una justificación antes de guardar.', 'warning');
      return;
    }

    const key = `${item.id_item}|${item.referencia}|${item.id_talla ?? ''}|${item.id_color ?? ''}|${item.zona}`;
    this.guardandoJustificacion[key] = true;
    const userId = this.authService.user.id || 0;
    const ids = (item.conteoIds || []).filter((id: any) => id !== null && id !== undefined);

    const payload: any = {
      ids: ids,
      estado: 'validado',
      justificacion: item.justificacion
    };

    if (ids.length === 0) {
      payload.virtual_item = {
        id_asignacion: item.id_asignacion,
        id_item_siesa: item.id_item,
        referencia: item.referencia,
        descripcion: item.descripcion,
        id_talla: item.id_talla,
        id_color: item.id_color
      };
    }

    this.inventarioService.bulkUpdateValidaciones(payload, userId).subscribe({
      next: (resp) => {
        this.guardandoJustificacion[key] = false;
        if (resp.success) {
          Swal.fire({
            icon: 'success',
            title: 'Justificación guardada',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
          });

          // Actualización local en memoria
          const justText = item.justificacion;
          const createdId = resp.created_id;

          if (ids.length > 0) {
            this.validaciones = this.validaciones.map(v => {
              if (ids.includes(v.id)) {
                return {
                  ...v,
                  justificacion: justText,
                  estado_validacion: 'validado'
                };
              }
              return v;
            });
          } else if (createdId) {
            this.validaciones = this.validaciones.map(v => {
              const matchItem = String(v.id_item) === String(item.id_item);
              const matchTalla = String(v.id_talla ?? '') === String(item.id_talla ?? '');
              const matchColor = String(v.id_color ?? '') === String(item.id_color ?? '');
              const matchZona = String(v.zona) === String(item.zona);
              
              if (matchItem && matchTalla && matchColor && matchZona) {
                return {
                  ...v,
                  id: createdId,
                  justificacion: justText,
                  estado_validacion: 'validado',
                  cantidad_conteo: 0.0
                };
              }
              return v;
            });
          }

          this.actualizarListasFiltradas(true);
        }
      },
      error: () => {
        this.guardandoJustificacion[key] = false;
        Swal.fire('Error', 'No se pudo guardar la justificación', 'error');
      }
    });
  }

  exportarExcelFlat() {
    let dataToExport: any[] = [];

    if (this.modoActual === 'justificar') {
      // Consolidar ítems que aparecen en múltiples zonas en una sola fila
      const mapaConsolidado = new Map<string, any>();

      for (const i of this.itemsAgrupadosJustificacion) {
        const key = `${i.id_item}|${i.referencia}|${i.id_talla ?? ''}|${i.id_color ?? ''}`;

        if (!mapaConsolidado.has(key)) {
          mapaConsolidado.set(key, {
            ...i,
            zonas: new Set<string>()
          });
        }

        const consolidado = mapaConsolidado.get(key)!;

        // Agregar zona
        if (i.zona) consolidado.zonas.add(i.zona);

        // Priorizar el registro que tenga conteo
        const tieneConteoActual = i.conteo !== null || i.reconteo1 !== null || i.reconteo2 !== null;
        const tieneConteoConsolidado = consolidado.conteo !== null || consolidado.reconteo1 !== null || consolidado.reconteo2 !== null;

        if (tieneConteoActual && !tieneConteoConsolidado) {
          consolidado.conteo = i.conteo;
          consolidado.reconteo1 = i.reconteo1;
          consolidado.reconteo2 = i.reconteo2;
          consolidado.valor_final = i.valor_final;
          consolidado.diferencia = i.diferencia;
          consolidado.diferencia_valor = i.diferencia_valor;
          consolidado.cantidad_siesa = i.cantidad_siesa;
          consolidado.costo_unitario = i.costo_unitario;
        }

        // Acumular comentarios y justificación
        if (i.comentarios?.length) {
          consolidado.comentarios = [...new Set([...consolidado.comentarios, ...i.comentarios])];
        }
        if (i.justificacion && !consolidado.justificacion) {
          consolidado.justificacion = i.justificacion;
        }
      }

      dataToExport = Array.from(mapaConsolidado.values()).map(i => {
        const c1Norm = this.normalizarConteo(i.conteo, i.cantidad_siesa);
        const r1Norm = this.normalizarConteo(i.reconteo1, i.cantidad_siesa);
        const r2Norm = this.normalizarConteo(i.reconteo2, i.cantidad_siesa);

        const valorFinal = this.obtenerConteoMasCercano(c1Norm, r1Norm, r2Norm, i.cantidad_siesa);
        const diferencia = valorFinal - i.cantidad_siesa;
        const diferenciaValor = Math.abs(diferencia * i.costo_unitario);

        return {
          'Bodega': i.codigo_bodega,
          'Zona(s)': Array.from(i.zonas).join(' | '),
          'ID Ítem': i.id_item,
          'Referencia': i.referencia,
          'Descripción': i.descripcion,
          'Talla': i.id_talla || 'N/A',
          'Color': i.id_color || 'N/A',
          'Val. Unitario': i.costo_unitario,
          'Stock Siesa': i.cantidad_siesa,
          '1° Conteo': c1Norm !== null ? c1Norm : '',
          '1° Reconteo': r1Norm !== null ? r1Norm : '',
          '2° Reconteo': r2Norm !== null ? r2Norm : '',
          'Conteo Final': valorFinal,
          'Diferencia': diferencia,
          'Dif. Valor ($)': diferenciaValor,
          'Comentarios Conteo': i.comentarios.join(' | '),
          'Justificación': i.justificacion
        };
      });
    } else {
      dataToExport = this.validacionesFiltradas.map(v => {
        const comentariosHistorial = (v.historial || [])
          .filter((h: any) => h.observaciones)
          .map((h: any) => `${h.tipo_conteo}: ${h.observaciones}`)
          .join(' | ');
        const todosComentarios = [
          v.observaciones ? `${v.tipo_conteo}: ${v.observaciones}` : '',
          comentariosHistorial
        ].filter(str => !!str).join(' | ');

        return {
          'Bodega': v.codigo_bodega,
          'Zona': v.zona,
          'Responsable': v.responsable,
          'ID Ítem': v.id_item,
          'Referencia': v.referencia,
          'Descripción': v.descripcion,
          'Talla': v.id_talla || 'N/A',
          'Color': v.id_color || 'N/A',
          'Etapa Conteo': v.tipo_conteo,
          'Cantidad Conteo': v.cantidad_conteo,
          'Stock Siesa': v.cantidad_siesa,
          'Val. Unitario': v.costo_unitario,
          'Diferencia': v.diferencia,
          'Dif. Valor ($)': v.diferencia_valor,
          'Estado Validación': v.estado_validacion,
          'Comentario Conteo': todosComentarios,
          'Justificación': v.justificacion || ''
        };
      });
    }

    if (dataToExport.length === 0) {
      Swal.fire('Atención', 'No hay datos para exportar con los filtros actuales.', 'warning');
      return;
    }

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook: XLSX.WorkBook = {
      Sheets: { 'Reporte': worksheet },
      SheetNames: ['Reporte']
    };

    const maxCols = dataToExport.reduce((acc, row) => Math.max(acc, Object.keys(row).length), 0);
    const wscols = [];
    for (let i = 0; i < maxCols; i++) {
      wscols.push({ wch: 15 });
    }
    worksheet['!cols'] = wscols;

    const fecha = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `Inventario_Reporte_${this.modoActual}_${fecha}.xlsx`;
    XLSX.writeFile(workbook, nombreArchivo);

    Swal.fire({
      icon: 'success',
      title: 'Reporte Excel generado',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000
    });
  }

  // --- MÉTODOS DEL MODAL DE COMENTARIOS Y JUSTIFICACIÓN ---

  abrirModalComentarios(item: any) {
    const comentarios: { etapa: string; texto: string }[] = [];

    // 1. Si es un ítem de validación normal, puede tener observaciones en sí mismo
    if (item.observaciones) {
      comentarios.push({
        etapa: this.getLabelEtapa(item.tipo_conteo || this.modoActual),
        texto: item.observaciones
      });
    }

    // 2. Y puede tener historial
    if (item.historial && Array.isArray(item.historial)) {
      item.historial.forEach((h: any) => {
        if (h.observaciones) {
          comentarios.push({
            etapa: this.getLabelEtapa(h.tipo_conteo),
            texto: h.observaciones
          });
        }
      });
    }

    // 3. Si es un ítem agrupado de justificación y ya tiene la lista armada
    if (item.comentarios && Array.isArray(item.comentarios) && comentarios.length === 0) {
      item.comentarios.forEach((com: string) => {
        const partes = com.split(': ');
        comentarios.push({
          etapa: partes[0] || 'Comentario',
          texto: partes.slice(1).join(': ')
        });
      });
    }

    this.comentariosModalItem = {
      ...item,
      listaComentarios: comentarios,
      // Hacemos una copia para no alterar la UI local directamente hasta guardar
      justificacion: item.justificacion || ''
    };
    this.mostrarModalComentarios = true;
  }

  cerrarModalComentarios() {
    this.mostrarModalComentarios = false;
    this.comentariosModalItem = null;
  }

  tieneComentariosOJustificacion(item: any): boolean {
    if (item.observaciones || item.justificacion) return true;
    if (item.historial && item.historial.some((h: any) => h.observaciones)) return true;
    if (item.comentarios && item.comentarios.length > 0) return true;
    return false;
  }

  obtenerNumeroComentarios(item: any): number {
    let count = 0;
    if (item.observaciones) count++;
    if (item.historial && Array.isArray(item.historial)) {
      item.historial.forEach((h: any) => {
        if (h.observaciones) count++;
      });
    }
    if (item.comentarios && Array.isArray(item.comentarios)) {
      count += item.comentarios.length;
    }
    return count;
  }

  getLabelEtapa(etapa: string): string {
    const et = String(etapa || '').toLowerCase().trim();
    if (et === 'conteo') return '1° Conteo';
    if (et === 'reconteo1' || et === '1 reconteo' || et === 'reconteo 1') return '1° Reconteo';
    if (et === 'reconteo2' || et === '2 reconteo' || et === 'reconteo 2') return '2° Reconteo';
    return etapa;
  }

  guardarJustificacionDesdeModal(item: any) {
    const ids = (item.conteoIds ? item.conteoIds : [item.id]).filter((id: any) => id !== null && id !== undefined && id !== '');
    const key = item.conteoIds
      ? `${item.id_item}|${item.referencia}|${item.id_talla ?? ''}|${item.id_color ?? ''}|${item.zona}`
      : `val_${item.id}`;

    if (!item.justificacion || !item.justificacion.trim()) {
      Swal.fire('Atención', 'Escriba una justificación antes de guardar.', 'warning');
      return;
    }

    this.guardandoJustificacion[key] = true;
    const userId = this.authService.user.id || 0;

    const payload: any = {
      ids: ids,
      estado: 'validado',
      justificacion: item.justificacion
    };

    if (ids.length === 0) {
      payload.virtual_item = {
        id_asignacion: item.id_asignacion,
        id_item_siesa: item.id_item,
        referencia: item.referencia,
        descripcion: item.descripcion,
        id_talla: item.id_talla,
        id_color: item.id_color
      };
    }

    this.inventarioService.bulkUpdateValidaciones(payload, userId).subscribe({
      next: (resp) => {
        this.guardandoJustificacion[key] = false;
        if (resp.success) {
          Swal.fire({
            icon: 'success',
            title: 'Justificación guardada',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
          });
          this.cerrarModalComentarios();

          // Actualización local en memoria
          const justText = item.justificacion;
          const createdId = resp.created_id;

          if (ids.length > 0) {
            this.validaciones = this.validaciones.map(v => {
              if (ids.includes(v.id)) {
                return {
                  ...v,
                  justificacion: justText,
                  estado_validacion: 'validado'
                };
              }
              return v;
            });
          } else if (createdId) {
            this.validaciones = this.validaciones.map(v => {
              const matchItem = String(v.id_item) === String(item.id_item);
              const matchTalla = String(v.id_talla ?? '') === String(item.id_talla ?? '');
              const matchColor = String(v.id_color ?? '') === String(item.id_color ?? '');
              const matchZona = String(v.zona) === String(item.zona);
              
              if (matchItem && matchTalla && matchColor && matchZona) {
                return {
                  ...v,
                  id: createdId,
                  justificacion: justText,
                  estado_validacion: 'validado',
                  cantidad_conteo: 0.0
                };
              }
              return v;
            });
          }

          this.actualizarListasFiltradas(true);
        }
      },
      error: () => {
        this.guardandoJustificacion[key] = false;
        Swal.fire('Error', 'No se pudo guardar la justificación', 'error');
      }
    });
  }

  // Justificación automática por tolerancia
  toleranciaTelas = 8;
  toleranciaInsumos = 2;
  ejecutandoTolerancia = false;

  async ejecutarJustificacionTolerancia() {
    if (!this.inventarioSeleccionado) return;

    const result = await Swal.fire({
      title: 'Justificar por Tolerancia',
      html: `
        <p class="text-sm text-gray-600 mb-4">
          Se marcarán como <strong>"Validado"</strong> todos los ítems cuyo descuadre sea:
          <br><br>
          • Telas: <strong>≤ ${this.toleranciaTelas}%</strong>
          <br>
          • Insumos: <strong>≤ ${this.toleranciaInsumos}%</strong>
          <br><br>
          respecto al stock de Siesa.
        </p>
        <p class="text-xs text-gray-400">Esta acción no se puede deshacer fácilmente. Los ítems justificados quedarán con la etiqueta "Justificado por tolerancia".</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, justificar automáticamente',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669'
    });

    if (!result.isConfirmed) return;

    this.ejecutandoTolerancia = true;
    const userId = this.authService.user.id || 0;

    this.inventarioService.justificarPorTolerancia(
      this.inventarioSeleccionado.id,
      this.toleranciaTelas,
      this.toleranciaInsumos,
      userId
    ).subscribe({
      next: (resp) => {
        this.ejecutandoTolerancia = false;
        if (resp.success) {
          Swal.fire({
            icon: 'success',
            title: 'Tolerancia aplicada',
            text: resp.message,
            confirmButtonColor: '#059669'
          });

          // Actualización local en memoria
          this.validaciones = this.validaciones.map(v => {
            const cantidadSiesa = parseFloat(v.cantidad_siesa || 0);
            const cantidadConteo = parseFloat(v.cantidad_conteo || 0);
            const diferencia = cantidadConteo - cantidadSiesa;

            if (cantidadSiesa > 0 && diferencia !== 0) {
              const porcentajeDescuadre = (Math.abs(diferencia) / cantidadSiesa) * 100;
              const esTela = v.referencia && v.referencia.startsWith('1110');
              const limite = esTela ? this.toleranciaTelas : this.toleranciaInsumos;
              const tipoItem = esTela ? 'Tela' : 'Insumo';

              if (porcentajeDescuadre <= limite) {
                const porcentajeFormatted = porcentajeDescuadre.toFixed(2).replace('.', ',');
                return {
                  ...v,
                  estado_validacion: 'validado',
                  justificacion: `Justificado por tolerancia (${tipoItem}, diferencia de ${porcentajeFormatted}% <= ${limite}%). Stock Siesa: ${cantidadSiesa} uds. Conteo final: ${cantidadConteo} uds.`,
                  observaciones: `Justificado por tolerancia por Usuario ID: ${userId}`
                };
              }
            }
            return v;
          });

          this.actualizarListasFiltradas(true);
        } else {
          Swal.fire('Error', resp.message, 'error');
        }
      },
      error: (err) => {
        this.ejecutandoTolerancia = false;
        Swal.fire('Error', err.error?.message || 'Error al ejecutar la justificación por tolerancia', 'error');
      }
    });
  }
}


