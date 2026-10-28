import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

@Component({
  selector: 'app-mold-selector-modal',
  templateUrl: './mold-selector-modal.component.html',
  styleUrls: ['./mold-selector-modal.component.css']
})
export class MoldSelectorModalComponent implements OnInit {
  @Input() itemDescription = '';
  @Input() selectedMoldId: number | null = null;
  @Input() categories: any[] = [];
  @Input() allMolds: any[] = [];
  @Input() isLoadingMolds = false;
  @Input() initialCategoryId: number | null = null;

  @Output() onSelect = new EventEmitter<any>();
  @Output() onClose = new EventEmitter<void>();

  selectedCategoryId: number | null = null;
  searchQuery = '';

  ngOnInit(): void {
    this.selectedCategoryId = this.initialCategoryId;
  }

  get filteredMolds(): any[] {
    let list = this.allMolds;
    if (this.selectedCategoryId !== null) {
      list = list.filter(m => (m.mold_category_id || m.id_product_category || m.category_id) === this.selectedCategoryId);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(m =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.code && m.code.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    }
    return list;
  }

  getCategoryMoldCount(catId: number): number {
    return this.allMolds.filter(m => (m.mold_category_id || m.id_product_category || m.category_id) === catId).length;
  }

  getMoldPreviewImage(mold: any): string {
    if (mold.image_signed_url) return mold.image_signed_url;
    if (mold.front_image_signed_url) return mold.front_image_signed_url;
    if (mold.front_image_url) return mold.front_image_url;
    const cat = this.categories.find(c => c.id === (mold.mold_category_id || mold.id_product_category || mold.category_id));
    return cat?.image_signed_url || '';
  }

  selectMold(mold: any): void {
    this.onSelect.emit(mold);
  }

  close(): void {
    this.onClose.emit();
  }
}

