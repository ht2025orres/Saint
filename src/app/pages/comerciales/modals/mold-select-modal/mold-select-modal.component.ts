import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-mold-select-modal',
  templateUrl: './mold-select-modal.component.html',
  styleUrls: ['./mold-select-modal.component.css']
})
export class MoldSelectModalComponent {
  @Input() molds: any[] = [];
  @Output() onSelect = new EventEmitter<any>();
  @Output() onClose = new EventEmitter<void>();

  searchTerm = '';

  get filteredMolds(): any[] {
    if (!this.searchTerm.trim()) return this.molds;
    const term = this.searchTerm.toLowerCase();
    return this.molds.filter(m =>
      (m.name || '').toLowerCase().includes(term) ||
      (m.description || '').toLowerCase().includes(term)
    );
  }

  select(mold: any): void {
    this.onSelect.emit(mold);
  }

  close(): void {
    this.onClose.emit();
  }
}
