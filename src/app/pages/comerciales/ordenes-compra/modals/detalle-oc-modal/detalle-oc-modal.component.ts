import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-detalle-oc-modal',
  templateUrl: './detalle-oc-modal.component.html',
  styleUrls: ['./detalle-oc-modal.component.css']
})
export class DetalleOcModalComponent {
  @Input() visible: boolean = false;
  @Input() orden: any = null;
  @Input() itemsOrden: any[] = [];
  @Input() itemsSiesa: any[] = [];
  @Input() isLoading: boolean = false;

  @Output() onClose = new EventEmitter<void>();
  @Output() onVerDocumento = new EventEmitter<any>();
  @Output() onDesvincularPV = new EventEmitter<any>();

  close(): void {
    this.onClose.emit();
  }

  verDocumento(): void {
    this.onVerDocumento.emit(this.orden);
  }

  desvincularPV(): void {
    this.onDesvincularPV.emit(this.orden);
  }

  getTotalCantidadSiesa(): number {
    return (this.itemsSiesa || []).reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);
  }

  getTotalValorSiesa(): number {
    return (this.itemsSiesa || []).reduce((acc, item) => acc + (Number(item.valor_total) || 0), 0);
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'PENDIENTE': return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'PROCESADA': return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
      case 'RECHAZADA': return 'bg-rose-100 text-rose-800 border border-rose-300';
      default: return 'bg-slate-100 text-slate-700 border border-slate-300';
    }
  }

  getEstadoTexto(estado: string): string {
    switch (estado) {
      case 'PENDIENTE': return 'Pendiente';
      case 'PROCESADA': return 'Procesada';
      case 'RECHAZADA': return 'Rechazada';
      default: return estado || 'Desconocido';
    }
  }

  calcularPlazoPactado(inicio: any, fin: any, diasBD?: any): string {
    if (diasBD && Number(diasBD) > 0) {
      return `${diasBD} días`;
    }
    if (!inicio || !fin) return 'No especificado';
    const dInicio = new Date(inicio);
    const dFin = new Date(fin);
    if (isNaN(dInicio.getTime()) || isNaN(dFin.getTime())) return 'No especificado';
    const diff = Math.ceil((dFin.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? `${diff} días` : '0 días';
  }

  calcularDiasRestantes(fechaEntrega: any): { dias: number; texto: string; clase: string } | null {
    if (!fechaEntrega) return null;
    const entrega = new Date(fechaEntrega);
    if (isNaN(entrega.getTime())) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    entrega.setHours(0, 0, 0, 0);
    const diff = Math.ceil((entrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) {
      return { dias: diff, texto: `Vencida (${Math.abs(diff)}d)`, clase: 'bg-red-50 text-red-700 border-red-200' };
    } else if (diff === 0) {
      return { dias: 0, texto: 'Entrega Hoy', clase: 'bg-amber-50 text-amber-800 border-amber-300' };
    } else if (diff <= 5) {
      return { dias: diff, texto: `${diff}d restantes`, clase: 'bg-amber-50 text-amber-700 border-amber-200' };
    } else {
      return { dias: diff, texto: `${diff}d restantes`, clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
  }
}
