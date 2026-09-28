import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MoldZone } from '../../../../../services/mold.service';

@Component({
  selector: 'app-modal-zone-parts-drawer',
  templateUrl: './modal-zone-parts-drawer.component.html',
  styleUrls: ['./modal-zone-parts-drawer.component.css']
})
export class ModalZonePartsDrawerComponent {
  @Input() isOpen = false;
  @Input() zone: MoldZone | null = null;
  @Input() isReadOnly = false;
  @Input() loadingZoneCatalog = false;
  @Input() zoneCatalogParts: any[] = [];
  @Input() zoneTypeOptions: any[] = [];
  @Input() parts: any[] = []; // Current mold parts for this zone/view

  @Output() closeDrawer = new EventEmitter<void>();
  @Output() editZone = new EventEmitter<MoldZone>();
  @Output() togglePart = new EventEmitter<any>();
  @Output() setMandatory = new EventEmitter<{ part: any; isMandatory: boolean }>();
  @Output() toggleVariant = new EventEmitter<{ part: any; typeId: number }>();

  searchQuery = '';
  statusFilter: 'all' | 'enabled' | 'disabled' = 'all';
  expandedPartIds = new Set<number>();
  expandedVariantsPartIds = new Set<number>();

  get filteredCatalogParts(): any[] {
    if (!this.zoneCatalogParts) return [];
    let list = this.zoneCatalogParts;

    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.types && p.types.some((t: any) => t.name && t.name.toLowerCase().includes(q)))
      );
    }

    if (this.statusFilter === 'enabled') {
      list = list.filter(p => this.isPartEnabled(p));
    } else if (this.statusFilter === 'disabled') {
      list = list.filter(p => !this.isPartEnabled(p));
    }

    return list;
  }

  isPartEnabled(catalogPart: any): boolean {
    if (!this.zone || !this.parts) return false;
    const zName = (this.zone.name || '').toLowerCase().trim();
    const zType = (this.zone.zone_type || '').toLowerCase().trim();
    return this.parts.some(p => {
      const matchZone = (p.mold_zone_id === this.zone?.id) ||
                        (p.zone_name && zName && p.zone_name.toLowerCase().trim() === zName) ||
                        (p.zone_type && zType && p.zone_type.toLowerCase().trim() === zType);
      const matchPart = (p.garment_part_id && Number(p.garment_part_id) === Number(catalogPart.id)) ||
                        (p.name && catalogPart.name && p.name.toLowerCase() === catalogPart.name.toLowerCase());
      return matchZone && matchPart;
    });
  }

  getMoldPartForCatalog(catalogPart: any): any {
    if (!this.zone || !this.parts) return null;
    const zName = (this.zone.name || '').toLowerCase().trim();
    const zType = (this.zone.zone_type || '').toLowerCase().trim();
    return this.parts.find(p => {
      const matchZone = (p.mold_zone_id === this.zone?.id) ||
                        (p.zone_name && zName && p.zone_name.toLowerCase().trim() === zName) ||
                        (p.zone_type && zType && p.zone_type.toLowerCase().trim() === zType);
      const matchPart = (p.garment_part_id && Number(p.garment_part_id) === Number(catalogPart.id)) ||
                        (p.name && catalogPart.name && p.name.toLowerCase() === catalogPart.name.toLowerCase());
      return matchZone && matchPart;
    }) || null;
  }

  getPartsCountForZone(): number {
    if (!this.zone || !this.parts) return 0;
    const zName = (this.zone.name || '').toLowerCase().trim();
    const zType = (this.zone.zone_type || '').toLowerCase().trim();
    return this.parts.filter(p =>
      (p.mold_zone_id === this.zone?.id) ||
      (p.zone_name && zName && p.zone_name.toLowerCase().trim() === zName) ||
      (p.zone_type && zType && p.zone_type.toLowerCase().trim() === zType)
    ).length;
  }

  getDisabledPartsCountForZone(): number {
    const total = this.zoneCatalogParts?.length || 0;
    const enabled = this.getPartsCountForZone();
    return Math.max(0, total - enabled);
  }

  getTotalVariantsCountForZone(): number {
    if (!this.zone || !this.parts) return 0;
    const zName = (this.zone.name || '').toLowerCase().trim();
    const zType = (this.zone.zone_type || '').toLowerCase().trim();
    const zoneParts = this.parts.filter(p =>
      (p.mold_zone_id === this.zone?.id) ||
      (p.zone_name && zName && p.zone_name.toLowerCase().trim() === zName) ||
      (p.zone_type && zType && p.zone_type.toLowerCase().trim() === zType)
    );
    let count = 0;
    for (const p of zoneParts) {
      if (p.types) {
        count += p.types.filter((t: any) => this.isVariantActive(t)).length;
      }
    }
    return count;
  }

  isSharedZone(): boolean {
    const t = (this.zone?.zone_type || '').toLowerCase();
    return ['cuello', 'manga', 'pretina', 'pierna_bota'].includes(t);
  }

  isVariantActive(vt: any): boolean {
    if (!vt) return false;
    return vt.is_disabled !== true && vt.is_active !== false;
  }

  getActiveVariantsCount(part: any): number {
    if (!part || !part.types) return 0;
    return part.types.filter((t: any) => this.isVariantActive(t)).length;
  }

  toggleExpandPart(partId: number): void {
    if (this.expandedPartIds.has(partId)) {
      this.expandedPartIds.delete(partId);
    } else {
      this.expandedPartIds.add(partId);
    }
  }

  isPartExpanded(partId: number): boolean {
    return this.expandedPartIds.has(partId);
  }

  toggleExpandVariants(partId: number, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.expandedVariantsPartIds.has(partId)) {
      this.expandedVariantsPartIds.delete(partId);
    } else {
      this.expandedVariantsPartIds.add(partId);
    }
  }

  isVariantsExpanded(partId: number): boolean {
    return this.expandedVariantsPartIds.has(partId);
  }

  expandAllVariants(): void {
    if (!this.zoneCatalogParts) return;
    this.zoneCatalogParts.forEach(p => {
      if (this.isPartEnabled(p)) {
        this.expandedVariantsPartIds.add(p.id);
      }
    });
  }

  collapseAllVariants(): void {
    this.expandedVariantsPartIds.clear();
  }

  getZoneIcon(type?: string): string {
    const opt = this.zoneTypeOptions.find(o => o.value === type);
    return opt ? opt.icon : 'bi-bounding-box-circles';
  }

  getZoneColor(type?: string): string {
    const opt = this.zoneTypeOptions.find(o => o.value === type);
    return opt ? opt.color : '#4f46e5';
  }

  getZoneLabel(type?: string): string {
    const opt = this.zoneTypeOptions.find(o => o.value === type);
    return opt ? opt.label : (type || 'Zona');
  }

  onTogglePart(catalogPart: any, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (catalogPart?.id) {
      this.expandedVariantsPartIds.delete(catalogPart.id);
    }
    this.togglePart.emit(catalogPart);
  }

  onSetMandatory(part: any, isMandatory: boolean): void {
    this.setMandatory.emit({ part, isMandatory });
  }

  toggleVariantState(part: any, vt: any, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.isReadOnly || !vt) return;
    const currentlyActive = this.isVariantActive(vt);
    vt.is_disabled = currentlyActive;
    vt.is_active = !currentlyActive;
    this.toggleVariant.emit({ part, typeId: vt.id || vt.name });
  }

  enableAllVariants(part: any, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.isReadOnly || !part || !part.types) return;
    part.types.forEach((t: any) => {
      t.is_disabled = false;
      t.is_active = true;
    });
    this.toggleVariant.emit({ part, typeId: -1 });
  }

  disableAllVariants(part: any, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.isReadOnly || !part || !part.types) return;
    part.types.forEach((t: any) => {
      t.is_disabled = true;
      t.is_active = false;
    });
    this.toggleVariant.emit({ part, typeId: -1 });
  }

  onEditZoneClick(): void {
    if (this.zone) {
      this.editZone.emit(this.zone);
    }
  }

  onCloseClick(): void {
    this.closeDrawer.emit();
  }
}
