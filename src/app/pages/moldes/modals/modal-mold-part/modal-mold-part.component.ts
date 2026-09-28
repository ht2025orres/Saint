import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { MoldService } from '../../../../services/mold.service';
import Swal from 'sweetalert2';

interface MoldPart {
  id?: number;
  name: string;
  field_name?: string;
  garment_component_id?: number;
  garment_part_id?: number;
  position_x: number | null;
  position_y: number | null;
  width?: number | null;
  height?: number | null;
  item_type: string;
  is_mandatory: boolean;
  editing?: boolean;
  view?: 'front' | 'back';
  description?: string;
  icon?: string;
  types?: any[];
}

@Component({
  selector: 'app-modal-mold-part',
  templateUrl: './modal-mold-part.component.html',
  styleUrls: ['./modal-mold-part.component.css']
})
export class ModalMoldPartComponent implements OnInit {
  @Input() part: MoldPart | null = null;
  @Input() isNew: boolean = false;
  @Input() availableComponents: any[] = [];
  @Input() isReadOnly: boolean = false;
  @Input() activeTab: 'molde' | 'formulario' = 'molde';
  @Input() pendingPin: { x: number | null, y: number | null } | null = null;

  @Output() save = new EventEmitter<MoldPart>();
  @Output() cancel = new EventEmitter<void>();

  showSuggestions = false;
  searchQuery = '';
  globalGarmentPartsCatalog: any[] = [];
  selectedGarmentPartId: number | null = null;
  selectedGarmentPartTypeId: number | null = null;
  availablePartTypes: any[] = [];

  constructor(private moldService: MoldService) {}

  ngOnInit(): void {
    this.loadCatalog();
    if (this.part) {
      this.searchQuery = this.part.name;
      this.selectedGarmentPartId = this.part.garment_part_id || null;
      if (this.part.types && this.part.types.length > 0) {
        this.availablePartTypes = this.part.types;
        const def = this.part.types.find(t => t.is_default) || this.part.types[0];
        this.selectedGarmentPartTypeId = def ? def.id : null;
      }
    }
  }

  loadCatalog(): void {
    this.moldService.getGarmentParts(undefined, true).subscribe({
      next: (res: any) => {
        this.globalGarmentPartsCatalog = res.data || [];
        if (this.part?.garment_part_id) {
          const match = this.globalGarmentPartsCatalog.find(gp => gp.id === this.part?.garment_part_id);
          if (match && (!this.availablePartTypes || this.availablePartTypes.length === 0)) {
            this.availablePartTypes = match.types || [];
          }
        }
      },
      error: () => {}
    });
  }

  onGarmentPartChange(): void {
    const selected = this.globalGarmentPartsCatalog.find(gp => Number(gp.id) === Number(this.selectedGarmentPartId));
    if (selected && this.part) {
      this.part.name = selected.name;
      this.part.garment_part_id = selected.id;
      this.part.icon = selected.icon || 'bi-layers';
      this.searchQuery = selected.name;
      this.availablePartTypes = selected.types || [];
      const defaultType = this.availablePartTypes.find((t: any) => t.is_default) || this.availablePartTypes[0];
      this.selectedGarmentPartTypeId = defaultType ? defaultType.id : null;
      this.part.types = JSON.parse(JSON.stringify(this.availablePartTypes));
    }
  }

  onVariantChange(): void {
    if (this.part && this.part.types) {
      this.part.types.forEach((t: any) => {
        t.is_default = (Number(t.id) === Number(this.selectedGarmentPartTypeId));
      });
    }
  }

  get filteredSuggestions(): any[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.availableComponents.slice(0, 50);
    return this.availableComponents.filter(c => 
      (c.display_name || '').toLowerCase().includes(q) ||
      (c.name || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }

  selectSuggestion(comp: any): void {
    if (this.part) {
      this.part.name = comp.display_name;
      this.part.garment_component_id = comp.id;
      this.part.item_type = comp.item_type || this.part.item_type;
    }
    this.searchQuery = comp.display_name;
    this.showSuggestions = false;
  }

  onSave(): void {
    if (!this.part || (!this.searchQuery.trim() && !this.selectedGarmentPartId)) {
      Swal.fire('Error', 'El nombre del componente o la parte del catálogo es obligatorio', 'error');
      return;
    }
    if (this.searchQuery.trim()) {
      this.part.name = this.searchQuery.trim();
    }
    this.save.emit(this.part);
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
