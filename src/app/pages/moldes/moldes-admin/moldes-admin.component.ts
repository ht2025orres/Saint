import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MoldService } from '../../../services/mold.service';
import { AuthService } from '../../../services/auth.service';
import { CdkDragEnd } from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';
import { getGarmentTemplate } from '../garment-templates';

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
  selector: 'app-moldes-admin',
  templateUrl: './moldes-admin.component.html',
  styleUrls: ['./moldes-admin.component.css']
})
export class MoldesAdminComponent implements OnInit {
  @ViewChild('svgContainer') svgContainer!: ElementRef<HTMLDivElement>;

  moldId: number | null = null;
  isEditMode = false;
  isReadOnly = false;

  // Form fields
  moldName = '';
  moldDescription = '';
  mold_category_id: number | null = null;
  moldCategories: any[] = [];
  showCategoryManager = false;

  // SVG Logic
  viewBox: string = '0 0 200 200';
  currentTemplate: any = null;
  customImageUrl: string = '';
  backImageUrl: string = '';
  pendingImageFile: File | null = null;
  pendingBackImageFile: File | null = null;
  activeView: 'front' | 'back' = 'front';
  activeTab: 'molde' | 'formulario' | 'texto' = 'molde';

  // Parts / Pins
  parts: MoldPart[] = [];
  backParts: MoldPart[] = [];
  availableComponents: any[] = [];
  selectedComponentId: number | null = null;
  
  isNewPart = false;

  // Pin pendiente para creación diferida
  pendingPin: { x: number | null; y: number | null } | null = null;
  
  // Text view
  textContent = '';
  showTextSuggestions = false;
  textSuggestionResults: any[] = [];

  // Promote general to positioned
  promotingPartIndex: number | null = null;
  awaitingPosition = false;

  // Edit modal state
  showEditModal = false;
  editingPart: MoldPart | null = null;
  showInventorySearch = false;

  // Add item modal
  showAddModal = false;
  addModalType: 'general' | 'component' = 'general';
  addName = '';
  addSearchQuery = '';
  addItemType = 'parte';
  showAddSuggestions = false;
  popoverPosition: { x: number; y: number } | null = null;

  // Inline editing
  inlineAdding = false;
  inlineAddingType: 'general' | 'component' = 'general';
  inlineEditingPart: MoldPart | null = null;
  inlineEditName = '';
  inlineEditType = 'parte';

  startInlineEdit(part: MoldPart): void {
    this.inlineEditingPart = part;
    this.inlineEditName = part.name;
    this.inlineEditType = part.item_type;
  }

  saveInlineEdit(): void {
    if (this.inlineEditingPart && this.inlineEditName.trim()) {
      this.inlineEditingPart.name = this.inlineEditName.trim();
      this.inlineEditingPart.item_type = this.inlineEditType as any;
      this.inlineEditingPart = null;
      if (this.activeTab === 'texto') this.buildTextContent();
      this.saveDraft();
    }
  }

  cancelInlineEdit(): void {
    this.inlineEditingPart = null;
  }

  startInlineAdd(type: 'general' | 'component', itemType: string = 'parte'): void {
    this.inlineAdding = true;
    this.inlineAddingType = type;
    this.inlineEditName = '';
    this.inlineEditType = itemType;
  }

  confirmInlineAdd(): void {
    const finalName = this.inlineEditName.trim();
    if (!finalName) {
      this.inlineAdding = false;
      return;
    }

    const comp = this.availableComponents.find(c =>
      c.display_name.toLowerCase() === finalName.toLowerCase()
    );
    const newPart: MoldPart = {
      name: finalName,
      garment_component_id: comp?.id || undefined,
      position_x: null,
      position_y: null,
      item_type: this.inlineEditType as any,
      is_mandatory: true,
      view: this.activeView
    };

    if (this.activeView === 'back') {
      this.backParts.push(newPart);
    } else {
      this.parts.push(newPart);
    }
    
    this.inlineAdding = false;
    if (this.activeTab === 'texto') this.buildTextContent();
    this.saveDraft();
  }

  // Text validation
  textWarnings: string[] = [];

  // States
  saving = false;
  loading = false;
  showGeneralSelector = false;
  errorMessage = '';
  successMessage = '';

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Si estamos editando inline
    if (this.inlineEditingPart) {
      const editingRow = document.querySelector('.inline-editing-row');
      if (editingRow && !editingRow.contains(target)) {
        if (this.inlineEditName.trim() !== this.inlineEditingPart.name || this.inlineEditType !== this.inlineEditingPart.item_type) {
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
        if (this.inlineEditName.trim()) {
          this.confirmInlineAdd();
        } else {
          this.inlineAdding = false;
        }
      }
    }
  }

  constructor(
    private moldService: MoldService,
    private route: ActivatedRoute,
    private router: Router,
    public authService: AuthService
  ) {}

  // ==================== PERMISSIONS ====================
  // 1 = Admin del sistema (ve todo)
  // 41 = Crear, 42 = Editar, 43 = Eliminar, 44 = Subir imagen, 45 = Categorías

  get canCreate(): boolean { return this.authService.hasAnyPermission([1, 41]); }
  get canEdit(): boolean { return this.authService.hasAnyPermission([1, 42]); }
  get canDelete(): boolean { return this.authService.hasAnyPermission([1, 43]); }
  get canUploadImage(): boolean { return this.authService.hasAnyPermission([1, 44]); }
  get canManageCategories(): boolean { return this.authService.hasAnyPermission([1, 45]); }

  ngOnInit(): void {
    this.moldId = this.route.snapshot.params['id'] ? Number(this.route.snapshot.params['id']) : null;
    this.isEditMode = !!this.moldId;
    
    // Read-only si el query param es 'view' O si no tiene permiso de edición
    const isViewMode = this.route.snapshot.queryParams['mode'] === 'view';
    this.isReadOnly = isViewMode || (this.isEditMode && !this.canEdit) || (!this.isEditMode && !this.canCreate);
    
    this.loadMoldCategories();

    if (this.isEditMode && this.moldId) {
      this.loadMold();
    } else {
      this.checkDraft();
    }
  }

  // ==================== DRAFT LOGIC ====================
  private readonly DRAFT_KEY = 'draft_mold_admin';

  saveDraft(): void {
    if (this.isReadOnly) return;
    
    const draft = {
      moldName: this.moldName,
      moldDescription: this.moldDescription,
      mold_category_id: this.mold_category_id,
      parts: this.parts,
      backParts: this.backParts,
      customImageUrl: this.customImageUrl,
      backImageUrl: this.backImageUrl,
      timestamp: new Date().getTime()
    };
    localStorage.setItem(this.DRAFT_KEY, JSON.stringify(draft));
  }

  checkDraft(): void {
    const saved = localStorage.getItem(this.DRAFT_KEY);
    if (saved) {
      const draft = JSON.parse(saved);
      if (draft.moldName || draft.parts.length > 0 || draft.backParts.length > 0) {
        Swal.fire({
          title: '¿Restaurar borrador?',
          text: `Tienes un trabajo pendiente del ${new Date(draft.timestamp).toLocaleString()}. ¿Deseas recuperarlo?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sí, restaurar',
          cancelButtonText: 'No, descartar',
          confirmButtonColor: '#4f46e5'
        }).then((result) => {
          if (result.isConfirmed) {
            this.restoreDraft(draft);
          } else {
            this.clearDraft();
          }
        });
      }
    }
  }

  restoreDraft(draft: any): void {
    this.moldName = draft.moldName || '';
    this.moldDescription = draft.moldDescription || '';
    this.mold_category_id = draft.mold_category_id || null;
    this.parts = draft.parts || [];
    this.backParts = draft.backParts || [];
    this.customImageUrl = draft.customImageUrl || '';
    this.backImageUrl = draft.backImageUrl || '';
    
    // Sincronizar la imagen actual del diseño
    if (this.activeView === 'back' && this.backImageUrl) {
      this.currentTemplate = { image: this.backImageUrl };
    } else if (this.customImageUrl) {
      this.currentTemplate = { image: this.customImageUrl };
    }
    
    Swal.fire({ title: 'Borrador restaurado', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
  }

  clearDraft(): void {
    localStorage.removeItem(this.DRAFT_KEY);
  }

  loadMold(): void {
    this.moldService.getMold(this.moldId!).subscribe({
      next: (res: any) => {
        const mold = res.data;
        this.moldName = mold.name;
        this.moldDescription = mold.description || '';
        this.mold_category_id = mold.mold_category_id || null;
        this.customImageUrl = mold.image_signed_url || '';
        this.backImageUrl = mold.back_image_signed_url || '';
        
        const allParts = mold.parts || [];
        this.parts = allParts.filter((p: any) => p.view !== 'back');
        this.backParts = allParts.filter((p: any) => p.view === 'back');

        // Load garment template from the mold image if available
        if (this.customImageUrl) {
          this.currentTemplate = { image: this.customImageUrl };
        }
      },
      error: (err) => {
        console.error('Error loading mold:', err);
        Swal.fire('Error', 'No se pudo cargar la información del molde', 'error');
      }
    });
  }

  loadMoldCategories(): void {
    this.moldService.getCategories().subscribe({
      next: (res: any) => {
        this.moldCategories = res.data || [];
      },
      error: () => {}
    });
  }

  onCategoryChange(): void {
    // Categories no longer control template — template comes from uploaded image
    this.availableComponents = [];
  }

  generateAssembledGarment(description: string, categoryId: number): any {
    return getGarmentTemplate(description, categoryId);
  }

  loadAvailableComponents(categoryId: number): void {
    this.moldService.getComponentsByCategory(categoryId).subscribe({
      next: (res) => {
        this.availableComponents = res.data;
      },
      error: (err) => {
        console.error('Error loading components:', err);
      }
    });
  }

  onCustomImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire('Error', 'La imagen no puede superar los 5MB', 'error');
        return;
      }

      // If mold already exists, upload directly to S3
      if (this.moldId) {
        this.moldService.uploadMoldImage(this.moldId, file, this.activeView).subscribe({
          next: (res: any) => {
            if (this.activeView === 'back') {
              this.backImageUrl = res.data?.back_image_signed_url || '';
            } else {
              this.customImageUrl = res.data?.image_signed_url || '';
            }
            this.saveDraft();
            Swal.fire({ title: 'Imagen subida', icon: 'success', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo subir la imagen', 'error')
        });
      } else {
        // For new molds, show preview and store file for upload after save
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (this.activeView === 'back') {
            this.backImageUrl = dataUrl;
            this.pendingBackImageFile = file;
          } else {
            this.customImageUrl = dataUrl;
            this.pendingImageFile = file;
          }
          this.saveDraft();
        };
        reader.readAsDataURL(file);
      }
    }
  }

  private applyInitialParts(): void {
    if (this.currentTemplate && !this.isEditMode) {
      this.parts = [];
      this.backParts = [];
    }
  }

  toggleView(): void {
    this.activeView = this.activeView === 'front' ? 'back' : 'front';
    this.pendingPin = null;
    this.selectedComponentId = null;
  }

  get hasBackView(): boolean {
    return !!this.backImageUrl;
  }

  get activeImage(): string {
    if (this.activeView === 'back' && this.currentTemplate?.backImage) {
      return this.currentTemplate.backImage;
    }
    return this.currentTemplate?.image || '';
  }

  get activeParts(): MoldPart[] {
    return this.activeView === 'back' ? this.backParts : this.parts;
  }

  get positionedParts(): MoldPart[] {
    return this.activeParts.filter(p => p.position_x !== null);
  }

  get generalParts(): MoldPart[] {
    return this.activeParts.filter(p => p.position_x === null);
  }

  get allPartsList(): MoldPart[] {
    return [...this.parts, ...this.backParts];
  }

  get filteredAddSuggestions(): any[] {
    const q = this.addSearchQuery.toLowerCase().trim();
    if (!q) return this.availableComponents.slice(0, 50);
    return this.availableComponents.filter(c =>
      (c.display_name || c.name || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }

  selectAddSuggestion(s: any): void {
    this.addSearchQuery = s.display_name || s.name;
    this.addItemType = s.item_type || 'parte';
    this.showAddSuggestions = false;
  }

  get materialParts(): MoldPart[] {
    return this.allPartsList.filter(p => p.item_type === 'tela' || p.item_type === 'insumo');
  }

  get structuralParts(): MoldPart[] {
    return this.allPartsList.filter(p => p.item_type === 'parte');
  }

  startEditPart(part: MoldPart): void {
    if (this.isReadOnly) return;
    this.editingPart = { ...part };
    this.showEditModal = true;
    this.isNewPart = false;
    this.pendingPin = part.position_x !== null ? { x: part.position_x, y: part.position_y } : null;
  }

  savePart(updatedPart?: MoldPart): void {
    const partToSave = updatedPart || this.editingPart;
    if (!partToSave || !partToSave.name) {
      Swal.fire('Error', 'El nombre del componente es obligatorio', 'error');
      return;
    }

    if (this.isNewPart) {
      this.activeParts.push({ ...partToSave });
    } else {
      const index = this.activeParts.findIndex(p => p.id === partToSave.id || p.name === partToSave.name);
      if (index !== -1) {
        this.activeParts[index] = { ...partToSave };
      }
    }
    
    this.cancelEdit();
    if (this.activeTab === 'texto') this.buildTextContent();
    this.saveDraft();
  }

  cancelEdit(): void {
    this.showEditModal = false;
    this.editingPart = null;
    this.isNewPart = false;
    this.pendingPin = null;
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.currentTemplate || this.isReadOnly || this.showEditModal) return;

    const target = event.target as HTMLElement;
    // Si el clic fue en un pin existente, no crear uno nuevo
    if (target.closest('.cdk-drag')) return;

    const container = this.svgContainer.nativeElement;
    const rect = container.getBoundingClientRect();
    
    // Posición porcentual para el PIN
    const xPerc = ((event.clientX - rect.left) / rect.width) * 100;
    const yPerc = ((event.clientY - rect.top) / rect.height) * 100;

    const roundedX = Math.round(xPerc * 100) / 100;
    const roundedY = Math.round(yPerc * 100) / 100;

    this.popoverPosition = { x: event.clientX, y: event.clientY };

    if (this.awaitingPosition) {
      const list = this.activeParts;
      if (this.promotingPartIndex !== null) {
        list[this.promotingPartIndex].position_x = roundedX;
        list[this.promotingPartIndex].position_y = roundedY;
      }
      this.awaitingPosition = false;
      this.promotingPartIndex = null;
      return;
    }

    this.addPartAt(roundedX, roundedY);
  }

  addPartAt(x: number | null, y: number | null): void {
    this.isNewPart = true;
    this.pendingPin = { x, y };
    this.editingPart = {
      name: '',
      item_type: 'parte',
      view: this.activeView,
      position_x: x,
      position_y: y,
      is_mandatory: true
    };
    this.showAddModal = true;
  }

  addGeneralComponent(type: string = 'parte'): void {
    this.addItemType = type;
    this.addSearchQuery = '';
    this.showAddSuggestions = false;
    this.showAddModal = true;
  }

  confirmAddModal(part?: any): void {
    const finalName = part ? part.name : (this.addSearchQuery.trim() || this.addName.trim());
    if (!finalName) return;

    const finalType = part ? part.item_type : this.addItemType;

    const comp = this.availableComponents.find(c =>
      (c.display_name || c.name || '').toLowerCase() === finalName.toLowerCase()
    );
    const newPart: MoldPart = {
      name: finalName,
      garment_component_id: comp?.id || undefined,
      position_x: this.pendingPin ? this.pendingPin.x : null,
      position_y: this.pendingPin ? this.pendingPin.y : null,
      item_type: finalType,
      is_mandatory: true,
      editing: false,
      view: this.activeView,
    };
    this.activeParts.push(newPart);
    this.pendingPin = null;
    this.showAddModal = false;
    if (this.activeTab === 'texto') this.buildTextContent();
    this.saveDraft();
  }

  onDragEnd(event: CdkDragEnd, index: number, part: MoldPart): void {
    if (this.isReadOnly) {
      event.source.reset();
      return;
    }
    const element = event.source.getRootElement();
    const container = this.svgContainer.nativeElement;
    const containerRect = container.getBoundingClientRect();
    
    const pinRect = element.getBoundingClientRect();
    const pinX = pinRect.left + pinRect.width / 2;
    const pinY = pinRect.top + pinRect.height / 2;

    // Verificar si el pin se soltó fuera del canvas (zona general)
    const isOutside = pinX < containerRect.left || 
                      pinX > containerRect.right || 
                      pinY < containerRect.top || 
                      pinY > containerRect.bottom;

    if (isOutside) {
      // Convertir a general
      part.position_x = null;
      part.position_y = null;
      Swal.fire({
        title: 'Componente General',
        text: `"${part.name}" ahora es un componente general`,
        icon: 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      });
    } else {
      // Actualizar posición
      const newX = ((pinX - containerRect.left) / containerRect.width) * 100;
      const newY = ((pinY - containerRect.top) / containerRect.height) * 100;
      
      part.position_x = Math.max(0, Math.min(100, newX));
      part.position_y = Math.max(0, Math.min(100, newY));
    }
    
    this.saveDraft();
    event.source.reset();
  }

  onGeneralDragEnd(event: CdkDragEnd, part: MoldPart): void {
    if (this.isReadOnly) {
      event.source.reset();
      return;
    }
    
    const element = event.source.getRootElement();
    const container = this.svgContainer.nativeElement;
    const containerRect = container.getBoundingClientRect();
    
    const dropRect = element.getBoundingClientRect();
    const dropX = dropRect.left + dropRect.width / 2;
    const dropY = dropRect.top + dropRect.height / 2;

    // Verificar si se soltó dentro del canvas
    const isInside = dropX >= containerRect.left && 
                     dropX <= containerRect.right && 
                     dropY >= containerRect.top && 
                     dropY <= containerRect.bottom;

    if (isInside) {
      // Convertir a posicionado
      const newX = ((dropX - containerRect.left) / containerRect.width) * 100;
      const newY = ((dropY - containerRect.top) / containerRect.height) * 100;
      
      part.position_x = Math.round(newX * 100) / 100;
      part.position_y = Math.round(newY * 100) / 100;
      part.view = this.activeView;

      Swal.fire({
        title: 'Componente Posicionado',
        text: `"${part.name}" ha sido posicionado en el diseño`,
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      });
    }
    
    this.saveDraft();
    event.source.reset();
  }

  confirmPin(): void {
    // Esta función ya no se usa porque confirmAddModal maneja ambos casos
  }

  cancelPin(): void {
    this.pendingPin = null;
    this.selectedComponentId = null;
    this.showGeneralSelector = false;
  }

  removePart(item: MoldPart): void {
    if (this.isReadOnly) return;
    const list = item.view === 'back' ? this.backParts : this.parts;
    const index = list.indexOf(item);
    if (index >= 0) {
      list.splice(index, 1);
      if (this.activeTab === 'texto') this.buildTextContent();
      this.saveDraft();
    }
  }

  // Dragging
  isDragging = false;
  draggedPartIndex: number | null = null;

  startDragging(event: MouseEvent, index: number): void {
    if (this.isReadOnly) return;
    event.stopPropagation();
    this.isDragging = true;
    this.draggedPartIndex = index;
    
    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging || this.draggedPartIndex === null || !this.svgContainer) return;
      
      const container = this.svgContainer.nativeElement;
      const rect = container.getBoundingClientRect();
      
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;

      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      this.activeParts[this.draggedPartIndex].position_x = Math.round(x * 100) / 100;
      this.activeParts[this.draggedPartIndex].position_y = Math.round(y * 100) / 100;
    };

    const onMouseUp = () => {
      this.isDragging = false;
      this.draggedPartIndex = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  // ==================== Promote General → Positioned ====================

  startPromote(generalIndex: number): void {
    const realIndex = this.positionedParts.length + generalIndex;
    this.promotingPartIndex = realIndex;
    this.awaitingPosition = true;
  }

  cancelPromote(): void {
    this.awaitingPosition = false;
    this.promotingPartIndex = null;
  }

  // ==================== Text View ====================

  /** Normalize item_type to tela, insumo or parte */
  private normalizeItemType(raw: string): 'tela' | 'insumo' | 'parte' {
    const t = (raw || '').toLowerCase().trim();
    if (t.includes('tela') || t.includes('te')) return 'tela';
    if (t.includes('insumo') || t.includes('in')) return 'insumo';
    if (t.includes('parte') || t.includes('pa')) return 'parte';
    return 'parte'; // Default to part for structural consistency
  }

  buildTextContent(): void {
    const lines: string[] = [];
    const allParts = [...this.parts, ...this.backParts];
    const generals = allParts.filter(p => p.position_x === null);
    const positioned = allParts.filter(p => p.position_x !== null);

    if (generals.length > 0 || positioned.length === 0) {
      lines.push('--- GENERALES ---');
      generals.forEach(g => lines.push(`${g.name} (${this.normalizeItemType(g.item_type)})`));
      lines.push('');
    }
    if (positioned.length > 0) {
      lines.push('--- COMPONENTES ---');
      positioned.forEach(p => lines.push(`${p.name} (${this.normalizeItemType(p.item_type)}) [${p.view || 'front'}]`));
    }
    this.textContent = lines.join('\n');
    this.validateText();
  }

  onTextInput(): void {
    const lines = this.textContent.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    if (!lastLine.startsWith('---')) {
      if (!lastLine) {
        this.textSuggestionResults = this.availableComponents.slice(0, 50);
      } else if (!lastLine.includes('(')) {
        this.textSuggestionResults = this.availableComponents.filter(c =>
          (c.display_name || c.name || '').toLowerCase().includes(lastLine.toLowerCase())
        ).slice(0, 50);
      } else {
        this.textSuggestionResults = [];
      }
      this.showTextSuggestions = this.textSuggestionResults.length > 0;
    } else {
      this.showTextSuggestions = false;
    }
    this.parseTextToParts();
    this.validateText();
  }

  selectTextSuggestion(comp: any): void {
    const lines = this.textContent.split('\n');
    lines[lines.length - 1] = `${comp.display_name} (insumo)`;
    this.textContent = lines.join('\n') + '\n';
    this.showTextSuggestions = false;
    this.parseTextToParts();
    this.validateText();
  }

  dismissTextSuggestions(): void {
    this.showTextSuggestions = false;
  }

  /** Parse text content back into parts arrays — accepts any (tipo) */
  parseTextToParts(): void {
    const lines = this.textContent.split('\n');
    const newParts: MoldPart[] = [];
    let section: 'none' | 'generales' | 'componentes' = 'none';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line === '--- GENERALES ---') { section = 'generales'; continue; }
      if (line === '--- COMPONENTES ---') { section = 'componentes'; continue; }

      // Accept any word(s) inside parentheses: "Nombre (tipo)" or "Nombre (tipo) [vista]"
      const match = line.match(/^(.+?)\s*\(([^)]+)\)(?:\s*\[(front|back)\])?$/);
      if (match) {
        const name = match[1].trim();
        if (!name) continue;
        const rawType = match[2].trim();
        const itemType = this.normalizeItemType(rawType);
        const view = (match[3] as 'front' | 'back') || 'front';
        const existing = [...this.parts, ...this.backParts].find(p => p.name === name);
        newParts.push({
          id: existing?.id,
          name,
          garment_component_id: existing?.garment_component_id,
          position_x: section === 'componentes' ? (existing?.position_x ?? null) : null,
          position_y: section === 'componentes' ? (existing?.position_y ?? null) : null,
          item_type: itemType,
          is_mandatory: existing?.is_mandatory ?? true,
          editing: false,
          view,
        });
      }
    }

    if (newParts.length > 0) {
      this.parts = newParts.filter(p => p.view !== 'back');
      this.backParts = newParts.filter(p => p.view === 'back');
      this.saveDraft();
    }
  }

  /** Validate text and generate warnings */
  validateText(): void {
    const warnings: string[] = [];
    const lines = this.textContent.split('\n');
    let lineNum = 0;
    for (const raw of lines) {
      lineNum++;
      const line = raw.trim();
      if (!line || line.startsWith('---')) continue;

      // Check for parentheses with a type
      const hasParens = /\([^)]+\)/.test(line);
      if (!hasParens) {
        warnings.push(`Línea ${lineNum}: Falta tipo — agrega (tela) o (insumo) después del nombre`);
        continue;
      }
      const match = line.match(/^(.+?)\s*\(([^)]+)\)/);
      if (match && !match[1].trim()) {
        warnings.push(`Línea ${lineNum}: Falta el nombre del componente`);
      }
      const tipo = match ? match[2].trim().toLowerCase() : '';
      if (tipo && tipo !== 'tela' && tipo !== 'insumo' && tipo !== 'parte') {
        warnings.push(`Línea ${lineNum}: Tipo "${tipo}" no reconocido — usa (tela), (insumo) o (parte)`);
      }
    }
    this.textWarnings = warnings;
  }

  // ==================== Save ====================

  saveMold(): void {
    if (!this.moldName.trim()) {
      this.errorMessage = 'El nombre del molde es obligatorio';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const allParts = [
      ...this.parts.map(p => ({ ...p, view: 'front' as const })),
      ...this.backParts.map(p => ({ ...p, view: 'back' as const })),
    ];

    const payload = {
      name: this.moldName.trim(),
      description: this.moldDescription.trim() || undefined,
      mold_category_id: this.mold_category_id,
      parts: allParts.map(p => ({
        id: p.id,
        name: p.name,
        garment_component_id: p.garment_component_id,
        position_x: p.position_x,
        position_y: p.position_y,
        item_type: p.item_type,
        is_mandatory: p.is_mandatory,
        view: p.view,
        description: p.description,
      }))
    };

    const action = this.isEditMode && this.moldId 
      ? this.moldService.updateMold(this.moldId, payload)
      : this.moldService.createMold(payload);

    action.subscribe({
      next: (res: any) => {
        const savedMoldId = res.data?.id || this.moldId;

        // Upload pending images for NEW molds
        const uploads: any[] = [];
        if (this.pendingImageFile && savedMoldId && !this.isEditMode) {
          uploads.push(this.moldService.uploadMoldImage(savedMoldId, this.pendingImageFile, 'front'));
        }
        if (this.pendingBackImageFile && savedMoldId && !this.isEditMode) {
          uploads.push(this.moldService.uploadMoldImage(savedMoldId, this.pendingBackImageFile, 'back'));
        }

        if (uploads.length > 0) {
          let completed = 0;
          uploads.forEach(upload$ => {
            upload$.subscribe({
              next: () => {
                completed++;
                if (completed === uploads.length) {
                  this.saving = false;
                  this.successMessage = 'Molde guardado exitosamente';
                  this.clearDraft();
                  setTimeout(() => this.router.navigate(['/moldes']), 1500);
                }
              },
              error: () => {
                completed++;
                if (completed === uploads.length) {
                  this.saving = false;
                  this.successMessage = 'Molde guardado (alguna imagen pendiente)';
                  this.clearDraft();
                  setTimeout(() => this.router.navigate(['/moldes']), 1500);
                }
              }
            });
          });
        } else {
          this.saving = false;
          this.successMessage = 'Molde guardado exitosamente';
          this.clearDraft();
          setTimeout(() => this.router.navigate(['/moldes']), 1500);
        }
      },
      error: (err: any) => {
        this.saving = false;
        this.errorMessage = err.error?.error || 'Error al guardar el molde';
        console.error(err);
      }
    });
  }

  handleInventorySelect(item: any): void {
    if (this.editingPart) {
      this.editingPart.name = item.descripcion;
      this.editingPart.description = `${item.referencia} - ${item.color}`;
      
      // Si estamos en modo edición, actualizar el componente original y guardar borrador
      const index = this.activeParts.findIndex(p => p === this.editingPart || (p.id && p.id === this.editingPart?.id));
      if (index !== -1) {
        this.activeParts[index] = { ...this.editingPart };
      }

      this.showInventorySearch = false;
      this.saveDraft();
    }
  }

  goBack(): void {
    this.router.navigate(['/moldes']);
  }
}
