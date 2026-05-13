import { Component, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { MoldService } from '../../../services/mold.service';
import { AuthService } from '../../../services/auth.service';


export interface OpmMaterial {
  id_item: string;
  referencia: string;
  descripcion: string;
  id_color: string;
  color: string;
  costo_unitario: number;
  existencias: number;
  is_fabric: boolean;
  assignment_source: 'siesa' | 'manual';
}

export interface ComponentItem {
  mold_part_id: number | null;
  name: string;
  item_type: 'tela' | 'insumo' | 'parte';
  view: 'front' | 'back';
  position_x: number | null;
  position_y: number | null;
  is_mandatory: boolean;
  client_spec: string;
  technical_spec: string;
  material_exception: OpmMaterial | null;
  is_from_mold: boolean;
  is_expanded?: boolean; // Propiedad para controlar la expansión del texto
}

@Component({
  selector: 'app-spec-generator',
  templateUrl: './spec-generator.component.html',
  styleUrls: ['./spec-generator.component.css']
})
export class SpecGeneratorComponent implements OnInit, OnChanges {
  @ViewChild('imageCanvas') imageCanvas!: ElementRef<HTMLDivElement>;
  @ViewChild('textEditor') textEditor!: ElementRef<HTMLTextAreaElement>;

  // Embedded mode (for use inside Solicitud form)
  @Input() embedded = false;
  @Input() externalMoldId: number | null = null;
  @Output() onSpecSaved = new EventEmitter<number>();

  moldId!: number;
  mold: any = null;
  mode: 'opm' | 'ficha' = 'opm';
  opmReference = '';
  generalDescription = '';
  activeView: 'front' | 'back' = 'front';
  activeTab: 'molde' | 'formulario' | 'texto' = 'molde';

  // Data
  components: ComponentItem[] = [];
  availableComponents: any[] = [];
  selectedPartIndex: number | null = null;
  selectedPartType: 'general' | 'component' | null = null;

  // Dynamic pin
  dynamicPinPosition: { x: number; y: number } | null = null;

  // Inventory modal
  showInventoryModal = false;
  inventoryFromSpecEditor = false;
  inventoryFilterType: 'todos' | 'tela' | 'insumo' = 'todos';

  // Spec Editor Modal
  showSpecEditor = false;
  specEditorIndex: number | null = null;
  specEditorComponent: ComponentItem | null = null;
  specEditorClientSpec = '';
  specEditorTechnicalSpec = '';

  // Manual modal
  showManualModal = false;
  manualModalIndex: number | null = null;
  manualText = '';
  manualColor = '';

  // Add item modal
  showAddModal = false;
  addModalType: 'general' | 'component' = 'general';
  editingPart: any = null;
  pendingPin: { x: number | null; y: number | null } | null = null;
  popoverPosition: { x: number; y: number } | null = null;

  // Inline editing / adding
  inlineAdding = false;
  inlineAddingType: 'general' | 'component' = 'general';
  inlineEditingIndex: number | null = null;
  inlineEditName = '';
  inlineEditType: 'tela' | 'insumo' | 'parte' = 'parte';
  addSearchQuery = '';
  addItemType: 'tela' | 'insumo' | 'parte' = 'parte';
  showAddSuggestions = false;

  startInlineEdit(index: number): void {
    const comp = this.components[index];
    this.inlineEditingIndex = index;
    this.inlineEditName = comp.name;
    this.inlineEditType = comp.item_type;
  }

  saveInlineEdit(): void {
    if (this.inlineEditingIndex !== null && this.inlineEditName.trim()) {
      this.components[this.inlineEditingIndex].name = this.inlineEditName.trim();
      this.components[this.inlineEditingIndex].item_type = this.inlineEditType;
      this.inlineEditingIndex = null;
      this.buildTextContent();
    }
  }

  cancelInlineEdit(): void {
    this.inlineEditingIndex = null;
  }

  startInlineAdd(type: 'general' | 'component'): void {
    this.inlineAdding = true;
    this.inlineAddingType = type;
    this.addSearchQuery = '';
    this.addItemType = 'parte';
  }

  confirmInlineAdd(): void {
    if (!this.addSearchQuery.trim()) {
      this.inlineAdding = false;
      return;
    }
    
    this.components.push({
      mold_part_id: null,
      name: this.addSearchQuery.trim(),
      item_type: this.addItemType,
      view: this.activeView,
      position_x: null,
      position_y: null,
      is_mandatory: false,
      client_spec: '',
      technical_spec: '',
      material_exception: null,
      is_from_mold: false,
      is_expanded: false,
    });

    this.inlineAdding = false;
    this.buildTextContent();
  }

  get filteredAddSuggestions(): any[] {
    const q = this.addSearchQuery.toLowerCase().trim();
    if (!q) return this.availableComponents.slice(0, 50);
    return this.availableComponents.filter(comp => 
      (comp.display_name || '').toLowerCase().includes(q) ||
      (comp.name || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }

  selectAddSuggestion(comp: any): void {
    this.addSearchQuery = comp.display_name || comp.name;
    this.addItemType = comp.item_type || 'parte';
    this.showAddSuggestions = false;
  }

  // Dragging
  isDragging = false;
  draggedComponentIndex: number | null = null;

  // Text view suggestions
  showSuggestions = false;
  suggestionType: 'component' | 'siesa' = 'component';
  suggestionQuery = '';
  textContent = '';
  allInventory: any[] = [];
  inventoryLoaded = false;

  loadInventory(): void {
    this.moldService.searchInventory('', 'MP001').subscribe({
      next: (res: any) => {
        this.allInventory = res.data || [];
        this.inventoryLoaded = true;
      }
    });
  }

  // States
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Si estamos editando inline
    if (this.inlineEditingIndex !== null) {
      const editingRow = document.querySelector('.inline-editing-row');
      if (editingRow && !editingRow.contains(target)) {
        const comp = this.components[this.inlineEditingIndex];
        if (this.inlineEditName.trim() !== comp.name || this.inlineEditType !== comp.item_type) {
          this.saveInlineEdit();
        } else {
          this.cancelInlineEdit();
        }
      }
    }

    // Si estamos agregando inline
    if (this.inlineAdding) {
      const addingRow = document.querySelector('.inline-adding-row');
      if (addingRow && !addingRow.contains(target) && !target.closest('.bi-plus-circle')) {
        if (this.addSearchQuery.trim()) {
          this.confirmInlineAdd();
        } else {
          this.inlineAdding = false;
        }
      }
    }

    // Si el popover de agregar está abierto (solo para cerrar si se hace clic fuera del canvas y del popover)
    if (this.showAddModal && this.activeTab === 'molde') {
      const popover = document.querySelector('.fixed.z-\\[1100\]');
      const canvas = this.imageCanvas?.nativeElement;
      if (popover && !popover.contains(target) && canvas && !canvas.contains(target)) {
        this.showAddModal = false;
      }
    }
  }

  constructor(
    private moldService: MoldService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  // ==================== PERMISSIONS ====================
  // 1 = Admin, 46 = Crear OPM, 47 = Editar OPM, 48 = Crear ficha, 49 = Editar ficha

  get canCreateOpm(): boolean { return this.authService.hasAnyPermission([1, 46]); }
  get canEditOpm(): boolean { return this.authService.hasAnyPermission([1, 47]); }
  get canCreateFicha(): boolean { return this.authService.hasAnyPermission([1, 48]); }
  get canEditFicha(): boolean { return this.authService.hasAnyPermission([1, 49]); }

  ngOnInit(): void {
    if (this.embedded) {
      // In embedded mode, moldId comes from @Input
      this.mode = 'opm';
      if (this.externalMoldId) {
        this.moldId = this.externalMoldId;
        this.loadMold();
      }
    } else {
      this.mode = this.route.snapshot.data['mode'] || 'opm';
      const idParam = this.route.snapshot.paramMap.get('id');
      if (idParam) {
        this.moldId = parseInt(idParam, 10);
        this.loadMold();
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.embedded && changes['externalMoldId'] && !changes['externalMoldId'].firstChange) {
      const newId = changes['externalMoldId'].currentValue;
      if (newId) {
        this.moldId = newId;
        this.loadMold();
      } else {
        this.mold = null;
        this.components = [];
      }
    }
  }

  // ==================== Computed ====================

  get modeLabel(): string {
    return this.mode === 'ficha' ? 'Ficha Técnica' : 'OPM';
  }

  get hasBackView(): boolean {
    return !!this.mold?.back_image_signed_url;
  }

  get activeImage(): string {
    if (!this.mold) return '';
    if (this.activeView === 'back' && this.mold.back_image_signed_url) {
      return this.mold.back_image_signed_url;
    }
    return this.mold.image_signed_url || '';
  }

  get activeComponents(): ComponentItem[] {
    return this.components.filter(c => c.view === this.activeView || c.position_x === null);
  }

  get positionedComponents(): ComponentItem[] {
    return this.components.filter(c => c.position_x !== null && c.view === this.activeView);
  }

  get generalComponents(): ComponentItem[] {
    return this.components.filter(c => c.position_x === null);
  }

  getAssignedGenerals(): number {
    return this.generalComponents.filter(g => g.material_exception !== null).length;
  }

  getSpecCount(): number {
    return this.mode === 'opm'
      ? this.components.filter(c => c.client_spec.trim()).length
      : this.components.filter(c => c.technical_spec.trim()).length;
  }

  getRealComponentIndex(part: ComponentItem): number {
    return this.components.indexOf(part);
  }

  isComponentComplete(part: ComponentItem): boolean {
    if (this.mode === 'opm') {
      return !!(part.client_spec && part.client_spec.trim().length > 0);
    } else {
      return !!(part.technical_spec && part.technical_spec.trim().length > 0);
    }
  }

  // ==================== Load ====================

  loadMold(): void {
    this.loading = true;
    this.moldService.getMold(this.moldId).subscribe({
      next: (res: any) => {
        this.mold = res.data;
        const parts = this.mold.parts || [];

        this.components = parts.map((p: any) => ({
          mold_part_id: p.id,
          name: p.garment_component?.display_name || p.name || 'Componente',
          item_type: p.item_type || 'parte',
          view: p.view || 'front',
          position_x: p.position_x,
          position_y: p.position_y,
          is_mandatory: true,
          client_spec: '',
          technical_spec: '',
          material_exception: null,
          is_from_mold: true,
          is_expanded: false,
        }));

        if (this.mold?.id_product_category) {
          this.loadAvailableComponents(this.mold.id_product_category);
        }

        this.buildTextContent();
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Error al cargar el molde';
        this.loading = false;
      }
    });
  }

  loadAvailableComponents(categoryId: number): void {
    this.moldService.getComponentsByCategory(categoryId).subscribe({
      next: (res: any) => {
        this.availableComponents = res.data;
      },
      error: (err) => {
        console.error('Error loading components:', err);
      }
    });
  }

  toggleView(): void {
    if (!this.hasBackView) return;
    this.activeView = this.activeView === 'front' ? 'back' : 'front';
  }

  // ==================== Add Items ====================

  openAddModal(type: 'general' | 'component'): void {
    this.addModalType = type;
    this.editingPart = {
      name: '',
      item_type: 'parte',
      view: this.activeView,
      position_x: type === 'component' ? (this.dynamicPinPosition?.x || null) : null,
      position_y: type === 'component' ? (this.dynamicPinPosition?.y || null) : null,
      is_mandatory: false
    };
    this.pendingPin = this.editingPart.position_x !== null ? { x: this.editingPart.position_x, y: this.editingPart.position_y } : null;
    this.showAddModal = true;
  }

  confirmAdd(part?: { name: string, item_type: string }): void {
    if (!this.editingPart && !this.addSearchQuery.trim()) return;

    const finalName = part ? part.name : this.addSearchQuery.trim();
    const finalType = part ? part.item_type : this.addItemType;

    this.components.push({
      mold_part_id: null,
      name: finalName,
      item_type: finalType as any,
      view: this.editingPart?.view || this.activeView,
      position_x: this.editingPart?.position_x || null,
      position_y: this.editingPart?.position_y || null,
      is_mandatory: false,
      client_spec: '',
      technical_spec: '',
      material_exception: null,
      is_from_mold: false,
      is_expanded: false,
    });

    this.showAddModal = false;
    this.editingPart = null;
    this.pendingPin = null;
    this.dynamicPinPosition = null;
    this.addSearchQuery = '';
    this.addItemType = 'parte';
    this.buildTextContent();
  }

  cancelAdd(): void {
    this.showAddModal = false;
    this.editingPart = null;
    this.pendingPin = null;
    this.dynamicPinPosition = null;
  }

  removeComponent(item: ComponentItem): void {
    if (item.is_from_mold) return;
    const index = this.components.indexOf(item);
    if (index >= 0) {
      this.components.splice(index, 1);
      this.buildTextContent();
    }
  }

  // ==================== Spec Editor (primary) ====================

  openSpecEditor(realIndex: number): void {
    this.specEditorIndex = realIndex;
    this.specEditorComponent = this.components[realIndex];
    this.specEditorClientSpec = this.specEditorComponent.client_spec || '';
    this.specEditorTechnicalSpec = this.specEditorComponent.technical_spec || '';
    this.showSpecEditor = true;
  }

  saveSpecEditor(data: { clientSpec: string; technicalSpec: string }): void {
    if (this.specEditorIndex === null) return;
    const c = this.components[this.specEditorIndex];
    c.client_spec = data.clientSpec;
    c.technical_spec = data.technicalSpec;
    this.showSpecEditor = false;
    this.specEditorIndex = null;
    this.specEditorComponent = null;
    this.buildTextContent();
  }

  closeSpecEditor(): void {
    this.showSpecEditor = false;
    this.specEditorIndex = null;
    this.specEditorComponent = null;
  }

  // Exception from within spec editor
  specAddExceptionSiesa(): void {
    if (this.specEditorIndex === null) return;
    this.inventoryFromSpecEditor = true;
    this.showSpecEditor = false;
    this.openSiesaForComponent(this.specEditorIndex);
  }

  specAddExceptionManual(): void {
    if (this.specEditorIndex === null) return;
    this.openManualForComponent(this.specEditorIndex);
  }

  specRemoveException(): void {
    if (this.specEditorIndex === null) return;
    this.components[this.specEditorIndex].material_exception = null;
  }

  // ==================== Canvas Interaction ====================

  onCanvasClick(event: MouseEvent): void {
    if (this.loading || !this.mold || !this.imageCanvas || this.isDragging) return;

    const container = this.imageCanvas.nativeElement;
    const rect = container.getBoundingClientRect();
    
    // Posición porcentual para el PIN
    const xPerc = ((event.clientX - rect.left) / rect.width) * 100;
    const yPerc = ((event.clientY - rect.top) / rect.height) * 100;

    this.dynamicPinPosition = { 
      x: Math.round(xPerc * 100) / 100, 
      y: Math.round(yPerc * 100) / 100 
    };

    // Posición en píxeles para el Popover (flotante)
    this.popoverPosition = {
      x: event.clientX,
      y: event.clientY
    };

    this.openAddModal('component');
  }

  // ==================== Drag & Drop ====================

  startDragging(event: MouseEvent, index: number): void {
    const comp = this.components[index];
    if (comp.is_mandatory) return; // No mover obligatorios

    event.stopPropagation();
    this.isDragging = true;
    this.draggedComponentIndex = index;
    
    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging || this.draggedComponentIndex === null || !this.imageCanvas) return;
      
      const container = this.imageCanvas.nativeElement;
      const rect = container.getBoundingClientRect();
      
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;

      // Limitar dentro del canvas
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      this.components[this.draggedComponentIndex].position_x = Math.round(x * 100) / 100;
      this.components[this.draggedComponentIndex].position_y = Math.round(y * 100) / 100;
    };

    const onMouseUp = () => {
      this.isDragging = false;
      this.draggedComponentIndex = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }



  // ==================== Inventory (Siesa) ====================

  openSiesaForComponent(i: number): void {
    this.selectedPartIndex = i;
    this.inventoryFilterType = this.components[i].item_type === 'tela' ? 'tela' : 'insumo';
    this.showInventoryModal = true;
  }

  handleInventorySelect(item: any): void {
    if (this.selectedPartIndex === null) return;
    const mat: OpmMaterial = {
      id_item: item.id_item || '',
      referencia: item.referencia || '',
      descripcion: item.descripcion || '',
      id_color: item.id_color || '',
      color: item.color || '',
      costo_unitario: item.costo_unitario || 0,
      existencias: item.existencias || 0,
      is_fabric: (item.referencia || '').startsWith('1110'),
      assignment_source: 'siesa',
    };
    this.components[this.selectedPartIndex].material_exception = mat;
    
    const wasFromSpec = this.inventoryFromSpecEditor;
    this.closeModal();

    if (wasFromSpec) {
      this.showSpecEditor = true;
    }
    this.buildTextContent();
  }

  closeModal(): void {
    this.showInventoryModal = false;
    this.selectedPartIndex = null;
    this.inventoryFromSpecEditor = false;
  }

  // ==================== Manual ====================

  openManualForComponent(i: number): void {
    this.manualModalIndex = i;
    this.manualText = this.components[i].material_exception?.descripcion || '';
    this.manualColor = this.components[i].material_exception?.color || '';
    this.showManualModal = true;
  }

  handleManualConfirm(data: { text: string; color: string }): void {
    if (this.manualModalIndex === null) return;
    const mat: OpmMaterial = {
      id_item: '', referencia: '', descripcion: data.text,
      id_color: '', color: data.color,
      costo_unitario: 0, existencias: 0, is_fabric: false,
      assignment_source: 'manual',
    };
    this.components[this.manualModalIndex].material_exception = mat;
    this.closeManualModal();
    this.buildTextContent();
  }

  closeManualModal(): void {
    this.showManualModal = false;
    this.manualModalIndex = null;
    this.manualText = '';
    this.manualColor = '';
  }

  onClearMaterialException(i: number): void {
    this.components[i].material_exception = null;
  }

  onOpenSiesaForItem(i: number): void {
    if (this.components[i].item_type === 'parte') {
      this.onOpenManualForItem(i);
      return;
    }
    this.selectedPartIndex = i;
    this.selectedPartType = 'component';
    this.manualModalIndex = i;
    this.inventoryFilterType = this.components[i].item_type === 'tela' ? 'tela' : 'insumo';
    this.showInventoryModal = true;
  }

  onOpenManualForItem(i: number): void {
    this.openManualForComponent(i);
  }

  // ==================== Text View ====================

  buildTextContent(): void {
    let lines: string[] = [];
    lines.push('=== ELEMENTOS GENERALES ===');
    this.generalComponents.forEach(g => {
      lines.push(`${g.name}:`);
      lines.push(g.material_exception ? `  ${g.material_exception.descripcion}` : '  ');
    });
    lines.push('');
    lines.push('=== COMPONENTES POSICIONADOS ===');
    this.positionedComponents.forEach(c => {
      lines.push(`${c.name}:`);
      if (this.mode === 'opm') {
        lines.push(`  Especificación: ${c.client_spec}`);
      } else {
        lines.push(`  Cliente: ${c.client_spec}`);
        lines.push(`  Técnica: ${c.technical_spec}`);
      }
      if (c.material_exception) {
        lines.push(`  Excepción: ${c.material_exception.descripcion}`);
      }
    });
    this.textContent = lines.join('\n');
  }

  onTextKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const ta = this.textEditor?.nativeElement;
      if (!ta) return;
      const val = ta.value;
      const pos = ta.selectionStart;
      const before = val.substring(0, pos);
      if (before.endsWith('\n')) {
        this.suggestionType = 'component';
        this.suggestionQuery = '';
        this.showSuggestions = true;
      }
    }
  }

  onTextInput(): void {
    const ta = this.textEditor?.nativeElement;
    if (!ta) return;
    const val = ta.value;
    const pos = ta.selectionStart;
    const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
    const currentLine = val.substring(lineStart, pos);
    const colonIdx = currentLine.indexOf(':');
    if (colonIdx >= 0 && pos > lineStart + colonIdx) {
      this.suggestionType = 'siesa';
      this.suggestionQuery = currentLine.substring(colonIdx + 1).trim().toLowerCase();
      this.showSuggestions = true;
      if (!this.inventoryLoaded) this.loadInventory();
    } else {
      this.showSuggestions = false;
    }
  }

  get textSuggestions(): any[] {
    if (this.suggestionType === 'component') {
      const suggestions = [
        { type: 'tela', label: 'Tela (nueva)' },
        { type: 'insumo', label: 'Insumo (nuevo)' },
        { type: 'parte', label: 'Parte (nueva)' },
      ];
      return suggestions;
    } else {
      const q = this.suggestionQuery;
      if (!q) return this.allInventory.slice(0, 50);
      return this.allInventory.filter(i =>
        (i.referencia || '').toLowerCase().includes(q)
        || (i.descripcion || '').toLowerCase().includes(q)
      ).slice(0, 50);
    }
  }

  selectTextSuggestion(item: any): void {
    const ta = this.textEditor?.nativeElement;
    if (!ta) return;
    if (this.suggestionType === 'component') {
      let typeLabel = 'Nuevo Insumo';
      if (item.type === 'tela') typeLabel = 'Nueva Tela';
      if (item.type === 'parte') typeLabel = 'Nueva Parte';
      const name = typeLabel;
      const pos = ta.selectionStart;
      const before = ta.value.substring(0, pos);
      const after = ta.value.substring(pos);
      ta.value = before + name + ':\n  ' + after;
      this.textContent = ta.value;
    } else {
      const pos = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1;
      const colonPos = ta.value.indexOf(':', lineStart);
      const before = ta.value.substring(0, colonPos + 1);
      const lineEnd = ta.value.indexOf('\n', pos);
      const after = lineEnd >= 0 ? ta.value.substring(lineEnd) : '';
      ta.value = before + ' ' + item.descripcion + after;
      this.textContent = ta.value;
    }
    this.showSuggestions = false;
  }

  dismissSuggestions(): void { this.showSuggestions = false; }

  // Public method for parent to call (returns Observable with spec ID)
  saveSpec(): Observable<number | null> {
    if (!this.mold || this.components.length === 0) {
      return of(null);
    }

    this.saving = true;
    this.errorMessage = '';
    const user = this.authService.user;
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';

    const payload = {
      mold_id: this.moldId,
      reference: this.opmReference || null,
      user_created: userName || null,
      parts: this.components.map(c => ({
        mold_part_id: c.mold_part_id,
        name: c.name,
        item_type: c.item_type,
        view: c.view,
        position_x: c.position_x,
        position_y: c.position_y,
        client_spec: c.client_spec || null,
        technical_spec: c.technical_spec || null,
        material_exception: c.material_exception,
        is_from_mold: c.is_from_mold,
      })),
    };

    return this.moldService.createTechnicalSpec(payload).pipe(
      tap((res: any) => {
        this.saving = false;
        this.successMessage = `${this.modeLabel} creada exitosamente`;
      }),
      map((res: any) => res.data?.id || null)
    );
  }

  // Standalone save (used by /moldes route footer button)
  save(): void {
    this.saveSpec().subscribe({
      next: (specId) => {
        if (this.embedded && specId) {
          this.onSpecSaved.emit(specId);
        }
      },
      error: (err: any) => {
        this.saving = false;
        this.errorMessage = err.error?.error || 'Error al guardar';
      }
    });
  }

  get hasComponents(): boolean {
    return this.components.length > 0;
  }

  goBack(): void { this.router.navigate(['/moldes']); }
}
