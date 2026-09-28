import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MoldService } from '../../../services/mold.service';
import Swal from 'sweetalert2';
import {
  IconOption,
  SharedOperation,
  AnatomicalRegion,
  DEFAULT_REGIONS,
  DEFAULT_CATEGORIES,
  DEFAULT_SHARED_OPERATIONS,
  DEFAULT_ICONS,
  DEFAULT_ICON_CATEGORIES
} from './partes-catalog.models';

export { SharedOperation, AnatomicalRegion, IconOption };

@Component({
  selector: 'app-partes-catalog',
  templateUrl: './partes-catalog.component.html',
  styleUrls: ['./partes-catalog.component.css']
})
export class PartesCatalogComponent implements OnInit {
  activeTab: 'partes' | 'regiones' | 'maquinaria' | 'operaciones' = 'regiones';

  // Parts State
  parts: any[] = [];
  allMasterParts: any[] = [];
  machines: any[] = [];
  isLoading = false;
  searchTerm = '';
  selectedPart: any = null;
  isModalOpen = false;
  isEditing = false;
  selectedZoneFilter = '';

  // Custom Dropdowns State
  showZonePicker = false;
  showIconPicker = false;
  iconSearchTerm = '';
  selectedIconCategory = 'Todos';
  activeOpSuggestionIndex: { typeIdx: number; opIdx: number } | null = null;

  // Form State for Part Modal
  partForm: any = {
    id: null,
    name: '',
    code: '',
    description: '',
    icon: 'bi-box-seam',
    zone: 'manga',
    is_active: true,
    types: []
  };

  // Regiones Anatómicas
  regions: AnatomicalRegion[] = [...DEFAULT_REGIONS];
  isRegionModalOpen = false;
  isEditingRegion = false;
  regionForm: AnatomicalRegion = {
    id: '',
    value: '',
    label: '',
    color: '#3b82f6',
    icon: 'bi-bounding-box-circles',
    description: ''
  };

  // Maquinaria
  isMachineModalOpen = false;
  isEditingMachine = false;
  machineForm: any = { id: null, name: '', code: '', description: '', is_active: true };

  // Operaciones Estándar
  isStandardOpModalOpen = false;
  isEditingStandardOp = false;
  editingStandardOpIndex: number | null = null;
  standardOpForm: SharedOperation = {
    operation_name: '',
    machine_name: 'PLANA',
    execution_time: 0.50,
    category: 'Ensamble'
  };

  categoriesList: string[] = [...DEFAULT_CATEGORIES];
  isCategoryModalOpen = false;
  newCategoryName = '';
  editingCategoryOriginal: string | null = null;
  editingCategoryName = '';

  sharedOperationsLibrary: SharedOperation[] = [...DEFAULT_SHARED_OPERATIONS];
  opSearchTerm = '';
  opSelectedCategory = 'Todas';
  opSelectedMachine = 'Todas';
  machineSearchTerm = '';
  opCurrentPage = 1;
  opPageSize = 10;
  isViewAssignedModalOpen = false;
  selectedOpForViewAssigned: SharedOperation | null = null;

  iconCategories: string[] = [...DEFAULT_ICON_CATEGORIES];
  availableIcons: IconOption[] = [...DEFAULT_ICONS];

  constructor(
    private moldService: MoldService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  get totalVariantsCount(): number {
    return this.allMasterParts.reduce((acc, p) => acc + ((p.types && p.types.length) || 1), 0);
  }

  get totalSamOperationsCount(): number {
    return this.sharedOperationsLibrary.length;
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

  ngOnInit(): void {
    const tabParam = this.route.snapshot.queryParams['tab'];
    if (tabParam && ['partes', 'regiones', 'maquinaria', 'operaciones'].includes(tabParam)) {
      this.activeTab = tabParam as any;
    }
    this.loadParts();
    this.loadMachines();
  }

  setTab(tab: 'partes' | 'regiones' | 'maquinaria' | 'operaciones'): void {
    this.activeTab = tab;
  }

  // ==================== PARTES ====================

  get filteredParts(): any[] {
    let list = this.allMasterParts || [];
    if (this.selectedZoneFilter) list = list.filter(p => p.zone === this.selectedZoneFilter);
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase().trim();
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.types && p.types.some((t: any) => t.name.toLowerCase().includes(q)))
      );
    }
    return list;
  }

  // Modal de catálogo de partes de una región específica
  isRegionPartsModalOpen = false;
  selectedRegionForPartsModal: AnatomicalRegion | null = null;
  isGeneralPartsModal = false;
  regionModalParts: any[] = [];

  loadParts(forceRefresh = false): void {
    this.isLoading = true;
    this.moldService.getGarmentParts(undefined, true, undefined, forceRefresh).subscribe({
      next: (res: any) => {
        this.allMasterParts = res.data || [];
        this.parts = this.allMasterParts;
        this.syncSharedOperationsFromParts();
        if (this.selectedRegionForPartsModal) {
          const zoneVal = this.selectedRegionForPartsModal.value;
          this.regionModalParts = this.allMasterParts.filter(p => p.zone === zoneVal);
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        Swal.fire('Error', 'No se pudieron cargar las partes del catálogo', 'error');
      }
    });
  }

  openRegionPartsModal(regOrValue: AnatomicalRegion | string): void {
    if (typeof regOrValue === 'string') {
      if (regOrValue === 'general') {
        this.isGeneralPartsModal = true;
        this.selectedRegionForPartsModal = {
          id: 'general',
          value: 'general',
          label: 'Partes Generales & Apliques',
          color: '#f59e0b',
          icon: 'bi-gem',
          description: 'Elementos transversales (Logos, Bordados, Cintas Reflectivas, Marquillas, Estampados, Vivos).'
        };
        this.regionModalParts = this.allMasterParts.filter(p => p.zone === 'general');
      } else {
        const found = this.regions.find(r => r.value === regOrValue);
        this.selectedRegionForPartsModal = found || null;
        this.isGeneralPartsModal = false;
        this.regionModalParts = this.allMasterParts.filter(p => p.zone === regOrValue);
      }
    } else {
      this.selectedRegionForPartsModal = regOrValue;
      this.isGeneralPartsModal = (regOrValue.value === 'general');
      this.regionModalParts = this.allMasterParts.filter(p => p.zone === regOrValue.value);
    }
    this.isRegionPartsModalOpen = true;
  }

  closeRegionPartsModal(): void {
    this.isRegionPartsModalOpen = false;
    this.selectedRegionForPartsModal = null;
    this.regionModalParts = [];
  }

  syncSharedOperationsFromParts(): void {
    const existing = new Map<string, SharedOperation>();
    this.sharedOperationsLibrary.forEach(op => existing.set(op.operation_name.toUpperCase(), op));
    this.allMasterParts.forEach(p => {
      (p.types || []).forEach((t: any) => {
        (t.operations || []).forEach((op: any) => {
          if (op.operation_name && !existing.has(op.operation_name.toUpperCase())) {
            const newOp: SharedOperation = {
              operation_name: op.operation_name.toUpperCase(),
              machine_name: op.machine_name || 'PLANA',
              execution_time: parseFloat(op.execution_time) || 0.5,
              category: this.getRegionLabel(p.zone) || 'Ensamble'
            };
            this.sharedOperationsLibrary.push(newOp);
            existing.set(newOp.operation_name, newOp);
          }
        });
      });
    });
  }

  openCreateModal(zone?: string): void {
    this.isEditing = false;
    this.selectedPart = null;
    this.partForm = {
      id: null,
      name: '',
      code: '',
      description: '',
      icon: 'bi-box-seam',
      zone: zone || this.selectedZoneFilter || 'manga',
      is_active: true,
      types: [
        { name: 'Estándar', description: '', technical_description: '', materials: ['Tela Principal', 'Hilo de Confección'], total_time: 0, is_active: true, disabled_reason: '', _isExpanded: true, operations: [] }
      ]
    };
    this.isModalOpen = true;
  }

  openEditModal(part: any): void {
    this.isEditing = true;
    this.selectedPart = part;
    this.partForm = JSON.parse(JSON.stringify(part));
    if (!this.partForm.types || this.partForm.types.length === 0) {
      this.partForm.types = [
        { name: 'Estándar', description: '', technical_description: '', materials: ['Tela Principal', 'Hilo de Confección'], total_time: 0, is_active: true, disabled_reason: '', _isExpanded: true, operations: [] }
      ];
    } else {
      this.partForm.types.forEach((t: any, idx: number) => {
        t._isExpanded = (idx === 0);
        if (t.is_active === undefined) t.is_active = true;
        if (!t.materials || t.materials.length === 0) t.materials = ['Tela Principal', 'Hilo de Confección'];
      });
    }
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedPart = null;
  }

  savePart(): void {
    if (!this.partForm.name.trim()) {
      Swal.fire('Atención', 'El nombre de la parte es obligatorio', 'warning');
      return;
    }

    const payload = {
      name: this.partForm.name.trim(),
      code: this.partForm.code?.trim() || null,
      description: this.partForm.description?.trim() || null,
      icon: this.partForm.icon || 'bi-box-seam',
      zone: this.partForm.zone || 'general',
      is_active: this.partForm.is_active !== undefined ? this.partForm.is_active : true,
      types: (this.partForm.types || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description || null,
        technical_description: t.technical_description || null,
        materials: t.materials && Array.isArray(t.materials) ? t.materials : ['Tela Principal', 'Hilo de Confección'],
        total_time: (t.operations || []).reduce((acc: number, o: any) => acc + (parseFloat(o.execution_time) || 0), 0),
        is_active: t.is_active !== undefined ? !!t.is_active : true,
        disabled_reason: !t.is_active ? (t.disabled_reason || null) : null,
        operations: (t.operations || []).map((op: any) => ({
          id: op.id,
          mold_machine_id: op.mold_machine_id,
          machine_name: op.machine_name || 'PLANA',
          operation_name: op.operation_name,
          execution_time: parseFloat(op.execution_time) || 0
        }))
      }))
    };

    const action$ = this.isEditing && this.partForm.id
      ? this.moldService.updateGarmentPart(this.partForm.id, payload)
      : this.moldService.createGarmentPart(payload);

    action$.subscribe({
      next: () => {
        this.isModalOpen = false;
        this.loadParts(true);
        Swal.fire({ title: 'Guardado exitoso', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
      },
      error: (err: any) => Swal.fire('Error', err.error?.error || 'No se pudo guardar la parte', 'error')
    });
  }

  deletePart(part: any): void {
    Swal.fire({
      title: `¿Eliminar "${part.name}"?`,
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then(result => {
      if (result.isConfirmed) {
        this.moldService.deleteGarmentPart(part.id).subscribe({
          next: () => {
            this.loadParts(true);
            Swal.fire({ title: 'Parte eliminada', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
          },
          error: (err: any) => Swal.fire('Error', err.error?.error || 'No se pudo eliminar la parte', 'error')
        });
      }
    });
  }

  // ==================== FORM BUILDER HELPERS ====================

  generateAutoCode(_event?: any): void {
    const name = this.partForm.name;
    if (!name) { this.partForm.code = ''; return; }
    const clean = name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    this.partForm.code = `PRT_${clean}`;
  }

  selectZone(zoneKey: string): void {
    this.partForm.zone = zoneKey;
    this.showZonePicker = false;
  }

  selectIcon(iconName: string): void {
    this.partForm.icon = iconName;
    this.showIconPicker = false;
  }

  addType(): void {
    if (!this.partForm.types) this.partForm.types = [];
    this.partForm.types.push({
      name: 'Nueva Variante',
      description: '',
      technical_description: '',
      materials: ['Tela Principal', 'Hilo de Confección'],
      total_time: 0,
      is_active: true,
      disabled_reason: '',
      _isExpanded: true,
      operations: []
    });
  }

  removeType(index: number): void {
    if (this.partForm.types) this.partForm.types.splice(index, 1);
  }

  setDefaultType(selectedType: any): void {
    if (this.partForm.types) {
      this.partForm.types.forEach((t: any) => t.is_default = false);
      selectedType.is_default = true;
    }
  }

  autoGenerateTechnicalDescription(type: any): void {
    if (!type.operations || type.operations.length === 0) return;
    const desc = type.operations.map((o: any) => `${o.operation_name} (${o.machine_name || 'PLANA'})`).join(', ');
    type.technical_description = `Confección con ${desc}.`;
  }

  toggleModalVariant(_type: any): void {
    // Gestionado localmente en el componente modal
  }

  addOperation(type: any): void {
    if (!type.operations) type.operations = [];
    type._isExpanded = true;
    type.operations.push({
      machine_name: 'PLANA',
      operation_name: '',
      execution_time: 0.5
    });
  }

  removeOperation(type: any, opIndex: number): void {
    if (type.operations) type.operations.splice(opIndex, 1);
  }

  selectSharedOp(typeIdx: number, opIdx: number, op: SharedOperation): void {
    if (this.partForm.types?.[typeIdx]?.operations?.[opIdx]) {
      const target = this.partForm.types[typeIdx].operations[opIdx];
      target.operation_name = op.operation_name;
      target.machine_name = op.machine_name;
      target.execution_time = op.execution_time;
    }
    this.activeOpSuggestionIndex = null;
  }

  // ==================== REGIONES ANATÓMICAS ====================

  selectRegionFilter(regionKey: string): void {
    this.selectedZoneFilter = (this.selectedZoneFilter === regionKey) ? '' : regionKey;
  }

  filterByRegionAndSwitchTab(regionKey: string): void {
    this.selectedZoneFilter = regionKey;
    this.activeTab = 'partes';
  }

  openCreateRegionModal(): void {
    this.isEditingRegion = false;
    this.regionForm = { id: '', value: '', label: '', color: '#3b82f6', icon: 'bi-bounding-box-circles', description: '' };
    this.isRegionModalOpen = true;
  }

  openEditRegionModal(region: AnatomicalRegion): void {
    this.isEditingRegion = true;
    this.regionForm = JSON.parse(JSON.stringify(region));
    this.isRegionModalOpen = true;
  }

  saveRegion(): void {
    if (!this.regionForm.label.trim()) return;
    if (!this.regionForm.value) {
      this.regionForm.value = this.regionForm.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
      this.regionForm.id = this.regionForm.value;
    }
    const idx = this.regions.findIndex(r => r.id === this.regionForm.id || r.value === this.regionForm.value);
    if (idx !== -1) {
      this.regions[idx] = { ...this.regionForm };
    } else {
      this.regions.push({ ...this.regionForm });
    }
    this.isRegionModalOpen = false;
  }

  getRegionLabel(zoneKey: string): string {
    return this.regions.find(r => r.value === zoneKey)?.label || zoneKey;
  }

  // ==================== MAQUINARIA ====================

  loadMachines(): void {
    this.moldService.getMoldMachines().subscribe({
      next: (res: any) => this.machines = res.data || []
    });
  }

  openCreateMachineModal(): void {
    this.isEditingMachine = false;
    this.machineForm = { id: null, name: '', code: '', description: '', is_active: true };
    this.isMachineModalOpen = true;
  }

  openEditMachineModal(m: any): void {
    this.isEditingMachine = true;
    this.machineForm = JSON.parse(JSON.stringify(m));
    this.isMachineModalOpen = true;
  }

  saveMachine(): void {
    if (!this.machineForm.name.trim()) return;
    const action$ = this.isEditingMachine && this.machineForm.id
      ? this.moldService.updateMoldMachine(this.machineForm.id, this.machineForm)
      : this.moldService.createMoldMachine(this.machineForm);

    action$.subscribe({
      next: () => {
        this.isMachineModalOpen = false;
        this.loadMachines();
      }
    });
  }

  deleteMachine(machine: any): void {
    Swal.fire({
      title: `¿Eliminar "${machine.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then(res => {
      if (res.isConfirmed) {
        this.moldService.deleteMoldMachine(machine.id).subscribe({
          next: () => this.loadMachines()
        });
      }
    });
  }

  // ==================== OPERACIONES ESTÁNDAR ====================

  openCreateStandardOpModal(): void {
    this.isEditingStandardOp = false;
    this.editingStandardOpIndex = null;
    this.standardOpForm = { operation_name: '', machine_name: 'PLANA', execution_time: 0.50, category: 'Ensamble' };
    this.isStandardOpModalOpen = true;
  }

  openEditStandardOpModal(op: SharedOperation, index: number): void {
    this.isEditingStandardOp = true;
    this.editingStandardOpIndex = index;
    this.standardOpForm = JSON.parse(JSON.stringify(op));
    this.isStandardOpModalOpen = true;
  }

  saveStandardOp(): void {
    if (!this.standardOpForm.operation_name.trim()) return;
    if (this.isEditingStandardOp && this.editingStandardOpIndex !== null) {
      this.sharedOperationsLibrary[this.editingStandardOpIndex] = { ...this.standardOpForm };
    } else {
      this.sharedOperationsLibrary.push({ ...this.standardOpForm });
    }
    this.isStandardOpModalOpen = false;
  }

  deleteStandardOp(index: number): void {
    this.sharedOperationsLibrary.splice(index, 1);
  }

  goBack(): void { this.router.navigate(['/moldes']); }
}
