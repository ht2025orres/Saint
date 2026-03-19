import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-lista-informes',
  templateUrl: './lista-informes.component.html',
  styleUrls: ['./lista-informes.component.css']
})
export class ListaInformesComponent {
  @Input() informes: any[] = [];
  @Input() loadingInformes = false;
  @Input() filtroEstadoInforme = 'todos';
  @Input() busquedaInformes = '';
  @Input() vistaInformes: 'tarjetas' | 'lista' = 'tarjetas';
  @Input() puedeGestionarModulo = false;

  @Output() onCargarInformes = new EventEmitter<void>();
  @Output() onBusquedaInformesChange = new EventEmitter<string>();
  @Output() onVerDetalleInforme = new EventEmitter<any>();
  @Output() onEditarInforme = new EventEmitter<any>();
  @Output() onEliminarInforme = new EventEmitter<any>();
  @Output() onAbrirModalCrearInforme = new EventEmitter<void>();
  @Output() onCambiarFiltro = new EventEmitter<string>();
  @Output() onCambiarVista = new EventEmitter<'tarjetas' | 'lista'>();

  getImpactoBadgeClass(impacto: string): string {
    const map: Record<string, string> = {
      bajo: 'bg-green-100 text-green-700',
      medio: 'bg-yellow-100 text-yellow-700',
      alto: 'bg-red-100 text-red-700',
    };
    return map[impacto] ?? 'bg-gray-100 text-gray-700';
  }

  getTipoBadgeClass(tipo: string): string {
    const map: Record<string, string> = {
      tecnico: 'bg-blue-100 text-blue-700',
      gestion: 'bg-purple-100 text-purple-700',
      seguimiento: 'bg-indigo-100 text-indigo-700',
    };
    return map[tipo] ?? 'bg-gray-100 text-gray-700';
  }

  getEstadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      abierto: 'bg-green-100 text-green-700',
      en_proceso: 'bg-blue-100 text-blue-700',
      cerrado: 'bg-gray-100 text-gray-700',
    };
    return map[estado] ?? 'bg-gray-100 text-gray-700';
  }
}
