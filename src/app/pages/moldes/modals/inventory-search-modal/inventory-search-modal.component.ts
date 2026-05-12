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

  constructor(private moldService: MoldService) {}

  search(): void {
    this.loading = true;
    this.moldService.searchInventory(this.searchQuery.trim(), this.selectedBodega).subscribe({
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
    const q = (this.searchQuery || '').toLowerCase().trim();
    this.results = this.allResults.filter(item => {
      if (this.filterType === 'tela' && !item.is_fabric) return false;
      if (this.filterType === 'insumo' && item.is_fabric) return false;
      if (!q) return true;
      return (item.referencia || '').toLowerCase().includes(q)
          || (item.descripcion || '').toLowerCase().includes(q)
          || (item.id_item || '').toLowerCase().includes(q)
          || (item.id_color || '').toLowerCase().includes(q)
          || (item.color || '').toLowerCase().includes(q);
    });
  }

  selectItem(item: any): void {
    this.onSelect.emit(item);
  }

  close(): void {
    this.onClose.emit();
  }
}
