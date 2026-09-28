import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { MoldService, GenericMaterial } from '../../../../../services/mold.service';

@Component({
  selector: 'app-modal-gestion-materiales',
  templateUrl: './modal-gestion-materiales.component.html',
  styleUrls: ['./modal-gestion-materiales.component.css']
})
export class ModalGestionMaterialesComponent implements OnInit {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() catalogUpdated = new EventEmitter<GenericMaterial[]>();

  materials: GenericMaterial[] = [];
  searchQuery = '';
  typeFilter: 'all' | 'tela' | 'insumo' = 'all';

  // Form State
  editingMaterial: GenericMaterial | null = null;
  formName = '';
  formType: 'tela' | 'insumo' = 'insumo';
  formIcon = 'bi-box-seam-fill';
  formDescription = '';
  showForm = false;
  errorMessage = '';

  popularIcons = [
    { icon: 'bi-droplet-fill', label: 'Tela Base' },
    { icon: 'bi-palette-fill', label: 'Contraste' },
    { icon: 'bi-layers-fill', label: 'Forro' },
    { icon: 'bi-card-heading', label: 'Entretela' },
    { icon: 'bi-grid-3x3', label: 'Malla/Mesh' },
    { icon: 'bi-threads', label: 'Hilo' },
    { icon: 'bi-record-circle', label: 'Botón' },
    { icon: 'bi-distribute-vertical', label: 'Cremallera' },
    { icon: 'bi-circle-square', label: 'Broche' },
    { icon: 'bi-brightness-high', label: 'Reflectivo' },
    { icon: 'bi-arrows-expand', label: 'Elástico' },
    { icon: 'bi-tag-fill', label: 'Marquilla' },
    { icon: 'bi-grip-vertical', label: 'Velcro' },
    { icon: 'bi-bezier2', label: 'Cordón' },
    { icon: 'bi-shield-check', label: 'Protección' },
    { icon: 'bi-scissors', label: 'Corte' }
  ];

  constructor(private moldService: MoldService) {}

  ngOnInit(): void {
    this.loadMaterials();
  }

  loadMaterials(): void {
    this.materials = this.moldService.getGenericMaterials();
    this.catalogUpdated.emit(this.materials);
  }

  get filteredMaterials(): GenericMaterial[] {
    let list = this.materials;

    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(m =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    }

    if (this.typeFilter !== 'all') {
      list = list.filter(m => m.type === this.typeFilter);
    }

    return list;
  }

  startCreate(): void {
    this.editingMaterial = null;
    this.formName = '';
    this.formType = 'insumo';
    this.formIcon = 'bi-box-seam-fill';
    this.formDescription = '';
    this.errorMessage = '';
    this.showForm = true;
  }

  startEdit(item: GenericMaterial): void {
    this.editingMaterial = item;
    this.formName = item.name;
    this.formType = item.type;
    this.formIcon = item.icon || (item.type === 'tela' ? 'bi-droplet-fill' : 'bi-box-seam-fill');
    this.formDescription = item.description || '';
    this.errorMessage = '';
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingMaterial = null;
    this.errorMessage = '';
  }

  saveForm(): void {
    if (!this.formName || !this.formName.trim()) {
      this.errorMessage = 'El nombre del material es obligatorio.';
      return;
    }

    const payload: Partial<GenericMaterial> = {
      id: this.editingMaterial ? this.editingMaterial.id : undefined,
      name: this.formName.trim(),
      type: this.formType,
      icon: this.formIcon,
      description: this.formDescription.trim()
    };

    this.moldService.saveGenericMaterial(payload);
    this.loadMaterials();
    this.cancelForm();
  }

  deleteMaterial(item: GenericMaterial): void {
    if (confirm(`¿Estás seguro de eliminar "${item.name}" del catálogo maestro de materiales?`)) {
      this.moldService.deleteGenericMaterial(item.id);
      this.loadMaterials();
      if (this.editingMaterial?.id === item.id) {
        this.cancelForm();
      }
    }
  }

  resetToDefaults(): void {
    if (confirm('¿Restablecer el catálogo maestro con los insumos y telas predeterminados de Saint?')) {
      this.materials = this.moldService.resetGenericMaterials();
      this.catalogUpdated.emit(this.materials);
      this.cancelForm();
    }
  }

  onClose(): void {
    this.close.emit();
  }
}
