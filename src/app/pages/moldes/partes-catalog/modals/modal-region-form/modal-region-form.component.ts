import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AnatomicalRegion } from '../../partes-catalog.component';

@Component({
  selector: 'app-modal-region-form',
  templateUrl: './modal-region-form.component.html',
  styleUrls: ['./modal-region-form.component.css']
})
export class ModalRegionFormComponent {
  @Input() isOpen = false;
  @Input() isEditing = false;
  @Input() regionForm: AnatomicalRegion = {
    id: '',
    value: '',
    label: '',
    color: '#3b82f6',
    icon: 'bi-bounding-box-circles',
    description: ''
  };

  @Output() saveRegion = new EventEmitter<void>();
  @Output() closeRegion = new EventEmitter<void>();

  colorOptions: string[] = [
    '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#06b6d4', 
    '#64748b', '#6366f1', '#f59e0b', '#ef4444', '#14b8a6', '#84cc16', '#a855f7'
  ];

  iconOptions: string[] = [
    'bi-border-outer', 'bi-layers', 'bi-columns', 'bi-border-all', 
    'bi-bounding-box-circles', 'bi-arrows-vertical', 'bi-layout-sidebar', 
    'bi-gem', 'bi-puzzle', 'bi-shield-check', 'bi-tag', 'bi-box-seam'
  ];

  onSave(): void {
    if (!this.regionForm.value && this.regionForm.label) {
      this.generateSlugFromLabel();
    }
    this.saveRegion.emit();
  }

  onClose(): void {
    this.closeRegion.emit();
  }

  onLabelInput(): void {
    if (!this.isEditing) {
      this.generateSlugFromLabel();
    }
  }

  private generateSlugFromLabel(): void {
    const label = this.regionForm.label || '';
    const slug = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    this.regionForm.value = slug;
    this.regionForm.id = slug;
  }
}
