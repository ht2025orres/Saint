import { Component, OnInit, HostListener } from '@angular/core';
import { InventarioService } from '../../../services/inventario.service';
import { AuthService } from '../../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-gestion-inventarios',
  templateUrl: './gestion-inventarios.component.html',
  styleUrls: ['./gestion-inventarios.component.css']
})
export class GestionInventariosComponent implements OnInit {
  inventarios: any[] = [];
  zonas: any[] = [];
  contadores: any[] = [];
  colapsado = false;
  limiteZonas = 3;
  
  // Selección
  inventarioSeleccionado: any = null;
  asignaciones: any[] = [];
  validaciones: any[] = [];
  
  // Filtros Sidebar
  busquedaInventarios = '';
  filtroEstado = '';
  filtroBodega = '';

  // Control de modales
  mostrarModalInventario = false;
  guardandoInventario = false;
  
  // Formulario nuevo inventario
  nuevoInventario = {
    nombre: '',
    descripcion: '',
    fecha_inicio: ''
  };

  cargando = false;
  sincronizandoSiesa = false;

  // Sub-interfaz activa
  subInterfazActiva: 'asignacion' | 'reconteo' = 'asignacion';
  private _modoActual: 'conteo' | 'reconteo1' | 'reconteo2' = 'conteo';
  set modoActual(val: 'conteo' | 'reconteo1' | 'reconteo2') {
    this._modoActual = val;
    
    // Sincronizar la vista de las tarjetas del sidebar con el modo seleccionado
    this.inventarios.forEach(inv => {
      // Solo sincronizar si la etapa existe en las estadísticas del inventario
      if (inv.stats_etapas && inv.stats_etapas[val]) {
        inv.etapaVista = val;
      } else {
        inv.etapaVista = 'conteo';
      }
    });

    this.cargarAsignaciones();
  }
  get modoActual() {
    return this._modoActual;
  }

  private normalizeModo(modo: string): string {
    const m = String(modo || 'conteo').trim().toLowerCase();
    if (m === '1 reconteo' || m === 'reconteo 1') return 'reconteo1';
    if (m === '2 reconteo' || m === 'reconteo 2') return 'reconteo2';
    return m;
  }

  get canEnterReconteo1() {
    return this.validaciones.some(v => this.normalizeModo(v.tipo_conteo) === 'conteo' && v.estado_validacion === 'reconteo');
  }

  get canEnterReconteo2() {
    return this.validaciones.some(v => this.normalizeModo(v.tipo_conteo) === 'reconteo1' && v.estado_validacion === 'reconteo');
  }

  get statsModoActual() {
    if (!this.inventarioSeleccionado) return null;

    let total = 0;
    let contados = 0;
    let zonasCubiertas = 0;

    // Si no hay validaciones cargadas aún para el inventario seleccionado, 
    // usamos los datos básicos del objeto inventario como fallback para evitar el 0%
    if (this.validaciones.length === 0) {
      return {
        total: this.inventarioSeleccionado.total_items || 0,
        contados: this.inventarioSeleccionado.items_contados || 0,
        progreso: Number(this.inventarioSeleccionado.progreso || 0),
        zonasCubiertas: this.inventarioSeleccionado.zonas_asignadas || 0,
        totalBodegas: this.inventarioSeleccionado.total_bodegas || 0
      };
    }

    if (this.modoActual === 'conteo') {
      // El modo conteo muestra el progreso global del primer conteo
      total = this.inventarioSeleccionado.total_items || 0;
      contados = this.validaciones.filter(v => this.normalizeModo(v.tipo_conteo) === 'conteo').length;
      zonasCubiertas = new Set(this.asignaciones.filter(a => this.normalizeModo(a.tipo_conteo) === 'conteo').map(a => a.id_zona)).size;
    } else if (this.modoActual === 'reconteo1') {
      // Universo de reconteo 1: lo que se marcó en conteo
      total = this.validaciones.filter(v => this.normalizeModo(v.tipo_conteo) === 'conteo' && v.estado_validacion === 'reconteo').length;
      contados = this.validaciones.filter(v => this.normalizeModo(v.tipo_conteo) === 'reconteo1').length;
      zonasCubiertas = new Set(this.asignaciones.filter(a => this.normalizeModo(a.tipo_conteo) === 'reconteo1').map(a => a.id_zona)).size;
    } else if (this.modoActual === 'reconteo2') {
      // Universo de reconteo 2: lo que se marcó en reconteo 1
      total = this.validaciones.filter(v => this.normalizeModo(v.tipo_conteo) === 'reconteo1' && v.estado_validacion === 'reconteo').length;
      contados = this.validaciones.filter(v => this.normalizeModo(v.tipo_conteo) === 'reconteo2').length;
      zonasCubiertas = new Set(this.asignaciones.filter(a => this.normalizeModo(a.tipo_conteo) === 'reconteo2').map(a => a.id_zona)).size;
    }

    // Usar toFixed(2) para mantener la precisión que el usuario espera (ej: 0.92%)
    const progreso = total > 0 ? Number(((contados / total) * 100).toFixed(2)) : 0;

    return {
      total,
      contados,
      progreso,
      zonasCubiertas,
      totalBodegas: this.inventarioSeleccionado.total_bodegas || 0
    };
  }

  constructor(
    private inventarioService: InventarioService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.cargarInventarios();
    this.cargarZonas();
    this.cargarContadores();
    this.calcularLimiteZonas();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.calcularLimiteZonas();
  }

  calcularLimiteZonas() {
    const width = window.innerWidth;
    if (width < 640) this.limiteZonas = 1;
    else if (width < 1024) this.limiteZonas = 2;
    else if (width < 1280) this.limiteZonas = 3;
    else if (width < 1536) this.limiteZonas = 4;
    else this.limiteZonas = 5;
  }

  get inventariosFiltrados() {
    return this.inventarios.filter(inv => {
      const matchBusqueda = inv.nombre.toLowerCase().includes(this.busquedaInventarios.toLowerCase());
      const matchEstado = !this.filtroEstado || inv.estado === this.filtroEstado;
      
      // Filtro por bodega si hay alguna seleccionada
      let matchBodega = true;
      if (this.filtroBodega) {
        // En el backend, total_bodegas es un número, pero tal vez necesitemos algo más preciso
        // por ahora, si el inventario tiene esa bodega en sus zonas
        // NOTA: Como el modelo de datos aquí es el inventario general, 
        // tal vez el filtro de bodega en la lista lateral no sea tan trivial 
        // sin cargar todas las asignaciones de todos los inventarios.
        // Por ahora, lo dejaremos pasar o lo simplificaremos.
      }
      
      return matchBusqueda && matchEstado && matchBodega;
    });
  }

  get bodegasDisponibles() {
    // Obtener bodegas únicas de todas las zonas cargadas
    const bodegas = this.zonas.map(z => z.codigo_bodega).filter(b => !!b);
    return Array.from(new Set(bodegas)).sort();
  }

  cargarInventarios() {
    this.cargando = true;
    this.inventarioService.getInventarios().subscribe(resp => {
      if (resp.success) {
        this.inventarios = resp.data.map((inv: any) => ({
          ...inv,
          // Sincronizar etapaVista con el modoActual global
          etapaVista: (inv.stats_etapas && inv.stats_etapas[this.modoActual]) ? this.modoActual : 'conteo'
        }));
        if (this.inventarioSeleccionado) {
          const actualizado = this.inventarios.find(i => i.id === this.inventarioSeleccionado.id);
          if (actualizado) this.inventarioSeleccionado = actualizado;
        }
      }
      this.cargando = false;
    });
  }

  cambiarEtapaCard(event: Event, inv: any, direccion: number) {
    event.stopPropagation(); // Evitar seleccionar el inventario al hacer click en las flechas
    
    const etapas = ['conteo', 'reconteo1', 'reconteo2'];
    const etapasDisponibles = etapas.filter(e => inv.stats_etapas && inv.stats_etapas[e] && inv.stats_etapas[e].disponible);
    
    let currentIndex = etapasDisponibles.indexOf(inv.etapaVista);
    let nextIndex = currentIndex + direccion;

    if (nextIndex >= etapasDisponibles.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = etapasDisponibles.length - 1;

    inv.etapaVista = etapasDisponibles[nextIndex];
  }

  getLabelEtapa(etapa: string): string {
    switch(etapa) {
      case 'conteo': return '1° Conteo';
      case 'reconteo1': return '1° Reconteo';
      case 'reconteo2': return '2° Reconteo';
      default: return etapa;
    }
  }

  cargarZonas() {
    this.inventarioService.getZonas().subscribe(resp => {
      if (resp.success) this.zonas = resp.data;
    });
  }

  cargarContadores() {
    this.inventarioService.getContadores().subscribe(resp => {
      if (resp.success) this.contadores = resp.data;
    });
  }

  seleccionarInventario(inv: any) {
    // 1. Limpiar datos previos para forzar el uso de estadísticas estáticas del objeto 'inv'
    this.validaciones = [];
    this.asignaciones = [];
    
    // 2. Seleccionar el nuevo inventario
    this.inventarioSeleccionado = inv;
    this._modoActual = 'conteo'; // Reset a conteo sin disparar recarga inmediata
    
    // 3. Cargar datos frescos
    this.cargarAsignaciones();
    this.cargarValidaciones();
  }

  cargarValidaciones() {
    if (!this.inventarioSeleccionado || this.sincronizandoSiesa) return;
    
    // 1. Carga rápida inicial (sin sincronizar con SIESA)
    this.inventarioService.getValidacionesReconteo(this.inventarioSeleccionado.id, false).subscribe(resp => {
      if (resp.success) {
        this.validaciones = resp.data;
        
        // 2. Inmediatamente después, disparar la sincronización real en segundo plano
        this.ejecutarSincronizacionSiesa();
      }
    });
  }

  ejecutarSincronizacionSiesa() {
    if (!this.inventarioSeleccionado || this.sincronizandoSiesa) return;
    
    this.sincronizandoSiesa = true;
    this.inventarioService.getValidacionesReconteo(this.inventarioSeleccionado.id, true).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.validaciones = resp.data;
          // Toast opcional para avisar que los datos de SIESA están listos
          const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
          });
          Toast.fire({ icon: 'success', title: 'Sincronizado con SIESA' });
        }
        this.sincronizandoSiesa = false;
      },
      error: () => {
        this.sincronizandoSiesa = false;
      }
    });
  }

  cargarAsignaciones() {
    if (!this.inventarioSeleccionado) return;
    this.inventarioService.getAsignaciones(this.inventarioSeleccionado.id, undefined, this.modoActual).subscribe(resp => {
      if (resp.success) this.asignaciones = resp.data;
    });
  }

  crearInventario() {
    if (!this.nuevoInventario.nombre || !this.nuevoInventario.fecha_inicio) {
      Swal.fire('Error', 'Nombre y fecha son obligatorios', 'error');
      return;
    }

    this.guardandoInventario = true;
    const userId = this.authService.user.id || 0;
    this.inventarioService.storeInventario(this.nuevoInventario, userId).subscribe({
      next: (resp) => {
        if (resp.success) {
          Swal.fire('Éxito', 'Inventario creado', 'success');
          this.mostrarModalInventario = false;
          this.nuevoInventario = { nombre: '', descripcion: '', fecha_inicio: '' };
          this.cargarInventarios();
        }
        this.guardandoInventario = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo crear el inventario', 'error');
        this.guardandoInventario = false;
      }
    });
  }

  cambiarEstadoInventario(id: number, estado: string) {
    Swal.fire({
      title: '¿Cambiar estado?',
      text: `El inventario pasará a estado: ${estado.toUpperCase()}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const userId = this.authService.user.id || 0;
        this.inventarioService.updateInventarioStatus(id, estado, userId).subscribe(resp => {
          if (resp.success) {
            Swal.fire('Éxito', 'Estado actualizado', 'success');
            this.cargarInventarios();
          }
        });
      }
    });
  }
}
