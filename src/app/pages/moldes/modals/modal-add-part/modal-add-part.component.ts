import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal-add-part',
  templateUrl: './modal-add-part.component.html',
  styleUrls: ['./modal-add-part.component.css']
})
export class ModalAddPartComponent {
  @Input() type: 'general' | 'component' = 'general';
  @Input() availableComponents: any[] = [];
  
  @Output() confirm = new EventEmitter<{ name: string, item_type: string }>();
  @Output() cancel = new EventEmitter<void>();

  searchQuery = '';
  itemType: 'parte' | 'insumo' | 'tela' = 'parte';
  showSuggestions = false;

  get filteredSuggestions(): any[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.availableComponents.slice(0, 50);
    return this.availableComponents.filter(c => 
      (c.display_name || c.name || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }

  selectSuggestion(s: any): void {
    this.searchQuery = s.display_name || s.name;
    this.itemType = s.item_type || 'parte';
    this.showSuggestions = false;
  }

  onConfirm(): void {
    if (this.searchQuery.trim()) {
      this.confirm.emit({
        name: this.searchQuery.trim(),
        item_type: this.itemType
      });
      this.searchQuery = '';
      this.itemType = 'parte';
    }
  }

  onCancel(): void {
    this.cancel.emit();
    this.searchQuery = '';
    this.itemType = 'parte';
  }
}
