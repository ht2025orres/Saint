import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { MoldService } from '../../../../services/mold.service';

@Component({
  selector: 'app-modal-add-part',
  templateUrl: './modal-add-part.component.html',
  styleUrls: ['./modal-add-part.component.css']
})
export class ModalAddPartComponent implements OnInit {
  @Input() type: 'general' | 'component' = 'general';
  @Input() availableComponents: any[] = [];
  
  @Output() confirm = new EventEmitter<{ name: string, item_type: string, garment_part_id?: number }>();
  @Output() cancel = new EventEmitter<void>();

  searchQuery = '';
  itemType: 'parte' | 'insumo' | 'tela' = 'parte';
  showSuggestions = false;
  garmentPartsCatalog: any[] = [];
  selectedGarmentPart: any = null;

  constructor(private moldService: MoldService) {}

  ngOnInit(): void {
    this.moldService.getGarmentParts().subscribe({
      next: (res: any) => {
        this.garmentPartsCatalog = res.data || [];
      },
      error: () => {}
    });
  }

  get filteredCatalogParts(): any[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.garmentPartsCatalog;
    return this.garmentPartsCatalog.filter(p => p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q)));
  }

  selectCatalogPart(part: any): void {
    this.selectedGarmentPart = part;
    this.searchQuery = part.name;
    this.itemType = 'parte';
    this.showSuggestions = false;
  }

  onConfirm(): void {
    if (this.searchQuery.trim()) {
      const match = this.garmentPartsCatalog.find(p => p.name.toLowerCase() === this.searchQuery.trim().toLowerCase());
      this.confirm.emit({
        name: this.searchQuery.trim(),
        item_type: this.itemType,
        garment_part_id: match?.id || this.selectedGarmentPart?.id
      });
      this.searchQuery = '';
      this.selectedGarmentPart = null;
      this.itemType = 'parte';
    }
  }

  onCancel(): void {
    this.cancel.emit();
    this.searchQuery = '';
    this.selectedGarmentPart = null;
    this.itemType = 'parte';
  }
}
