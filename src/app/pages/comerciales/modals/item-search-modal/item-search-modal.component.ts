import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { ComercialService, ItemSiesa } from '../../../../services/comercial.service';

@Component({
  selector: 'app-item-search-modal',
  templateUrl: './item-search-modal.component.html',
  styleUrls: ['./item-search-modal.component.css']
})
export class ItemSearchModalComponent implements OnInit {
  @Input() clienteId: number | null = null;
  @Output() onSelect = new EventEmitter<ItemSiesa>();
  @Output() onClose = new EventEmitter<void>();

  items: ItemSiesa[] = [];
  filteredItems: ItemSiesa[] = [];
  searchTerm = '';
  isLoading = false;
  isDeepSearch = false;
  hasTriedNormalSearch = false;

  constructor(private comercialService: ComercialService) {}

  ngOnInit(): void {
    if (this.clienteId) {
      this.loadItems();
    }
  }

  loadItems(deep: boolean = false): void {
    if (!this.clienteId) return;
    this.isLoading = true;
    this.isDeepSearch = deep;
    this.comercialService.itemsCliente(this.clienteId, deep).subscribe({
      next: (res) => {
        this.items = res.data || [];
        this.search(); // Apply current search term if any
        this.isLoading = false;
        this.hasTriedNormalSearch = !deep;
      },
      error: () => { this.isLoading = false; }
    });
  }

  search(): void {
    if (!this.searchTerm.trim()) {
      this.filteredItems = [...this.items];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredItems = this.items.filter(i =>
      (i.f120_descripcion || i.descripcion || '').toLowerCase().includes(term) ||
      (i.f120_referencia || i.referencia || '').toLowerCase().includes(term) ||
      (i.color || '').toLowerCase().includes(term)
    );

    // If no results and haven't tried deep search, we could suggest it
    if (this.filteredItems.length === 0 && this.searchTerm.length >= 3 && !this.isDeepSearch) {
      this.hasTriedNormalSearch = true;
    }
  }

  deepSearch(): void {
    this.loadItems(true);
  }

  select(item: ItemSiesa): void {
    this.onSelect.emit(item);
  }

  close(): void {
    this.onClose.emit();
  }

  getDesc(item: ItemSiesa): string {
    return item.f120_descripcion || item.descripcion || item.f120_descripcion_corta || '';
  }

  getRef(item: ItemSiesa): string {
    return item.f120_referencia || item.referencia || item.f120_id || '';
  }
}
