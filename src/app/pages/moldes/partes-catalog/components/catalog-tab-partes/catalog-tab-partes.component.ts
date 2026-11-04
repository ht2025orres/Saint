import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AnatomicalRegion } from '../../partes-catalog.component';
import { MoldService } from '../../../../../services/mold.service';
import Swal from 'sweetalert2';

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
  
  // Mini búsqueda y control por tarjeta
  cardSearchTerms: { [partId: number]: string } = {};
  showCardSearch: { [partId: number]: boolean } = {};

  // Submodal de Inhabilitación Global con Motivo
  isDisableReasonModalOpen = false;
  selectedVariantForModal: any = null;
  selectedPartForModal: any = null;
  tempDisableReason = '';
  quickDisableReasons: string[] = [
    'Falta de material / insumo',
    'Maquinaria especializada en mantenimiento',
    'Descontinuada temporalmente por patronaje',
    'No homologada para dotación actual',
    'Fuera de producción por temporada'
  ];

  constructor(private moldService: MoldService) {}

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

  getPartTotalSam(part: any): number {
    if (!part || !part.types || part.types.length === 0) return 0;
    const total = part.types.reduce((sum: number, t: any) => sum + this.calculateVariantTotalTime(t), 0);
    return parseFloat(total.toFixed(2));
  }

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

  // --- Submodal de Inhabilitación Global con Motivo ---
  openDisableVariantModal(part: any, type: any): void {
    this.selectedPartForModal = part;
    this.selectedVariantForModal = type;
    this.tempDisableReason = type.disabled_reason || '';
    this.isDisableReasonModalOpen = true;
  }

  selectQuickReason(reason: string): void {
    this.tempDisableReason = reason;
  }

  closeDisableReasonModal(): void {
    this.isDisableReasonModalOpen = false;
    this.selectedVariantForModal = null;
    this.selectedPartForModal = null;
  }

  confirmDisableVariant(): void {
    if (!this.selectedVariantForModal || !this.selectedPartForModal) return;
    const reason = this.tempDisableReason.trim() || 'No disponible temporalmente';
    const type = this.selectedVariantForModal;
    const part = this.selectedPartForModal;

    type.is_active = false;
    type.disabled_reason = reason;

    if (part.id && type.id) {
      this.moldService.updateGarmentPartTypeStatus(part.id, type.id, false, reason).subscribe({
        next: () => {
          Swal.fire({
            title: 'Variante inhabilitada',
            text: `"${type.name}" inhabilitada a nivel general por: ${reason}`,
            icon: 'warning',
            toast: true,
            position: 'top-end',
            timer: 3000,
            showConfirmButton: false
          });
        },
        error: (err: any) => console.error('Error inhabilitando variante:', err)
      });
    }

    this.closeDisableReasonModal();
  }

  enableVariant(part: any, type: any): void {
    type.is_active = true;
    type.disabled_reason = null;

    if (part.id && type.id) {
      this.moldService.updateGarmentPartTypeStatus(part.id, type.id, true, null).subscribe({
        next: () => {
          Swal.fire({
            title: 'Variante habilitada',
            text: `"${type.name}" ahora está disponible a nivel general.`,
            icon: 'success',
            toast: true,
            position: 'top-end',
            timer: 2500,
            showConfirmButton: false
          });
        },
        error: (err: any) => console.error('Error habilitando variante:', err)
      });
    }
  }
}

