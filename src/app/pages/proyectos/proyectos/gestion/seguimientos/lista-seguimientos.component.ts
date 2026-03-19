import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-lista-seguimientos',
  templateUrl: './lista-seguimientos.component.html',
  styleUrls: ['./lista-seguimientos.component.css']
})
export class ListaSeguimientosComponent {
  @Input() seguimientos: any[] = [];
  @Input() loadingSeguimientos = false;
  @Input() showDetalleMes = false;
  @Input() meses: any[] = [];
  @Input() mesActual: number | null = null;
  @Input() seguimientoActual: any = null;
  @Input() puedeGestionarModulo = false;
  @Input() moduloActual = '';

  @Output() onAbrirMes = new EventEmitter<{seguimiento: any, mes: number}>();
  @Output() onAbrirModalTareaRapida = new EventEmitter<any>();
  @Output() onCerrarSeguimiento = new EventEmitter<any>();
  @Output() onAbrirModalCrearSeguimiento = new EventEmitter<void>();

  getEstadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      activo: 'bg-green-100 text-green-700 border border-green-200',
      cerrado: 'bg-gray-100 text-gray-600 border border-gray-300',
    };
    return map[estado] ?? 'bg-gray-100 text-gray-700';
  }
}
