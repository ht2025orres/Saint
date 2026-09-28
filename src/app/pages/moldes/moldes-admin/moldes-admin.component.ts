import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MoldService, MoldZone } from '../../../services/mold.service';
import { AuthService } from '../../../services/auth.service';
import Swal from 'sweetalert2';
import { MoldPart, ZONE_TYPE_OPTIONS } from './moldes-admin.models';

@Component({
  selector: 'app-moldes-admin',
  templateUrl: './moldes-admin.component.html',
  styleUrls: ['./moldes-admin.component.css']
})
export class MoldesAdminComponent implements OnInit {
  @ViewChild('svgContainer') svgContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('moldImage') moldImage!: ElementRef<HTMLImageElement>;

  moldId: number | null = null;
  isEditMode = false;
  isReadOnly = false;

  // Form fields
  moldName = '';
  moldDescription = '';
  mold_category_id: number | null = null;
  moldCategories: any[] = [];
  showCategoryManager = false;

  // Views & Images
  viewBox = '0 0 200 200';
  currentTemplate: any = null;
  customImageUrl = '';
  backImageUrl = '';
  pendingImageFile: File | null = null;
  pendingBackImageFile: File | null = null;
  activeTab: 'molde' | 'formulario' = 'molde';
  activeView: 'front' | 'back' = 'front';
  imageLoadError = false;
  isDraggingGarment = false;

  // Global Operations & Machines
  globalOperations: any[] = [];
  machinesList: any[] = [];

  // Parts
  parts: MoldPart[] = [];
  availableComponents: any[] = [];
  globalGarmentPartsCatalog: any[] = [];

  // Zonas Anatómicas
  zones: MoldZone[] = [];
  isDrawingZone = false;
  drawingZonePoints: { x: number; y: number }[] = [];
  drawingCurrentMousePos: { x: number; y: number } | null = null;
  showZoneNameModal = false;
  pendingZoneName = '';
  pendingZoneType = 'cuello';
  pendingZoneColor = '';
  editingZoneIndex: number | null = null;
  zoneTypeOptions = ZONE_TYPE_OPTIONS;

  // Zone Parts Drawer
  selectedZoneForParts: MoldZone | null = null;
  showZonePartsDrawer = false;
  zoneCatalogParts: any[] = [];
  loadingZoneCatalog = false;

  // Tab Estructura State (Inline Edit / Add)
  inlineEditingPart: MoldPart | null = null;
  inlineEditName = '';
  inlineEditType: 'tela' | 'insumo' | 'parte' = 'parte';
  inlineAdding = false;
  inlineAddingType: 'material' | 'structural' = 'material';
  addItemType: 'tela' | 'insumo' | 'parte' = 'parte';
  addSearchQuery = '';
  showAddSuggestions = false;

  // Modals & UI State
  showEditModal = false;
  showAddModal = false;
  editingPart: MoldPart | null = null;
  isNewPart = false;
  pendingPin: { x: number | null; y: number | null } | null = null;
  showInventorySearch = false;
  inventorySearchFilterType: 'todos' | 'tela' | 'insumo' = 'todos';
  awaitingPosition = false;



  // Feedback State
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  private readonly DRAFT_KEY = 'draft_mold_admin';

  constructor(
    private moldService: MoldService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  get canCreate(): boolean { return this.authService.hasAnyPermission([1, 46]); }
  get canEdit(): boolean { return this.authService.hasAnyPermission([1, 47]); }
  get canUploadImage(): boolean { return this.authService.hasAnyPermission([1, 46, 47]); }

  get hasBackView(): boolean {
    return !!this.backImageUrl || !!this.getFallbackBackImage();
  }

  get activeImage(): string {
    if (this.activeView === 'back') {
      return this.backImageUrl || this.getFallbackBackImage() || this.customImageUrl || '';
    }
    return this.customImageUrl || '';
  }

  getFallbackBackImage(): string | null {
    const name = (this.moldName || '').toLowerCase();
    if (name.includes('camisa')) return 'assets/garments/camisa_back.png';
    if (name.includes('chaqueta')) return 'assets/garments/chaqueta_back.png';
    if (name.includes('pantalon') || name.includes('pantalón')) return 'assets/garments/pantalon_back.png';
    if (name.includes('overol')) return 'assets/garments/overol_back.png';
    if (name.includes('polo')) return 'assets/garments/polo_back.png';
    if (name.includes('buzo')) return 'assets/garments/buzo_back.png';
    if (name.includes('camiseta')) return 'assets/garments/camiseta_back.png';
    if (name.includes('chaleco')) return 'assets/garments/chaleco_back.png';
    if (name.includes('delantal')) return 'assets/garments/delantal_back.png';
    if (name.includes('gorra')) return 'assets/garments/gorra_back.png';
    return null;
  }

  toggleActiveView(): void {
    if (this.hasBackView || this.activeView === 'back' || !this.isReadOnly) {
      this.activeView = this.activeView === 'front' ? 'back' : 'front';
    }
  }

  get activeParts(): MoldPart[] {
    return this.parts;
  }
  set activeParts(val: MoldPart[]) {
    this.parts = val;
  }

  get positionedParts(): MoldPart[] {
    return this.parts.filter(p => p.position_x !== null);
  }
  get generalParts(): MoldPart[] {
    return this.parts.filter(p => p.position_x === null);
  }
  get materialParts(): MoldPart[] {
    return this.parts.filter(p => p.item_type === 'tela' || p.item_type === 'insumo');
  }
  get structuralParts(): MoldPart[] {
    return this.parts.filter(p => p.item_type === 'parte');
  }
  get allCombinedParts(): MoldPart[] {
    return this.parts;
  }

  get uniqueLogicalZonesCount(): number {
    const seen = new Set<string>();
    for (const z of this.zones) {
      seen.add((z.zone_type || z.name || `z_${z.id}`).toLowerCase().trim());
    }
    return seen.size;
  }

  get activeZones(): MoldZone[] {
    return this.zones.filter(z => (z.view || 'front') === this.activeView);
  }
  get sortedActiveZones(): MoldZone[] {
    return [...this.activeZones].sort((a, b) => this.getZoneArea(b) - this.getZoneArea(a));
  }

  get filteredAddSuggestions(): any[] {
    const q = this.addSearchQuery.toLowerCase().trim();
    if (!q) return this.availableComponents.slice(0, 50);
    return this.availableComponents.filter(c =>
      (c.display_name || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }

  ngOnInit(): void {
    this.loadMoldCategories();
    this.loadMoldMachines();
    this.loadGarmentPartsCatalog();

    const idParam = this.route.snapshot.paramMap.get('id');
    const isViewRoute = this.route.snapshot.url.some(segment => segment.path === 'view');

    if (idParam) {
      this.moldId = parseInt(idParam, 10);
      this.isEditMode = !isViewRoute;
      this.isReadOnly = isViewRoute;
      this.loadMold();
    } else {
      this.isEditMode = false;
      this.isReadOnly = false;
      this.checkDraft();
    }
  }

  // ==================== DATA LOADING ====================

  loadMold(): void {
    this.moldService.getMold(this.moldId!).subscribe({
      next: (res: any) => {
        const mold = res.data;
        this.moldName = mold.name;
        this.moldDescription = mold.description || '';
        this.mold_category_id = mold.mold_category_id || null;
        this.customImageUrl = mold.image_signed_url || '';
        this.backImageUrl = mold.back_image_signed_url || '';
        this.globalOperations = mold.global_operations || mold.globalOperations || [];
        this.imageLoadError = false;

        this.zones = (mold.zones || []).map((z: any) => {
          let parsedPath = null;
          if (Array.isArray(z.path_data)) {
            parsedPath = z.path_data;
          } else if (typeof z.path_data === 'string' && z.path_data.trim()) {
            try {
              let p = JSON.parse(z.path_data);
              if (typeof p === 'string') p = JSON.parse(p);
              if (Array.isArray(p)) parsedPath = p;
            } catch (e) {
              parsedPath = null;
            }
          }
          if (parsedPath) {
            parsedPath = parsedPath.map((pt: any) => ({
              x: parseFloat(pt.x) || 0,
              y: parseFloat(pt.y) || 0
            }));
          }

          return {
            id: z.id,
            name: z.name,
            zone_type: z.zone_type || 'general',
            position_x: parseFloat(z.position_x) || 0,
            position_y: parseFloat(z.position_y) || 0,
            width: parseFloat(z.width) || 20,
            height: parseFloat(z.height) || 20,
            path_data: parsedPath,
            view: (z.view || 'front') as 'front' | 'back',
            color: z.color || this.getZoneColor(z.zone_type || 'general')
          };
        });

        const allParts = mold.parts || [];
        this.parts = allParts.map((p: any) => this.enrichPart(p));

        if (this.customImageUrl) {
          this.currentTemplate = { image: this.customImageUrl };
        }
      },
      error: () => Swal.fire('Error', 'No se pudo cargar la información del molde', 'error')
    });
  }

  loadMoldCategories(): void {
    this.moldService.getCategories().subscribe({ next: (res: any) => this.moldCategories = res.data || [] });
  }

  loadMoldMachines(): void {
    this.moldService.getMoldMachines().subscribe({ next: (res: any) => this.machinesList = res.data || [] });
  }

  loadGarmentPartsCatalog(): void {
    this.moldService.getGarmentParts(undefined, true).subscribe({
      next: (res: any) => {
        this.globalGarmentPartsCatalog = res.data || [];
        if (this.parts && this.parts.length > 0) {
          this.parts = this.parts.map((p: any) => this.enrichPart(p));
        }
      }
    });
  }

  enrichPart(p: any): MoldPart {
    const rawTypes = (p.types && p.types.length > 0) ? p.types : (p.garmentPart?.types || p.garment_part?.types || []);
    const masterGarmentPart = p.garmentPart || p.garment_part || this.globalGarmentPartsCatalog.find(
      (gp: any) => (p.garment_part_id && Number(gp.id) === Number(p.garment_part_id)) || (gp.name && p.name && gp.name.trim().toLowerCase() === p.name.trim().toLowerCase())
    );
    const masterTypes = masterGarmentPart?.types || [];

    const matchedZone = this.zones?.find(z => (p.mold_zone_id && z.id === p.mold_zone_id) || (p.zone_name && z.name === p.zone_name));

    return {
      ...p,
      zone_type: p.zone_type || matchedZone?.zone_type || '',
      garment_part_id: p.garment_part_id || masterGarmentPart?.id || null,
      width: p.width || 22,
      height: p.height || 18,
      types: rawTypes && rawTypes.length > 0 ? rawTypes.map((t: any) => {
        const masterType = masterTypes.find((mt: any) =>
          (t.garment_part_type_id && Number(mt.id) === Number(t.garment_part_type_id)) ||
          (mt.name && t.name && mt.name.trim().toLowerCase() === t.name.trim().toLowerCase())
        );

        let materials = (t.materials && Array.isArray(t.materials) && t.materials.length > 0)
          ? t.materials
          : (masterType?.materials && Array.isArray(masterType.materials) && masterType.materials.length > 0 ? masterType.materials : ['Tela Principal', 'Hilo de Confección']);

        materials = materials.map((m: string) => {
          if (!m) return m;
          if (m.toLowerCase() === 'tela') return 'Tela Principal';
          if (m.toLowerCase() === 'hilo') return 'Hilo de Confección';
          return m;
        });

        return {
          ...t,
          materials,
          is_disabled: t.is_disabled === true || t.is_active === false,
          is_active: t.is_disabled !== true && t.is_active !== false,
          operations: (t.operations && t.operations.length > 0) ? t.operations : (masterType?.operations || [])
        };
      }) : [
        { name: 'Estándar', technical_description: '', materials: ['Tela Principal', 'Hilo de Confección'], total_time: 0, is_default: true, operations: [] }
      ]
    };
  }

  // ==================== ZONAS & CANVAS ====================

  getZoneColor(zoneType: string): string {
    return this.zoneTypeOptions.find(z => z.value === zoneType)?.color || '#64748b';
  }

  getZoneLabel(zoneType: string): string {
    return this.zoneTypeOptions.find(z => z.value === zoneType)?.label || zoneType;
  }

  getZoneArea(zone: MoldZone): number {
    if (zone.path_data && zone.path_data.length >= 3) {
      let area = 0;
      const pts = zone.path_data;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
      }
      return Math.abs(area) / 2;
    }
    return (parseFloat(zone.width as any) || 20) * (parseFloat(zone.height as any) || 20);
  }

  getZoneCenter(zone: MoldZone): { x: number; y: number } {
    if (zone.path_data && zone.path_data.length > 0) {
      const sumX = zone.path_data.reduce((acc, p) => acc + (p.x || 0), 0);
      const sumY = zone.path_data.reduce((acc, p) => acc + (p.y || 0), 0);
      return {
        x: Math.round((sumX / zone.path_data.length) * 100) / 100,
        y: Math.round((sumY / zone.path_data.length) * 100) / 100
      };
    }
    return {
      x: Math.round(((parseFloat(zone.position_x as any) || 0) + ((parseFloat(zone.width as any) || 20) / 2)) * 100) / 100,
      y: Math.round(((parseFloat(zone.position_y as any) || 0) + ((parseFloat(zone.height as any) || 20) / 2)) * 100) / 100
    };
  }

  toggleZoneDrawMode(event?: MouseEvent): void {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    this.isDrawingZone = !this.isDrawingZone;
    this.editingZoneIndex = null;
    this.drawingZonePoints = [];
    this.drawingCurrentMousePos = null;
  }

  undoLastPoint(): void {
    if (this.drawingZonePoints.length > 0) this.drawingZonePoints.pop();
  }

  startVertexEdit(zone: MoldZone): void {
    if (this.isReadOnly) return;
    this.editingZoneIndex = this.zones.indexOf(zone);
    if (this.editingZoneIndex === -1) return;

    this.isDrawingZone = true;
    if (zone.path_data && Array.isArray(zone.path_data) && zone.path_data.length >= 3) {
      this.drawingZonePoints = zone.path_data.map(p => ({ x: parseFloat((p as any).x) || 0, y: parseFloat((p as any).y) || 0 }));
    } else {
      const x = parseFloat(zone.position_x as any) || 20;
      const y = parseFloat(zone.position_y as any) || 20;
      const w = parseFloat(zone.width as any) || 20;
      const h = parseFloat(zone.height as any) || 20;
      this.drawingZonePoints = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
      ];
    }
    this.drawingCurrentMousePos = null;
  }

  finishDrawingZone(): void {
    if (this.drawingZonePoints.length < 3) {
      Swal.fire('Zona incompleta', 'Debes marcar al menos 3 puntos para formar una zona', 'warning');
      return;
    }

    // Actualización de puntos de una zona existente
    if (this.editingZoneIndex !== null && this.editingZoneIndex >= 0 && this.editingZoneIndex < this.zones.length) {
      const targetZone = this.zones[this.editingZoneIndex];
      const xs = this.drawingZonePoints.map(p => p.x);
      const ys = this.drawingZonePoints.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);

      targetZone.path_data = this.drawingZonePoints.map(p => ({ x: p.x, y: p.y }));
      targetZone.position_x = Math.round(minX * 100) / 100;
      targetZone.position_y = Math.round(minY * 100) / 100;
      targetZone.width = Math.round(Math.max(4, maxX - minX) * 100) / 100;
      targetZone.height = Math.round(Math.max(4, maxY - minY) * 100) / 100;

      this.isDrawingZone = false;
      this.editingZoneIndex = null;
      this.drawingZonePoints = [];
      this.drawingCurrentMousePos = null;
      this.saveDraft();

      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });
      Toast.fire({
        icon: 'success',
        title: `Puntos de "${targetZone.name}" actualizados`
      });
      return;
    }

    // Creación de nueva zona
    this.editingZoneIndex = null;
    this.pendingZoneName = '';
    this.pendingZoneType = 'cuello';
    this.pendingZoneColor = this.getZoneColor('cuello');
    this.showZoneNameModal = true;
  }

  selectZoneTypeAndConfirm(type: string): void {
    this.pendingZoneType = type;
    this.pendingZoneColor = this.getZoneColor(type);
    if (this.editingZoneIndex !== null) this.confirmZoneEdit();
    else this.confirmZoneCreation();
  }

  confirmZoneCreation(): void {
    if (this.drawingZonePoints.length < 3) return;
    const xs = this.drawingZonePoints.map(p => p.x);
    const ys = this.drawingZonePoints.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const newZone: MoldZone = {
      name: this.getZoneLabel(this.pendingZoneType),
      zone_type: this.pendingZoneType,
      zone_nature: 'structural',
      path_data: this.drawingZonePoints.map(p => ({ x: p.x, y: p.y })),
      position_x: Math.round(minX * 100) / 100,
      position_y: Math.round(minY * 100) / 100,
      width: Math.round(Math.max(4, maxX - minX) * 100) / 100,
      height: Math.round(Math.max(4, maxY - minY) * 100) / 100,
      view: this.activeView,
      color: this.pendingZoneColor || this.getZoneColor(this.pendingZoneType)
    };

    this.zones.push(newZone);
    this.showZoneNameModal = false;
    this.drawingZonePoints = [];
    this.drawingCurrentMousePos = null;
    this.isDrawingZone = false;
    this.saveDraft();
    this.openZonePartsDrawer(newZone);
  }

  cancelZoneCreation(): void {
    this.showZoneNameModal = false;
    this.editingZoneIndex = null;
    this.drawingZonePoints = [];
    this.drawingCurrentMousePos = null;
    this.isDrawingZone = false;
  }

  startEditZone(zoneOrIndex: MoldZone | number): void {
    const zone = typeof zoneOrIndex === 'number' ? this.activeZones[zoneOrIndex] : zoneOrIndex;
    if (!zone) return;
    this.editingZoneIndex = this.zones.indexOf(zone);
    this.pendingZoneName = zone.name;
    this.pendingZoneType = zone.zone_type || 'cuello';
    this.pendingZoneColor = zone.color || this.getZoneColor(this.pendingZoneType);
    this.showZoneNameModal = true;
  }

  confirmZoneEdit(): void {
    if (this.editingZoneIndex === null || this.editingZoneIndex < 0) return;
    const zone = this.zones[this.editingZoneIndex];
    const oldName = zone.name;
    zone.zone_type = this.pendingZoneType;
    zone.name = this.getZoneLabel(this.pendingZoneType);
    zone.color = this.pendingZoneColor || this.getZoneColor(this.pendingZoneType);

    if (oldName && oldName !== zone.name) {
      this.parts.forEach(p => {
        if (p.zone_name === oldName || (zone.id && p.mold_zone_id === zone.id)) p.zone_name = zone.name;
      });
    }

    this.editingZoneIndex = null;
    this.showZoneNameModal = false;
    this.saveDraft();
  }

  removeZone(index: number): void {
    if (index >= 0 && index < this.zones.length) {
      const target = this.zones[index];
      this.zones.splice(index, 1);

      // Only remove associated parts if no other zone of the same type/name remains
      const hasSibling = this.zones.some(z =>
        z !== target && (
          (target.zone_type && z.zone_type === target.zone_type) ||
          z.name === target.name
        )
      );

      if (!hasSibling) {
        this.parts = this.parts.filter(p => p.mold_zone_id !== target.id && p.zone_name !== target.name);
      }

      if (this.selectedZoneForParts === target) this.closeZonePartsDrawer();
      this.saveDraft();
    }
  }

  // ==================== DRAWER PARTES POR ZONA ====================

  openZonePartsDrawer(zone: MoldZone): void {
    this.selectedZoneForParts = zone;
    this.showZonePartsDrawer = true;
    const zoneType = zone.zone_type || 'general';
    this.loadingZoneCatalog = true;

    this.moldService.getGarmentPartsByZone(zoneType).subscribe({
      next: (res: any) => {
        this.zoneCatalogParts = res.data || [];
        this.loadingZoneCatalog = false;
      },
      error: () => {
        this.zoneCatalogParts = this.globalGarmentPartsCatalog.filter((p: any) => !p.zone || p.zone === zoneType || p.zone === 'general');
        this.loadingZoneCatalog = false;
      }
    });
  }

  closeZonePartsDrawer(): void {
    this.showZonePartsDrawer = false;
    this.selectedZoneForParts = null;
  }

  toggleZonePart(garmentPart: any, zone?: MoldZone): void {
    const targetZone = zone || this.selectedZoneForParts;
    if (!targetZone || this.isReadOnly) return;

    const partsList = this.parts;

    const targetZName = (targetZone.name || '').toLowerCase().trim();
    const targetZType = (targetZone.zone_type || '').toLowerCase().trim();

    const existingIndex = partsList.findIndex(p => {
      const matchZone = (p.mold_zone_id && targetZone.id && p.mold_zone_id === targetZone.id) ||
        (p.zone_name && targetZName && p.zone_name.toLowerCase().trim() === targetZName) ||
        (p.zone_type && targetZType && p.zone_type.toLowerCase().trim() === targetZType);
      const matchPart = (p.garment_part_id && Number(p.garment_part_id) === Number(garmentPart.id)) ||
        (p.name && garmentPart.name && p.name.toLowerCase() === garmentPart.name.toLowerCase());
      return matchZone && matchPart;
    });

    if (existingIndex !== -1) {
      partsList.splice(existingIndex, 1);
    } else {
      const center = this.getZoneCenter(targetZone);
      const clonedTypes = (garmentPart.types || []).map((t: any) => ({
        ...t,
        is_disabled: false,
        operations: (t.operations || []).map((op: any) => ({ ...op, execution_time: parseFloat(op.execution_time) || 0 }))
      }));

      const newMoldPart: MoldPart = {
        name: garmentPart.name,
        garment_part_id: garmentPart.id,
        mold_zone_id: targetZone.id || null,
        zone_name: targetZone.name,
        zone_type: targetZone.zone_type,
        item_type: 'parte',
        is_mandatory: garmentPart.is_mandatory !== false,
        view: targetZone.view || this.activeView || 'front',
        position_x: center.x,
        position_y: center.y,
        width: 22,
        height: 18,
        icon: garmentPart.icon || 'bi-layers',
        description: garmentPart.description || '',
        types: clonedTypes
      };
      partsList.push(newMoldPart);
    }
    this.saveDraft();
  }

  setPartMandatory(part: MoldPart, isMandatory: boolean): void {
    part.is_mandatory = isMandatory;
    this.saveDraft();
  }

  togglePartVariant(part: MoldPart, typeId: any): void {
    this.saveDraft();
  }

  // ==================== CANVAS & IMAGE EVENTS ====================

  onZoneCanvasMouseMove(data: { x: number; y: number; event: MouseEvent }): void {
    if (!this.isDrawingZone) return;
    this.drawingCurrentMousePos = { x: data.x, y: data.y };
  }

  onZoneCanvasDblClick(data?: { x: number; y: number; event: MouseEvent }): void {
    if (this.isDrawingZone && this.drawingZonePoints.length >= 3) {
      this.finishDrawingZone();
    }
  }

  onCanvasClick(data: { x: number; y: number; event: MouseEvent }): void {
    if (!this.isDrawingZone || this.isReadOnly) return;
    const coords = { x: data.x, y: data.y };
    if (this.drawingZonePoints.length >= 3) {
      const start = this.drawingZonePoints[0];
      if (Math.hypot(coords.x - start.x, coords.y - start.y) < 5.0) {
        this.finishDrawingZone();
        return;
      }
    }
    this.drawingZonePoints.push(coords);
  }

  onStartPointClick(event: MouseEvent, index: number): void {
    if (index === 0 && this.drawingZonePoints.length >= 3) {
      this.finishDrawingZone();
    }
  }

  onCustomImageUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      if (this.activeView === 'back') {
        this.pendingBackImageFile = file;
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.backImageUrl = e.target.result;
          this.saveDraft();
        };
        reader.readAsDataURL(file);
      } else {
        this.pendingImageFile = file;
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.customImageUrl = e.target.result;
          this.currentTemplate = { image: e.target.result };
          this.saveDraft();
        };
        reader.readAsDataURL(file);
      }
    }
  }

  onGarmentDragOver(event: DragEvent): void {
    if (!this.isReadOnly && this.canUploadImage) {
      event.preventDefault();
      this.isDraggingGarment = true;
    }
  }
  onGarmentDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingGarment = false;
  }
  onGarmentDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingGarment = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } } as any;
      this.onCustomImageUpload(fakeEvent);
    }
  }
  onImageError(): void { this.imageLoadError = true; }

  // ==================== TAB ESTRUCTURA (INLINE EDIT & ADD) ====================

  addGeneralComponent(type: 'tela' | 'insumo' | 'parte'): void {
    this.activeParts.push({
      name: `Nuevo ${type.toUpperCase()}`,
      item_type: type,
      view: 'front',
      position_x: null,
      position_y: null,
      is_mandatory: true,
      types: [{ name: 'Estándar', technical_description: '', total_time: 0, is_default: true, operations: [] }]
    });
    this.saveDraft();
  }

  startInlineEdit(part: MoldPart): void {
    this.inlineEditingPart = part;
    this.inlineEditName = part.name;
    this.inlineEditType = (part.item_type || 'parte') as any;
  }

  saveInlineEdit(): void {
    if (this.inlineEditingPart && this.inlineEditName.trim()) {
      this.inlineEditingPart.name = this.inlineEditName.trim();
      this.inlineEditingPart.item_type = this.inlineEditType;
      this.inlineEditingPart = null;
      this.saveDraft();
    }
  }

  cancelInlineEdit(): void { this.inlineEditingPart = null; }

  startInlineAdd(location: 'general' | 'positioned', type: 'material' | 'structural'): void {
    this.inlineAdding = true;
    this.inlineAddingType = type;
    this.addItemType = type === 'material' ? 'insumo' : 'parte';
    this.addSearchQuery = '';
  }

  confirmInlineAdd(): void {
    if (!this.addSearchQuery.trim()) {
      this.inlineAdding = false;
      return;
    }
    this.activeParts.push({
      name: this.addSearchQuery.trim(),
      item_type: this.addItemType,
      view: 'front',
      position_x: null,
      position_y: null,
      is_mandatory: false,
      types: [{ name: 'Estándar', technical_description: '', total_time: 0, is_default: true, operations: [] }]
    });
    this.inlineAdding = false;
    this.addSearchQuery = '';
    this.saveDraft();
  }

  selectAddSuggestion(comp: any): void {
    this.addSearchQuery = comp.display_name || comp.name;
    this.addItemType = comp.item_type || 'parte';
    this.showAddSuggestions = false;
  }

  startEditPart(part: MoldPart): void {
    this.editingPart = part;
    this.isNewPart = false;
    this.showEditModal = true;
  }

  savePart(): void {
    this.showEditModal = false;
    this.saveDraft();
  }

  cancelEdit(): void { this.showEditModal = false; }

  confirmAddModal(part: any): void {
    this.activeParts.push({
      name: part.name,
      item_type: part.item_type || 'insumo',
      view: 'front',
      position_x: null,
      position_y: null,
      is_mandatory: false
    });
    this.showAddModal = false;
    this.saveDraft();
  }

  openMaterialInventorySearch(type: 'todos' | 'tela' | 'insumo' = 'todos'): void {
    this.inventorySearchFilterType = type;
    this.editingPart = null;
    this.showInventorySearch = true;
  }

  addPresetMaterial(preset: { name: string; type: 'tela' | 'insumo'; description?: string }): void {
    const newPart: MoldPart = {
      name: preset.name,
      item_type: preset.type,
      view: 'front',
      position_x: null,
      position_y: null,
      is_mandatory: true,
      description: preset.description || '',
      types: [{ name: 'Estándar', technical_description: '', total_time: 0, is_default: true, operations: [] }]
    };
    (newPart as any).material_source = 'default';
    this.activeParts.push(newPart);
    this.saveDraft();
  }

  togglePartMandatory(part: MoldPart): void {
    part.is_mandatory = !part.is_mandatory;
    this.saveDraft();
  }

  handleInventorySelect(item: any): void {
    if (this.editingPart) {
      this.editingPart.name = item.descripcion || item.referencia;
      this.editingPart.description = `${item.referencia} ${item.color ? '- ' + item.color : ''}`.trim();
      (this.editingPart as any).siesa_reference = item.referencia;
      (this.editingPart as any).siesa_color = item.color;
      (this.editingPart as any).siesa_id_item = item.id_item;
      (this.editingPart as any).material_source = 'siesa';
      this.editingPart = null;
    } else {
      const isTela = item.es_tela || (item.grupo || '').toUpperCase().includes('TELA');
      const newMat: MoldPart = {
        name: item.descripcion || item.referencia,
        item_type: isTela ? 'tela' : 'insumo',
        view: 'front',
        position_x: null,
        position_y: null,
        is_mandatory: true,
        description: `${item.referencia} ${item.color ? '- ' + item.color : ''}`.trim(),
        types: [{ name: 'Estándar', technical_description: '', total_time: 0, is_default: true, operations: [] }]
      };
      (newMat as any).siesa_reference = item.referencia;
      (newMat as any).siesa_color = item.color;
      (newMat as any).siesa_id_item = item.id_item;
      (newMat as any).material_source = 'siesa';
      this.activeParts.push(newMat);
    }
    this.showInventorySearch = false;
    this.saveDraft();
  }

  removePart(partOrIndex: MoldPart | number): void {
    if (typeof partOrIndex === 'number') {
      this.parts.splice(partOrIndex, 1);
    } else {
      const idx = this.parts.indexOf(partOrIndex);
      if (idx !== -1) {
        this.parts.splice(idx, 1);
      }
    }
    this.saveDraft();
  }

  // ==================== OPERACIONES & TIEMPOS SAM ====================

  addGlobalOperation(): void {
    this.globalOperations.push({ machine_name: 'PLANA', operation_name: '', execution_time: 0 });
  }

  removeGlobalOperation(index: number): void {
    this.globalOperations.splice(index, 1);
  }

  addTypeToPart(part: MoldPart): void {
    if (!part.types) part.types = [];
    part.types.push({ name: 'Nueva Variante', technical_description: '', total_time: 0, is_default: part.types.length === 0, operations: [] });
  }

  removeTypeFromPart(part: MoldPart, typeIndex: number): void {
    if (part.types) part.types.splice(typeIndex, 1);
  }

  setDefaultType(part: MoldPart, selectedType: any): void {
    if (part.types) {
      part.types.forEach(t => t.is_default = false);
      selectedType.is_default = true;
    }
  }

  addOperationToType(type: any): void {
    if (!type.operations) type.operations = [];
    type.operations.push({ machine_name: 'PLANA', operation_name: '', execution_time: 0 });
  }

  removeOperationFromType(type: any, opIndex: number): void {
    if (type.operations) {
      type.operations.splice(opIndex, 1);
      this.recalculateTypeTotalTime(type);
    }
  }

  recalculateTypeTotalTime(type: any): number {
    if (!type || !type.operations) return 0;
    const total = type.operations.reduce((acc: number, op: any) => acc + (parseFloat(op.execution_time) || 0), 0);
    type.total_time = total;
    return total;
  }

  get totalGarmentStandardTime(): number {
    let globalTotal = (this.globalOperations || []).reduce((acc: number, op: any) => acc + (parseFloat(op.execution_time) || 0), 0);
    let partsTotal = 0;
    this.parts.forEach((p: any) => {
      if (p.types && p.types.length > 0) {
        const defType = p.types.find((t: any) => t.is_default) || p.types[0];
        if (defType) partsTotal += this.recalculateTypeTotalTime(defType);
      }
    });
    return globalTotal + partsTotal;
  }

  // ==================== DRAFT & SAVE ====================

  saveDraft(): void {
    if (this.isReadOnly) return;
    localStorage.setItem(this.DRAFT_KEY, JSON.stringify({
      moldName: this.moldName,
      moldDescription: this.moldDescription,
      mold_category_id: this.mold_category_id,
      zones: this.zones,
      parts: this.parts,
      customImageUrl: this.customImageUrl,
      backImageUrl: this.backImageUrl,
      activeView: this.activeView,
      timestamp: Date.now()
    }));
  }

  checkDraft(): void {
    const saved = localStorage.getItem(this.DRAFT_KEY);
    if (!saved) return;
    const draft = JSON.parse(saved);
    if (draft.moldName || draft.zones?.length > 0 || draft.parts?.length > 0) {
      Swal.fire({
        title: '¿Restaurar borrador?',
        text: `Trabajo pendiente del ${new Date(draft.timestamp).toLocaleString()}.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, restaurar',
        cancelButtonText: 'Descartar'
      }).then((res) => {
        if (res.isConfirmed) {
          this.moldName = draft.moldName || '';
          this.moldDescription = draft.moldDescription || '';
          this.mold_category_id = draft.mold_category_id || null;
          this.zones = draft.zones || [];
          this.parts = draft.parts || [];
          this.customImageUrl = draft.customImageUrl || '';
          this.backImageUrl = draft.backImageUrl || '';
          if (draft.activeView) this.activeView = draft.activeView;
          this.currentTemplate = { image: this.customImageUrl };
        } else {
          this.clearDraft();
        }
      });
    }
  }

  clearDraft(): void { localStorage.removeItem(this.DRAFT_KEY); }

  saveMold(): void {
    this.saving = true;
    const payload = {
      name: this.moldName.trim(),
      description: this.moldDescription.trim() || undefined,
      mold_category_id: this.mold_category_id,
      zones: this.zones,
      parts: this.parts.map(p => ({
        ...p,
        view: (p.view || 'front') as 'front' | 'back',
        types: (p.types || []).map((t: any) => ({
          ...t,
          materials: t.materials || ['Tela Principal', 'Hilo de Confección'],
          is_disabled: t.is_disabled === true || t.is_active === false,
          total_time: this.recalculateTypeTotalTime(t),
          operations: (t.operations || []).map((op: any) => ({
            ...op,
            mold_machine_id: op.mold_machine_id || this.machinesList.find(m => m.name.toLowerCase() === (op.machine_name || '').toLowerCase())?.id,
            execution_time: parseFloat(op.execution_time) || 0
          }))
        }))
      })),
      global_operations: (this.globalOperations || []).map((gOp: any) => ({
        ...gOp,
        mold_machine_id: gOp.mold_machine_id || this.machinesList.find(m => m.name.toLowerCase() === (gOp.machine_name || '').toLowerCase())?.id,
        execution_time: parseFloat(gOp.execution_time) || 0
      }))
    };

    const action$ = this.isEditMode && this.moldId
      ? this.moldService.updateMold(this.moldId, payload)
      : this.moldService.createMold(payload);

    action$.subscribe({
      next: (res: any) => {
        const savedId = res.data?.id || this.moldId;
        const uploads: any[] = [];
        if (this.pendingImageFile && savedId) {
          uploads.push(this.moldService.uploadMoldImage(savedId, this.pendingImageFile, 'front'));
        }
        if (this.pendingBackImageFile && savedId) {
          uploads.push(this.moldService.uploadMoldImage(savedId, this.pendingBackImageFile, 'back'));
        }

        this.saving = false;
        this.successMessage = 'Molde guardado exitosamente';
        this.clearDraft();
        Swal.fire({
          title: '¡Guardado!',
          text: 'El molde y su arquitectura fueron guardados correctamente.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
        setTimeout(() => this.router.navigate(['/moldes']), 1200);
      },
      error: (err: any) => {
        this.saving = false;
        this.errorMessage = err.error?.error || 'Error al guardar el molde';
        Swal.fire('Error al guardar', this.errorMessage, 'error');
      }
    });
  }

  switchToEditMode(): void {
    this.isReadOnly = false;
    if (this.moldId) {
      this.router.navigate(['/moldes/admin', this.moldId]);
    }
  }

  goBack(): void { this.router.navigate(['/moldes']); }
}
