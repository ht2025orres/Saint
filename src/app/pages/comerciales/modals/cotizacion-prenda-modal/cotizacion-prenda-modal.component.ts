import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { ComercialService } from '../../../../services/comercial.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cotizacion-prenda-modal',
  templateUrl: './cotizacion-prenda-modal.component.html',
  styleUrls: ['./cotizacion-prenda-modal.component.css']
})
export class CotizacionPrendaModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() item: any = null;
  @Input() costeo: any = null;
  @Input() trackingMateriales: any[] = [];

  @Output() onClose = new EventEmitter<void>();
  @Output() onSnapshotGuardado = new EventEmitter<any>();

  isLoadingHistorial = false;
  isSavingSnapshot = false;
  historialCotizacionesPrenda: any[] = [];
  historialOtrasSolicitudes: any[] = [];
  selectedSnapshotDetalle: any = null;

  constructor(private comercialService: ComercialService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible && this.item) {
      this.selectedSnapshotDetalle = null;
      this.cargarHistorialPrenda(this.item.id);
    }
  }

  cargarHistorialPrenda(itemId: number): void {
    if (!itemId) return;
    this.isLoadingHistorial = true;
    this.comercialService.listarCotizacionesPrenda(itemId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.historialCotizacionesPrenda = res.data.cotizaciones_esta_solicitud || [];
          this.historialOtrasSolicitudes = res.data.cotizaciones_otras_solicitudes || [];
        } else {
          this.historialCotizacionesPrenda = [];
          this.historialOtrasSolicitudes = [];
        }
        this.isLoadingHistorial = false;
      },
      error: (err) => {
        console.error('Error cargando historial de cotizaciones:', err);
        this.isLoadingHistorial = false;
      }
    });
  }

  guardarSnapshotPrenda(): void {
    if (!this.item || !this.item.id) return;

    Swal.fire({
      title: 'Capturar Versión de Insumos',
      text: `¿Deseas registrar un snapshot con los insumos y costos actuales para "${this.item.descripcion}"?`,
      icon: 'question',
      input: 'text',
      inputPlaceholder: 'Notas u observaciones de esta versión (opcional)',
      showCancelButton: true,
      confirmButtonText: 'Guardar Versión',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSavingSnapshot = true;
        const notas = (result.value || '').trim();

        this.comercialService.guardarCotizacionPrenda(this.item.id, { notas }).subscribe({
          next: (res) => {
            this.isSavingSnapshot = false;
            if (res.success) {
              Swal.fire({
                title: 'Versión Guardada',
                text: `Se registró la Versión ${res.data?.version || ''} exitosamente.`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
              });
              this.cargarHistorialPrenda(this.item.id);
              this.onSnapshotGuardado.emit(res.data);
            }
          },
          error: (err) => {
            this.isSavingSnapshot = false;
            console.error('Error al guardar snapshot:', err);
            Swal.fire('Error', err.error?.message || 'No se pudo guardar la versión de cotización.', 'error');
          }
        });
      }
    });
  }

  verDetalleSnapshot(c: any): void {
    if (this.selectedSnapshotDetalle?.id === c.id) {
      this.selectedSnapshotDetalle = null;
    } else {
      this.selectedSnapshotDetalle = c;
    }
  }

  getItemTotal(item: any): number {
    if (!item?.tallas || item.tallas.length === 0) {
      return item?.cantidad_muestra || 1;
    }
    const sum = item.tallas.reduce((acc: number, t: any) => acc + (t.cantidad || 0), 0);
    return sum > 0 ? sum : (item.cantidad_muestra || 1);
  }

  getMaterialesItem(itemId?: number): any[] {
    if (!this.trackingMateriales || this.trackingMateriales.length === 0) return [];
    return this.trackingMateriales.filter((m: any) => m.solicitud_item_id === itemId);
  }

  getCostoTotalInsumo(m: any): number {
    const cant = m.cantidad_requerida || 0;
    const costo = m.costo_vigente_final || m.costo_vigente_logistica || m.ultimo_costo_siesa || 0;
    return cant * costo;
  }

  getTotalCostoInsumosItem(itemId: number): number {
    const mats = this.getMaterialesItem(itemId);
    return mats.reduce((acc, m) => acc + this.getCostoTotalInsumo(m), 0);
  }

  getCostoUnitarioInsumosPorPrenda(itemId: number): number {
    const totalLote = this.getTotalCostoInsumosItem(itemId);
    const item = this.item;
    const cantPrendas = item ? this.getItemTotal(item) : 1;
    return cantPrendas > 0 ? totalLote / cantPrendas : 0;
  }

  cerrar(): void {
    this.onClose.emit();
  }
}
