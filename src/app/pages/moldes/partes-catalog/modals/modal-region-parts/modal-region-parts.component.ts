import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AnatomicalRegion } from '../../partes-catalog.component';

@Component({
  selector: 'app-modal-region-parts',
  templateUrl: './modal-region-parts.component.html',
  styleUrls: ['./modal-region-parts.component.css']
})
export class ModalRegionPartsComponent {
  @Input() isOpen = false;
  @Input() region: AnatomicalRegion | null = null;
  @Input() isGeneral = false;
  @Input() parts: any[] = [];
  @Input() machines: any[] = [];

  @Output() closeModal = new EventEmitter<void>();
  @Output() createPart = new EventEmitter<string>();
  @Output() editPart = new EventEmitter<any>();
  @Output() deletePart = new EventEmitter<any>();

  searchTerm = '';
  expandedPartIds: Set<any> = new Set();
  cardSearchTerms: { [partId: number]: string } = {};
  showCardSearch: { [partId: number]: boolean } = {};

  toggleCardSearch(partId: number): void {
    this.showCardSearch[partId] = !this.showCardSearch[partId];
    if (!this.showCardSearch[partId]) {
      this.cardSearchTerms[partId] = '';
    }
  }

  getFilteredVariants(part: any): any[] {
    if (!part || !part.types) return [];
    const term = (this.cardSearchTerms[part.id] || '').trim().toLowerCase();
    if (!term) return part.types;
    return part.types.filter((t: any) =>
      (t.name && t.name.toLowerCase().includes(term)) ||
      (t.technical_description && t.technical_description.toLowerCase().includes(term)) ||
      (t.materials && Array.isArray(t.materials) && t.materials.some((m: string) => m.toLowerCase().includes(term)))
    );
  }

  get filteredParts(): any[] {
    if (!this.parts) return [];
    if (!this.searchTerm.trim()) return this.parts;
    const q = this.searchTerm.toLowerCase().trim();
    return this.parts.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.types && p.types.some((t: any) => t.name && t.name.toLowerCase().includes(q)))
    );
  }

  get totalSamTime(): number {
    if (!this.parts) return 0;
    const total = this.parts.reduce((sum, p) => sum + this.calculatePartTotalTime(p), 0);
    return parseFloat(total.toFixed(2));
  }

  get totalVariantsCount(): number {
    if (!this.parts) return 0;
    return this.parts.reduce((sum, p) => sum + ((p.types && p.types.length) || 0), 0);
  }

  toggleExpandPart(part: any): void {
    const key = part.id || part.code || part.name;
    if (this.expandedPartIds.has(key)) {
      this.expandedPartIds.delete(key);
    } else {
      this.expandedPartIds.add(key);
    }
  }

  isPartExpanded(part: any): boolean {
    const key = part.id || part.code || part.name;
    return this.expandedPartIds.has(key);
  }

  calculatePartTotalTime(part: any): number {
    if (!part || !part.types || part.types.length === 0) return 0;
    const defaultType = part.types.find((t: any) => t.is_default) || part.types[0];
    if (!defaultType || !defaultType.operations) return 0;
    const total = defaultType.operations.reduce((sum: number, op: any) => sum + (parseFloat(op.execution_time) || 0), 0);
    return parseFloat(total.toFixed(2));
  }

  calculateTypeTotalTime(type: any): number {
    if (!type || !type.operations || type.operations.length === 0) return 0;
    const total = type.operations.reduce((sum: number, op: any) => sum + (parseFloat(op.execution_time) || 0), 0);
    return parseFloat(total.toFixed(2));
  }

  onClose(): void {
    this.searchTerm = '';
    this.closeModal.emit();
  }
}
