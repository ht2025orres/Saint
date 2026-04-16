import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { InventarioService } from '../../../../services/inventario.service';
import { AuthService } from '../../../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-reconteo-inventario',
  templateUrl: './reconteo.component.html'
})
export class ReconteoInventarioComponent implements OnInit {
  private _inventarioSeleccionado: any;
  @Input() set inventarioSeleccionado(val: any) {
    this._inventarioSeleccionado = val;
    this.resetearFiltros();
    this.cargarValidaciones();
  }
  get inventarioSeleccionado() {
    return this._inventarioSeleccionado;
  }

  @Input() asignaciones: any[] = [];
  @Input() validaciones: any[] = [];
  @Input() sincronizandoSiesa = false;
  private _modoActual: 'conteo' | 'reconteo1' | 'reconteo2' = 'conteo';
  @Input() set modoActual(val: 'conteo' | 'reconteo1' | 'reconteo2') {
    this._modoActual = val;
    this.itemsSeleccionados.clear();
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

  // Filtros y Búsqueda
  busquedaItems = '';
  filtroEstado: 'todos' | 'pendiente' | 'validado' | 'reconteo' = 'todos';
  filtroBodega = '';
  
  // Selección masiva
  itemsSeleccionados: Set<number> = new Set();

  // Umbrales de Reconteo
  umbralUnidades = 5;
  umbralPrecio = 10000;

  constructor(
    private inventarioService: InventarioService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // El setter de inventarioSeleccionado ya llama a cargarValidaciones
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
    let base = this.validaciones.filter(v => this.normalizeModo(v.tipo_conteo) === this.modoActual);
    
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

  get bodegasDisponibles() {
    // 1. Extraer bodegas de las asignaciones para el modo actual
    const bodegasAsignadas = this.asignaciones
      .filter(a => this.normalizeModo(a.tipo_conteo) === this.modoActual)
      .map(a => a.zona?.codigo_bodega)
      .filter(b => !!b);
    
    // 2. Extraer bodegas de las validaciones para el modo actual
    const bodegasValidaciones = this.validaciones
      .filter(v => this.normalizeModo(v.tipo_conteo) === this.modoActual)
      .map(v => v.codigo_bodega);
    
    // Unir y eliminar duplicados
    const todas = [...bodegasAsignadas, ...bodegasValidaciones];
    return Array.from(new Set(todas)).sort();
  }

  onFiltroBodegaChange() {
    this.itemsSeleccionados.clear();
    // Si estamos en una vista filtrada por contador/zona, tal vez queramos volver al menú?
    // O simplemente dejar que los getters hagan su trabajo de filtrado.
  }

  resetearFiltros() {
    this.filtroBodega = '';
    this.filtroEstado = 'todos';
    this.busquedaItems = '';
    this.itemsSeleccionados.clear();
    this.vistaActual = 'menu';
    this.filtroActual = null;
    this.itemSeleccionado = null;
  }

  get contadoresAgrupados() {
    const grupos: { [key: string]: any } = {};
    
    let validacionesBase = this.validaciones.filter(v => this.normalizeModo(v.tipo_conteo) === this.modoActual);
    if (this.filtroBodega) {
      validacionesBase = validacionesBase.filter(v => v.codigo_bodega === this.filtroBodega);
    }

    validacionesBase.forEach(v => {
      if (!grupos[v.responsable]) {
        grupos[v.responsable] = { nombre: v.responsable, total: 0, pendientes: 0 };
      }
      grupos[v.responsable].total++;
      if (v.estado_validacion === 'pendiente') grupos[v.responsable].pendientes++;
    });
    return Object.values(grupos);
  }

  get zonasAgrupadas() {
    const grupos: { [key: string]: any } = {};
    
    let validacionesBase = this.validaciones.filter(v => this.normalizeModo(v.tipo_conteo) === this.modoActual);
    if (this.filtroBodega) {
      validacionesBase = validacionesBase.filter(v => v.codigo_bodega === this.filtroBodega);
    }

    validacionesBase.forEach(v => {
      if (!grupos[v.zona]) {
        grupos[v.zona] = { nombre: v.zona, total: 0, pendientes: 0 };
      }
      grupos[v.zona].total++;
      if (v.estado_validacion === 'pendiente') grupos[v.zona].pendientes++;
    });
    return Object.values(grupos);
  }

  // Lógica de filtrado de la lista
  get validacionesFiltradas() {
    // Filtrar por el modo actual (conteo, reconteo1, reconteo2)
    let filtrados = this.validaciones.filter(v => this.normalizeModo(v.tipo_conteo) === this.modoActual);

    // Filtro por bodega (Global)
    if (this.filtroBodega) {
      filtrados = filtrados.filter(v => v.codigo_bodega === this.filtroBodega);
    }

    // Filtro por menú (contador o zona)
    if (this.filtroActual === 'contador' && this.itemSeleccionado) {
      filtrados = filtrados.filter(v => v.responsable === this.itemSeleccionado);
    } else if (this.filtroActual === 'zona' && this.itemSeleccionado) {
      filtrados = filtrados.filter(v => v.zona === this.itemSeleccionado);
    }

    // Filtro por estado
    if (this.filtroEstado !== 'todos') {
      filtrados = filtrados.filter(v => v.estado_validacion === this.filtroEstado);
    }

    // Búsqueda global
    if (this.busquedaItems) {
      const search = this.busquedaItems.toLowerCase();
      filtrados = filtrados.filter(v => 
        v.referencia.toLowerCase().includes(search) || 
        v.descripcion.toLowerCase().includes(search) ||
        v.id_item.toLowerCase().includes(search)
      );
    }

    return filtrados;
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
}
