import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { InventarioOldService } from 'src/app/services/inventario-old.service';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-contador-items',
  templateUrl: './contador-items.component.html',
  styleUrls: ['./contador-items.component.css']
})
export class ContadorItemsComponent implements OnInit {
  
  isLoading = false;
  procesando = false;
  
  // Lista de hojas
  hojas: any[] = [];
  hojasFiltradas: any[] = [];
  
  // Registro de conteo
  hojaSeleccionada: any = null;
  itemsHoja: any[] = [];
  itemsFiltrados: any[] = [];
  contadoresAsignados: any[] = [];
  
  // Filtros
  filtros = {
    tipo: null as string | null,
    estado: null as string | null,
    busqueda: ''
  };

  busqueda = '';
  filtroEstado = '';
  
  // Modal
  modalConteo = false;
  itemActual: any = null;
  
  conteoForm = {
    responsables: [],
    cantidad_contada: null
  };

  constructor(
    private router: Router,
    private inventarioService: InventarioOldService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarHojasDelLider();
  }

  cargarHojasDelLider(): void {
    this.isLoading = true;

    this.inventarioService.obtenerHojasDelLider().subscribe({
      next: (res) => {
        this.hojas = res['data'] || [];
        
        // 🔍 eliminar duplicados por codigo_hoja
        this.hojas = (res['data'] || []).map(hoja => ({
          ...hoja,
          bodegas: Array.isArray(hoja.bodegas)
            ? hoja.bodegas
            : JSON.parse(hoja.bodegas ?? '[]')
        }));

        this.hojasFiltradas = [...this.hojas];
        console.log('Hojas cargadas:', this.hojas);
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar las hojas', 'error');
        this.isLoading = false;
      }
    });
  }

  aplicarFiltros(): void {
    let filtered = [...this.hojas];

    if (this.filtros.tipo) {
      filtered = filtered.filter(h => h.tipo === this.filtros.tipo);
    }

    if (this.filtros.estado) {
      filtered = filtered.filter(h => h.estado === this.filtros.estado);
    }

    if (this.filtros.busqueda.trim()) {
      const term = this.filtros.busqueda.toLowerCase();
      filtered = filtered.filter(h =>
        (h.codigo_hoja || '').toLowerCase().includes(term)
      );
    }

    this.hojasFiltradas = filtered;
  }

  calcularProgresoHoja(hoja: any): number {
    if (!hoja.total_items || hoja.total_items === 0) return 0;
    return (hoja.items_contados / hoja.total_items) * 100;
  }

  abrirRegistroConteo(hoja: any): void {
    if (hoja.estado === 'FINALIZADO' || hoja.estado === 'BORRADOR') {
      Swal.fire('Atención', 'No se puede hacer conteo en este estado', 'warning');
      return;
    }

    this.hojaSeleccionada = hoja;
    this.cargarItemsHoja();
  }

  cargarItemsHoja(): void {
    this.isLoading = true;

    this.inventarioService.obtenerDetalleHoja(this.hojaSeleccionada.id).subscribe({
      next: (res) => {
        if (res['success']) {
          console.log('Contadores desde el backend:', res['data'].contadores);
          this.contadoresAsignados = res['data'].contadores || [];
          this.cargarItems();
        }
      },
      error: () => {
        Swal.fire('Error', 'Error al cargar datos', 'error');
        this.isLoading = false;
      }
    });
  }

  cargarItems(): void {
    this.inventarioService.obtenerItemsHoja(this.hojaSeleccionada.id).subscribe({
      next: (res) => {
        this.itemsHoja = (res['data'] || [])
          .map((item: any) => {
            let ids: number[] = [];
            const raw = item.responsables;
            if (Array.isArray(raw)) {
              if (raw.length > 0 && typeof raw[0] === 'object') {
                ids = raw.map(r => r.id).filter(id => id != null);
              } else {
                ids = raw.filter(id => typeof id === 'number');
              }
            } else if (typeof raw === 'string') {
              try {
                const parsed = JSON.parse(raw);
                ids = Array.isArray(parsed) ? parsed : [];
              } catch {
                ids = [];
              }
            }
            return {
              ...item,
              responsables: ids,
              estado: item.estado || 'PENDIENTE'
            };
          })
          // Ordenar los items por zona
          .sort((a, b) => {
            const zonaA = a.zona_nombre || '';
            const zonaB = b.zona_nombre || '';
            return this.compararZonas(zonaA, zonaB);
          });
        
        this.itemsFiltrados = [...this.itemsHoja];
        this.cargarProgresoLocal();
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los items', 'error');
        this.isLoading = false;
      }
    });
  }

  filtrarItems(): void {
    let filtered = [...this.itemsHoja];

    if (this.busqueda.trim()) {
      const term = this.busqueda.toLowerCase();
      filtered = filtered.filter(item =>
        (item.codigo_item || '').toLowerCase().includes(term) ||
        (item.descripcion || '').toLowerCase().includes(term) ||
        (item.zona_nombre || '').toLowerCase().includes(term)
      );
    }

    if (this.filtroEstado) {
      filtered = filtered.filter(item => item.estado === this.filtroEstado);
    }

    // Importante: mantener el orden original (por zona)
    this.itemsFiltrados = filtered;
  }

  // Función para extraer partes de un nombre de zona
  private parsearNombreZona(zona: string): { texto: string; numero: number } {
    // Busca patrones como "Zona A", "Zona 1", "Canasta 2", etc.
    const match = zona.match(/^([A-Za-záéíóúÁÉÍÓÚ\s]+?)\s*([0-9]+|[A-Za-z])?$/);
    
    if (match) {
      const texto = match[1].trim().toLowerCase();
      const identificador = match[2];
      
      // Si el identificador es un número
      if (identificador && !isNaN(Number(identificador))) {
        return { texto, numero: Number(identificador) };
      }
      // Si el identificador es una letra, convertir a número (A=1, B=2, etc.)
      else if (identificador && identificador.length === 1 && isNaN(Number(identificador))) {
        return { texto, numero: identificador.toUpperCase().charCodeAt(0) - 64 };
      }
    }
    
    // Si no hay patrón claro, devolver el texto completo y número 0
    return { texto: zona.toLowerCase(), numero: 0 };
  }

  // Función de comparación para ordenar zonas
  private compararZonas(a: string, b: string): number {
    const zonaA = this.parsearNombreZona(a);
    const zonaB = this.parsearNombreZona(b);
    
    // Primero ordenar por texto (Zona, Canasta, etc.)
    if (zonaA.texto < zonaB.texto) return -1;
    if (zonaA.texto > zonaB.texto) return 1;
    
    // Si el texto es igual, ordenar por número/letra
    return zonaA.numero - zonaB.numero;
  }

  formatearResponsables(item: any): string {
    let ids: number[] = [];

    // 1. Extraer IDs del campo responsables (maneja varios formatos)
    const raw = item.responsables;
    if (Array.isArray(raw)) {
      if (raw.length > 0 && typeof raw[0] === 'object') {
        ids = raw.map(r => r.id).filter(id => id != null);
      } else {
        ids = raw.filter(id => typeof id === 'number');
      }
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        ids = Array.isArray(parsed) ? parsed : [];
      } catch {
        ids = [];
      }
    }

    if (ids.length === 0) return '-';

    // 2. Convertir IDs a nombres usando la lista de contadores
    const nombres = ids
      .map(id => {
        const contador = this.contadoresAsignados.find(c => c.id_contador === id);
        if (contador) {
          const nombre = contador.nombres || contador.nombre || '';
          const apellido = contador.apellidos || contador.apellido || '';
          return `${nombre} ${apellido}`.trim();
        }
        return '';
      })
      .filter(n => n !== '');

    return nombres.length > 0 ? nombres.join(', ') : '-';
  }

  abrirModalConteo(item: any): void {
    if (item.estado === 'CONTADO') {
      Swal.fire('Atención', 'Este item ya fue contado', 'warning');
      return;
    }

    this.itemActual = item;
    this.conteoForm = {
      responsables: [],
      cantidad_contada: null
    };
    this.modalConteo = true;
  }

  cerrarModalConteo(): void {
    this.modalConteo = false;
    this.itemActual = null;
    this.conteoForm = {
      responsables: [],
      cantidad_contada: null
    };
  }

  puedeGuardarConteo(): boolean {
    return (
      this.conteoForm.responsables &&
      this.conteoForm.responsables.length > 0 &&
      this.conteoForm.cantidad_contada !== null &&
      this.conteoForm.cantidad_contada !== '' &&
      this.conteoForm.cantidad_contada > 0
    );
  }

  toggleResponsable(id: number, checked: boolean): void {
    if (!this.conteoForm.responsables) {
      this.conteoForm.responsables = [];
    }

    if (checked) {
      if (!this.conteoForm.responsables.includes(id)) {
        this.conteoForm.responsables.push(id);
      }
    } else {
      this.conteoForm.responsables = this.conteoForm.responsables.filter(r => r !== id);
    }
  }

  confirmarConteo(): void {
    if (!this.puedeGuardarConteo()) {
      Swal.fire('Atención', 'Complete todos los campos requeridos', 'warning');
      return;
    }

    this.procesando = true;

    const payload = {
      cantidad_contada: parseFloat(this.conteoForm.cantidad_contada),
      responsables: this.conteoForm.responsables,
      usuario_id: this.authService.user.id,
      existencia_siesa: this.itemActual.existencia_siesa,
      costo_prom_unitario_siesa: this.itemActual.costo_prom_unitario_siesa
    };

    this.inventarioService.registrarConteoItem(this.hojaSeleccionada.id, this.itemActual.id, payload).subscribe({
      next: () => {
        const itemIndex = this.itemsHoja.findIndex(i => i.id === this.itemActual.id);
        if (itemIndex > -1) {
          this.itemsHoja[itemIndex].estado = 'CONTADO';
          this.itemsHoja[itemIndex].cantidad_contada = parseFloat(this.conteoForm.cantidad_contada);
          this.itemsHoja[itemIndex].responsables = this.conteoForm.responsables;
          
          // Actualizar hojaSeleccionada
          this.hojaSeleccionada.items_contados = (this.hojaSeleccionada.items_contados || 0) + 1;

          // Sincronizar con la hoja en la lista (this.hojas)
          const hojaEnLista = this.hojas.find(h => h.id === this.hojaSeleccionada.id);
          if (hojaEnLista) {
            hojaEnLista.items_contados = (hojaEnLista.items_contados || 0) + 1;
            // También podrías actualizar la lista filtrada si es necesario
            const hojaFiltrada = this.hojasFiltradas.find(h => h.id === this.hojaSeleccionada.id);
            if (hojaFiltrada) hojaFiltrada.items_contados = hojaEnLista.items_contados;
          }
        }

        this.guardarProgresoLocal();
        this.filtrarItems();
        this.cerrarModalConteo();

        Swal.fire({
          icon: 'success',
          title: 'Conteo registrado',
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo guardar el conteo', 'error');
      },
      complete: () => {
        this.procesando = false;
      }
    });
  }

  guardarProgreso(): void {
    this.procesando = true;

    const itemsContados = this.itemsHoja.filter(i => i.estado === 'CONTADO').map(item => ({
      id_item: item.id,
      cantidad_contada: item.cantidad_contada,
      existencia_siesa: item.existencia_siesa,
      costo_prom_unitario_siesa: item.costo_prom_unitario_siesa,
      responsables: item.responsables
    }));

    const payload = {
      items: itemsContados,
      usuario_id: this.authService.user.id
    };

    this.inventarioService.guardarProgresoConteo(this.hojaSeleccionada.id, payload).subscribe({
      next: () => {
        this.guardarProgresoLocal();
        const nuevosContados = this.itemsHoja.filter(i => i.estado === 'CONTADO').length;
        this.hojaSeleccionada.items_contados = nuevosContados;
        
        const hojaEnLista = this.hojas.find(h => h.id === this.hojaSeleccionada.id);
        if (hojaEnLista) {
          hojaEnLista.items_contados = nuevosContados;
        }
        Swal.fire({
          icon: 'success',
          title: 'Progreso guardado',
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo guardar el progreso', 'error');
      },
      complete: () => {
        this.procesando = false;
      }
    });
  }

  guardarProgresoLocal(): void {
    const progreso = {
      hojaId: this.hojaSeleccionada.id,
      items: this.itemsHoja, // ya contiene responsables como array de IDs
      timestamp: new Date().getTime()
    };
    localStorage.setItem(`conteo_hoja_${this.hojaSeleccionada.id}`, JSON.stringify(progreso));
  }

  cargarProgresoLocal(): void {
    const stored = localStorage.getItem(`conteo_hoja_${this.hojaSeleccionada.id}`);
    if (stored) {
      try {
        const progreso = JSON.parse(stored);
        progreso.items.forEach((itemLocal: any) => {
          const itemIndex = this.itemsHoja.findIndex(i => i.id === itemLocal.id);
          if (itemIndex > -1) {
            this.itemsHoja[itemIndex].cantidad_contada = itemLocal.cantidad_contada;
            this.itemsHoja[itemIndex].responsables = itemLocal.responsables; // array de IDs
          }
        });
        this.filtrarItems();
      } catch (e) {
        console.error('Error al cargar progreso local', e);
      }
    }
  }

  volverALista(): void {
    this.hojaSeleccionada = null;
    this.itemsHoja = [];
    this.itemsFiltrados = [];
    this.busqueda = '';
    this.filtroEstado = '';
  }

  get itemsContados(): number {
    return this.itemsHoja.filter(i => i.estado === 'CONTADO').length;
  }

  getEstadoItemLabel(estado: string): string {
    // Si es cualquier tipo de reconteo, mostrar "CONTADO"
    if (estado === 'RECONTEO') {
      return 'CONTADO';
    }
    // Para los demás estados, mostrar el estado original
    return estado;
  }

  calcularProgreso(): number {
    if (this.itemsHoja.length === 0) return 0;
    return (this.itemsContados / this.itemsHoja.length) * 100;
  }

  getEstadoLabel(estado: string): string {
    const labels: any = {
      'BORRADOR': 'Borrador',
      'PENDIENTE': 'Pendiente',
      'EN_PROCESO': 'En Proceso',
      'FINALIZADO': 'Finalizado'
    };
    return labels[estado] || estado;
  }

  getTipoLabel(tipo: string): string {
    const labels: any = {
      'CONTEO': 'Conteo',
      'RECONTEO1': 'Reconteo 1',
      'RECONTEO2': 'Reconteo 2',
      'RECONTEO3': 'Reconteo 3'
    };
    return labels[tipo] || tipo;
  }
}