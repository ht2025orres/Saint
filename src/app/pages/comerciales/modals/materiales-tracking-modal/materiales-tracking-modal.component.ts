import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { ComercialService } from '../../../../services/comercial.service';

@Component({
  selector: 'app-materiales-tracking-modal',
  templateUrl: './materiales-tracking-modal.component.html',
  styleUrls: ['./materiales-tracking-modal.component.css']
})
export class MaterialesTrackingModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() solicitudId: number | null = null;
  @Input() solicitudCodigo = '';
  @Input() clienteNombre = '';
  @Input() filtroInicial: 'TODOS' | 'TELA' | 'INSUMO' | 'PENDIENTES' | 'ENTREGADOS' = 'TODOS';

  @Output() onClose = new EventEmitter<void>();

  isLoading = false;
  errorMessage = '';
  materialesData: any = null;
  filtroTipo: 'TODOS' | 'TELA' | 'INSUMO' | 'PENDIENTES' | 'ENTREGADOS' = 'TODOS';

  constructor(private comercialService: ComercialService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filtroInicial'] && this.filtroInicial) {
      this.filtroTipo = this.filtroInicial;
    }
    if (changes['visible'] && this.visible) {
      if (this.filtroInicial) {
        this.filtroTipo = this.filtroInicial;
      }
      if (this.solicitudId) {
        this.cargarMateriales();
      }
    }
  }

  cargarMateriales(): void {
    if (!this.solicitudId) return;
    this.isLoading = true;
    this.errorMessage = '';

    this.comercialService.listarMaterialesSolicitud(this.solicitudId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.materialesData = res.data;
        } else {
          this.materialesData = null;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando materiales:', err);
        this.errorMessage = 'No se pudieron cargar los materiales de la solicitud.';
        this.isLoading = false;
      }
    });
  }

  get conteoTelas(): number {
    return (this.materialesData?.materiales || []).filter((m: any) => m.tipo_material === 'TELA').length;
  }

  get conteoInsumos(): number {
    return (this.materialesData?.materiales || []).filter((m: any) => m.tipo_material !== 'TELA').length;
  }

  get metricas(): any {
    return this.materialesData?.metricas || {
      total: 0,
      entregados: 0,
      parciales: 0,
      pendientes: 0,
      porcentaje_entrega: 0
    };
  }

  get materiales(): any[] {
    const list = this.materialesData?.materiales || [];
    if (this.filtroTipo === 'TELA') {
      return list.filter((m: any) => m.tipo_material === 'TELA');
    }
    if (this.filtroTipo === 'INSUMO') {
      return list.filter((m: any) => m.tipo_material !== 'TELA');
    }
    if (this.filtroTipo === 'PENDIENTES') {
      return list.filter((m: any) => m.estado_entrega === 'PENDIENTE' || m.estado_entrega === 'PARCIAL');
    }
    if (this.filtroTipo === 'ENTREGADOS') {
      return list.filter((m: any) => m.estado_entrega === 'ENTREGADO');
    }
    return list;
  }

  esLlegadaRetrasada(fecha?: string): boolean {
    if (!fecha) return false;
    const llegada = new Date(fecha);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return llegada < hoy;
  }

  trackById(index: number, item: any): number {
    return item.id;
  }

  cerrar(): void {
    this.onClose.emit();
  }
}

