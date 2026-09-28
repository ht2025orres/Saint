import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AnatomicalRegion } from '../../partes-catalog.component';

@Component({
  selector: 'app-catalog-tab-partes',
  templateUrl: './catalog-tab-partes.component.html',
  styleUrls: ['./catalog-tab-partes.component.css']
})
export class CatalogTabPartesComponent {
  @Input() parts: any[] = [];
  @Input() allMasterParts: any[] = [];
  @Input() regions: AnatomicalRegion[] = [];
  @Input() searchTerm = '';
  @Input() selectedZoneFilter = '';
  @Input() expandedVariants: Set<number> = new Set<number>();
  @Input() expandedVariantOps: Set<number> = new Set<number>();
  @Input() isLoading = false;

  @Output() searchTermChange = new EventEmitter<string>();
  @Output() selectRegion = new EventEmitter<string>();
  @Output() createPart = new EventEmitter<string | undefined>();
  @Output() editPart = new EventEmitter<any>();
  @Output() deletePart = new EventEmitter<any>();
  @Output() toggleVariant = new EventEmitter<number>();
  @Output() toggleOps = new EventEmitter<number>();

  showRegionFilterDropdown = false;
  regionFilterSearchTerm = '';

  get filteredRegionsForDropdown(): AnatomicalRegion[] {
    if (!this.regionFilterSearchTerm) return this.regions;
    const term = this.regionFilterSearchTerm.toLowerCase();
    return this.regions.filter(r =>
      r.label.toLowerCase().includes(term) ||
      r.description.toLowerCase().includes(term)
    );
  }

  getSelectedRegionFilterInfo(): { label: string; color: string; count: number } {
    if (!this.selectedZoneFilter) {
      return {
        label: 'Todas las Regiones',
        color: '#6366f1',
        count: this.allMasterParts ? this.allMasterParts.length : 0
      };
    }
    const reg = this.regions.find(r => r.value === this.selectedZoneFilter);
    const count = this.allMasterParts ? this.allMasterParts.filter(p => p.zone === this.selectedZoneFilter).length : 0;
    return {
      label: reg ? reg.label : this.selectedZoneFilter,
      color: reg ? reg.color : '#6366f1',
      count
    };
  }

  getRegionInfo(zoneKey: string): AnatomicalRegion | undefined {
    return this.regions.find(r => r.value === zoneKey);
  }

  getPartsCountForRegion(zoneKey: string): number {
    if (!this.allMasterParts) return 0;
    return this.allMasterParts.filter(p => p.zone === zoneKey).length;
  }

  isVariantExpanded(typeId: number): boolean {
    return this.expandedVariants.has(typeId);
  }

  isVariantOpsExpanded(typeId: number): boolean {
    return this.expandedVariantOps.has(typeId);
  }

  toggleVariantOps(typeId: number): void {
    if (this.expandedVariantOps.has(typeId)) {
      this.expandedVariantOps.delete(typeId);
    } else {
      this.expandedVariantOps.add(typeId);
    }
  }

  calculateVariantTotalTime(type: any): number {
    if (!type.operations || type.operations.length === 0) return 0;
    const sum = type.operations.reduce((acc: number, op: any) => acc + (parseFloat(op.execution_time) || 0), 0);
    return parseFloat(sum.toFixed(2));
  }

  onSelectFilter(zone: string): void {
    this.selectRegion.emit(zone);
    this.showRegionFilterDropdown = false;
  }
}

