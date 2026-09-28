import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MoldService } from '../../../../services/mold.service';

@Component({
  selector: 'app-modal-insumos-agrupados',
  templateUrl: './modal-insumos-agrupados.component.html',
  styleUrls: ['./modal-insumos-agrupados.component.css']
})
export class ModalInsumosAgrupadosComponent implements OnInit {
  @Input() initialSearch: string = '';
  @Input() initialGrupo: string = '';

  @Output() selectInsumo = new EventEmitter<{
    referencia: string;
    descripcion: string;
    id_color?: string;
    color?: string;
    total_existencias?: number;
    estado_stock?: string;
    is_manual?: boolean;
  }>();
  @Output() cancel = new EventEmitter<void>();

  searchTerm: string = '';
  selectedGrupo: string = '';
  soloConStock: boolean = false;
  loading: boolean = false;

  grupos: string[] = [
    'TODOS',
    'TELAS',
    'BOTONES',
    'HILOS Y HILAZAS',
    'CIERRES',
    'SESGOS Y CINTAS',
    'RESORTES Y ELÁSTICOS',
    'OTROS INSUMOS'
  ];

  rawItems: any[] = [];
  groupedInsumos: any = {};
  manualText: string = '';
  activeTab: 'siesa' | 'manual' = 'siesa';

  constructor(private moldService: MoldService) {}

  ngOnInit(): void {
    this.searchTerm = this.initialSearch || '';
    this.selectedGrupo = this.initialGrupo || 'TODOS';
    this.buscarInsumos();
  }

  buscarInsumos(): void {
    this.loading = true;
    const grupoParam = this.selectedGrupo === 'TODOS' ? '' : this.selectedGrupo;

    this.moldService.getGroupedInsumos(this.searchTerm, grupoParam, this.soloConStock, 'MP001').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.rawItems = res.data.raw_items || [];
          this.groupedInsumos = res.data.grouped || {};
        } else {
          this.rawItems = [];
          this.groupedInsumos = {};
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error buscando insumos agrupados:', err);
        this.rawItems = [];
        this.groupedInsumos = {};
        this.loading = false;
      }
    });
  }

  onGrupoChange(grupo: string): void {
    this.selectedGrupo = grupo;
    this.buscarInsumos();
  }

  onStockFilterToggle(): void {
    this.soloConStock = !this.soloConStock;
    this.buscarInsumos();
  }

  onSelectColorOption(insumo: any, colorObj: any): void {
    this.selectInsumo.emit({
      referencia: colorObj.referencia || insumo.referencia_base,
      descripcion: insumo.insumo,
      id_color: colorObj.id_color,
      color: colorObj.color,
      total_existencias: colorObj.total_existencias,
      estado_stock: colorObj.estado_stock,
      is_manual: false
    });
  }

  onSaveManual(): void {
    if (!this.manualText.trim()) return;
    this.selectInsumo.emit({
      referencia: 'MANUAL',
      descripcion: this.manualText.trim(),
      color: 'LIBRE',
      is_manual: true
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
