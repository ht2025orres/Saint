import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MoldService } from '../../../../services/mold.service';

@Component({
  selector: 'app-inventory-search-modal',
  templateUrl: './inventory-search-modal.component.html',
  styleUrls: ['./inventory-search-modal.component.css']
})
export class InventorySearchModalComponent {
  @Input() visible = true; // Default true when used with *ngIf
  @Input() partName = '';
  @Input() filterType: 'todos' | 'tela' | 'insumo' = 'todos';
  @Output() onClose = new EventEmitter<void>();
  @Output() onSelect = new EventEmitter<any>();

  searchQuery = '';
  selectedBodega = 'MP001';
  results: any[] = [];
  allResults: any[] = [];
  loading = false;
  isLoaded = false;

  bodegas = [
    { id: 'MP001', name: 'Materia Prima' },
    { id: 'PT001', name: 'Producto Terminado' }
  ];

  constructor(private moldService: MoldService) {}

  ngOnInit(): void {
    // Cargar automáticamente al abrir el modal
    this.search();
  }

  search(): void {
    this.loading = true;
    this.moldService.searchInventory('', this.selectedBodega).subscribe({
      next: (res: any) => {
        this.allResults = (res.data || []).map((item: any) => ({
          ...item,
          is_fabric: (item.referencia || '').startsWith('1110'),
        }));
        this.filterResults();
        this.isLoaded = true;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  filterResults(): void {
    const query = (this.searchQuery || '').toLowerCase().trim();
    
    this.results = this.allResults.filter(item => {
      // 1. Filtro por Tipo (Tela/Insumo)
      let matchType = true;
      if (this.filterType === 'tela') matchType = item.is_fabric;
      if (this.filterType === 'insumo') matchType = !item.is_fabric;

      // 2. Filtro por Búsqueda de Texto (Ref, ID o Desc)
      let matchQuery = true;
      if (query) {
        matchQuery = 
          (item.referencia || '').toLowerCase().includes(query) ||
          (item.id_item || '').toLowerCase().includes(query) ||
          (item.descripcion || '').toLowerCase().includes(query);
      }

      return matchType && matchQuery;
    });
  }

  selectItem(item: any): void {
    this.onSelect.emit(item);
  }

  close(): void {
    this.onClose.emit();
  }
}
