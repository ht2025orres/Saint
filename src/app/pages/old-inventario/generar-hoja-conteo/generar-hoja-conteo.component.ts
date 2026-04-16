import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { InventarioOldService, Inventario } from 'src/app/services/inventario-old.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-generar-hoja-conteo',
  templateUrl: './generar-hoja-conteo.component.html',
  styleUrls: ['./generar-hoja-conteo.component.css']
})
export class GenerarHojaConteoComponent implements OnInit {
  inventariosActivos: any[] = [];
  inventarioSeleccionado: number | null = null;
  paso = 1;
  bodegas: any[] = [];
  lideres: any[] = [];
  zonas: any[] = [];
  fechaHoy = new Date().toISOString().split('T')[0];

  configuracion = {
    codigo_bodega: null as string | null,
    id_lider: null as number | null,
    tipo: 'CONTEO' as 'CONTEO' | 'RECONTEO1' | 'RECONTEO2' | 'RECONTEO3',
    fecha_desde: null as string | null,
    zonas_ids: [] as number[],
    max_items: 50,
    max_valor_existencia: null as number | null,
    umbral_existencia_minima: null as number | null,
    agrupar_por_cercania: true,
    estrategia: 'balanceada' as 'balanceada' | 'rapida' | 'zona_completa',
    excluir_sin_zona: false,
    observaciones: ''
  };

  estrategias = [
    { valor: 'balanceada', nombre: 'Balanceada', descripcion: 'Optimiza por zonas y valor' },
    { valor: 'rapida', nombre: 'Rápida', descripcion: 'Selección rápida por prioridad' },
    { valor: 'zona_completa', nombre: 'Zona Completa', descripcion: 'Completa zonas enteras' }
  ];

  itemsSugeridos: any[] = [];
  itemsFiltrados: any[] = [];
  busquedaItems = '';
  metadatos: any = null;
  generandoSugerencia = false;
  creandoHoja = false;
  hojaCreada: any = null;
  estadisticasZona: { [key: string]: any } = {};

  constructor(private inventarioService: InventarioOldService, private router: Router) {}

  ngOnInit(): void {
    this.cargarDatosMaestros();
  }

  cargarDatosMaestros(): void {
    this.cargarInventariosActivos();
    this.inventarioService.obtenerResumenBodegas().subscribe({
      next: (res) => this.bodegas = res['data'] || [],
      error: () => Swal.fire('Error', 'No se cargaron las bodegas', 'error')
    });

    this.inventarioService.obtenerLideresConteo().subscribe({
      next: (res) => this.lideres = res['data'] || [],
      error: () => Swal.fire('Error', 'No se cargaron los líderes', 'error')
    });

    this.inventarioService.obtenerZonas().subscribe({
      next: (res) => this.zonas = (res['data'] || []).map((z: any) => ({ ...z, seleccionada: false })),
      error: () => Swal.fire('Error', 'No se cargaron las zonas', 'error')
    });
  }

  cargarInventariosActivos(): void {
    this.inventarioService.getInventarios('activos').subscribe({
      next: (res) => this.inventariosActivos = res.data.filter((inv: any) => inv.estado === 'activo'),
      error: () => console.error('Error cargando inventarios activos')
    });
  }

  onZonaChange(zona: any): void {
    if (zona.seleccionada) {
      if (!this.configuracion.zonas_ids.includes(zona.id)) {
        this.configuracion.zonas_ids.push(zona.id);
      }
    } else {
      this.configuracion.zonas_ids = this.configuracion.zonas_ids.filter(id => id !== zona.id);
    }
  }

  puedeGenerar(): boolean {
    return !!(this.configuracion.codigo_bodega && this.configuracion.id_lider && !this.generandoSugerencia);
  }

  onInventarioChange(): void {
    // Opcional: reiniciar configuración dependiente del inventario
    this.configuracion.zonas_ids = [];
  }

  generarSugerencia(): void {
    if (!this.inventarioSeleccionado) {
      Swal.fire('Validación', 'Debe seleccionar un inventario', 'warning');
      return;
    }
    this.generandoSugerencia = true;

    const payload: any = {
      inventario_id: this.inventarioSeleccionado,
      codigo_bodega: this.configuracion.codigo_bodega,
      tipo: this.configuracion.tipo,
      estrategia: this.configuracion.estrategia,
      agrupar_por_cercania: this.configuracion.agrupar_por_cercania,
      excluir_sin_zona: this.configuracion.excluir_sin_zona
    };

    if (this.configuracion.fecha_desde) payload.fecha_desde = this.configuracion.fecha_desde;
    if (this.configuracion.zonas_ids.length) payload.zonas_ids = this.configuracion.zonas_ids;
    if (this.configuracion.max_items) payload.max_items = this.configuracion.max_items;
    if (this.configuracion.max_valor_existencia) payload.max_valor_existencia = this.configuracion.max_valor_existencia;
    if (this.configuracion.umbral_existencia_minima) payload.umbral_existencia_minima = this.configuracion.umbral_existencia_minima;

    this.inventarioService.generarSugerenciaHoja(payload).subscribe({
      next: (res) => {
        const raw = res['data'] || [];

        // 🔍 VALIDACIÓN: si viene vacío, no avanzar al paso 2
        if (!raw.length) {
          Swal.fire(
            'Sin resultados',
            'Esta bodega no tiene ítems disponibles con las configuraciones seleccionadas.',
            'warning'
          );
          this.generandoSugerencia = false;
          return; // ⛔ DETIENE el flujo, no sigue al paso 2
        }

        // Normalizar items y zonas
        this.itemsSugeridos = raw.map((item: any) => {
          // normalizar valores numéricos
          const cantidad = parseFloat(item.cantidad) || 0;
          const costo_prom_unitario = parseFloat(item.costo_prom_unitario) || 0;
          const costo_prom_total = parseFloat(item.costo_prom_total) || 0;

          // normalizar zonas: puede venir como array, objeto indexado, colección, null...
          let zonasRaw: any[] = [];

          if (Array.isArray(item.zonas)) {
            zonasRaw = item.zonas;
          } else if (item.zonas && typeof item.zonas === 'object') {
            // objeto con keys numéricas o string -> convertir a array de valores
            zonasRaw = Object.values(item.zonas);
          } else {
            zonasRaw = [];
          }

          // mapear cada zona a la forma esperada { zona_id, zona_nombre }
          const zonas = zonasRaw.map((z: any) => {
            // si viene con zona_id/zona_nombre o id/nombre o como stdClass
            const zona_id = z.zona_id ?? z.id ?? z.zoneId ?? null;
            const zona_nombre = z.zona_nombre ?? z.nombre ?? z.name ?? null;
            return { zona_id, zona_nombre };
          }).filter(z => z.zona_id !== null); // opcional: filtrar sin id

          return {
            ...item,
            seleccionado: true,
            cantidad,
            costo_prom_unitario,
            costo_prom_total,
            zonas
          };
        });

        // asignar filtrados y metadatos
        this.itemsFiltrados = [...this.itemsSugeridos];
        this.metadatos = res['metadata'] || null;

        // recalcular estadisticas de zona (usa zona_nombre ahora)
        this.calcularEstadisticasZona();

        // avanzar UI
        this.paso = 2;

        // debug (temporal): ver en consola la estructura de un item
        console.log('itemsSugeridos[0]:', this.itemsSugeridos[0]);
      },error: (err) => Swal.fire('Error', err.error?.message || 'No se generó la sugerencia', 'error'),
      complete: () => this.generandoSugerencia = false
    });
  }

  calcularEstadisticasZona(): void {
    this.estadisticasZona = {};

    this.itemsSugeridos.forEach(item => {
      const zonas = (item.zonas && item.zonas.length > 0)
        ? item.zonas
        : [{ zona_nombre: 'Sin zona', zona_id: null }];

      zonas.forEach((z: any) => {
        const nombre = z.zona_nombre ?? z.nombre ?? 'Sin zona';
        if (!this.estadisticasZona[nombre]) {
          this.estadisticasZona[nombre] = { cantidad_items: 0, valor_total: 0 };
        }
        this.estadisticasZona[nombre].cantidad_items++;
        this.estadisticasZona[nombre].valor_total += item.costo_prom_total || 0;
      });
    });
  }

  get zonasAgrupadas(): any[] {
    if (!this.estadisticasZona || typeof this.estadisticasZona !== 'object') {
      return [];
    }
    console.log('estadisticasZona:', this.estadisticasZona);
    return Object.entries(this.estadisticasZona)
      .map(([zona, stats]: [string, any]) => ({
        nombre: zona,
        ...stats
      }))
      .sort((a, b) => b.cantidad_items - a.cantidad_items);
  }

  filtrarItems(): void {
    const b = this.busquedaItems.toLowerCase().trim();
    this.itemsFiltrados = !b ? [...this.itemsSugeridos] :
      this.itemsSugeridos.filter(i =>
        (i.id_item || '').toString().toLowerCase().includes(b) ||
        (i.referencia || '').toString().toLowerCase().includes(b) ||
        (i.descripcion || '').toString().toLowerCase().includes(b) ||
        (i.zonas || []).some((z: any) => (z.zona_nombre || '').toString().toLowerCase().includes(b))
      );
  }

  get todosSeleccionados(): boolean {
    return this.itemsFiltrados.length > 0 && this.itemsFiltrados.every(i => i.seleccionado);
  }

  toggleTodos(): void {
    const estado = !this.todosSeleccionados;
    this.itemsFiltrados.forEach(i => i.seleccionado = estado);
  }

  get itemsSeleccionados(): any[] {
    return this.itemsSugeridos.filter(i => i.seleccionado);
  }

  calcularTotalExistencias(): number {
    return this.itemsSeleccionados.reduce((s, i) => s + (parseFloat(i.cantidad) || 0), 0);
  }

  calcularTotalValor(): number {
    return this.itemsSeleccionados.reduce((s, i) => s + (parseFloat(i.costo_prom_total) || 0), 0);
  }

  confirmarCreacion(): void {
    const payload = {
      id_lider: this.configuracion.id_lider!,
      tipo: this.configuracion.tipo,
      items: this.itemsSeleccionados,
      observaciones: this.configuracion.observaciones || undefined,
      inventario_id: this.inventarioSeleccionado
    };

    this.creandoHoja = true;

    this.inventarioService.crearHojaConteo(payload).subscribe({
      next: (res) => {
        this.hojaCreada = res['data'];
        this.paso = 3;
        Swal.fire({
          icon: 'success',
          title: '¡Hoja creada!',
          text: `Código: ${this.hojaCreada.codigo_hoja}`,
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: () => Swal.fire('Error', 'No se pudo crear la hoja', 'error'),
      complete: () => this.creandoHoja = false
    });
  }

  volverAPaso1(): void {
    this.paso = 1;
    this.itemsSugeridos = [];
    this.itemsFiltrados = [];
    this.busquedaItems = '';
    this.metadatos = null;
    this.estadisticasZona = {};
  }

  volver(): void {
    this.router.navigate(['/hojas-conteo-list']);
  }

  verDetalle(): void {
    this.router.navigate(['/hojas-conteo-detalle', this.hojaCreada.id]);
  }

  crearOtra(): void {
    this.paso = 1;
    this.configuracion = {
      codigo_bodega: this.configuracion.codigo_bodega,
      id_lider: this.configuracion.id_lider,
      tipo: 'CONTEO',
      fecha_desde: null,
      zonas_ids: [],
      max_items: 50,
      max_valor_existencia: null,
      umbral_existencia_minima: null,
      agrupar_por_cercania: true,
      estrategia: 'balanceada',
      excluir_sin_zona: false,
      observaciones: ''
    };
    this.itemsSugeridos = [];
    this.itemsFiltrados = [];
    this.hojaCreada = null;
    this.metadatos = null;
    this.estadisticasZona = {};
  }

  // TrackBy functions para optimizar rendering
  trackByCodigoBodega(index: number, item: any): string {
    return item.codigo;
  }

  trackByIdLider(index: number, item: any): number {
    return item.id;
  }

  trackByItemId(index: number, item: any): string {
    return item.id_f400 || item.id_item || index.toString();
  }
}