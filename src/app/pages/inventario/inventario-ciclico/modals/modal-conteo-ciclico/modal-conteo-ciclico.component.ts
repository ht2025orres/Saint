import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { InventarioService, ItemBodega } from 'src/app/services/inventario.service';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-conteo-ciclico',
  templateUrl: './modal-conteo-ciclico.component.html'
})
export class ModalConteoCiclicoComponent implements OnChanges {
  @Input() show = false;
  @Input() item: ItemBodega | null = null;
  @Input() bodega: string = '';
  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardado = new EventEmitter<void>();

  cantidadFisica: number | null = null;
  justificacion: string = '';
  guardando = false;

  // Movimientos detallados
  movimientos: any[] = [];
  cargandoMovimientos = false;
  pageMovimientos = 1;
  hasMoreMovimientos = false;

  constructor(
    private inventarioService: InventarioService,
    private authService: AuthService
  ) {}

  ngOnChanges() {
    if (this.show && this.item) {
      this.resetForm();
      this.cargarMovimientos(1);
    }
  }

  resetForm() {
    this.cantidadFisica = null;
    this.justificacion = '';
    this.movimientos = [];
    this.pageMovimientos = 1;
    this.hasMoreMovimientos = false;
  }

  cargarMovimientos(page: number = 1) {
    if (!this.item) return;
    
    this.cargandoMovimientos = true;
    this.inventarioService.getItemMovimientosDetallados(this.item.id_f400.toString(), this.bodega, page).subscribe({
      next: (resp) => {
        if (resp.success) {
          if (page === 1) {
            this.movimientos = resp.data.data;
          } else {
            this.movimientos = [...this.movimientos, ...resp.data.data];
          }
          this.pageMovimientos = resp.data.current_page;
          this.hasMoreMovimientos = resp.data.current_page < resp.data.last_page;
        }
        this.cargandoMovimientos = false;
      },
      error: () => {
        this.cargandoMovimientos = false;
      }
    });
  }

  cargarMasMovimientos() {
    if (this.hasMoreMovimientos) {
      this.cargarMovimientos(this.pageMovimientos + 1);
    }
  }

  cerrar() {
    this.onCerrar.emit();
  }

  guardar() {
    if (this.cantidadFisica === null || this.cantidadFisica === undefined) {
      Swal.fire('Atención', 'La cantidad física es obligatoria', 'warning');
      return;
    }

    this.guardando = true;
    const payload = {
      id_item_siesa: this.item.id_item,
      id_f400: this.item.id_f400, // Añadir id_f400 al payload
      referencia: this.item.referencia,
      descripcion: this.item.descripcion,
      id_talla: this.item.id_talla,
      id_color: this.item.id_color,
      cantidad_fisica: this.cantidadFisica,
      cantidad_siesa: this.item.cantidad,
      valor_unitario: this.item.costo_prom_unitario,
      bodega: this.bodega,
      id_usuario: this.authService.user.id || 0,
      justificacion: this.justificacion
    };

    this.inventarioService.storeCiclico(payload).subscribe({
      next: (resp) => {
        if (resp.success) {
          Swal.fire('Éxito', 'Conteo cíclico registrado', 'success');
          this.onGuardado.emit();
          this.cerrar();
        }
        this.guardando = false;
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo guardar', 'error');
        this.guardando = false;
      }
    });
  }

  get diferencia() {
    if (this.cantidadFisica === null) return 0;
    return this.cantidadFisica - (this.item?.cantidad || 0);
  }

  get diferenciaPrecio(): number {
    return this.diferencia * (this.item?.costo_prom_unitario || 0);
  }

  formatFecha(fechaId: any): string {
    if (!fechaId) return '';
    const f = fechaId.toString();
    if (f.length !== 8) return f;
    const anio = f.substring(0, 4);
    const mes = f.substring(4, 6);
    const dia = f.substring(6, 8);
    return `${dia}/${mes}/${anio}`;
  }

  getItemZonas(item: ItemBodega | null): string {
    if (!item || !item.zonas || item.zonas.length === 0) {
      return 'N/A';
    }
    return item.zonas.map(zona => zona.nombre).join(', ');
  }
}
