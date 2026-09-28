import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AnatomicalRegion } from '../../partes-catalog.component';

@Component({
  selector: 'app-catalog-tab-regiones',
  templateUrl: './catalog-tab-regiones.component.html',
  styleUrls: ['./catalog-tab-regiones.component.css']
})
export class CatalogTabRegionesComponent {
  @Input() regions: AnatomicalRegion[] = [];
  @Input() allMasterParts: any[] = [];

  @Output() createRegion = new EventEmitter<void>();
  @Output() editRegion = new EventEmitter<AnatomicalRegion>();
  @Output() createPartForRegion = new EventEmitter<string>();
  @Output() filterByRegion = new EventEmitter<string>();
  @Output() viewRegionCatalog = new EventEmitter<AnatomicalRegion | string>();
  @Output() editPart = new EventEmitter<any>();
  @Output() deletePart = new EventEmitter<any>();

  expandedPartIds: Set<any> = new Set();

  getStructuralRegions(): AnatomicalRegion[] {
    if (!this.regions) return [];
    return this.regions.filter(r => r.value !== 'general' && r.nature !== 'overlay');
  }

  getGeneralRegion(): AnatomicalRegion | undefined {
    if (!this.regions) return undefined;
    return this.regions.find(r => r.value === 'general' || r.nature === 'overlay');
  }

  getGeneralParts(): any[] {
    if (!this.allMasterParts) return [];
    return this.allMasterParts.filter(p => p.zone === 'general');
  }

  getPartsForRegion(regionValue: string): any[] {
    if (!this.allMasterParts) return [];
    return this.allMasterParts.filter(p => p.zone === regionValue);
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
}
