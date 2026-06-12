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
    this.cargarValidaciones();
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
    this._validaciones = (val || []).filter(v => v.estado_validacion !== 'sin_conteo');
    this.actualizarBodegasDisponibles();
    this.actualizarListasFiltradas();
  }
  get validaciones() {
    return this._validaciones;
  }

  @Input() sincronizandoSiesa = false;

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

  @Output() onValidacionCambiada = new EventEmitter<void>();

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

  private _filtroEstado: 'todos' | 'pendiente' | 'validado' | 'reconteo' = 'todos';
  set filtroEstado(val: 'todos' | 'pendiente' | 'validado' | 'reconteo') {
    this._filtroEstado = val;
    this.actualizarListasFiltradas();
  }
  get filtroEstado(): 'todos' | 'pendiente' | 'validado' | 'reconteo' {
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
  ) {}

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
    // Notificar al padre para que dispare la lógica de carga dual (rápida + sync SIESA)
    this.onValidacionCambiada.emit();
  }

  ejecutarSincronizacionSiesa() {
    // Simplemente notificamos al padre para que dispare la sincronización real
    this.onValidacionCambiada.emit();
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
    this.itemsSeleccionados.clear();
    this.actualizarListasFiltradas();
  }

  resetearFiltros() {
    this._filtroBodega = '';
    this._filtroEstado = 'todos';
    this._busquedaItems = '';
    this.itemsSeleccionados.clear();
    this.vistaActual = 'menu';
    this.filtroActual = null;
    this.itemSeleccionado = null;
    this.actualizarListasFiltradas();
  }

  // Métodos de actualización de listas cacheadas
  actualizarListasFiltradas() {
    const modo = this.modoActual;
    const base = this.validaciones || [];

    // --- 1. Filtrar validaciones para la vista de listado regular ---
    let filtrados = base.filter(v => this.normalizeModo(v.tipo_conteo) === modo);

    if (this.filtroBodega) {
      filtrados = filtrados.filter(v => v.codigo_bodega === this.filtroBodega);
    }

    if (this.filtroActual === 'contador' && this.itemSeleccionado) {
      filtrados = filtrados.filter(v => v.responsable === this.itemSeleccionado);
    } else if (this.filtroActual === 'zona' && this.itemSeleccionado) {
      filtrados = filtrados.filter(v => v.zona === this.itemSeleccionado);
    }

    if (this.filtroEstado !== 'todos') {
      filtrados = filtrados.filter(v => v.estado_validacion === this.filtroEstado);
    }

    if (this.busquedaItems) {
      const search = this.busquedaItems.toLowerCase();
      filtrados = filtrados.filter(v => 
        (v.referencia && v.referencia.toLowerCase().includes(search)) || 
        (v.descripcion && v.descripcion.toLowerCase().includes(search)) ||
        (v.id_item && String(v.id_item).toLowerCase().includes(search))
      );
    }

    this.validacionesFiltradas = filtrados;
    this.totalValidacionesFiltradas = filtrados.length;
    this.paginationService.updatePaginator(this.valPaginatorId, filtrados, this.itemsPorPagina);

    // --- 2. Agrupar contadores y zonas para el menú principal ---
    const gruposContadores: { [key: string]: any } = {};
    const gruposZonas: { [key: string]: any } = {};
    
    let validacionesBaseMenu = base.filter(v => this.normalizeModo(v.tipo_conteo) === modo);
    if (this.filtroBodega) {
      validacionesBaseMenu = validacionesBaseMenu.filter(v => v.codigo_bodega === this.filtroBodega);
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
    const mapa = new Map<string, any>();
    let baseJustificacion = base;

    if (this.filtroBodega) {
      baseJustificacion = baseJustificacion.filter(v => v.codigo_bodega === this.filtroBodega);
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
          referencia: v.referencia,
          descripcion: v.descripcion,
          id_talla: v.id_talla,
          id_color: v.id_color,
          zona: v.zona,
          codigo_bodega: v.codigo_bodega,
          costo_unitario: v.costo_unitario || 0,
          cantidad_siesa: v.cantidad_siesa || 0,
          
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

      if (v.observaciones) {
        item.comentarios.push(`${v.tipo_conteo === 'conteo' ? '1° Conteo' : (v.tipo_conteo === 'reconteo1' ? '1° Reconteo' : '2° Reconteo')}: ${v.observaciones}`);
      }
    });

    let itemsList = Array.from(mapa.values()).map(item => {
      const valorFinalConteo = item.reconteo2 !== null ? item.reconteo2 : (item.reconteo1 !== null ? item.reconteo1 : (item.conteo !== null ? item.conteo : 0));
      const diferencia = valorFinalConteo - item.cantidad_siesa;
      const diferencia_valor = Math.abs(diferencia * item.costo_unitario);

      return {
        ...item,
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
    }

    this.itemsAgrupadosJustificacion = itemsList;
    this.totalItemsAgrupadosJustificacion = itemsList.length;
    this.paginationService.updatePaginator(this.justPaginatorId, itemsList, this.itemsPorPagina);
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
    this.inventarioService.bulkUpdateValidaciones({
      ids: Array.from(this.itemsSeleccionados),
      estado: nuevoEstado,
      justificacion: justificacion || undefined
    }, userId).subscribe(resp => {
      if (resp.success) {
        Swal.fire('Éxito', 'Estados actualizados', 'success');
        this.itemsSeleccionados.clear();
        this.cargarValidaciones();
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

    this.inventarioService.bulkUpdateValidaciones({
      ids: item.conteoIds,
      estado: 'validado',
      justificacion: item.justificacion
    }, userId).subscribe({
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
          this.cargarValidaciones();
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
      dataToExport = this.itemsAgrupadosJustificacion.map(i => ({
        'Bodega': i.codigo_bodega,
        'Zona': i.zona,
        'ID Ítem': i.id_item,
        'Referencia': i.referencia,
        'Descripción': i.descripcion,
        'Talla': i.id_talla || 'N/A',
        'Color': i.id_color || 'N/A',
        'Val. Unitario': i.costo_unitario,
        'Stock Siesa': i.cantidad_siesa,
        '1° Conteo': i.conteo !== null ? i.conteo : '',
        '1° Reconteo': i.reconteo1 !== null ? i.reconteo1 : '',
        '2° Reconteo': i.reconteo2 !== null ? i.reconteo2 : '',
        'Conteo Final': i.valor_final,
        'Diferencia': i.diferencia,
        'Dif. Valor ($)': i.diferencia_valor,
        'Comentarios Conteo': i.comentarios.join(' | '),
        'Justificación': i.justificacion
      }));
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
    const ids = item.conteoIds ? item.conteoIds : [item.id];
    const key = item.conteoIds 
      ? `${item.id_item}|${item.referencia}|${item.id_talla ?? ''}|${item.id_color ?? ''}|${item.zona}`
      : `val_${item.id}`;
      
    if (!item.justificacion || !item.justificacion.trim()) {
      Swal.fire('Atención', 'Escriba una justificación antes de guardar.', 'warning');
      return;
    }

    this.guardandoJustificacion[key] = true;
    const userId = this.authService.user.id || 0;

    this.inventarioService.bulkUpdateValidaciones({
      ids: ids,
      estado: 'validado',
      justificacion: item.justificacion
    }, userId).subscribe({
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
          this.cargarValidaciones();
        }
      },
      error: () => {
        this.guardandoJustificacion[key] = false;
        Swal.fire('Error', 'No se pudo guardar la justificación', 'error');
      }
    });
  }
}

