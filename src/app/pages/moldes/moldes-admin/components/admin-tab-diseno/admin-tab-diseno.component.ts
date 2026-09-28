import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { MoldZone } from '../../../../../services/mold.service';

@Component({
  selector: 'app-admin-tab-diseno',
  templateUrl: './admin-tab-diseno.component.html',
  styleUrls: ['./admin-tab-diseno.component.css']
})
export class AdminTabDisenoComponent implements OnDestroy {
  @ViewChild('svgContainer') svgContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('moldImage') moldImage!: ElementRef<HTMLImageElement>;

  @Input() moldName = '';
  @Input() moldDescription = '';
  @Input() mold_category_id: number | null = null;
  @Input() moldCategories: any[] = [];
  @Input() isReadOnly = false;
  @Input() canEdit = true;
  @Input() canUploadImage = true;
  @Input() customImageUrl = '';
  @Input() imageLoadError = false;
  @Input() isDraggingGarment = false;
  @Input() activeZones: MoldZone[] = [];
  @Input() sortedActiveZones: MoldZone[] = [];
  @Input() selectedZoneForParts: MoldZone | null = null;
  @Input() activeParts: any[] = [];
  @Input() allZones: MoldZone[] = [];
  @Input() allParts: any[] = [];
  @Input() isDrawingZone = false;
  @Input() drawingZonePoints: { x: number; y: number }[] = [];
  @Input() drawingCurrentMousePos: { x: number; y: number } | null = null;
  @Input() awaitingPosition = false;
  @Input() zoneTypeOptions: any[] = [];
  @Input() editingZoneIndex: number | null = null;
  @Input() editingZone: MoldZone | null = null;
  @Input() activeView: 'front' | 'back' = 'front';
  @Input() hasBackView = false;

  @Output() moldNameChange = new EventEmitter<string>();
  @Output() moldDescriptionChange = new EventEmitter<string>();
  @Output() moldCategoryIdChange = new EventEmitter<number | null>();
  @Output() manageCategories = new EventEmitter<void>();
  @Output() toggleDrawMode = new EventEmitter<MouseEvent | undefined>();
  @Output() undoPoint = new EventEmitter<void>();
  @Output() removePoint = new EventEmitter<number>();
  @Output() finishShape = new EventEmitter<void>();
  @Output() openZoneDrawer = new EventEmitter<MoldZone>();
  @Output() editZone = new EventEmitter<MoldZone>();
  @Output() deleteZone = new EventEmitter<MoldZone>();
  @Output() selectZoneForVertexEdit = new EventEmitter<MoldZone>();
  @Output() pointsChange = new EventEmitter<{ x: number; y: number }[]>();
  @Output() canvasClick = new EventEmitter<{ x: number; y: number; event: MouseEvent }>();
  @Output() canvasMouseMove = new EventEmitter<{ x: number; y: number; event: MouseEvent }>();
  @Output() canvasDblClick = new EventEmitter<{ x: number; y: number; event: MouseEvent }>();
  @Output() startPointClick = new EventEmitter<{ event: MouseEvent; index: number }>();
  @Output() customImageUpload = new EventEmitter<Event>();
  @Output() garmentDragOver = new EventEmitter<DragEvent>();
  @Output() garmentDragLeave = new EventEmitter<DragEvent>();
  @Output() garmentDrop = new EventEmitter<DragEvent>();
  @Output() imageError = new EventEmitter<void>();
  @Output() toggleView = new EventEmitter<void>();

  activeVertexDragIndex: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private hasDragged = false;

  private onWindowMouseMove = (event: MouseEvent) => {
    if (this.activeVertexDragIndex === null) return;
    
    if (!this.hasDragged) {
      const dist = Math.hypot(event.clientX - this.dragStartX, event.clientY - this.dragStartY);
      if (dist > 3) {
        this.hasDragged = true;
      }
    }

    const coords = this.getEventCoordinates(event);
    if (!coords) return;

    if (this.drawingZonePoints[this.activeVertexDragIndex]) {
      this.drawingZonePoints[this.activeVertexDragIndex] = { x: coords.x, y: coords.y };
      this.pointsChange.emit([...this.drawingZonePoints]);
    }
  };

  private onWindowMouseUp = (event: MouseEvent) => {
    if (this.activeVertexDragIndex !== null) {
      const draggedIdx = this.activeVertexDragIndex;
      const wasDragged = this.hasDragged;
      this.activeVertexDragIndex = null;
      this.hasDragged = false;
      window.removeEventListener('mousemove', this.onWindowMouseMove);
      window.removeEventListener('mouseup', this.onWindowMouseUp);

      if (!wasDragged && draggedIdx === 0 && this.editingZoneIndex === null && this.drawingZonePoints.length >= 3) {
        this.startPointClick.emit({ event, index: 0 });
      }
    }
  };

  ngOnDestroy(): void {
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
  }

  getEventCoordinates(event: MouseEvent): { x: number; y: number } | null {
    const el = this.moldImage?.nativeElement || this.svgContainer?.nativeElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)) * 100) / 100,
      y: Math.round(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)) * 100) / 100
    };
  }

  handleCanvasClick(event: MouseEvent): void {
    if (this.activeVertexDragIndex !== null || this.hasDragged) return;
    const coords = this.getEventCoordinates(event);
    if (coords) {
      this.canvasClick.emit({ x: coords.x, y: coords.y, event });
    }
  }

  handleCanvasMouseMove(event: MouseEvent): void {
    if (this.activeVertexDragIndex !== null) return;
    const coords = this.getEventCoordinates(event);
    if (!coords) return;
    this.canvasMouseMove.emit({ x: coords.x, y: coords.y, event });
  }

  handleCanvasDblClick(event: MouseEvent): void {
    if (this.activeVertexDragIndex !== null) return;
    const coords = this.getEventCoordinates(event);
    if (coords) {
      this.canvasDblClick.emit({ x: coords.x, y: coords.y, event });
    }
  }

  onVertexMouseDown(event: MouseEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeVertexDragIndex = index;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.hasDragged = false;
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
  }

  onVertexMouseUp(): void {
    if (this.activeVertexDragIndex !== null) {
      this.onWindowMouseUp(new MouseEvent('mouseup'));
    }
  }

  onZonePolygonClick(zone: MoldZone, event: MouseEvent): void {
    if (this.isDrawingZone) return;
    event.stopPropagation();
    this.openZoneDrawer.emit(zone);
  }

  getZoneIcon(type?: string): string {
    const opt = this.zoneTypeOptions.find(o => o.value === type);
    return opt ? opt.icon : 'bi-bounding-box-circles';
  }

  getZoneColor(type?: string): string {
    const opt = this.zoneTypeOptions.find(o => o.value === type);
    return opt ? opt.color : '#4f46e5';
  }

  getZoneLabel(type?: string): string {
    const opt = this.zoneTypeOptions.find(o => o.value === type);
    return opt ? opt.label : (type || 'Zona');
  }

  /**
   * Unique zones grouped by zone_type (e.g. one entry for 'manga' even if 2 polygons exist).
   * Used in the sidebar list to avoid showing duplicates.
   */
  get uniqueActiveZones(): MoldZone[] {
    const seen = new Map<string, MoldZone>();
    for (const zone of this.activeZones) {
      const key = zone.zone_type || zone.name || `zone_${zone.id}`;
      if (!seen.has(key)) {
        seen.set(key, zone);
      }
    }
    return Array.from(seen.values());
  }

  /**
   * Get all zone IDs that share the same zone_type as the given zone.
   * This allows parts associated with any polygon of the same region to be counted together.
   */
  getSiblingZoneIds(zone: MoldZone): (number | undefined)[] {
    if (!zone.zone_type) return [zone.id];
    const sourceList = this.allZones?.length ? this.allZones : this.activeZones;
    return sourceList
      .filter(z => z.zone_type === zone.zone_type || (z.name && zone.name && z.name.toLowerCase().trim() === zone.name.toLowerCase().trim()))
      .map(z => z.id);
  }

  getPartsCountForZone(zone: MoldZone): number {
    if (!this.allParts) return 0;
    const siblingIds = this.getSiblingZoneIds(zone);
    const zName = (zone.name || '').toLowerCase().trim();
    const zType = (zone.zone_type || '').toLowerCase().trim();
    return this.allParts.filter(p => {
      if (p.mold_zone_id && siblingIds.includes(p.mold_zone_id)) return true;
      if (p.zone_name && zName && p.zone_name.toLowerCase().trim() === zName) return true;
      if (p.zone_type && zType && p.zone_type.toLowerCase().trim() === zType) return true;
      return false;
    }).length;
  }

  getZoneCenter(zone: MoldZone): { x: number; y: number } {
    if (zone.path_data && Array.isArray(zone.path_data) && zone.path_data.length > 0) {
      let sumX = 0;
      let sumY = 0;
      zone.path_data.forEach(p => { 
        sumX += parseFloat((p as any).x) || 0; 
        sumY += parseFloat((p as any).y) || 0; 
      });
      return {
        x: Math.round((sumX / zone.path_data.length) * 100) / 100,
        y: Math.round((sumY / zone.path_data.length) * 100) / 100
      };
    }
    return {
      x: (parseFloat(zone.position_x as any) || 0) + (parseFloat(zone.width as any) || 10) / 2,
      y: (parseFloat(zone.position_y as any) || 0) + (parseFloat(zone.height as any) || 10) / 2
    };
  }

  getPolygonPoints(pathData?: { x: number; y: number }[]): string {
    if (!pathData || !Array.isArray(pathData) || pathData.length === 0) return '';
    return pathData.map(p => `${parseFloat((p as any).x) || 0},${parseFloat((p as any).y) || 0}`).join(' ');
  }

  getDrawingPolylinePoints(): string {
    if (!this.drawingZonePoints || this.drawingZonePoints.length === 0) return '';
    return this.drawingZonePoints.map(p => `${p.x},${p.y}`).join(' ');
  }
}
