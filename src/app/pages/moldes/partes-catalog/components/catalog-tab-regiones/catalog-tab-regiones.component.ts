import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AnatomicalRegion } from '../../partes-catalog.component';
import { MoldService } from '../../../../../services/mold.service';

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
  @Output() deleteRegion = new EventEmitter<AnatomicalRegion>();
  @Output() createPartForRegion = new EventEmitter<string>();
  @Output() filterByRegion = new EventEmitter<string>();
  @Output() viewRegionCatalog = new EventEmitter<AnatomicalRegion | string>();
  @Output() editPart = new EventEmitter<any>();
  @Output() deletePart = new EventEmitter<any>();
  @Output() assignPartsToRegion = new EventEmitter<AnatomicalRegion | string>();
  @Output() unassignPart = new EventEmitter<{ part: any; regionValue: string }>();

  expandedPartIds: Set<any> = new Set();

  constructor(private moldService: MoldService) {}

  getStructuralRegions(): AnatomicalRegion[] {
    if (!this.regions) return [];
    return this.regions.filter(r => r.value !== 'general' && r.nature !== 'overlay' && r.is_structural !== false);
  }

  getGeneralRegion(): AnatomicalRegion | undefined {
    if (!this.regions) return undefined;
    return this.regions.find(r => r.value === 'general' || r.nature === 'overlay' || r.is_structural === false);
  }

  getGeneralParts(): any[] {
    if (!this.allMasterParts) return [];
    return this.allMasterParts.filter(p => (p.zones && p.zones.includes('general')) || p.zone === 'general');
  }

  getPartsForRegion(regionValue: string): any[] {
    if (!this.allMasterParts) return [];
    return this.allMasterParts.filter(p => (p.zones && p.zones.includes(regionValue)) || p.zone === regionValue);
  }

  getPartRegionsCount(part: any): number {
    if (part && part.zones && Array.isArray(part.zones)) return part.zones.length;
    return (part && part.zone) ? 1 : 0;
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

  isVariantGloballyDisabled(variant: any): boolean {
    return !!variant && variant.is_active === false;
  }

  isVariantDisabledInRegion(part: any, regionValue: string, variant: any): boolean {
    if (!part || !variant) return false;
    if (this.isVariantGloballyDisabled(variant)) return true;
    const pr = (part.partRegions || []).find((r: any) => r.region_value === regionValue);
    if (!pr || !pr.disabled_variant_ids) return false;
    const vId = variant.id || variant.name;
    return pr.disabled_variant_ids.includes(vId) || pr.disabled_variant_ids.includes(Number(vId));
  }

  getRegionActiveVariantsCount(part: any, regionValue: string): number {
    if (!part || !part.types) return 0;
    return part.types.filter((t: any) => !this.isVariantDisabledInRegion(part, regionValue, t)).length;
  }

  toggleRegionVariantState(part: any, regionValue: string, variant: any, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!part || !variant) return;
    if (this.isVariantGloballyDisabled(variant)) return;

    let pr = (part.partRegions || []).find((r: any) => r.region_value === regionValue);
    if (!pr) {
      if (!part.partRegions) part.partRegions = [];
      pr = { garment_part_id: part.id, region_value: regionValue, disabled_variant_ids: [] };
      part.partRegions.push(pr);
    }
    if (!pr.disabled_variant_ids || !Array.isArray(pr.disabled_variant_ids)) {
      pr.disabled_variant_ids = [];
    }

    const vId = variant.id || variant.name;
    const isCurrentlyDisabled = pr.disabled_variant_ids.includes(vId) || pr.disabled_variant_ids.includes(Number(vId));
    const newDisabledState = !isCurrentlyDisabled;

    if (newDisabledState) {
      if (!pr.disabled_variant_ids.includes(vId)) {
        pr.disabled_variant_ids.push(vId);
      }
    } else {
      pr.disabled_variant_ids = pr.disabled_variant_ids.filter((id: any) => id != vId && id != Number(vId));
    }

    if (part.id) {
      this.moldService.toggleRegionVariant(part.id, regionValue, vId, newDisabledState).subscribe({
        next: () => {},
        error: (err: any) => console.error('Error toggling region variant:', err)
      });
    }
  }
}
