import { Component, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { MoldService } from '../../../services/mold.service';
import { AuthService } from '../../../services/auth.service';


export interface OpmMaterial {
  id_item: string;
  referencia: string;
  descripcion: string;
  id_color: string;
  color: string;
  id_talla?: string;
  talla?: string;
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
  client_material_exception?: OpmMaterial | null;
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
  @ViewChild('moldImage') moldImage!: ElementRef<HTMLImageElement>;
  @ViewChild('textEditor') textEditor!: ElementRef<HTMLTextAreaElement>;

  // Embedded mode (for use inside Solicitud form)
  @Input() embedded = false;
  @Input() context: 'comercial' | 'muestras' | 'molde' = 'comercial';
  @Input() itemIndex?: number;
  @Input() externalMoldId: number | null = null;
  @Input() technicalSpecId: number | null = null;
  @Input() initialComponents: ComponentItem[] | null = null;
  @Input() itemData: any = null;
  @Input() solicitudData: any = null;
  @Output() onSpecSaved = new EventEmitter<number>();
  @Output() onComponentsChange = new EventEmitter<ComponentItem[]>();

  moldId!: number;
  mold: any = null;
  mode: 'opm' | 'ficha' = 'opm';
  opmReference = '';
  generalDescription = '';
  clientGeneralDescription = '';
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
  hoveredComponent: ComponentItem | null = null;
  pinnedComponent: ComponentItem | null = null;

  onPartHover(part: ComponentItem): void {
    this.hoveredComponent = part;
  }

  onPartLeave(): void {
    this.hoveredComponent = null;
  }

  togglePinPart(part: ComponentItem, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.pinnedComponent === part) {
      this.pinnedComponent = null;
    } else {
      this.pinnedComponent = part;
      this.hoveredComponent = null;
    }
  }

  clearPinnedPart(): void {
    this.pinnedComponent = null;
  }

  get activeOpmPopoverPart(): ComponentItem | null {
    return this.pinnedComponent || this.hoveredComponent;
  }

  isPartActive(part: ComponentItem): boolean {
    return (this.hoveredComponent === part) || (this.pinnedComponent === part);
  }

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
      this.notifyChanges();
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
    this.notifyChanges();
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

  initializeComponentsFromInput(): void {
    this.clientGeneralDescription = 
      this.itemData?.technical_spec?.description || 
      this.itemData?.technical_spec?.general_description || 
      this.itemData?.draftGeneralDescription || 
      this.itemData?.descripcion_general || 
      this.itemData?.especificaciones || 
      this.solicitudData?.observaciones || 
      '';

    if (this.context === 'comercial') {
      if (!this.generalDescription) {
        this.generalDescription = this.clientGeneralDescription;
      }
    } else {
      if (this.itemData?.technical_spec?.technical_description) {
        this.generalDescription = this.itemData.technical_spec.technical_description;
      }
    }

    if (this.initialComponents && this.initialComponents.length > 0) {
      this.components = this.initialComponents.map((c: any) => {
        let clientMat = c.client_material_exception || c.material_exception || null;
        const clientText = c.client_spec || c.spec_content || '';
        const techText = c.technical_spec || '';
        let techMat = c.technical_material_exception || (c.client_material_exception ? c.material_exception : null);

        if (!clientMat && !techMat && (c.inventory_reference || c.inventory_description)) {
          let parsedColor = '';
          let parsedDesc = c.inventory_description || '';
          const matchColor = parsedDesc.match(/\(([^)]+)\)$/);
          if (matchColor) {
            parsedColor = matchColor[1];
          }

          const mat: OpmMaterial = {
            id_item: c.inventory_reference || '',
            referencia: c.inventory_reference || '',
            descripcion: parsedDesc,
            id_color: '',
            color: parsedColor,
            costo_unitario: 0,
            existencias: 0,
            is_fabric: false,
            assignment_source: c.inventory_reference ? 'siesa' : 'manual',
          };
          clientMat = mat;
          techMat = mat;
        }

        if (!clientMat && techMat) clientMat = techMat;
        if (!techMat && clientMat) techMat = clientMat;

        return {
          mold_part_id: c.mold_part_id || c.id || null,
          name: c.name || c.garment_component?.display_name || 'Componente',
          item_type: c.item_type || 'parte',
          view: c.view || 'front',
          position_x: c.position_x,
          position_y: c.position_y,
          is_mandatory: c.is_mandatory ?? true,
          client_spec: clientText,
          technical_spec: techText,
          client_material_exception: clientMat,
          material_exception: techMat,
          is_from_mold: c.is_from_mold ?? true,
          is_expanded: false,
        };
      });
    }
  }

  ngOnInit(): void {
    if (this.embedded) {
      // In embedded mode, moldId comes from @Input
      this.mode = 'opm';
      if (this.externalMoldId) {
        this.moldId = this.externalMoldId;
        
        // Si hay componentes iniciales (del borrador), usarlos. Si no, cargar del molde.
        if (this.initialComponents && this.initialComponents.length > 0) {
          this.initializeComponentsFromInput();
          this.loadMoldMinimal(); // Cargar info del molde y ficha si existe
        } else {
          this.loadMold();
        }
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

  public notifyChanges(): void {
    if (this.embedded) {
      this.onComponentsChange.emit(this.components);
    }
  }

  loadMoldMinimal(): void {
    this.loading = true;
    this.moldService.getMold(this.moldId).subscribe({
      next: (res: any) => {
        this.mold = res.data;
        if (this.technicalSpecId) {
          this.moldService.getTechnicalSpec(this.technicalSpecId).subscribe({
            next: (specRes: any) => {
              if (specRes && specRes.data) {
                const spec = specRes.data;
                this.opmReference = spec.reference || '';
                this.clientGeneralDescription = spec.description || spec.general_description || this.clientGeneralDescription || '';
                if (this.context === 'comercial') {
                  this.generalDescription = spec.description || spec.general_description || this.clientGeneralDescription;
                } else {
                  this.generalDescription = spec.technical_description || '';
                }
                if (spec.parts && spec.parts.length > 0) {
                  this.initialComponents = spec.parts;
                  this.initializeComponentsFromInput();
                }
              }
              this.buildTextContent();
              this.loading = false;
            },
            error: () => {
              this.buildTextContent();
              this.loading = false;
            }
          });
        } else {
          this.buildTextContent();
          this.loading = false;
        }
      },
      error: () => this.loading = false
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.embedded) {
      const moldChanged = changes['externalMoldId'];
      const specChanged = changes['technicalSpecId'];
      const initCompChanged = changes['initialComponents'];

      if (specChanged && changes['technicalSpecId'].currentValue) {
        this.technicalSpecId = changes['technicalSpecId'].currentValue;
      }

      if (initCompChanged && this.initialComponents && this.initialComponents.length > 0) {
        this.initializeComponentsFromInput();
      }

      if (moldChanged || specChanged) {
        const newMoldId = this.externalMoldId;
        if (newMoldId) {
          this.moldId = newMoldId;
          if (this.initialComponents && this.initialComponents.length > 0) {
            this.initializeComponentsFromInput();
            this.loadMoldMinimal();
          } else {
            this.loadMold();
          }
        } else {
          this.mold = null;
          this.components = [];
        }
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
    return this.components.filter(c => this.isComponentComplete(c)).length;
  }

  getRealComponentIndex(part: ComponentItem): number {
    return this.components.indexOf(part);
  }

  isComponentComplete(part: ComponentItem): boolean {
    const hasSpec = !!(part.client_spec && part.client_spec.trim().length > 0) || 
                    !!(part.technical_spec && part.technical_spec.trim().length > 0);
    const hasMaterial = !!part.material_exception || 
                        (!!(part as any).inventory_reference && (part as any).inventory_reference.trim().length > 0) ||
                        (!!(part as any).inventory_description && (part as any).inventory_description.trim().length > 0);
    return hasSpec || hasMaterial;
  }

  // ==================== Load ====================

  loadMold(): void {
    this.loading = true;
    this.moldService.getMold(this.moldId).subscribe({
      next: (res: any) => {
        this.mold = res.data;
        const parts = this.mold.parts || [];

        // Si tenemos un technicalSpecId guardado previamente, cargamos sus especificaciones existentes
        if (this.technicalSpecId) {
          this.moldService.getTechnicalSpec(this.technicalSpecId).subscribe({
            next: (specRes: any) => {
              if (specRes && specRes.data) {
                const spec = specRes.data;
                this.opmReference = spec.reference || '';
                this.clientGeneralDescription = spec.description || spec.general_description || this.clientGeneralDescription || '';
                if (this.context === 'comercial') {
                  this.generalDescription = spec.description || spec.general_description || this.clientGeneralDescription;
                } else {
                  this.generalDescription = spec.technical_description || '';
                }
                if (spec.parts && spec.parts.length > 0) {
                  this.components = spec.parts.map((p: any) => {
                    let clientMat: OpmMaterial | null = p.client_material_exception || null;
                    let techMat: OpmMaterial | null = p.material_exception || null;

                    if (!clientMat && !techMat && (p.inventory_reference || p.inventory_description)) {
                      const mat: OpmMaterial = {
                        id_item: p.inventory_reference || '',
                        referencia: p.inventory_reference || '',
                        descripcion: p.inventory_description || '',
                        id_color: '',
                        color: '',
                        costo_unitario: 0,
                        existencias: 0,
                        is_fabric: false,
                        assignment_source: 'siesa',
                      };
                      clientMat = mat;
                      techMat = mat;
                    }

                    return {
                      mold_part_id: p.mold_part_id || null,
                      name: p.name || 'Componente',
                      item_type: p.item_type || 'parte',
                      view: p.view || 'front',
                      position_x: p.position_x,
                      position_y: p.position_y,
                      is_mandatory: true,
                      client_spec: p.client_spec || '',
                      technical_spec: p.technical_spec || '',
                      client_material_exception: clientMat,
                      material_exception: techMat,
                      is_from_mold: !!p.mold_part_id,
                      is_expanded: false,
                    };
                  });
                }
              }
              if (this.mold?.id_product_category) {
                this.loadAvailableComponents(this.mold.id_product_category);
              }
              this.buildTextContent();
              this.loading = false;
              this.notifyChanges();
            },
            error: () => {
              this.loadDefaultMoldParts(parts);
            }
          });
        } else {
          this.loadDefaultMoldParts(parts);
        }
      },
      error: () => {
        this.errorMessage = 'Error al cargar el molde';
        this.loading = false;
      }
    });
  }

  private loadDefaultMoldParts(parts: any[]): void {
    if (!this.initialComponents || this.initialComponents.length === 0) {
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
    }

    if (this.mold?.id_product_category) {
      this.loadAvailableComponents(this.mold.id_product_category);
    }

    this.buildTextContent();
    this.loading = false;
    this.notifyChanges();
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
    this.notifyChanges();
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
      this.notifyChanges();
    }
  }

  // Spec Editor (primary)
  targetMaterialType: 'client' | 'technical' = 'technical';

  openSpecEditor(realIndex: number): void {
    this.specEditorIndex = realIndex;
    this.specEditorComponent = this.components[realIndex];
    this.specEditorClientSpec = this.specEditorComponent.client_spec || '';
    this.specEditorTechnicalSpec = this.specEditorComponent.technical_spec || '';
    this.targetMaterialType = this.context === 'comercial' ? 'client' : 'technical';
    this.showSpecEditor = true;
  }

  saveSpecEditor(data: { clientSpec: string; technicalSpec: string }): void {
    if (this.specEditorIndex === null) return;
    const c = this.components[this.specEditorIndex];
    c.client_spec = data.clientSpec;
    c.technical_spec = data.technicalSpec;
    this.closeSpecEditor();
    this.buildTextContent();
    this.notifyChanges();
  }

  closeSpecEditor(): void {
    this.showSpecEditor = false;
    this.specEditorIndex = null;
    this.specEditorComponent = null;
    this.targetMaterialType = 'technical';
  }

  // Exception from within spec editor
  specAddExceptionSiesa(): void {
    if (this.specEditorIndex === null) return;
    this.targetMaterialType = 'technical';
    this.inventoryFromSpecEditor = true;
    this.showSpecEditor = false;
    this.openSiesaForComponent(this.specEditorIndex);
  }

  specAddExceptionManual(): void {
    if (this.specEditorIndex === null) return;
    this.targetMaterialType = 'technical';
    this.openManualForComponent(this.specEditorIndex);
  }

  specRemoveException(): void {
    if (this.specEditorIndex === null) return;
    this.components[this.specEditorIndex].material_exception = null;
  }

  specAddClientExceptionSiesa(): void {
    if (this.specEditorIndex === null) return;
    this.targetMaterialType = 'client';
    this.inventoryFromSpecEditor = true;
    this.showSpecEditor = false;
    this.openSiesaForComponent(this.specEditorIndex);
  }

  specAddClientExceptionManual(): void {
    if (this.specEditorIndex === null) return;
    this.targetMaterialType = 'client';
    this.openManualForComponent(this.specEditorIndex);
  }

  specRemoveClientException(): void {
    if (this.specEditorIndex === null) return;
    this.components[this.specEditorIndex].client_material_exception = null;
  }

  // ==================== Canvas Interaction ====================

  onCanvasClick(event: MouseEvent): void {
    if (this.loading || !this.mold || this.isDragging) return;

    const imgEl = this.moldImage?.nativeElement || this.imageCanvas?.nativeElement?.querySelector('img');
    if (!imgEl) return;

    const rect = imgEl.getBoundingClientRect();
    
    // Posición porcentual exacta respecto a la IMAGEN
    const xPerc = ((event.clientX - rect.left) / rect.width) * 100;
    const yPerc = ((event.clientY - rect.top) / rect.height) * 100;

    if (xPerc < 0 || xPerc > 100 || yPerc < 0 || yPerc > 100) return;

    this.dynamicPinPosition = { 
      x: Math.round(xPerc * 100) / 100, 
      y: Math.round(yPerc * 100) / 100 
    };

    // Posición para el Popover flotante
    this.popoverPosition = {
      x: Math.min(event.clientX, window.innerWidth - 280),
      y: Math.min(event.clientY, window.innerHeight - 200)
    };

    this.openAddModal('component');
  }

  // ==================== Drag & Drop ====================

  startDragging(event: MouseEvent, index: number): void {
    event.stopPropagation();
    event.preventDefault();

    this.isDragging = true;
    this.draggedComponentIndex = index;
    
    const imgEl = this.moldImage?.nativeElement || this.imageCanvas?.nativeElement?.querySelector('img');
    
    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging || this.draggedComponentIndex === null || !imgEl) return;
      
      const rect = imgEl.getBoundingClientRect();
      
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;

      // Limitar estrictamente dentro de la imagen (0% a 100%)
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      this.components[this.draggedComponentIndex].position_x = Math.round(x * 100) / 100;
      this.components[this.draggedComponentIndex].position_y = Math.round(y * 100) / 100;
      this.notifyChanges();
    };

    const onMouseUp = () => {
      setTimeout(() => {
        this.isDragging = false;
        this.draggedComponentIndex = null;
      }, 50);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }



  // ==================== Inventory (Siesa) ====================

  openSiesaForComponent(i: number): void {
    this.selectedPartIndex = i;
    if (!this.inventoryFromSpecEditor) {
      this.targetMaterialType = this.context === 'comercial' ? 'client' : 'technical';
    }
    this.inventoryFilterType = this.components[i].item_type === 'tela' ? 'tela' : 'insumo';
    this.showInventoryModal = true;
  }

  handleInventorySelect(item: any): void {
    if (this.selectedPartIndex === null) return;
    const idItem = item.id_item || item.referencia || '';
    const idColor = item.id_color || '';
    const idTalla = item.id_talla || item.talla || '';

    const codeParts = [idItem, idColor, idTalla].filter(x => !!x);
    const refCode = codeParts.length > 0 ? codeParts.join('-') : (item.referencia || '');

    const mat: OpmMaterial = {
      id_item: idItem,
      referencia: refCode,
      descripcion: item.descripcion || '',
      id_color: idColor,
      color: item.color || '',
      id_talla: idTalla,
      talla: item.talla || '',
      costo_unitario: item.costo_unitario || 0,
      existencias: item.existencias || 0,
      is_fabric: (item.referencia || refCode).startsWith('1110'),
      assignment_source: 'siesa',
    };
    if (this.targetMaterialType === 'client') {
      this.components[this.selectedPartIndex].client_material_exception = mat;
    } else {
      this.components[this.selectedPartIndex].material_exception = mat;
    }
    
    const wasFromSpec = this.inventoryFromSpecEditor;
    this.closeModal();

    if (wasFromSpec) {
      this.showSpecEditor = true;
    }
    this.buildTextContent();
    this.notifyChanges();
  }

  getMaterialDisplayName(mat: any): string {
    if (!mat) return '';
    const desc = (mat.descripcion || mat.inventory_description || '').trim();
    const color = (mat.color || '').trim();
    if (color && !desc.toLowerCase().includes(color.toLowerCase())) {
      return `${desc} (${color})`;
    }
    return desc;
  }

  closeModal(): void {
    this.showInventoryModal = false;
    this.selectedPartIndex = null;
    this.inventoryFromSpecEditor = false;
  }

  // ==================== Manual ====================

  openManualForComponent(i: number): void {
    this.manualModalIndex = i;
    if (!this.inventoryFromSpecEditor) {
      this.targetMaterialType = this.context === 'comercial' ? 'client' : 'technical';
    }
    const mat = this.targetMaterialType === 'client' 
      ? this.components[i].client_material_exception 
      : this.components[i].material_exception;
    this.manualText = mat?.descripcion || '';
    this.manualColor = mat?.color || '';
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
    if (this.targetMaterialType === 'client') {
      this.components[this.manualModalIndex].client_material_exception = mat;
    } else {
      this.components[this.manualModalIndex].material_exception = mat;
    }
    this.closeManualModal();
    this.buildTextContent();
    this.notifyChanges();
  }

  closeManualModal(): void {
    this.showManualModal = false;
    this.manualModalIndex = null;
    this.manualText = '';
    this.manualColor = '';
  }

  onClearMaterialException(i: number): void {
    if (this.context === 'comercial') {
      this.components[i].client_material_exception = null;
    } else {
      this.components[i].material_exception = null;
    }
    this.buildTextContent();
    this.notifyChanges();
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
    if (!this.moldId) {
      return of(null);
    }

    this.saving = true;
    this.errorMessage = '';
    const user = this.authService.user;
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';

    const payload = {
      mold_id: this.moldId,
      reference: this.opmReference || null,
      description: this.context === 'comercial' ? (this.generalDescription || this.clientGeneralDescription || null) : (this.clientGeneralDescription || null),
      technical_description: this.context !== 'comercial' ? (this.generalDescription || null) : null,
      user_created: userName || null,
      parts: (this.components || []).map(c => {
        const mat = this.context === 'muestras' 
          ? (c.material_exception || c.client_material_exception) 
          : (c.client_material_exception || c.material_exception);
        let invRef = null;
        let invDesc = null;
        if (mat) {
          const idItem = mat.id_item || mat.referencia || '';
          const idColor = mat.id_color || '';
          const idTalla = mat.id_talla || mat.talla || '';
          const codeParts = [idItem, idColor, idTalla].filter(x => !!x);
          invRef = codeParts.length > 0 ? codeParts.join('-') : mat.referencia;
          const descStr = (mat.descripcion || '').trim();
          const colorStr = (mat.color || '').trim();
          if (colorStr && !descStr.toLowerCase().includes(colorStr.toLowerCase())) {
            invDesc = `${descStr} (${colorStr})`;
          } else {
            invDesc = descStr;
          }
        } else {
          invRef = (c as any).inventory_reference || null;
          invDesc = (c as any).inventory_description || null;
        }

        let clientSpecText = c.client_spec || null;
        if (!clientSpecText && c.client_material_exception?.assignment_source === 'manual') {
          clientSpecText = c.client_material_exception.descripcion;
        }

        return {
          mold_part_id: c.mold_part_id || null,
          name: c.name || 'Componente',
          item_type: c.item_type || 'parte',
          view: c.view || 'front',
          position_x: c.position_x ?? null,
          position_y: c.position_y ?? null,
          inventory_reference: invRef,
          inventory_description: invDesc,
          client_spec: clientSpecText,
          technical_spec: c.technical_spec || null,
          material_exception: c.material_exception,
          client_material_exception: c.client_material_exception,
          is_from_mold: c.is_from_mold,
        };
      }),
    };

    const request$ = this.technicalSpecId
      ? this.moldService.updateTechnicalSpec(this.technicalSpecId, payload)
      : this.moldService.createTechnicalSpec(payload);

    return request$.pipe(
      tap((res: any) => {
        this.saving = false;
        if (res.data?.id) {
          this.technicalSpecId = res.data.id;
          if (res.data.reference) {
            this.opmReference = res.data.reference;
          }
        }
        this.successMessage = `${this.modeLabel} guardada exitosamente`;
      }),
      map((res: any) => res.data?.id || null),
      catchError((err) => {
        console.error('Error al guardar especificación OPM en backend:', err);
        this.saving = false;
        return of(this.technicalSpecId || null);
      })
    );
  }

  save(): void {
    this.saveSpec().subscribe({
      next: (specId) => {
        if (specId) {
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
