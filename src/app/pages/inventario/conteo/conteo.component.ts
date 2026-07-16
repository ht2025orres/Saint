import { Component, OnInit } from '@angular/core';
import { InventarioService } from '../../../services/inventario.service';
import { AuthService } from '../../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-conteo',
  templateUrl: './conteo.component.html',
  styleUrls: ['./conteo.component.css']
})
export class ConteoComponent implements OnInit {
  inventarios: any[] = [];
  inventarioSeleccionado: any = null;
  asignaciones: any[] = [];
  asignacionesFiltradas: any[] = [];
  asignacionSeleccionada: any = null;
  conteos: any[] = [];
  todasAsignaciones: any[] = []; // Nueva: para guardar todo sin filtrar por modo

  modoActual: 'conteo' | 'reconteo1' | 'reconteo2' | 'justificar' = 'conteo';
  validaciones: any[] = [];
  validacionesGlobales: any[] = []; // Para canEnterReconteo y progreso global

  // Para la lista de items que DEBERÍAN estar en la zona
  itemsDeZona: any[] = [];
  cargandoItems = false;
  activeMobileTab: 'registrar' | 'items' | 'historial' = 'items';

  nuevoConteo = {
    id_item_siesa: '',
    referencia: '',
    descripcion: '',
    id_talla: '',
    id_color: '',
    cantidad: null as number | null,
    observaciones: ''
  };
  cargando = false;
  usuarioActual: any;
  busquedaItemFiltro = '';
  campoActivo: string | null = null; // Para saber qué dropdown mostrar

  get porcentajeProgreso() {
    if (!this.itemsDeZona || this.itemsDeZona.length === 0) return 0;
    const itemsContados = this.itemsDeZona.filter(item => this.isItemContado(item)).length;
    return Math.round((itemsContados / this.itemsDeZona.length) * 100);
  }

  private normalize(val: any): string {
    return String(val || '').trim().toLowerCase();
  }

  isItemContado(item: any) {
    return this.conteos.some(c =>
      this.normalize(c.id_item_siesa) === this.normalize(item.id_item) &&
      this.normalize(c.referencia) === this.normalize(item.referencia) &&
      this.normalize(c.id_talla) === this.normalize(item.id_talla) &&
      this.normalize(c.id_color) === this.normalize(item.id_color)
    );
  }

  getConteoDetalle(item: any) {
    return this.conteos.filter(c =>
      this.normalize(c.id_item_siesa) === this.normalize(item.id_item) &&
      this.normalize(c.referencia) === this.normalize(item.referencia) &&
      this.normalize(c.id_talla) === this.normalize(item.id_talla) &&
      this.normalize(c.id_color) === this.normalize(item.id_color)
    );
  }

  async verDetallesConteo(item: any) {
    const conteosItem = this.getConteoDetalle(item);
    if (conteosItem.length === 0) {
      this.seleccionarItemParaConteo(item);
      return;
    }

    const conteo = conteosItem[0]; // Ahora solo debería haber uno
    const fechaCreacion = new Date(conteo.created_at);
    const diferenciaMinutos = (new Date().getTime() - fechaCreacion.getTime()) / (1000 * 60);
    const puedeEditar = diferenciaMinutos <= 1440;

    let html = `
      <div class="text-left">
        <div class="mb-4 p-4 bg-slate-50 rounded-[1.5rem] border border-slate-200">
          <div class="text-[10px] font-black text-slate-400 uppercase mb-1">Item</div>
          <div class="text-sm font-black text-slate-800">${item.id_item} - ${item.referencia}</div>
          <div class="text-xs text-slate-500 italic">${item.descripcion}</div>
        </div>
        
        <div class="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
          <div class="flex justify-between items-center mb-4">
            <span class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black border border-emerald-100 uppercase">
              Registro Único
            </span>
            <span class="text-[10px] font-bold text-slate-400">${new Date(conteo.fecha_conteo).toLocaleString()}</span>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div class="text-[9px] font-black text-slate-300 uppercase mb-1">Cantidad</div>
              <div class="text-2xl font-black text-slate-800">${this.formatCantidad(conteo.cantidad)}</div>
            </div>
            <div>
              <div class="text-[9px] font-black text-slate-300 uppercase mb-1">Estado Edición</div>
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${puedeEditar ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
                <span class="text-[10px] font-bold ${puedeEditar ? 'text-emerald-600' : 'text-rose-600'} uppercase">
                  ${puedeEditar ? 'Editable' : 'Bloqueado (>2h)'}
                </span>
              </div>
            </div>
          </div>

          <div class="mb-6">
            <div class="text-[9px] font-black text-slate-300 uppercase mb-1">Nota / Observación</div>
            <div class="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 min-h-[60px]">
              ${conteo.observaciones || '<span class="text-slate-300 italic">Sin observaciones registradas</span>'}
            </div>
          </div>

          ${puedeEditar ? `
            <div class="flex gap-3">
              <button onclick="window.dispatchEvent(new CustomEvent('edit-all', {detail: ${JSON.stringify(item)}}))" 
                class="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-xl transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 uppercase">
                <i class="bi bi-pencil-square"></i> Actualizar Conteo
              </button>
            </div>
          ` : `
            <div class="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 text-[10px] font-bold text-center uppercase">
              <i class="bi bi-lock-fill mr-1"></i> Este registro ya no puede ser modificado
            </div>
          `}
        </div>
      </div>
    `;

    const { value: formValue } = await Swal.fire({
      title: 'Información del Conteo',
      html: html,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
      customClass: {
        container: 'swal2-propuesta-conteo',
        popup: 'rounded-[2.5rem]',
        cancelButton: 'rounded-xl font-black text-xs uppercase tracking-widest px-8 py-3'
      },
      didOpen: () => {
        window.addEventListener('edit-all', (e: any) => {
          Swal.close();
          this.seleccionarItemParaConteo(e.detail);
        }, { once: true });
      }
    });
  }

  formatCantidad(cant: any): string {
    if (cant === null || cant === undefined) return '0';
    const num = parseFloat(cant);
    // Si no tiene decimales significativos, mostrar sin decimales
    return num % 1 === 0 ? num.toString() : num.toFixed(2).replace(/\.?0+$/, '');
  }

  async verNotaDirecto(conteo: any) {
    Swal.fire({
      title: 'Nota de Conteo',
      text: conteo.observaciones || 'No hay observaciones en este registro.',
      icon: 'info',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#059669',
      customClass: {
        popup: 'rounded-[2.5rem]',
        confirmButton: 'rounded-xl font-black text-xs uppercase tracking-widest px-8 py-3'
      }
    });
  }

  constructor(
    private inventarioService: InventarioService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.usuarioActual = this.authService.user;
    this.cargarAsignaciones();
  }

  get itemsDeZonaFiltrados() {
    let items = this.itemsDeZona;

    if (this.busquedaItemFiltro) {
      const search = this.busquedaItemFiltro.toLowerCase();
      items = items.filter(i =>
        (i.id_item && String(i.id_item).toLowerCase().includes(search)) ||
        (i.referencia && String(i.referencia).toLowerCase().includes(search)) ||
        (i.descripcion && String(i.descripcion).toLowerCase().includes(search)) ||
        (i.id_talla && String(i.id_talla).toLowerCase().includes(search)) ||
        (i.id_color && String(i.id_color).toLowerCase().includes(search))
      );
    }

    // Ordenar: No contados primero, contados al final
    return items.sort((a, b) => {
      const aContado = this.isItemContado(a);
      const bContado = this.isItemContado(b);
      if (aContado === bContado) return 0;
      return aContado ? 1 : -1;
    });
  }

  getRecomendaciones(campo: string) {
    const valor = (this.nuevoConteo as any)[campo];
    if (!valor || valor.length < 2) return [];

    const search = String(valor).toLowerCase();
    return this.itemsDeZona.filter(i => {
      const target = campo === 'id_item_siesa' ? i.id_item : (i as any)[campo.replace('id_', '')] || (i as any)[campo];
      return target && String(target).toLowerCase().includes(search);
    }).slice(0, 8);
  }

  cargarAsignaciones() {
    this.cargando = true;

    // Obtener TODAS las asignaciones para saber qué inventarios y modos están disponibles
    this.inventarioService.getAsignaciones(undefined, this.usuarioActual?.id).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.todasAsignaciones = resp.data;
          this.filtrarDatosPorModo();
        }
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  private normalizeModo(modo: string): string {
    const m = String(modo || 'conteo').trim().toLowerCase();
    if (m === '1 reconteo' || m === 'reconteo 1') return 'reconteo1';
    if (m === '2 reconteo' || m === 'reconteo 2') return 'reconteo2';
    return m;
  }

  filtrarDatosPorModo() {
    // 1. Filtrar inventarios que tienen al menos una asignación en este modo
    const inventariosMap = new Map();
    this.todasAsignaciones.forEach(asig => {
      const modoAsig = this.normalizeModo(asig.tipo_conteo);
      if (asig.inventario && modoAsig === this.modoActual) {
        if (!inventariosMap.has(asig.id_inventario)) {
          inventariosMap.set(asig.id_inventario, asig.inventario);
        }
      }
    });
    this.inventarios = Array.from(inventariosMap.values());

    // 2. Si hay un inventario seleccionado, filtrar sus asignaciones para el modo actual
    if (this.inventarioSeleccionado) {
      this.asignacionesFiltradas = this.todasAsignaciones.filter(asig =>
        asig.id_inventario === this.inventarioSeleccionado.id &&
        this.normalizeModo(asig.tipo_conteo) === this.modoActual
      );
      this.cargarValidacionesGlobales();
    }
  }

  cambiarModo(modo: 'conteo' | 'reconteo1' | 'reconteo2' | 'justificar') {
    this.modoActual = modo;
    // Si cambiamos de modo, reiniciamos la selección de zona para evitar errores de contexto
    this.asignacionSeleccionada = null;
    this.itemsDeZona = [];

    if (this.inventarioSeleccionado) {
      // Si ya hay un inventario seleccionado, refrescamos sus asignaciones para el nuevo modo
      this.seleccionarInventario(this.inventarioSeleccionado);
    } else {
      this.filtrarDatosPorModo();
    }
  }

  extraerInventarios() {
    const inventariosMap = new Map();
    this.asignaciones.forEach(asig => {
      if (asig.inventario && !inventariosMap.has(asig.id_inventario)) {
        // En reconteo, calcular progreso local basado en lo que el usuario ve
        const asigsInv = this.asignaciones.filter(a => a.id_inventario === asig.id_inventario);
        // Esto es lento, mejor lo hacemos en un getter o al seleccionar
        inventariosMap.set(asig.id_inventario, asig.inventario);
      }
    });
    this.inventarios = Array.from(inventariosMap.values());
  }

  get totalItemsInventario() {
    if (!this.inventarioSeleccionado) return 0;
    const asigs = this.asignaciones.filter(a => a.id_inventario === this.inventarioSeleccionado.id);
    // Para estimar el total, necesitamos los items de cada zona asignada
    // Pero eso es pesado. Usaremos el total guardado en el inventario para conteo
    // Para reconteo usaremos la suma de items de las asignaciones si las tenemos cargadas.
    return 0; // Se calculará dinámicamente o mostrará según asig
  }

  seleccionarInventario(inv: any) {
    this.inventarioSeleccionado = inv;
    this.asignacionSeleccionada = null;

    // Cargar validaciones globales primero para tener el universo de ítems
    this.inventarioService.getValidacionesReconteo(inv.id, false).subscribe(resp => {
      if (resp.success) {
        this.validacionesGlobales = (resp.data || []).filter((v: any) => v.estado_validacion !== 'sin_conteo');
        // Después de tener las validaciones, filtramos las asignaciones del modo actual
        this.asignacionesFiltradas = this.todasAsignaciones.filter(asig =>
          asig.id_inventario === inv.id &&
          (asig.tipo_conteo || 'conteo') === this.modoActual
        );
        this.calcularAvanceAsignaciones();
      }
    });
  }

  cargarValidacionesGlobales() {
    if (!this.inventarioSeleccionado) return;
    this.inventarioService.getValidacionesReconteo(this.inventarioSeleccionado.id, false).subscribe(resp => {
      if (resp.success) {
        this.validacionesGlobales = (resp.data || []).filter((v: any) => v.estado_validacion !== 'sin_conteo');
        this.calcularAvanceAsignaciones();
      }
    });
  }

  get canEnterReconteo1() {
    if (!this.inventarioSeleccionado) return this.todasAsignaciones.some(a => this.normalizeModo(a.tipo_conteo) === 'reconteo1');
    return this.validacionesGlobales.some(v => this.normalizeModo(v.tipo_conteo) === 'conteo' && v.estado_validacion === 'reconteo');
  }

  get canEnterReconteo2() {
    if (!this.inventarioSeleccionado) return this.todasAsignaciones.some(a => this.normalizeModo(a.tipo_conteo) === 'reconteo2');
    return this.validacionesGlobales.some(v => this.normalizeModo(v.tipo_conteo) === 'reconteo1' && v.estado_validacion === 'reconteo');
  }

  get progresoGlobalInventario() {
    if (!this.inventarioSeleccionado) return 0;

    let total = 0;
    let contados = 0;

    if (this.modoActual === 'conteo') {
      // Usar la suma de todas las asignaciones de este inventario en este modo
      const asigsInv = this.todasAsignaciones.filter(a => a.id_inventario === this.inventarioSeleccionado.id && this.normalizeModo(a.tipo_conteo) === 'conteo');
      total = asigsInv.reduce((acc, a) => acc + (a.total_items_zona || 0), 0);
      contados = asigsInv.reduce((acc, a) => acc + (a.items_contados_zona || 0), 0);

      // Si por alguna razón total es 0, intentar con el total_items del inventario
      if (total === 0) total = this.inventarioSeleccionado.total_items || 0;
    } else if (this.modoActual === 'reconteo1') {
      const asigsInv = this.todasAsignaciones.filter(a => a.id_inventario === this.inventarioSeleccionado.id && this.normalizeModo(a.tipo_conteo) === 'reconteo1');
      total = asigsInv.reduce((acc, a) => acc + (a.total_items_zona || 0), 0);
      contados = asigsInv.reduce((acc, a) => acc + (a.items_contados_zona || 0), 0);
    } else if (this.modoActual === 'reconteo2') {
      const asigsInv = this.todasAsignaciones.filter(a => a.id_inventario === this.inventarioSeleccionado.id && this.normalizeModo(a.tipo_conteo) === 'reconteo2');
      total = asigsInv.reduce((acc, a) => acc + (a.total_items_zona || 0), 0);
      contados = asigsInv.reduce((acc, a) => acc + (a.items_contados_zona || 0), 0);
    }

    return total > 0 ? Math.round((contados / total) * 100) : 0;
  }

  calcularAvanceAsignaciones() {
    // El avance ya viene calculado desde el backend en cada objeto de asignación
    // pero podemos refrescarlo localmente si es necesario para reconteo
    this.asignacionesFiltradas.forEach(asig => {
      if (this.modoActual !== 'conteo') {
        const nombreZona = asig.zona?.nombre;
        const etapaAnterior = this.modoActual === 'reconteo1' ? 'conteo' : 'reconteo1';
        const universoReconteo = this.validacionesGlobales.filter(v =>
          (v.tipo_conteo || 'conteo') === etapaAnterior &&
          v.estado_validacion === 'reconteo' &&
          this.normalize(v.zona) === this.normalize(nombreZona)
        );

        const contados = this.validacionesGlobales.filter(v =>
          v.tipo_conteo === this.modoActual &&
          this.normalize(v.zona) === this.normalize(nombreZona)
        );

        asig.avance = universoReconteo.length > 0
          ? Math.round((contados.length / universoReconteo.length) * 100)
          : 0;
      }
    });
  }

  seleccionarAsignacion(asig: any) {
    this.asignacionSeleccionada = asig;
    this.cargarConteos(asig.id);
    this.cargarItemsDeZona();
  }

  cargarConteos(idAsignacion: number) {
    this.inventarioService.getConteos(idAsignacion).subscribe(resp => {
      if (resp.success) {
        this.conteos = resp.data;
      }
    });
  }

  cargarItemsDeZona() {
    if (!this.asignacionSeleccionada?.zona) return;

    this.cargandoItems = true;
    this.inventarioService.getItemsPorBodega(this.asignacionSeleccionada.zona.codigo_bodega).subscribe(resp => {
      if (resp.success) {
        // Filtrar items que pertenecen a esta zona según ItemZonaPropuesta
        let items = resp.data.filter((i: any) =>
          i.zonas?.some((z: any) => z.id == this.asignacionSeleccionada.id_zona)
        );

        // Aplicar restricciones de la asignación (incluir/excluir)
        if (this.asignacionSeleccionada.tipo_items === 'incluir') {
          items = items.filter((i: any) =>
            this.asignacionSeleccionada.items_detalle.some((id: any) => String(id) === String(i.id_item))
          );
        } else if (this.asignacionSeleccionada.tipo_items === 'excluir') {
          items = items.filter((i: any) =>
            !this.asignacionSeleccionada.items_detalle.some((id: any) => String(id) === String(i.id_item))
          );
        } else if (this.modoActual !== 'conteo') {
          // Si es RECONTEO y dice "TODOS", forzar filtro de lo marcado para reconteo
          const etapaAnterior = this.modoActual === 'reconteo1' ? 'conteo' : 'reconteo1';
          const itemsMarcados = new Set(this.validacionesGlobales
            .filter(v =>
              this.normalizeModo(v.tipo_conteo) === etapaAnterior &&
              v.estado_validacion === 'reconteo' &&
              this.normalize(v.zona) === this.normalize(this.asignacionSeleccionada.zona?.nombre)
            )
            .map(v => `${String(v.id_item).trim()}|${String(v.referencia).trim()}|${String(v.id_talla || '').trim()}|${String(v.id_color || '').trim()}`.toUpperCase())
          );

          items = items.filter((i: any) => {
            const key = `${String(i.id_item).trim()}|${String(i.referencia).trim()}|${String(i.id_talla || '').trim()}|${String(i.id_color || '').trim()}`.toUpperCase();
            return itemsMarcados.has(key);
          });
        }

        this.itemsDeZona = items;
      }
      this.cargandoItems = false;
    });
  }

  seleccionarItemParaConteo(item: any) {
    this.nuevoConteo = {
      id_item_siesa: String(item.id_item),
      referencia: item.referencia,
      descripcion: item.descripcion,
      id_talla: item.id_talla || '',
      id_color: item.id_color || '',
      cantidad: null as any,
      observaciones: ''
    };
    this.campoActivo = null;
    this.activeMobileTab = 'registrar';
    // Hacer scroll al formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  registrarConteo() {
    if (!this.nuevoConteo.id_item_siesa || !this.nuevoConteo.cantidad) {
      Swal.fire('Error', 'ID Item y Cantidad son obligatorios', 'error');
      return;
    }

    const userId = this.authService.user.id || 0;
    const payload = {
      ...this.nuevoConteo,
      cantidad: String(this.nuevoConteo.cantidad || '0'), // Asegurar que sea string para el backend
      id_asignacion: this.asignacionSeleccionada.id,
      id_usuario: userId
    };

    this.cargando = true;
    this.inventarioService.storeConteo(payload, userId).subscribe({
      next: (resp) => {
        if (resp.success) {
          Swal.fire({
            icon: 'success',
            title: 'Conteo registrado',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
          });
          this.nuevoConteo = { id_item_siesa: '', referencia: '', descripcion: '', id_talla: '', id_color: '', cantidad: 0, observaciones: '' };
          this.cargarConteos(this.asignacionSeleccionada.id);
          this.activeMobileTab = 'items';
        }
        this.cargando = false;
      },
      error: (err) => {
        const message = err.error?.message || 'No se pudo registrar el conteo';
        Swal.fire('Atención', message, 'warning');
        this.cargando = false;
      }
    });
  }

  buscarItem() {
    const search = this.nuevoConteo.id_item_siesa.toLowerCase();
    const itemEncontrado = this.itemsDeZona.find(i =>
      i.id_item.toLowerCase() === search ||
      i.referencia.toLowerCase() === search
    );

    if (itemEncontrado) {
      this.seleccionarItemParaConteo(itemEncontrado);
    }
  }

  eliminarConteo(conteo: any) {
    const fechaCreacion = new Date(conteo.created_at);
    const diferenciaMinutos = (new Date().getTime() - fechaCreacion.getTime()) / (1000 * 60);
    const puedeEliminar = diferenciaMinutos <= 1440;

    if (!puedeEliminar) {
      Swal.fire('Atención', 'No se puede eliminar este registro. Han pasado más de 24 horas desde el registro inicial.', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Eliminar Conteo?',
      text: `¿Estás seguro de que deseas eliminar el conteo del ítem ${conteo.referencia}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'rounded-[2.5rem]',
        confirmButton: 'rounded-xl font-black text-xs uppercase tracking-widest px-8 py-3',
        cancelButton: 'rounded-xl font-black text-xs uppercase tracking-widest px-8 py-3'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.cargando = true;
        const userId = this.authService.user.id || 0;
        this.inventarioService.deleteConteo(conteo.id, userId).subscribe({
          next: (resp) => {
            if (resp.success) {
              Swal.fire({
                icon: 'success',
                title: 'Conteo eliminado',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
              });
              this.cargarConteos(this.asignacionSeleccionada.id);
              this.cargarAsignaciones();
            }
            this.cargando = false;
          },
          error: (err) => {
            const message = err.error?.message || 'No se pudo eliminar el conteo';
            Swal.fire('Atención', message, 'warning');
            this.cargando = false;
          }
        });
      }
    });
  }
  puedeEditarConteo(conteo: any): boolean {
    if (!conteo || !conteo.created_at) return false;
    const fechaCreacion = new Date(conteo.created_at);
    const diferenciaMinutos = (new Date().getTime() - fechaCreacion.getTime()) / (1000 * 60);
    return diferenciaMinutos <= 1440;
  }
}
