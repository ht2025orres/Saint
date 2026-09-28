import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnInit, HostListener } from '@angular/core';
import { AnatomicalRegion, SharedOperation } from '../../partes-catalog.component';
import { IconOption, DEFAULT_ICONS, DEFAULT_ICON_CATEGORIES } from '../../partes-catalog.models';
import { MoldService, GenericMaterial } from '../../../../../services/mold.service';

@Component({
  selector: 'app-modal-parte-form',
  templateUrl: './modal-parte-form.component.html',
  styleUrls: ['./modal-parte-form.component.css']
})
export class ModalParteFormComponent implements OnInit {
  @ViewChild('modalBody') modalBody!: ElementRef<HTMLDivElement>;

  @Input() isOpen = false;
  @Input() isEditing = false;
  @Input() isSaving = false;
  @Input() partForm: any = {
    id: null,
    name: '',
    code: '',
    description: '',
    icon: 'bi-box-seam',
    zone: 'manga',
    is_active: true,
    types: []
  };
  @Input() regions: AnatomicalRegion[] = [];
  @Input() machines: any[] = [];
  @Input() sharedOperationsLibrary: SharedOperation[] = [];
  @Input() activeOpSuggestionIndex: { typeIdx: number; opIdx: number } | null = null;
  @Input() expandedModalVariants: Set<number> = new Set<number>();

  @Output() closeModal = new EventEmitter<void>();
  @Output() savePart = new EventEmitter<void>();
  @Output() generateAutoCode = new EventEmitter<boolean>();
  @Output() selectZone = new EventEmitter<string>();
  @Output() selectIcon = new EventEmitter<string>();
  @Output() addType = new EventEmitter<void>();
  @Output() removeType = new EventEmitter<number>();
  @Output() setDefaultType = new EventEmitter<any>();
  @Output() toggleModalVariant = new EventEmitter<any>();
  @Output() addOperationToVariant = new EventEmitter<any>();
  @Output() removeOperationFromVariant = new EventEmitter<{ type: any; index: number }>();
  @Output() selectOperationSuggestion = new EventEmitter<{ op: any; type: any; opIdx: number }>();
  @Output() opNameInput = new EventEmitter<{ typeIdx: number; opIdx: number; query: string }>();

  showZonePicker = false;
  showIconPicker = false;
  iconSearchTerm = '';
  selectedIconCategory = 'Todos';
  availableIcons: IconOption[] = [...DEFAULT_ICONS];
  iconCategories: string[] = [...DEFAULT_ICON_CATEGORIES];

  // Gestión de Materiales Maestros
  masterMaterials: GenericMaterial[] = [];
  activePickerVariantIndex: number | null = null;
  materialPickerSearch = '';
  materialPickerTab: 'all' | 'tela' | 'insumo' = 'all';
  showMasterMaterialsManager = false;

  constructor(private moldService: MoldService, private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.refreshMasterMaterials();
  }

  refreshMasterMaterials(): void {
    this.masterMaterials = this.moldService.getGenericMaterials();
  }

  onMasterCatalogUpdated(list: GenericMaterial[]): void {
    this.masterMaterials = list;
  }

  get telasCount(): number {
    return this.masterMaterials.filter(m => m.type === 'tela').length;
  }

  get insumosCount(): number {
    return this.masterMaterials.filter(m => m.type === 'insumo').length;
  }

  get filteredMasterMaterials(): GenericMaterial[] {
    let list = this.masterMaterials;
    if (this.materialPickerTab !== 'all') {
      list = list.filter(m => m.type === this.materialPickerTab);
    }
    if (this.materialPickerSearch.trim()) {
      const q = this.materialPickerSearch.toLowerCase().trim();
      list = list.filter(m =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    }
    return list;
  }

  hasMaterialInMaster(name: string): boolean {
    if (!name) return false;
    const q = name.toLowerCase().trim();
    return this.masterMaterials.some(m => m.name.toLowerCase().trim() === q);
  }

  isTela(name: string): boolean {
    if (!name) return false;
    const q = name.toLowerCase();
    return q.includes('tela') || q.includes('forro') || q.includes('denim') || q.includes('dril');
  }

  toggleMaterialPicker(typeIndex: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.activePickerVariantIndex === typeIndex) {
      this.activePickerVariantIndex = null;
    } else {
      this.activePickerVariantIndex = typeIndex;
      this.materialPickerSearch = '';
      this.materialPickerTab = 'all';
    }
  }

  closeMaterialPicker(): void {
    this.activePickerVariantIndex = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.activePickerVariantIndex === null) return;
    const target = event.target as HTMLElement;
    const container = this.elementRef.nativeElement.querySelector('.variant-material-picker-container');
    if (container && !container.contains(target)) {
      this.closeMaterialPicker();
    }
  }

  hasMaterial(type: any, material: string): boolean {
    if (!type || !type.materials || !Array.isArray(type.materials)) return false;
    const q = material.toLowerCase().trim();
    return type.materials.some((m: string) => (m || '').toLowerCase().trim() === q);
  }

  toggleVariantMaterial(type: any, material: string): void {
    if (!type.materials) type.materials = [];
    const q = material.toLowerCase().trim();
    const index = type.materials.findIndex((m: string) => (m || '').toLowerCase().trim() === q);
    if (index >= 0) {
      type.materials.splice(index, 1);
    } else {
      type.materials.push(material.trim());
    }
  }

  removeVariantMaterial(type: any, material: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!type.materials) return;
    const q = material.toLowerCase().trim();
    const index = type.materials.findIndex((m: string) => (m || '').toLowerCase().trim() === q);
    if (index >= 0) {
      type.materials.splice(index, 1);
    }
  }

  createAndAssignNewMaterial(type: any): void {
    const raw = this.materialPickerSearch.trim();
    if (!raw) return;

    // Guardar en catálogo si no existe
    if (!this.hasMaterialInMaster(raw)) {
      const isTela = raw.toLowerCase().includes('tela') || raw.toLowerCase().includes('forro');
      this.moldService.saveGenericMaterial({
        name: raw,
        type: isTela ? 'tela' : 'insumo',
        description: 'Creado desde definición de variante'
      });
      this.refreshMasterMaterials();
    }

    if (!this.hasMaterial(type, raw)) {
      if (!type.materials) type.materials = [];
      type.materials.push(raw);
    }
    this.materialPickerSearch = '';
  }

  get filteredIcons(): IconOption[] {
    let list = this.availableIcons;
    if (this.selectedIconCategory && this.selectedIconCategory !== 'Todos') {
      list = list.filter(i => i.category === this.selectedIconCategory);
    }
    if (this.iconSearchTerm.trim()) {
      const q = this.iconSearchTerm.toLowerCase().trim();
      list = list.filter(i => i.name.toLowerCase().includes(q) || i.label.toLowerCase().includes(q));
    }
    return list;
  }

  // Submodales Dedicados
  isBasicDescModalOpen = false;
  isTechDescModalOpen = false;
  isDisableReasonModalOpen = false;
  selectedVariantForModal: any = null;
  tempText = '';
  tempDisableReason = '';
  quickDisableReasons: string[] = [
    'Falta de material / insumo',
    'Maquinaria especializada en mantenimiento',
    'Descontinuada temporalmente por patronaje',
    'No homologada para dotación actual',
    'Fuera de producción por temporada'
  ];

  getSelectedRegion(): AnatomicalRegion | undefined {
    return this.regions.find(r => r.value === this.partForm.zone);
  }

  isModalVariantExpanded(type: any, index?: number): boolean {
    if (type && type._isExpanded !== undefined) {
      return !!type._isExpanded;
    }
    return index === 0;
  }

  toggleVariant(type: any, index: number): void {
    const currentState = this.isModalVariantExpanded(type, index);
    type._isExpanded = !currentState;
  }

  // --- Submodal: Descripción Básica ---
  openBasicDescModal(type: any): void {
    this.selectedVariantForModal = type;
    this.tempText = type.description || '';
    this.isBasicDescModalOpen = true;
  }

  saveBasicDesc(): void {
    if (this.selectedVariantForModal) {
      this.selectedVariantForModal.description = this.tempText.trim();
    }
    this.isBasicDescModalOpen = false;
    this.selectedVariantForModal = null;
  }

  closeBasicDescModal(): void {
    this.isBasicDescModalOpen = false;
    this.selectedVariantForModal = null;
  }

  // --- Submodal: Descripción Técnica (Ficha / OPM) ---
  openTechDescModal(type: any): void {
    this.selectedVariantForModal = type;
    this.tempText = type.technical_description || '';
    this.isTechDescModalOpen = true;
  }

  saveTechDesc(): void {
    if (this.selectedVariantForModal) {
      this.selectedVariantForModal.technical_description = this.tempText.trim();
    }
    this.isTechDescModalOpen = false;
    this.selectedVariantForModal = null;
  }

  regenerateTechDescInModal(): void {
    if (!this.selectedVariantForModal) return;
    const ops = this.selectedVariantForModal.operations || [];
    if (ops.length === 0) {
      this.tempText = 'Confección estándar.';
      return;
    }
    const validOps = ops.filter((o: any) => o.operation_name && o.operation_name.trim());
    if (validOps.length === 0) {
      this.tempText = 'Confección estándar.';
      return;
    }
    const desc = validOps.map((o: any) => `${o.operation_name.trim()} (${o.machine_name || 'PLANA'})`).join(', ');
    this.tempText = `Confección mediante ${desc}.`;
  }

  closeTechDescModal(): void {
    this.isTechDescModalOpen = false;
    this.selectedVariantForModal = null;
  }

  // --- Submodal: Inhabilitar / Habilitar Variante ---
  toggleVariantActive(type: any): void {
    if (type.is_active === false) {
      // Re-habilitar directamente
      type.is_active = true;
      type.disabled_reason = null;
    } else {
      // Abrir modal para capturar motivo
      this.selectedVariantForModal = type;
      this.tempDisableReason = type.disabled_reason || '';
      this.isDisableReasonModalOpen = true;
    }
  }

  openEditDisableReason(type: any): void {
    this.selectedVariantForModal = type;
    this.tempDisableReason = type.disabled_reason || '';
    this.isDisableReasonModalOpen = true;
  }

  selectQuickReason(reason: string): void {
    this.tempDisableReason = reason;
  }

  confirmDisableVariant(): void {
    if (this.selectedVariantForModal) {
      this.selectedVariantForModal.is_active = false;
      this.selectedVariantForModal.disabled_reason = this.tempDisableReason.trim() || 'No disponible temporalmente';
    }
    this.isDisableReasonModalOpen = false;
    this.selectedVariantForModal = null;
  }

  closeDisableReasonModal(): void {
    this.isDisableReasonModalOpen = false;
    this.selectedVariantForModal = null;
  }

  onAddVariant(): void {
    this.addType.emit();
    setTimeout(() => {
      if (this.modalBody?.nativeElement) {
        this.modalBody.nativeElement.scrollTo({
          top: this.modalBody.nativeElement.scrollHeight,
          behavior: 'smooth'
        });
      }
      const inputs = this.modalBody?.nativeElement?.querySelectorAll('.variant-name-input');
      if (inputs && inputs.length > 0) {
        const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
        lastInput?.focus();
        lastInput?.select();
      }
    }, 120);
  }

  onAddOperation(type: any, typeIndex: number): void {
    type._isExpanded = true;
    this.addOperationToVariant.emit(type);
    setTimeout(() => {
      const typeContainers = this.modalBody?.nativeElement?.querySelectorAll('.variant-container');
      if (typeContainers && typeContainers[typeIndex]) {
        const opInputs = typeContainers[typeIndex].querySelectorAll('.op-name-input');
        if (opInputs && opInputs.length > 0) {
          const lastOpInput = opInputs[opInputs.length - 1] as HTMLInputElement;
          lastOpInput?.focus();
        }
      }
    }, 120);
  }

  calculateTypeTotalTime(type: any): number {
    if (!type.operations || type.operations.length === 0) return 0;
    const sum = type.operations.reduce((acc: number, op: any) => acc + (parseFloat(op.execution_time) || 0), 0);
    return parseFloat(sum.toFixed(2));
  }

  getFilteredOpSuggestions(query: string): SharedOperation[] {
    if (!query || !query.trim()) return [];
    const q = query.toLowerCase().trim();
    return this.sharedOperationsLibrary.filter(op =>
      op.operation_name.toLowerCase().includes(q) ||
      (op.category && op.category.toLowerCase().includes(q))
    ).slice(0, 6);
  }

  onNameInput(): void {
    this.generateAutoCode.emit(false);
  }

  onSelectIcon(iconName: string): void {
    this.partForm.icon = iconName;
    this.selectIcon.emit(iconName);
    this.showIconPicker = false;
  }
}
