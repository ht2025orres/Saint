import { Component, OnInit, Inject } from '@angular/core';
import { InventarioService, Inventario } from 'src/app/services/inventario.service';
import { DOCUMENT } from '@angular/common';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-inventarios',
  templateUrl: './inventarios.component.html',
  styleUrls: ['./inventarios.component.css']
})
export class InventariosComponent implements OnInit {
  inventarios: Inventario[] = [];
  filtroTipo: 'general' | 'ciclico' | 'todos' = 'todos';
  loading = false;
  showModal = false;
  modalTitle = '';
  inventarioForm: any = { fecha_inicio: '', fecha_fin: '', descripcion: '', tipo: 'general' };
  selectedInventario: Inventario | null = null;
  detalleInventario: any = null; // para vista detalle
  hojas: any[] = [];
  loadingDetalle = false;
  showDetalleModal = false;

  hojaExpandidaId: number | null = null;
  itemsHojaExpandida: any[] = [];
  cargandoItemsHoja = false;

  constructor(
    private inventarioService: InventarioService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.cargarInventarios();
  }

  private loadTailwind(): void {
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
    this.document.head.appendChild(link);

    const icons = this.document.createElement('link');
    icons.rel = 'stylesheet';
    icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
    this.document.head.appendChild(icons);
  }

  cargarInventarios(): void {
    this.loading = true;
    const tipo = this.filtroTipo !== 'todos' ? this.filtroTipo : undefined;
    this.inventarioService.getInventarios(tipo).subscribe({
      next: (res) => {
        this.inventarios = res.data;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        Swal.fire('Error', 'No se pudieron cargar los inventarios', 'error');
      }
    });
  }

  abrirModalCrear(): void {
    this.modalTitle = 'Nuevo Inventario';
    this.inventarioForm = { fecha_inicio: '', fecha_fin: '', descripcion: '', tipo: 'general' };
    this.showModal = true;
  }

  abrirModalEditar(inventario: Inventario): void {
    this.modalTitle = 'Editar Inventario';
    this.inventarioForm = { 
      fecha_inicio: inventario.fecha_inicio, 
      fecha_fin: inventario.fecha_fin, 
      descripcion: inventario.descripcion,
      tipo: inventario.tipo 
    };
    this.selectedInventario = inventario;
    this.showModal = true;
  }

  cerrarModal(): void {
    this.showModal = false;
    this.selectedInventario = null;
  }

  guardarInventario(): void {
    if (!this.inventarioForm.fecha_inicio) {
      Swal.fire('Validación', 'La fecha de inicio es obligatoria', 'warning');
      return;
    }
    const request = this.selectedInventario
      ? this.inventarioService.actualizarInventario(this.selectedInventario.id, this.inventarioForm)
      : this.inventarioService.crearInventario(this.inventarioForm);

    (request as any).subscribe({
      next: (res: any) => {
        Swal.fire('Éxito', `Inventario ${this.selectedInventario ? 'actualizado' : 'creado'}`, 'success');
        this.cerrarModal();
        this.cargarInventarios();
      },
      error: (err: any) => {
        Swal.fire('Error', 'No se pudo guardar', 'error');
      }
    });
  }

  cerrarInventario(inventario: Inventario): void {
    Swal.fire({
      title: '¿Cerrar inventario?',
      text: `El inventario ${inventario.codigo} se marcará como cerrado.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, cerrar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.inventarioService.cerrarInventario(inventario.id).subscribe({
          next: () => {
            Swal.fire('Cerrado', 'Inventario cerrado correctamente', 'success');
            this.cargarInventarios();
          },
          error: () => Swal.fire('Error', 'No se pudo cerrar', 'error')
        });
      }
    });
  }

  verDetalle(inventario: Inventario): void {
    this.selectedInventario = inventario;
    this.loadingDetalle = true;
    this.showDetalleModal = true;
    // Cargar detalle del inventario y sus hojas
    this.inventarioService.getInventarioDetalle(inventario.id).subscribe({
      next: (res) => {
        this.detalleInventario = res.data;
        this.hojas = res.data.hojas_conteo || [];
        this.loadingDetalle = false;
      },
      error: (err) => {
        console.error(err);
        this.loadingDetalle = false;
        Swal.fire('Error', 'No se pudo cargar el detalle', 'error');
      }
    });
  }

  cerrarDetalle(): void {
    this.showDetalleModal = false;
    this.selectedInventario = null;
    this.detalleInventario = null;
    this.hojas = [];
  }

  // Método para alternar expansión de una hoja
  toggleHoja(hojaId: number): void {
    if (this.hojaExpandidaId === hojaId) {
      // Si ya está expandida, la cerramos
      this.hojaExpandidaId = null;
      this.itemsHojaExpandida = [];
    } else {
      // Expandimos la nueva hoja y cargamos sus items
      this.hojaExpandidaId = hojaId;
      this.cargarItemsHoja(hojaId);
    }
  }

  // Cargar items de una hoja (adaptado de tu método existente)
  cargarItemsHoja(idHoja: number): void {
    this.cargandoItemsHoja = true;
    this.inventarioService.obtenerItemsHoja(idHoja).subscribe({
      next: (res) => {
        const items = (res.data || []).map((item: any) => {
          const existencia = parseFloat(item.existencia_siesa || 0);
          const contada = parseFloat(item.cantidad_contada || 0);
          const costoUnit = parseFloat(item.costo_prom_unitario_siesa || 0);
          const costoTotal = parseFloat(item.costo_prom_total_siesa || 0);
          const diferenciaUnidades = existencia - contada;
          const diferenciaCosto = Math.abs(diferenciaUnidades * costoUnit);

          return {
            ...item,
            diferencia_unidades: diferenciaUnidades,
            diferencia_costo: diferenciaCosto,
            costo_total: costoTotal
          };
        });
        this.itemsHojaExpandida = items;
      },
      error: (err) => {
        console.error(err);
        Swal.fire('Error', 'No se pudieron cargar los items de la hoja', 'error');
      },
      complete: () => {
        this.cargandoItemsHoja = false;
      }
    });
  }
}