import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import Swal from 'sweetalert2';

interface MoldPart {
  id?: number;
  name: string;
  field_name?: string;
  garment_component_id?: number;
  position_x: number | null;
  position_y: number | null;
  item_type: string;
  is_mandatory: boolean;
  editing?: boolean;
  view?: 'front' | 'back';
  description?: string;
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
  @Input() activeTab: 'molde' | 'formulario' | 'texto' = 'molde';
  @Input() pendingPin: { x: number | null, y: number | null } | null = null;

  @Output() save = new EventEmitter<MoldPart>();
  @Output() cancel = new EventEmitter<void>();

  showSuggestions = false;
  searchQuery = '';

  ngOnInit(): void {
    if (this.part) {
      this.searchQuery = this.part.name;
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
    if (!this.part || !this.searchQuery.trim()) {
      Swal.fire('Error', 'El nombre del componente es obligatorio', 'error');
      return;
    }
    this.part.name = this.searchQuery.trim();
    this.save.emit(this.part);
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
