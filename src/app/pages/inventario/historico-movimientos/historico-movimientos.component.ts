import { Component, OnInit } from '@angular/core';
import { InventarioService } from 'src/app/services/inventario.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-historico-movimientos',
  templateUrl: './historico-movimientos.component.html'
})
export class HistoricoMovimientosComponent implements OnInit {
  historico: any[] = [];
  loading = false;
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;

  filtros = {
    id_inventario: null as number | null,
    id_usuario: null as number | null,
    tipo_movimiento: ''
  };

  tiposMovimiento = [
    { value: '', label: 'Todos' },
    { value: 'creacion_zona', label: 'Creación de Zona' },
    { value: 'creacion_inventario', label: 'Creación de Inventario' },
    { value: 'cambio_estado_inventario', label: 'Cambio de Estado' },
    { value: 'creacion_asignacion', label: 'Creación de Asignación' },
    { value: 'actualizacion_asignacion', label: 'Actualización de Asignación' },
    { value: 'eliminacion_asignacion', label: 'Eliminación de Asignación' },
    { value: 'registro_conteo', label: 'Registro de Conteo' },
    { value: 'actualizacion_conteo', label: 'Actualización de Conteo' },
    { value: 'validacion_conteo', label: 'Validación de Conteo' }
  ];

  inventarios: any[] = [];
  usuarios: any[] = [];

  constructor(private inventarioService: InventarioService) { }

  ngOnInit(): void {
    this.cargarHistorico();
    this.cargarFiltros();
  }

  cargarHistorico(page: number = 1): void {
    this.loading = true;
    this.currentPage = page;
    // Build params avoiding null values for optional numeric fields
    const params: { id_inventario?: number; id_usuario?: number; tipo_movimiento?: string; page?: number } = { page: this.currentPage };
    if (this.filtros.id_inventario != null) params.id_inventario = this.filtros.id_inventario;
    if (this.filtros.id_usuario != null) params.id_usuario = this.filtros.id_usuario;
    if (this.filtros.tipo_movimiento) params.tipo_movimiento = this.filtros.tipo_movimiento;

    this.inventarioService.getHistoricoMovimientos(params).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.historico = resp.data.data;
          this.totalPages = resp.data.last_page;
          this.totalItems = resp.data.total;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        Swal.fire('Error', 'No se pudo cargar el histórico', 'error');
        this.loading = false;
      }
    });
  }

  cargarFiltros(): void {
    this.inventarioService.getInventarios().subscribe(resp => {
      if (resp.success) this.inventarios = resp.data;
    });

    this.inventarioService.getContadores().subscribe(resp => {
      if (resp.success) this.usuarios = resp.data;
    });
  }

  limpiarFiltros(): void {
    this.filtros = {
      id_inventario: null,
      id_usuario: null,
      tipo_movimiento: ''
    };
    this.cargarHistorico(1);
  }

  getBadgeClass(tipo: string): string {
    switch (tipo) {
      case 'creacion_zona':
      case 'creacion_inventario':
      case 'creacion_asignacion':
        return 'badge-success';
      case 'actualizacion_asignacion':
      case 'actualizacion_conteo':
      case 'cambio_estado_inventario':
        return 'badge-info';
      case 'registro_conteo':
      case 'validacion_conteo':
        return 'badge-primary';
      case 'eliminacion_asignacion':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  formatTipo(tipo: string): string {
    return tipo.replace(/_/g, ' ').toUpperCase();
  }

  cambiarPagina(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.cargarHistorico(page);
    }
  }

  verMetadata(mov: any): void {
    const metaStr = JSON.stringify(mov.metadata, null, 2);
    Swal.fire({
      title: 'Detalles del Movimiento',
      html: `<pre style="text-align: left; background: #f4f4f4; padding: 10px; border-radius: 5px; font-size: 12px; max-height: 400px; overflow-y: auto;">${metaStr}</pre>`,
      icon: 'info',
      confirmButtonText: 'Cerrar'
    });
  }
}
