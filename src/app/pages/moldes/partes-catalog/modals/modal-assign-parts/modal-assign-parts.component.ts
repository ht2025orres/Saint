import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { AnatomicalRegion } from '../../partes-catalog.component';

@Component({
  selector: 'app-modal-assign-parts',
  templateUrl: './modal-assign-parts.component.html',
  styleUrls: ['./modal-assign-parts.component.css']
})
export class ModalAssignPartsComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() region: AnatomicalRegion | null = null;
  @Input() allMasterParts: any[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() assign = new EventEmitter<number[]>();

  searchTerm = '';
  selectedPartIds: Set<number> = new Set();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.selectedPartIds.clear();
      this.searchTerm = '';
    }
  }

  get targetRegionValue(): string {
    return this.region ? this.region.value : '';
  }

  isPartAssignedToTarget(part: any): boolean {
    if (!this.targetRegionValue) return false;
    if (part.zones && Array.isArray(part.zones)) {
      return part.zones.includes(this.targetRegionValue);
    }
    return part.zone === this.targetRegionValue;
  }

  get filteredParts(): any[] {
    let list = this.allMasterParts || [];
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase().trim();
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.types && p.types.some((t: any) => t.name.toLowerCase().includes(q)))
      );
    }
    return list;
  }

  get unassignedCount(): number {
    return (this.allMasterParts || []).filter(p => !this.isPartAssignedToTarget(p)).length;
  }

  toggleSelect(partId: number): void {
    if (this.selectedPartIds.has(partId)) {
      this.selectedPartIds.delete(partId);
    } else {
      this.selectedPartIds.add(partId);
    }
  }

  toggleSelectAll(): void {
    const unassigned = this.filteredParts.filter(p => !this.isPartAssignedToTarget(p) && p.id);
    const allSelected = unassigned.every(p => this.selectedPartIds.has(p.id));

    if (allSelected) {
      unassigned.forEach(p => this.selectedPartIds.delete(p.id));
    } else {
      unassigned.forEach(p => this.selectedPartIds.add(p.id));
    }
  }

  onSave(): void {
    if (this.selectedPartIds.size === 0) return;
    this.assign.emit(Array.from(this.selectedPartIds));
  }

  onClose(): void {
    this.selectedPartIds.clear();
    this.close.emit();
  }

  calculateTotalTime(part: any): number {
    if (!part || !part.types || part.types.length === 0) return 0;
    const defaultType = part.types.find((t: any) => t.is_default) || part.types[0];
    if (!defaultType || !defaultType.operations) return 0;
    const total = defaultType.operations.reduce((sum: number, op: any) => sum + (parseFloat(op.execution_time) || 0), 0);
    return parseFloat(total.toFixed(2));
  }
}
