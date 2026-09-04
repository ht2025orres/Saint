import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { ProyectoFinanciero, SeguimientoProyectosService, MovimientoProyectoDetalle } from 'src/app/services/seguimiento-proyectos.service';

export interface DocumentoAgrupado {
  key: string;
  tipo_docto: string;
  consec_docto: string;
  fecha: string;
  total_valor_neto: number;
  total_costo_real: number;
  total_cantidad: number;
  tiene_comision: boolean;
  items: MovimientoProyectoDetalle[];
  expanded: boolean;
}

@Component({
  selector: 'app-modal-detalle-proyecto',
  templateUrl: './modal-detalle-proyecto.component.html'
})
export class ModalDetalleProyectoComponent implements OnInit {
  @Input() proyecto: ProyectoFinanciero | null = null;
  @Input() puedeEditar = false;
  @Output() cerrar = new EventEmitter<void>();
  @Output() editarNota = new EventEmitter<ProyectoFinanciero>();

  loadingDetalle = false;
  movimientos: MovimientoProyectoDetalle[] = [];
  documentosAgrupados: DocumentoAgrupado[] = [];

  constructor(private spService: SeguimientoProyectosService) {}

  onEditarNota(): void {
    if (this.proyecto) {
      this.editarNota.emit(this.proyecto);
    }
  }

  ngOnInit(): void {
    if (this.proyecto && this.proyecto.codigo_proyecto) {
      this.cargarDetalleMovimientos();
    }
  }

  cargarDetalleMovimientos(): void {
    this.loadingDetalle = true;
    this.spService.getDetalleProyecto(this.proyecto!.codigo_proyecto).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.movimientos = resp.data;
          this.agruparPorDocumento();
        }
        this.loadingDetalle = false;
      },
      error: (err) => {
        console.error('Error al cargar detalle de movimientos de Siesa:', err);
        this.loadingDetalle = false;
      }
    });
  }

  agruparPorDocumento(): void {
    const mapa = new Map<string, DocumentoAgrupado>();

    for (const m of this.movimientos) {
      const key = `${m.tipo_docto}-${m.consec_docto}`;
      if (!mapa.has(key)) {
        mapa.set(key, {
          key,
          tipo_docto: m.tipo_docto,
          consec_docto: m.consec_docto,
          fecha: m.fecha,
          total_valor_neto: 0,
          total_costo_real: 0,
          total_cantidad: 0,
          tiene_comision: false,
          items: [],
          expanded: false
        });
      }
      const grupo = mapa.get(key)!;
      grupo.total_valor_neto += m.valor_neto || 0;
      grupo.total_costo_real += m.costo_real || 0;
      grupo.total_cantidad += m.cantidad || 0;
      if (m.es_comision) {
        grupo.tiene_comision = true;
      }
      grupo.items.push(m);
    }

    this.documentosAgrupados = Array.from(mapa.values()).sort((a, b) => {
      return b.fecha.localeCompare(a.fecha);
    });
  }

  toggleDocumento(doc: DocumentoAgrupado): void {
    doc.expanded = !doc.expanded;
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  formatCurrency(val: number | undefined): string {
    if (val === undefined || val === null) return '$ 0';
    return '$ ' + Math.round(val).toLocaleString('es-CO');
  }

  formatPercent(val: number | undefined): string {
    if (val === undefined || val === null) return '0%';
    return Math.round(val) + '%';
  }
}
