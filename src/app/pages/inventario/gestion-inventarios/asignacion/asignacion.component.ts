import { Component, OnInit, Input, Output, EventEmitter, ElementRef, ViewChildren, QueryList, AfterViewInit, OnDestroy } from '@angular/core';
import { InventarioService } from '../../../../services/inventario.service';
import { AuthService } from '../../../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-asignacion-inventario',
  templateUrl: './asignacion.component.html'
})
export class AsignacionInventarioComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() inventarioSeleccionado: any;
  @Input() asignaciones: any[] = [];
  @Input() zonas: any[] = [];
  @Input() contadores: any[] = [];
  @Input() validaciones: any[] = [];
  @Input() statsModo: any = null;
  private _modoActual: 'conteo' | 'reconteo1' | 'reconteo2' | 'justificar' = 'conteo';
  @Input() set modoActual(val: 'conteo' | 'reconteo1' | 'reconteo2' | 'justificar') {
    this._modoActual = val;
  }
  get modoActual() {
    return this._modoActual;
  }
  
  @Output() onAsignacionCambiada = new EventEmitter<void>();

  // Resize Observer para agrupar zonas dinámicamente
  @ViewChildren('zonaContainer') zonaContainers!: QueryList<ElementRef>;
  private resizeObserver: ResizeObserver | null = null;
  limitesZonas: { [idUsuario: number]: number } = {};
  gruposExpandidos: { [idUsuario: number]: boolean } = {};

  // Barra de búsqueda global de la sub-interfaz
  busquedaGlobal = '';
  filtroBodega = '';

  // Control de modal de asignación
  mostrarModalAsignacion = false;
  guardandoAsignacion = false;
  pasoAsignacion: 1 | 2 = 1;

  // Formulario asignación
  asignacion = {
    id: null as number | null,
    id_inventario: null as number | null,
    id_zona: null as number | null,
    id_usuario: null as number | null,
    tipo_items: 'todos' as 'todos' | 'incluir' | 'excluir',
    items_detalle: [] as any[],
    tipo_conteo: 'conteo' as 'conteo' | 'reconteo1' | 'reconteo2' | 'justificar'
  };

  // Gestión de múltiples zonas
  id_zonas_seleccionadas: number[] = [];
  excepciones_por_zona: { [id_zona: number]: { tipo_items: 'todos' | 'incluir' | 'excluir', items_detalle: any[] } } = {};
  busquedaZonasAsignacion = '';
  filtroBodegaAsignacion = '';
  filtroSoloNoAsignadas = false;

  // Paso 2: Configuración por zona
  zona_activa_edicion: number | null = null;
  filtroBodegaPaso2 = '';
  busquedaItemAsignacion = '';
  filtroTipoItem = '';
  itemsDeZona: any[] = [];
  cargandoItemsZona = false;

  // Búsqueda de contadores
  busquedaContador = '';
  mostrarDropdownContador = false;

  // Modal de visualización de ítems
  mostrarModalItems = false;
  filtroItemsBusqueda = '';
  filtroItemsZona = '';
  filtroItemsResponsable = '';
  filtroItemsEstado = '';
  filtroItemsBodega = '';

  constructor(
    private inventarioService: InventarioService,
    private authService: AuthService,
    private elRef: ElementRef
  ) { }

  ngOnInit() {
    // Ya no es necesario cargarValidaciones() aquí, vienen por @Input
  }

  ngAfterViewInit() {
    this.setupResizeObserver();
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const idUsuario = Number(entry.target.getAttribute('data-usuario'));
        if (idUsuario) {
          this.calcularLimiteZonas(idUsuario, entry.contentRect.width);
        }
      }
    });

    this.zonaContainers.changes.subscribe((containers: QueryList<ElementRef>) => {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        containers.forEach(container => {
          this.resizeObserver?.observe(container.nativeElement);
        });
      }
    });
  }

  private calcularLimiteZonas(idUsuario: number, width: number) {
    // Estimación: cada tag de zona ocupa unos 120px + gap
    // Dejamos margen para el contador y otros elementos
    const widthDisponible = width - 40; // padding
    const limite = Math.max(1, Math.floor(widthDisponible / 130));
    
    if (this.limitesZonas[idUsuario] !== limite) {
      this.limitesZonas[idUsuario] = limite;
    }
  }

  getLimiteZonas(idUsuario: number): number {
    if (this.gruposExpandidos[idUsuario]) return 999;
    return this.limitesZonas[idUsuario] || 3;
  }

  toggleExpandirGrupo(idUsuario: number) {
    this.gruposExpandidos[idUsuario] = !this.gruposExpandidos[idUsuario];
  }

  // === Modal de visualización de ítems ===
  abrirModalItems() {
    this.filtroItemsBusqueda = '';
    this.filtroItemsZona = '';
    this.filtroItemsResponsable = '';
    this.filtroItemsEstado = '';
    this.filtroItemsBodega = '';
    this.mostrarModalItems = true;
  }

  get zonasUnicasValidaciones(): string[] {
    return Array.from(new Set(this.validaciones.map(v => v.zona).filter(Boolean))).sort();
  }

  get responsablesUnicosValidaciones(): string[] {
    return Array.from(new Set(this.validaciones.map(v => v.responsable).filter(Boolean))).sort();
  }

  get bodegasUnicasValidaciones(): string[] {
    return Array.from(new Set(this.validaciones.map(v => v.codigo_bodega).filter(Boolean))).sort();
  }

  get validacionesFiltradas() {
    const search = this.filtroItemsBusqueda.toLowerCase();
    return this.validaciones.filter(v => {
      // Filtro por modo actual (tipo_conteo)
      if (this.modoActual !== 'justificar' && this.normalizeModo(v.tipo_conteo) !== this.modoActual) return false;

      // Filtro texto libre
      if (search) {
        const matchTexto = 
          (v.id_item || '').toLowerCase().includes(search) ||
          (v.referencia || '').toLowerCase().includes(search) ||
          (v.descripcion || '').toLowerCase().includes(search) ||
          (v.responsable || '').toLowerCase().includes(search) ||
          (v.zona || '').toLowerCase().includes(search);
        if (!matchTexto) return false;
      }

      // Filtro por zona
      if (this.filtroItemsZona && v.zona !== this.filtroItemsZona) return false;

      // Filtro por responsable
      if (this.filtroItemsResponsable && v.responsable !== this.filtroItemsResponsable) return false;

      // Filtro por estado
      if (this.filtroItemsEstado && v.estado_validacion !== this.filtroItemsEstado) return false;

      // Filtro por bodega
      if (this.filtroItemsBodega && v.codigo_bodega !== this.filtroItemsBodega) return false;

      return true;
    });
  }

  getEstadoLabel(estado: string): string {
    switch (estado) {
      case 'sin_conteo': return 'Sin Conteo';
      case 'pendiente': return 'Pendiente';
      case 'validado': return 'Validado';
      case 'reconteo': return 'Reconteo';
      default: return estado || 'Sin Conteo';
    }
  }

  getEstadoClasses(estado: string): string {
    switch (estado) {
      case 'validado': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'reconteo': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'pendiente': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'sin_conteo': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  }

  contarPorEstado(estado: string): number {
    return this.validacionesFiltradas.filter(v => (v.estado_validacion || 'sin_conteo') === estado).length;
  }

  get bodegasDisponibles() {
    // 1. Extraer bodegas de las asignaciones (más completo desde el inicio)
    const bodegasAsignadas = this.asignaciones.map(a => a.zona?.codigo_bodega).filter(b => !!b);
    
    // 2. Extraer bodegas de todas las zonas (por si hay zonas sin asignar)
    const bodegasZonas = this.zonas.map(z => z.codigo_bodega).filter(b => !!b);
    
    // Unir y eliminar duplicados
    const todas = [...bodegasAsignadas, ...bodegasZonas];
    return Array.from(new Set(todas)).sort();
  }

  private normalizeModo(modo: string): string {
    const m = String(modo || 'conteo').trim().toLowerCase();
    if (m === '1 reconteo' || m === 'reconteo 1') return 'reconteo1';
    if (m === '2 reconteo' || m === 'reconteo 2') return 'reconteo2';
    return m;
  }

  get activeBodegaStats() {
    if (!this.inventarioSeleccionado || !this.inventarioSeleccionado.bodega_stats) return null;
    if (this.filtroBodega && this.inventarioSeleccionado.bodega_stats[this.filtroBodega]) {
      return this.inventarioSeleccionado.bodega_stats[this.filtroBodega];
    }
    return this.inventarioSeleccionado.bodega_stats['_acumulado'] || null;
  }

  // Getters para filtrado y lógica de negocio
  get asignacionesAgrupadas() {
    const grupos: { [id_usuario: number]: { contador: any, asignaciones: any[] } } = {};
    
    // Filtrar por búsqueda global (zona o responsable) y por bodega
    const search = this.busquedaGlobal.toLowerCase();
    const asignacionesFiltradas = this.asignaciones.filter(asig => {
      // Filtro por modo actual (tipo_conteo)
      const matchModo = this.modoActual === 'justificar' || this.normalizeModo(asig.tipo_conteo) === this.modoActual;
      if (!matchModo) return false;

      // Filtro por búsqueda global
      const nombreContador = asig.contador?.nombre_completo?.toLowerCase() || '';
      const nombreZona = asig.zona?.nombre?.toLowerCase() || '';
      const matchSearch = !this.busquedaGlobal || nombreContador.includes(search) || nombreZona.includes(search);
      
      // Filtro por bodega
      const matchBodega = !this.filtroBodega || asig.zona?.codigo_bodega === this.filtroBodega;
      
      return matchSearch && matchBodega;
    });

    asignacionesFiltradas.forEach(asig => {
      if (!asig.id_usuario) return;
      if (!grupos[asig.id_usuario]) {
        grupos[asig.id_usuario] = {
          contador: asig.contador,
          asignaciones: []
        };
      }
      // Evitar agregar asignaciones duplicadas para la misma zona en esta vista
      const existeZona = grupos[asig.id_usuario].asignaciones.some(a => a.id_zona === asig.id_zona);
      if (!existeZona) {
        grupos[asig.id_usuario].asignaciones.push(asig);
      }
    });

    return Object.values(grupos);
  }

  get contadoresFiltrados() {
    const actual = this.authService.user;
    let lista = [...this.contadores];
    
    if (this.busquedaContador) {
      const search = this.busquedaContador.toLowerCase();
      lista = lista.filter(c => 
        (c.nombre_completo && c.nombre_completo.toLowerCase().includes(search)) ||
        (c.nombres && c.nombres.toLowerCase().includes(search)) || 
        (c.apellidos && c.apellidos.toLowerCase().includes(search)) ||
        (c.cedula && c.cedula.includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search))
      );
    }

    if (actual && !this.busquedaContador) {
      const existe = lista.find(c => c.id == actual.id);
      if (!existe) {
        lista.unshift({
          id: actual.id,
          nombres: actual.firstName,
          apellidos: actual.lastName,
          nombre_completo: actual.nombre_completo || (actual.firstName + ' ' + (actual.lastName || '')),
          cedula: 'ACTUAL',
          email: actual.email
        });
      }
    }
    return lista;
  }

  get zonasDisponiblesAsignacion() {
    let filtradas = this.zonas;

    // Si estamos en reconteo, solo mostrar zonas que tengan items marcados para reconteo en la ETAPA ANTERIOR
    // Y que estén realmente asignadas en este inventario
    if (this.modoActual !== 'conteo') {
      const etapaAnterior = this.modoActual === 'reconteo1' ? 'conteo' : 'reconteo1';
      
      // 1. Obtener IDs de zonas que están asignadas en conteo para este inventario
      const zonasAsignadasConteo = new Set(
        this.asignaciones
          .filter(a => this.normalizeModo(a.tipo_conteo) === etapaAnterior)
          .map(a => Number(a.id_zona))
      );
      
      // 2. Obtener nombres de zonas que tienen ítems marcados para reconteo
      const zonasConReconteo = new Set((this.validaciones || [])
        .filter(v => this.normalizeModo(v.tipo_conteo) === etapaAnterior && v.estado_validacion === 'reconteo')
        .map(v => String(v.zona || '').trim().toUpperCase()));
      
      // 3. Filtrar: la zona debe estar en las asignaciones del inventario Y tener ítems de reconteo
      filtradas = filtradas.filter(z => 
        zonasAsignadasConteo.has(Number(z.id)) && 
        zonasConReconteo.has(String(z.nombre || '').trim().toUpperCase())
      );
    }

    if (this.filtroBodegaAsignacion) {
      filtradas = filtradas.filter(z => z.codigo_bodega === this.filtroBodegaAsignacion);
    }
    if (this.busquedaZonasAsignacion) {
      const search = this.busquedaZonasAsignacion.toLowerCase();
      filtradas = filtradas.filter(z => 
        z.nombre.toLowerCase().includes(search) || 
        z.codigo_bodega.toLowerCase().includes(search)
      );
    }
    if (this.filtroSoloNoAsignadas) {
      filtradas = filtradas.filter(z => !this.getAsignacionZona(z.id));
    }
    return filtradas;
  }

  get idZonasSeleccionadasFiltradas() {
    if (!this.filtroBodegaPaso2) return this.id_zonas_seleccionadas;
    return this.id_zonas_seleccionadas.filter(id => {
      const zona = this.zonas.find(z => z.id == id);
      return zona?.codigo_bodega === this.filtroBodegaPaso2;
    });
  }

  get itemsDeZonaFiltrados() {
    let filtrados = this.itemsDeZona;

    // Si estamos en reconteo, solo mostrar items marcados para reconteo de la ETAPA ANTERIOR
    if (this.modoActual !== 'conteo') {
      const etapaAnterior = this.modoActual === 'reconteo1' ? 'conteo' : 'reconteo1';
      
      const itemsConReconteo = new Set((this.validaciones || [])
        .filter(v => this.normalizeModo(v.tipo_conteo) === etapaAnterior && v.estado_validacion === 'reconteo')
        .map(v => `${String(v.id_item || '').trim()}|${String(v.referencia || '').trim()}|${String(v.id_talla || '').trim()}|${String(v.id_color || '').trim()}`.toUpperCase()));
      
      filtrados = filtrados.filter(i => {
        const key = `${String(i.id_item || '').trim()}|${String(i.referencia || '').trim()}|${String(i.id_talla || '').trim()}|${String(i.id_color || '').trim()}`.toUpperCase();
        return itemsConReconteo.has(key);
      });
    }
    
    if (this.filtroTipoItem) {
      filtrados = filtrados.filter(i => {
        const esTela = i.referencia?.startsWith('1110');
        return this.filtroTipoItem === 'telas' ? esTela : !esTela;
      });
    }
    if (this.busquedaItemAsignacion) {
      const search = this.busquedaItemAsignacion.toLowerCase();
      filtrados = filtrados.filter(i => 
        i.id_item.toLowerCase().includes(search) || 
        i.referencia.toLowerCase().includes(search) ||
        i.descripcion.toLowerCase().includes(search)
      );
    }
    return filtrados;
  }

  get allZoneItemsSelected() {
    return this.itemsDeZonaFiltrados.length > 0 && this.itemsDeZonaFiltrados.every(i => i.seleccionado);
  }

  // Métodos de acción
  abrirNuevaAsignacion() {
    this.asignacion = {
      id: null,
      id_inventario: this.inventarioSeleccionado.id,
      id_zona: null,
      id_usuario: null,
      tipo_items: 'todos',
      items_detalle: [],
      tipo_conteo: this.modoActual
    };
    this.id_zonas_seleccionadas = [];
    this.excepciones_por_zona = {};
    this.zona_activa_edicion = null;
    this.busquedaContador = '';
    this.itemsDeZona = [];
    this.pasoAsignacion = 1;
    this.mostrarModalAsignacion = true;
  }

  abrirEdicionGrupo(grupo: any) {
    this.asignacion = {
      id: null,
      id_inventario: this.inventarioSeleccionado.id,
      id_zona: null,
      id_usuario: grupo.contador.id,
      tipo_items: 'todos',
      items_detalle: [],
      tipo_conteo: this.modoActual
    };
    
    this.busquedaContador = grupo.contador.nombre_completo || (grupo.contador.nombres + ' ' + (grupo.contador.apellidos || ''));
    this.id_zonas_seleccionadas = grupo.asignaciones.map((a: any) => Number(a.id_zona));
    
    this.excepciones_por_zona = {};
    grupo.asignaciones.forEach((a: any) => {
      this.excepciones_por_zona[Number(a.id_zona)] = {
        tipo_items: a.tipo_items || 'todos',
        items_detalle: a.items_detalle || []
      };
    });

    this.zona_activa_edicion = this.id_zonas_seleccionadas[0] || null;
    this.pasoAsignacion = 1;
    this.mostrarModalAsignacion = true;
    
    if (this.zona_activa_edicion) {
      this.setZonaActiva(this.zona_activa_edicion);
    }
  }

  editarAsignacion(asig: any) {
    const grupoAsignaciones = this.asignaciones.filter(a => a.id_usuario == asig.id_usuario);
    
    this.asignacion = {
      id: null,
      id_inventario: asig.id_inventario,
      id_zona: asig.id_zona,
      id_usuario: asig.id_usuario,
      tipo_items: asig.tipo_items || 'todos',
      items_detalle: asig.items_detalle || [],
      tipo_conteo: asig.tipo_conteo || 'conteo'
    };

    this.id_zonas_seleccionadas = grupoAsignaciones.map(a => a.id_zona);
    this.excepciones_por_zona = {};
    grupoAsignaciones.forEach(a => {
      this.excepciones_por_zona[a.id_zona] = {
        tipo_items: a.tipo_items || 'todos',
        items_detalle: a.items_detalle || []
      };
    });

    this.zona_activa_edicion = asig.id_zona;
    this.pasoAsignacion = 2;
    
    if (asig.contador) {
      this.busquedaContador = asig.contador.nombre_completo || (asig.contador.nombres + ' ' + (asig.contador.apellidos || ''));
    }

    this.cargarItemsDeZona();
    this.mostrarModalAsignacion = true;
  }

  eliminarAsignacion(id: number) {
    Swal.fire({
      title: '¿Eliminar asignación?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const userId = this.authService.user.id || 0;
        this.inventarioService.deleteAsignacion(id, userId).subscribe(resp => {
          if (resp.success) {
            Swal.fire('Eliminado', 'Asignación removida', 'success');
            this.onAsignacionCambiada.emit();
          }
        });
      }
    });
  }

  seleccionarContador(c: any) {
    this.asignacion.id_usuario = c.id;
    this.busquedaContador = c.nombre_completo || (c.nombres + ' ' + (c.apellidos || ''));
    this.mostrarDropdownContador = false;
  }

  toggleZonaAsignacion(id: number) {
    const index = this.id_zonas_seleccionadas.findIndex(zid => zid == id);
    if (index > -1) {
      this.id_zonas_seleccionadas.splice(index, 1);
      delete this.excepciones_por_zona[id];
      if (this.zona_activa_edicion == id) {
        const proximaZona = this.id_zonas_seleccionadas[0];
        if (proximaZona) this.setZonaActiva(proximaZona);
        else {
          this.zona_activa_edicion = null;
          this.itemsDeZona = [];
        }
      }
    } else {
      this.id_zonas_seleccionadas.push(id);
      this.excepciones_por_zona[id] = { tipo_items: 'todos', items_detalle: [] };
      if (!this.zona_activa_edicion) this.setZonaActiva(id);
    }
  }

  setZonaActiva(id: number) {
    this.zona_activa_edicion = id;
    if (!this.excepciones_por_zona[id]) {
      this.excepciones_por_zona[id] = { tipo_items: 'todos', items_detalle: [] };
    }
    const config = this.excepciones_por_zona[id];
    this.asignacion.tipo_items = config.tipo_items || 'todos';
    this.asignacion.items_detalle = config.items_detalle || [];
    this.cargarItemsDeZona();
  }

  cargarItemsDeZona() {
    if (!this.zona_activa_edicion) {
      this.itemsDeZona = [];
      return;
    }
    const zona = this.zonas.find(z => z.id == this.zona_activa_edicion);
    if (!zona) return;
    this.itemsDeZona = [];
    this.cargandoItemsZona = true;
    this.inventarioService.getItemsPorBodega(zona.codigo_bodega).subscribe(resp => {
      if (resp.success) {
        this.itemsDeZona = resp.data.filter((i: any) => 
          i.zonas?.some((z: any) => z.id == this.zona_activa_edicion)
        ).map((i: any) => ({
          ...i,
          seleccionado: this.asignacion.items_detalle.some((id: any) => String(id) === String(i.id_item))
        }));
      }
      this.cargandoItemsZona = false;
    });
  }

  toggleItemAsignacion(item: any) {
    item.seleccionado = !item.seleccionado;
    if (item.seleccionado) {
      this.asignacion.items_detalle.push(item.id_item);
    } else {
      const index = this.asignacion.items_detalle.indexOf(item.id_item);
      if (index > -1) this.asignacion.items_detalle.splice(index, 1);
    }
    this.actualizarConfiguracionZonaActiva();
  }

  toggleAllZoneItems() {
    const targetState = !this.allZoneItemsSelected;
    this.itemsDeZonaFiltrados.forEach(i => {
      if (i.seleccionado !== targetState) this.toggleItemAsignacion(i);
    });
  }

  cambiarTipoItems(tipo: 'todos' | 'incluir' | 'excluir') {
    this.asignacion.tipo_items = tipo;
    this.actualizarConfiguracionZonaActiva();
  }

  actualizarConfiguracionZonaActiva() {
    if (this.zona_activa_edicion) {
      this.excepciones_por_zona[this.zona_activa_edicion] = {
        tipo_items: this.asignacion.tipo_items,
        items_detalle: this.asignacion.items_detalle
      };
    }
  }

  async guardarAsignacion() {
    if (this.id_zonas_seleccionadas.length === 0 || !this.asignacion.id_usuario) {
      Swal.fire('Error', 'Debe seleccionar al menos una zona y un responsable', 'error');
      return;
    }

    this.guardandoAsignacion = true;
    const asignacionesUsuario = this.asignaciones.filter(a => a.id_usuario == this.asignacion.id_usuario && this.normalizeModo(a.tipo_conteo) === this.modoActual);
    let errores = 0;
    let exitos = 0;
    const zonasUnicas = Array.from(new Set(this.id_zonas_seleccionadas));
    
    const userId = this.authService.user.id || 0;
    for (const idZona of zonasUnicas) {
      const config = this.excepciones_por_zona[idZona] || { tipo_items: 'todos', items_detalle: [] };
      const asigExistente = asignacionesUsuario.find(a => a.id_zona == idZona);
      
      let itemsFinales = config.items_detalle || [];
      let tipoFinal = config.tipo_items || 'todos';

      // SI ES RECONTEO Y TIPO 'TODOS', RESTRINGIR A LOS ÍTEMS MARCADOS PARA RECONTEO
      if (this.modoActual !== 'conteo' && tipoFinal === 'todos') {
        const etapaAnterior = this.modoActual === 'reconteo1' ? 'conteo' : 'reconteo1';
        const zonaObj = this.zonas.find(z => z.id == idZona);
        
        const itemsParaReconteo = this.validaciones
          .filter(v => 
            (v.tipo_conteo || 'conteo') === etapaAnterior && 
            v.estado_validacion === 'reconteo' &&
            String(v.zona).trim().toUpperCase() === String(zonaObj?.nombre).trim().toUpperCase()
          )
          .map(v => v.id_item);

        if (itemsParaReconteo.length > 0) {
          tipoFinal = 'incluir';
          itemsFinales = itemsParaReconteo;
        }
      }

      const payload = {
        id_inventario: this.asignacion.id_inventario,
        id_usuario: this.asignacion.id_usuario,
        id_zona: idZona,
        tipo_items: tipoFinal,
        items_detalle: itemsFinales,
        estado: asigExistente ? asigExistente.estado : 'pendiente',
        tipo_conteo: this.modoActual
      };

      try {
        let resp: any;
        if (asigExistente && asigExistente.id) {
          resp = await this.inventarioService.updateAsignacion(asigExistente.id, payload, userId).toPromise();
        } else {
          resp = await this.inventarioService.storeAsignacion(payload, userId).toPromise();
        }
        if (resp && resp.success) exitos++;
        else errores++;
      } catch (e) { 
        console.error('Error guardando asignación:', e);
        errores++; 
      }
    }

    const idsZonasSeleccionadas = new Set(zonasUnicas);
    for (const asig of asignacionesUsuario) {
      if (!idsZonasSeleccionadas.has(asig.id_zona)) {
        try { await this.inventarioService.deleteAsignacion(asig.id, userId).toPromise(); } 
        catch (e) { errores++; }
      }
    }

    if (errores === 0) Swal.fire('Éxito', `Se procesaron ${exitos} asignaciones correctamente`, 'success');
    else Swal.fire('Atención', `Se procesaron ${exitos} correctamente, pero ${errores} fallaron`, 'warning');

    this.mostrarModalAsignacion = false;
    this.onAsignacionCambiada.emit();
    this.guardandoAsignacion = false;
  }

  getAsignacionZona(idZona: number) {
    return this.asignaciones.find(a => a.id_zona == idZona && this.normalizeModo(a.tipo_conteo) === this.modoActual);
  }

  getNombreZona(id: number) {
    return this.zonas.find(z => z.id == id)?.nombre || 'Zona';
  }

  esBodegaMP001(idZona: number | null): boolean {
    if (!idZona) return false;
    return this.zonas.find(z => z.id == idZona)?.codigo_bodega === 'MP001';
  }
}
