import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { InventarioService } from 'src/app/services/inventario.service';
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
    private inventarioService: InventarioService,
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
        this.itemsHoja = (res['data'] || []).map((item: any) => {
          return {
            ...item,
            responsables: item.responsables ? JSON.parse(item.responsables) : [],
            estado: item.estado || 'PENDIENTE'
          };
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

    this.itemsFiltrados = filtered;
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
      usuario_id: this.authService.user.id
    };

    this.inventarioService.registrarConteoItem(this.hojaSeleccionada.id, this.itemActual.id, payload).subscribe({
      next: () => {
        const itemIndex = this.itemsHoja.findIndex(i => i.id === this.itemActual.id);
        if (itemIndex > -1) {
          this.itemsHoja[itemIndex].estado = 'CONTADO';
          this.itemsHoja[itemIndex].cantidad_contada = parseFloat(this.conteoForm.cantidad_contada);
          
          const responsablesNombres = this.conteoForm.responsables.map((idResp: number) => {
            const contador = this.contadoresAsignados.find(c => c.id_contador === idResp);
            return contador ? `${contador.nombre} ${contador.apellidos}` : '';
          });
          this.itemsHoja[itemIndex].responsables = responsablesNombres;
          this.hojaSeleccionada.items_contados = (this.hojaSeleccionada.items_contados || 0) + 1;
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
      responsables: item.responsables
    }));

    const payload = {
      items: itemsContados,
      usuario_id: this.authService.user.id
    };

    this.inventarioService.guardarProgresoConteo(this.hojaSeleccionada.id, payload).subscribe({
      next: () => {
        this.guardarProgresoLocal();
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
      items: this.itemsHoja,
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
            this.itemsHoja[itemIndex].estado = itemLocal.estado;
            this.itemsHoja[itemIndex].cantidad_contada = itemLocal.cantidad_contada;
            this.itemsHoja[itemIndex].responsables = itemLocal.responsables;
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