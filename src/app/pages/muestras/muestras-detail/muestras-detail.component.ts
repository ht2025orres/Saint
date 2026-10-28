import { Component, OnInit, Inject, ViewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, Solicitud } from '../../../services/comercial.service';
import { MoldService } from '../../../services/mold.service';
import { SpecGeneratorComponent } from '../../moldes/spec-generator/spec-generator.component';
import { MoldOpmStepperComponent } from '../../comerciales/mold-opm-stepper/mold-opm-stepper.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-muestras-detail',
  templateUrl: './muestras-detail.component.html',
  styleUrls: ['./muestras-detail.component.css']
})
export class MuestrasDetailComponent implements OnInit {
  @ViewChild('specGenRef') specGeneratorRef?: SpecGeneratorComponent;
  @ViewChild('stepperComponent') stepperComponent?: MoldOpmStepperComponent;

  solicitudId!: number;
  muestra: Solicitud | null = null;
  isLoading = false;

  // OPM Viewer Modal state
  selectedOpmItem: any = null;
  opmActiveView: 'front' | 'back' = 'front';
  selectedZone: any = null;
  expandedSidebarZoneKey: string | null = null;
  opmModalTab: 'figurine' | 'step_by_step' = 'figurine';

  setOpmModalTab(tab: 'figurine' | 'step_by_step'): void {
    this.opmModalTab = tab;
  }

  // OPM Edit Modal state
  isEditingOpmSpec = false;
  editingOpmItem: any = null;
  isSavingOpm = false;

  readonly ZONE_METADATA: Record<string, { label: string; icon: string; bgClass: string; color: string }> = {
    'cuello': { label: 'Cuello y Solapa', icon: 'bi-gem', bgClass: 'bg-indigo-500', color: '#6366f1' },
    'manga': { label: 'Mangas y Puños', icon: 'bi-layers-fill', bgClass: 'bg-purple-500', color: '#8b5cf6' },
    'pecho': { label: 'Pechera y Delantero', icon: 'bi-columns', bgClass: 'bg-emerald-500', color: '#10b981' },
    'espalda': { label: 'Espalda y Almilla', icon: 'bi-border-all', bgClass: 'bg-pink-500', color: '#ec4899' },
    'pretina': { label: 'Cintura y Pretina', icon: 'bi-bounding-box-circles', bgClass: 'bg-cyan-500', color: '#06b6d4' },
    'pierna_bota': { label: 'Piernas y Bota', icon: 'bi-arrows-vertical', bgClass: 'bg-slate-500', color: '#64748b' },
    'general': { label: 'General / Acabados', icon: 'bi-gem', bgClass: 'bg-amber-500', color: '#f59e0b' }
  };

  constructor(
    private comercialService: ComercialService,
    private moldService: MoldService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.solicitudId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadSolicitud();
  }

  private loadTailwind(): void {
    if (!this.document.getElementById('tw-cdn-muestras-detail')) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      link.id = 'tw-cdn-muestras-detail';
      this.document.head.appendChild(link);
    }
    if (!this.document.getElementById('bi-cdn-muestras-detail')) {
      const icons = this.document.createElement('link');
      icons.rel = 'stylesheet';
      icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
      icons.id = 'bi-cdn-muestras-detail';
      this.document.head.appendChild(icons);
    }
  }

  loadSolicitud(silent: boolean = false): void {
    if (!silent) this.isLoading = true;
    this.comercialService.detalleSolicitud(this.solicitudId).subscribe({
      next: (res) => {
        this.muestra = res.data;
        if (!silent) this.isLoading = false;
        this.loadMateriales();
      },
      error: () => {
        if (!silent) {
          Swal.fire('Error', 'No se pudo cargar el detalle de la muestra', 'error');
          this.isLoading = false;
        }
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/muestras']);
  }

  cambiarEstadoMuestra(nuevoEstado: string): void {
    if (!this.muestra?.id) return;
    this.comercialService.cambiarEstadoMuestra(this.muestra.id, nuevoEstado).subscribe({
      next: (res) => {
        if (this.muestra) {
          this.muestra.estado_muestra = nuevoEstado as any;
          if (res.data) {
            this.muestra.fecha_inicio_muestra = res.data.fecha_inicio_muestra;
            this.muestra.fecha_fin_muestra = res.data.fecha_fin_muestra;
          }
        }
        Swal.fire({ title: 'Estado de Muestra Actualizado', icon: 'success', timer: 1200, showConfirmButton: false });
      },
      error: () => Swal.fire('Error', 'No se pudo actualizar el estado de muestra', 'error')
    });
  }

  getTotalUnidades(): number {
    if (!this.muestra?.items) return 0;
    return this.muestra.items.reduce((acc, item) => {
      if (item.tallas?.length) {
        return acc + item.tallas.reduce((tAcc, t) => tAcc + (t.cantidad || 0), 0);
      }
      return acc + (item.cantidad_muestra || 0);
    }, 0);
  }

  getItemTotalTime(item: any): number {
    if (!item) return 0;
    const parts = this.getAllItemParts(item);
    return parts.reduce((acc: number, p: any) => {
      const time = Number(p.estimated_time || p.total_time || (p.types && p.selected_type_id ? p.types.find((t: any) => Number(t.id) === Number(p.selected_type_id))?.total_time : 0) || 0);
      return acc + time;
    }, 0);
  }

  getSolicitudTotalTime(): number {
    if (!this.muestra?.items) return 0;
    return this.muestra.items.reduce((acc, item) => acc + this.getItemTotalTime(item), 0);
  }

  getOpmState(item: any): 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETO' {
    if (!item) return 'PENDIENTE';
    const spec = item.technical_spec;
    if (spec?.status === 'COMPLETADO' || spec?.status === 'PUBLICADO' || spec?.status === 'APROBADO') {
      return 'COMPLETO';
    }
    if (spec?.status === 'EN_PROCESO') {
      return 'EN_PROCESO';
    }

    const parts = spec?.parts || item.mold?.parts || [];
    if (!parts || parts.length === 0) return 'PENDIENTE';

    let filledCount = 0;
    for (const p of parts) {
      if (!!p.technical_spec || !!p.selected_type_id || !!p.selected_type_name) {
        filledCount++;
      }
    }

    if (filledCount >= parts.length) {
      return 'COMPLETO';
    } else if (filledCount > 0) {
      return 'EN_PROCESO';
    }

    return 'PENDIENTE';
  }

  esOpmTecnicaCompleta(item: any): boolean {
    return this.getOpmState(item) === 'COMPLETO';
  }

  getSolicitudObservaciones(): string {
    return this.muestra?.observaciones || '';
  }

  getOpmBadgeInfo(item: any): { label: string; bgClass: string; icon: string } {
    const state = this.getOpmState(item);
    if (state === 'COMPLETO') {
      return {
        label: 'ESPECIFICACIÓN TÉCNICA COMPLETA',
        bgClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        icon: 'bi-patch-check-fill'
      };
    } else if (state === 'EN_PROCESO') {
      return {
        label: 'ESPECIFICACIÓN TÉCNICA EN PROCESO',
        bgClass: 'bg-sky-100 text-sky-800 border-sky-300',
        icon: 'bi-hourglass-split'
      };
    }
    return {
      label: 'OPM BÁSICA (COMERCIAL) · PENDIENTE',
      bgClass: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: 'bi-clock-history'
    };
  }

  // ==================== OPM VIEWER MODAL ====================

  openOpmModal(item: any): void {
    this.selectedOpmItem = item;
    this.opmActiveView = 'front';
    this.selectedZone = null;
    this.expandedSidebarZoneKey = null;

    const initialMoldParts = item.mold?.parts || [];
    const initialRawParts = item.technical_spec?.parts || [];

    const initialEnriched = this.enrichAndConsolidateComponents(initialRawParts, initialMoldParts);
    if (!this.selectedOpmItem.technical_spec) this.selectedOpmItem.technical_spec = {};
    this.selectedOpmItem.technical_spec.parts = initialEnriched;

    const moldId = item.mold?.id || item.mold_id || item.moldId;
    const specId = item.technical_spec_id || item.technicalSpecId || item.technical_spec?.id;

    if (moldId) {
      this.moldService.getMold(moldId).subscribe({
        next: (res: any) => {
          const fullMold = res.data || res;
          if (fullMold && this.selectedOpmItem) {
            this.selectedOpmItem.mold = {
              ...this.selectedOpmItem.mold,
              ...fullMold
            };
            this.loadAndEnrichTechnicalSpec(specId);
          }
        },
        error: () => {
          this.loadAndEnrichTechnicalSpec(specId);
        }
      });
    } else {
      this.loadAndEnrichTechnicalSpec(specId);
    }
  }

  private loadAndEnrichTechnicalSpec(specId?: number): void {
    const moldParts = this.selectedOpmItem?.mold?.parts || [];

    if (specId) {
      this.moldService.getTechnicalSpec(specId).subscribe({
        next: (specRes: any) => {
          const spec = specRes?.data || specRes;
          if (spec && this.selectedOpmItem) {
            this.selectedOpmItem.technical_spec = spec;
            const rawParts = (spec.parts && spec.parts.length > 0)
              ? spec.parts
              : [];
            const enriched = this.enrichAndConsolidateComponents(rawParts, moldParts);
            this.selectedOpmItem.technical_spec.parts = enriched;
          }
        },
        error: () => {
          if (this.selectedOpmItem) {
            const rawParts = this.selectedOpmItem.technical_spec?.parts || [];
            const enriched = this.enrichAndConsolidateComponents(rawParts, moldParts);
            if (!this.selectedOpmItem.technical_spec) this.selectedOpmItem.technical_spec = {};
            this.selectedOpmItem.technical_spec.parts = enriched;
          }
        }
      });
    } else {
      if (this.selectedOpmItem) {
        const rawParts = this.selectedOpmItem.technical_spec?.parts || [];
        const enriched = this.enrichAndConsolidateComponents(rawParts, moldParts);
        if (!this.selectedOpmItem.technical_spec) this.selectedOpmItem.technical_spec = {};
        this.selectedOpmItem.technical_spec.parts = enriched;
      }
    }
  }

  closeOpmModal(): void {
    this.selectedOpmItem = null;
    this.selectedZone = null;
  }

  get hasOpmBackView(): boolean {
    const mold = this.selectedOpmItem?.mold;
    return !!(mold?.back_image_signed_url || mold?.back_image_url || mold?.back_image);
  }

  toggleOpmView(view: 'front' | 'back'): void {
    this.opmActiveView = view;
  }

  getActiveOpmImage(): string {
    if (!this.selectedOpmItem?.mold) return '';
    const mold = this.selectedOpmItem.mold;
    if (this.opmActiveView === 'back') {
      return mold.back_image_signed_url || mold.back_image_url || '';
    }
    return mold.image_signed_url || mold.image_url || '';
  }

  getAllItemParts(item: any): any[] {
    if (!item) return [];
    const parts = item.technical_spec?.parts || item.mold?.parts || [];
    return parts.filter((p: any) => this.isPartIncluded(p));
  }

  getZoneKey(zone: any): string {
    return (zone?.name || zone?.zone_type || String(zone?.id || '')).toLowerCase().trim();
  }

  getZoneIcon(zoneType?: string): string {
    const key = (zoneType || '').toLowerCase().trim();
    return this.ZONE_METADATA[key]?.icon || 'bi-bounding-box-circles';
  }

  getZoneColor(zoneType?: string): string {
    const key = (zoneType || '').toLowerCase().trim();
    return this.ZONE_METADATA[key]?.color || '#8b5cf6';
  }

  getZoneLabel(zoneType?: string): string {
    const key = (zoneType || '').toLowerCase().trim();
    return this.ZONE_METADATA[key]?.label || (zoneType ? zoneType.toUpperCase() : 'ZONA');
  }

  isSidebarZoneExpanded(zone: any): boolean {
    const key = this.getZoneKey(zone);
    return this.expandedSidebarZoneKey === key;
  }

  toggleSidebarZone(zone: any, event?: Event): void {
    if (event) event.stopPropagation();
    const key = this.getZoneKey(zone);
    this.expandedSidebarZoneKey = this.expandedSidebarZoneKey === key ? null : key;
  }

  selectZone(zone: any, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.isZoneSelected(zone)) {
      this.selectedZone = null;
    } else {
      this.selectedZone = zone;
    }
  }

  clearSelectedZone(event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedZone = null;
  }

  isZoneSelected(zone: any): boolean {
    if (!this.selectedZone || !zone) return false;
    if (this.selectedZone === zone) return true;

    if (this.selectedZone.id && zone.id && Number(this.selectedZone.id) === Number(zone.id)) {
      return true;
    }

    const selKey = this.getZoneKey(this.selectedZone);
    const zoneKey = this.getZoneKey(zone);
    if (selKey && zoneKey && selKey === zoneKey) return true;

    const selType = (this.selectedZone.zone_type || '').toLowerCase().trim();
    const zType = (zone.zone_type || '').toLowerCase().trim();
    if (selType && zType && selType === zType && selType !== 'general') return true;

    const selName = (this.selectedZone.name || '').toLowerCase().trim();
    const zName = (zone.name || '').toLowerCase().trim();
    if (selName && zName && selName === zName) return true;

    return false;
  }

  getZonePopoverLeft(zone: any): number {
    if (!zone) return 50;
    const center = this.getZoneCenter(zone);
    return Math.min(65, Math.max(35, center.x));
  }

  getZonePopoverTop(zone: any): number {
    if (!zone) return 50;
    const center = this.getZoneCenter(zone);
    return Math.min(68, Math.max(22, center.y));
  }

  getConfiguredPartsForZoneObj(zone: any): any[] {
    if (!zone) return [];
    return this.getPartsForZone(zone).filter(p => this.isPartIncluded(p));
  }

  // Zone types that belong to each view
  private readonly FRONT_ZONE_TYPES = new Set(['cuello', 'pecho', 'manga', 'pretina', 'pierna_bota', 'general']);
  private readonly BACK_ZONE_TYPES = new Set(['espalda']);

  private isZoneTypeForView(zoneType: string, view: string): boolean {
    if (view === 'back') {
      return this.BACK_ZONE_TYPES.has(zoneType) || 
             ['manga', 'pretina', 'pierna_bota', 'general'].includes(zoneType);
    }
    return this.FRONT_ZONE_TYPES.has(zoneType);
  }

  getActiveZones(): any[] {
    if (!this.selectedOpmItem?.mold) return [];
    const zones = this.selectedOpmItem.mold.zones || [];
    const currentView = this.opmActiveView;

    const filtered = zones.filter((z: any) => {
      const v = (z.view || 'front').toLowerCase();
      return v === currentView;
    });

    if (zones.length === 0) {
      return this.getFallbackZonesFromParts();
    }

    return filtered;
  }

  private getFallbackZonesFromParts(): any[] {
    const currentView = this.opmActiveView;
    const allParts = this.getAllItemParts(this.selectedOpmItem);
    const detectedTypes = new Set<string>();
    allParts.forEach(p => {
      if (!this.isTransversalPart(p)) {
        const zt = (p.zone_type || this.inferZoneFromPartName(p.name || '')).toLowerCase();
        if (this.isZoneTypeForView(zt, currentView)) {
          detectedTypes.add(zt);
        }
      }
    });

    const defaultCoords: Record<string, { x: number; y: number; name: string; view: string }> = {
      'cuello': { x: 50, y: 18, name: 'CUELLO / SOLAPA', view: 'front' },
      'pecho': { x: 50, y: 35, name: 'PECHERA Y DELANTERO', view: 'front' },
      'manga': { x: 38, y: 55, name: 'MANGAS Y PUÑOS', view: 'front' },
      'espalda': { x: 50, y: 30, name: 'ESPALDA Y ALMILLA', view: 'back' },
      'pretina': { x: 50, y: 80, name: 'CINTURA Y PRETINA', view: 'front' },
      'pierna_bota': { x: 50, y: 75, name: 'PIERNAS Y BOTA', view: 'front' },
      'general': { x: 50, y: 50, name: 'ACABADOS GENERALES', view: 'front' }
    };

    const zones: any[] = [];
    detectedTypes.forEach(zt => {
      const meta = this.ZONE_METADATA[zt] || this.ZONE_METADATA['general'];
      const coord = defaultCoords[zt] || { x: 50, y: 50, name: zt.toUpperCase(), view: 'front' };
      zones.push({
        id: zt,
        name: coord.name,
        zone_type: zt,
        view: currentView,
        position_x: coord.x - 10,
        position_y: coord.y - 5,
        width: 20,
        height: 10,
        color: meta.color
      });
    });

    return zones;
  }

  getZonesWithParts(): { zone: any; parts: any[]; allZoneIds: any[] }[] {
    const activeZones = this.getActiveZones();
    const allParts = this.getAllItemParts(this.selectedOpmItem);
    const currentView = this.opmActiveView;
    const allMoldZones = this.selectedOpmItem?.mold?.zones || [];
    const grouped = new Map<string, { zone: any; parts: any[]; allZoneIds: any[] }>();

    for (const zone of activeZones) {
      const key = this.getZoneKey(zone);
      const parts = this.getPartsForZone(zone, allParts);
      if (!grouped.has(key)) {
        grouped.set(key, {
          zone,
          parts: [...parts],
          allZoneIds: zone.id ? [zone.id] : []
        });
      } else {
        const existing = grouped.get(key)!;
        if (zone.id && !existing.allZoneIds.includes(zone.id)) {
          existing.allZoneIds.push(zone.id);
        }
        parts.forEach(p => {
          if (!existing.parts.includes(p)) existing.parts.push(p);
        });
      }
    }

    for (const part of allParts) {
      if (this.isTransversalPart(part)) continue;
      if (part.view && part.view !== currentView) continue;

      if (part.mold_zone_id && allMoldZones.length > 0) {
        const assignedZone = allMoldZones.find((z: any) => Number(z.id) === Number(part.mold_zone_id));
        if (assignedZone) {
          const zoneView = (assignedZone.view || 'front').toLowerCase();
          if (zoneView !== currentView) continue;
        }
      }

      const isAssigned = Array.from(grouped.values()).some(g => g.parts.includes(part));
      if (!isAssigned) {
        const zt = (part.zone_type || this.inferZoneFromPartName(part.name || '')).toLowerCase();
        if (!this.isZoneTypeForView(zt, currentView)) continue;
        const meta = this.ZONE_METADATA[zt] || this.ZONE_METADATA['general'];
        const key = zt;
        if (!grouped.has(key)) {
          grouped.set(key, {
            zone: {
              id: null,
              name: meta.label,
              zone_type: zt,
              color: meta.color
            },
            parts: [part],
            allZoneIds: []
          });
        } else {
          grouped.get(key)!.parts.push(part);
        }
      }
    }

    return Array.from(grouped.values());
  }

  getPartsForZone(zone: any, allPartsList?: any[]): any[] {
    const list = allPartsList || this.getAllItemParts(this.selectedOpmItem);
    if (!zone) return [];
    const zoneId = Number(zone.id);
    const zName = (zone.name || '').toLowerCase().trim();
    const zType = (zone.zone_type || '').toLowerCase().trim();

    return list.filter(p => {
      if (p.mold_zone_id && Number(p.mold_zone_id) === zoneId) return true;
      if (p._all_zone_ids?.some((zid: any) => Number(zid) === zoneId)) return true;
      if (p.zone_name && zName && p.zone_name.toLowerCase().trim() === zName) return true;
      const pZoneType = (p.zone_type || '').toLowerCase().trim();
      if (zType && pZoneType && zType === pZoneType) return true;
      const pName = (p.name || '').toLowerCase().trim();
      return !!(zType && (pName.includes(zType) || zType.includes(pName)));
    });
  }

  isPartIncluded(part: any): boolean {
    if (!part) return false;
    return !!part.selected_type_id || 
           !!part.selected_type_name || 
           (typeof part.technical_spec === 'string' && part.technical_spec.trim().length > 0) || 
           (typeof part.client_spec === 'string' && part.client_spec.trim().length > 0) ||
           !!part.material_exception ||
           !!part.client_material_exception;
  }

  isPartConfigured(part: any): boolean {
    return this.isPartIncluded(part);
  }

  getConfiguredPartsForZone(zp: { zone: any; parts: any[] }): any[] {
    return (zp?.parts || []).filter(p => this.isPartIncluded(p));
  }

  getZoneCenter(zone: any): { x: number; y: number } {
    let pts = zone.path_data;
    if (typeof pts === 'string') {
      try { pts = JSON.parse(pts); } catch (e) { pts = null; }
    }
    if (Array.isArray(pts) && pts.length > 0) {
      const sumX = pts.reduce((acc: number, p: any) => acc + (p.x || 0), 0);
      const sumY = pts.reduce((acc: number, p: any) => acc + (p.y || 0), 0);
      return {
        x: Math.round((sumX / pts.length) * 100) / 100,
        y: Math.round((sumY / pts.length) * 100) / 100
      };
    }
    return {
      x: Math.round(((parseFloat(zone.position_x as any) || 0) + ((parseFloat(zone.width as any) || 20) / 2)) * 100) / 100,
      y: Math.round(((parseFloat(zone.position_y as any) || 0) + ((parseFloat(zone.height as any) || 20) / 2)) * 100) / 100
    };
  }

  getPolygonPoints(points?: any): string {
    let pts = points;
    if (typeof pts === 'string') {
      try { pts = JSON.parse(pts); } catch (e) { pts = null; }
    }
    if (!Array.isArray(pts) || pts.length === 0) return '';
    return pts.map((p: any) => `${p.x},${p.y}`).join(' ');
  }

  isZoneConfigured(zone: any): boolean {
    const parts = this.getPartsForZone(zone);
    return parts.some(p => this.isPartIncluded(p));
  }

  getConfiguredPartsCount(parts: any[]): number {
    return (parts || []).filter(p => this.isPartIncluded(p)).length;
  }

  getTransversalOptionals(): any[] {
    if (!this.selectedOpmItem) return [];
    const allParts = this.getAllItemParts(this.selectedOpmItem);
    const moldZones = this.selectedOpmItem?.mold?.zones || [];
    const zonesWithParts = this.getZonesWithParts();

    return allParts
      .filter(p => p.is_mandatory === false && (!!p.selected_type_id || !!p.selected_type_name || !!p.technical_spec || !!p.client_spec || this.isTransversalPart(p)))
      .map(p => {
        let zoneLabel = p.zone_name || (p.zone?.name) || '';
        if (!zoneLabel && p.mold_zone_id && moldZones.length > 0) {
          const matchedZ = moldZones.find((z: any) => Number(z.id) === Number(p.mold_zone_id));
          if (matchedZ?.name) zoneLabel = matchedZ.name;
        }
        if (!zoneLabel && p.zone_type) {
          zoneLabel = this.getZoneLabel(p.zone_type);
        }
        if (!zoneLabel) {
          const foundGroup = zonesWithParts.find(g => g.parts.some(pt => pt === p || pt.name === p.name));
          if (foundGroup?.zone?.name) {
            zoneLabel = foundGroup.zone.name;
          }
        }
        if (!zoneLabel) {
          zoneLabel = 'General / Acabados';
        }

        return {
          name: p.name || 'Aplique / Opcional',
          variant: this.extractVariantName(p),
          clientSpec: p.client_spec || '',
          technicalSpec: p.technical_spec || '',
          exceptionComment: p.exception_comment || '',
          estimated_time: p.estimated_time || p.total_time || 0,
          material: p.material_exception || p.client_material_exception || null,
          icon: this.getOptionalIcon(p.name || ''),
          zoneName: zoneLabel
        };
      });
  }

  getConsolidatedMaterials(): any[] {
    if (!this.selectedOpmItem) return [];
    const map = new Map<string, {
      name: string;
      type: 'tela' | 'insumo';
      sourceParts: Set<string>;
      siesaRef?: string;
      siesaDesc?: string;
      color?: string;
      comment?: string;
    }>();

    const addMat = (name: string, partLabel: string, type: 'tela' | 'insumo', siesaRef?: string, siesaDesc?: string, color?: string, comment?: string) => {
      const raw = (name || '').trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: raw,
          type: type,
          sourceParts: new Set<string>(),
          siesaRef,
          siesaDesc,
          color,
          comment
        });
      }
      if (partLabel) {
        map.get(key)!.sourceParts.add(partLabel);
      }
      if (siesaRef && !map.get(key)!.siesaRef) map.get(key)!.siesaRef = siesaRef;
      if (siesaDesc && !map.get(key)!.siesaDesc) map.get(key)!.siesaDesc = siesaDesc;
      if (color && !map.get(key)!.color) map.get(key)!.color = color;
      if (comment && !map.get(key)!.comment) map.get(key)!.comment = comment;
    };

    // 1. Extraer los materiales explícitos guardados en la ficha técnica (item_type === 'material')
    const specParts = this.selectedOpmItem.technical_spec?.parts || [];
    const savedMaterials = specParts.filter((p: any) => p.item_type === 'material');

    if (savedMaterials.length > 0) {
      savedMaterials.forEach((mat: any) => {
        const matName = mat.name || 'Material';
        const isTela = (mat.selected_type_name || '').toLowerCase() === 'tela' ||
                       matName.toLowerCase().includes('tela') ||
                       matName.toLowerCase().includes('forro') ||
                       matName.toLowerCase().includes('malla') ||
                       matName.toLowerCase().includes('entretela');
        const type: 'tela' | 'insumo' = isTela ? 'tela' : 'insumo';
        const sources = mat.zone_name ? mat.zone_name.split(', ') : ['Prenda Base'];

        sources.forEach((src: string) => {
          addMat(
            matName,
            src.trim(),
            type,
            mat.inventory_reference || undefined,
            mat.inventory_description || undefined,
            undefined,
            mat.client_spec || mat.exception_comment || undefined
          );
        });
      });
    }

    // 2. Extraer de las partes de confección (o como respaldo si no hay materiales guardados explícitamente)
    const allParts = this.getAllItemParts(this.selectedOpmItem).filter((p: any) => p.item_type !== 'material');

    allParts.forEach((part) => {
      const partName = part.name || 'Parte';
      const variantName = this.extractVariantName(part);
      const partLabel = `${partName} (${variantName})`;
      const matExc = part.material_exception || part.client_material_exception;
      const comment = part.exception_comment || part.client_spec || '';

      // Standard base materials si no están ya en el mapa
      if (!map.has('tela principal')) {
        addMat('Tela Principal', partLabel, 'tela', this.selectedOpmItem.ref_siesa_referencia, this.selectedOpmItem.ref_siesa_descripcion, undefined, undefined);
      }
      if (!map.has('hilo de confección')) {
        addMat('Hilo de Confección', partLabel, 'insumo');
      }

      if (matExc) {
        addMat(
          matExc.descripcion || matExc.referencia || 'Material Asignado',
          partLabel,
          matExc.is_fabric ? 'tela' : 'insumo',
          matExc.referencia,
          matExc.descripcion,
          matExc.color,
          comment
        );
      }

      if (savedMaterials.length === 0) {
        const corpus = `${part.name || ''} ${variantName} ${part.technical_spec || ''} ${part.client_spec || ''}`.toLowerCase();
        if (corpus.includes('botón') || corpus.includes('boton') || corpus.includes('ojal') || corpus.includes('pechera') || corpus.includes('camisa')) {
          addMat('Botones', partLabel, 'insumo');
        }
        if (corpus.includes('cremallera') || corpus.includes('cierre') || corpus.includes('zipper')) {
          addMat('Cremallera / Cierre', partLabel, 'insumo');
        }
        if (corpus.includes('velcro') || corpus.includes('contacto')) {
          addMat('Velcro / Contacto', partLabel, 'insumo');
        }
        if (corpus.includes('entretela') || corpus.includes('cuello') || corpus.includes('puño')) {
          addMat('Entretela Fusionable', partLabel, 'tela');
        }
        if (corpus.includes('reflectiv') || corpus.includes('cinta')) {
          addMat('Cinta Reflectiva', partLabel, 'insumo');
        }
        if (corpus.includes('elástico') || corpus.includes('elastico') || corpus.includes('resorte')) {
          addMat('Elástico', partLabel, 'insumo');
        }
        if (corpus.includes('forro') || corpus.includes('bolsillo')) {
          addMat('Tela Forro', partLabel, 'tela');
        }
      }
    });

    return Array.from(map.values()).map(item => ({
      name: item.name,
      type: item.type,
      sourceParts: Array.from(item.sourceParts).sort(),
      siesaRef: item.siesaRef,
      siesaDesc: item.siesaDesc,
      color: item.color,
      comment: item.comment
    }));
  }

  private isTransversalPart(part: any): boolean {
    const name = (part.name || '').toLowerCase();
    const zone = (part.zone_type || part.zone_name || '').toLowerCase();
    return zone === 'opcional' || 
           name.includes('reflectiv') || 
           name.includes('bordad') || 
           name.includes('estampad') || 
           name.includes('logo') || 
           name.includes('transfer') || 
           name.includes('cinta');
  }

  private getOptionalIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('reflectiv') || n.includes('cinta')) return 'bi-stars';
    if (n.includes('bordad')) return 'bi-patch-check-fill';
    if (n.includes('estampad') || n.includes('transfer') || n.includes('logo')) return 'bi-brush-fill';
    return 'bi-gem';
  }

  extractVariantName(part: any): string {
    if (!part) return 'Estándar';
    if (part.selected_type_name) return part.selected_type_name;
    if (part.part_type?.name) return part.part_type.name;
    if (part.partType?.name) return part.partType.name;
    if (part.technical_spec && part.technical_spec.length < 60) return part.technical_spec;
    if (part.types && part.types.length > 0 && part.selected_type_id) {
      const t = part.types.find((x: any) => Number(x.id) === Number(part.selected_type_id));
      if (t?.name) return t.name;
    }
    return '';
  }

  private inferZoneFromPartName(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('cuello') || n.includes('solapa')) return 'cuello';
    if (n.includes('pech') || n.includes('delanter') || n.includes('bolsillo')) return 'pecho';
    if (n.includes('manga') || n.includes('puño') || n.includes('brazo')) return 'manga';
    if (n.includes('espalda') || n.includes('almilla') || n.includes('canesu')) return 'espalda';
    if (n.includes('pretina') || n.includes('cintur') || n.includes('pasador')) return 'pretina';
    if (n.includes('bota') || n.includes('pierna') || n.includes('rodilla') || n.includes('tiro')) return 'pierna_bota';
    return 'general';
  }

  private enrichAndConsolidateComponents(rawParts: any[], moldParts: any[]): any[] {
    let sourceParts: any[] = [];
    if (rawParts && rawParts.length > 0) {
      sourceParts = [...rawParts];
    } else {
      sourceParts = [...(moldParts || [])];
    }

    const moldZones = this.selectedOpmItem?.mold?.zones || [];

    const enrichedList: any[] = sourceParts.map((raw: any): any => {
      const rawName = (raw.name || raw.garment_part?.name || '').toLowerCase().trim();
      const rawGpId = raw.garment_part_id || raw.garment_part?.id;
      const rawMoldPartId = raw.mold_part_id || (raw.is_from_mold ? raw.id : null);

      const matchedMoldPart = moldParts.find((mp: any) => {
        if (rawMoldPartId && Number(mp.id) === Number(rawMoldPartId)) return true;
        if (rawGpId && Number(mp.garment_part_id) === Number(rawGpId)) return true;
        const mpName = (mp.name || mp.garment_part?.name || '').toLowerCase().trim();
        if (rawName && mpName && (rawName === mpName || rawName.includes(mpName) || mpName.includes(rawName))) return true;
        return false;
      }) || (raw.is_from_mold ? raw : null);

      const typesFromMp = matchedMoldPart?.types || matchedMoldPart?.garment_part?.types || matchedMoldPart?.garmentPart?.types || [];
      const rawTypes = raw.types || [];
      const allTypes = (typesFromMp.length > 0 ? typesFromMp : rawTypes).filter((t: any) => !t.is_disabled);

      let selectedTypeId: number | null = null;
      let selectedTypeName = '';
      let technicalSpec = raw.technical_spec || '';
      let clientSpec = raw.client_spec || '';
      let totalTime = Number(raw.estimated_time) || 0;

      const targetId = Number(raw.selected_type_id || raw.mold_part_type_id || 0);
      const targetName = (raw.selected_type_name || raw.part_type?.name || raw.partType?.name || raw.inventory_description || '').toLowerCase().trim();
      const targetTech = (raw.technical_spec || '').toLowerCase().trim();

      let found = allTypes.find((t: any) => 
        (targetId && Number(t.id) === targetId) ||
        (targetName && (t.name || '').toLowerCase().trim() === targetName) ||
        (targetTech && (t.technical_description || '').toLowerCase().trim() === targetTech) ||
        (targetTech && (t.name || '').toLowerCase().trim() === targetTech)
      );

      if (!found && targetTech) {
        found = allTypes.find((t: any) => 
          (t.technical_description && targetTech.includes(t.technical_description.toLowerCase().trim())) ||
          (t.name && targetTech.includes(t.name.toLowerCase().trim()))
        );
      }

      if (!found && targetName) {
        found = allTypes.find((t: any) => 
          (t.name && (t.name.toLowerCase().includes(targetName) || targetName.includes(t.name.toLowerCase()))) ||
          (t.technical_description && (t.technical_description.toLowerCase().includes(targetName) || targetName.includes(t.technical_description.toLowerCase())))
        );
      }

      if (found) {
        selectedTypeId = found.id;
        selectedTypeName = found.name;
        technicalSpec = raw.technical_spec || found.technical_description || '';
        totalTime = Number(raw.estimated_time) || Number(found.total_time) || 0;
      } else if (raw.selected_type_name || raw.technical_spec || targetId) {
        selectedTypeId = targetId || raw.selected_type_id || null;
        selectedTypeName = raw.selected_type_name || raw.part_type?.name || raw.inventory_description || raw.technical_spec || '';
        technicalSpec = raw.technical_spec || '';
        totalTime = Number(raw.estimated_time || raw.total_time) || 0;
      }

      let zoneObj = matchedMoldPart?.zone || raw.zone;
      let zoneId = matchedMoldPart?.mold_zone_id || raw.mold_zone_id || null;
      let zoneName = zoneObj?.name || matchedMoldPart?.zone_name || raw.zone_name || raw.inventory_reference || '';
      let zoneType = zoneObj?.zone_type || matchedMoldPart?.zone_type || raw.zone_type || '';

      if (moldZones.length) {
        const matchingZone = moldZones.find((z: any) => {
          const zName = (z.name || '').toLowerCase().trim();
          const zType = (z.zone_type || '').toLowerCase().trim();
          const targetZName = (zoneName || '').toLowerCase().trim();
          if (zoneId && Number(z.id) === Number(zoneId)) return true;
          if (targetZName && (zName === targetZName || targetZName.includes(zName) || zName.includes(targetZName))) return true;
          if (targetZName && zType && (zType === targetZName || targetZName.includes(zType) || zType.includes(targetZName))) return true;
          if (zName && (rawName.includes(zName) || zName.includes(rawName))) return true;
          if (zType && (rawName.includes(zType) || zType.includes(rawName))) return true;
          return false;
        });
        if (matchingZone) {
          if (!zoneId) zoneId = matchingZone.id;
          if (!zoneName) zoneName = matchingZone.name;
          if (!zoneType) zoneType = matchingZone.zone_type;
        }
      }

      const isMandatory = raw.is_mandatory !== undefined 
        ? raw.is_mandatory 
        : (matchedMoldPart ? matchedMoldPart.is_mandatory !== false : true);

      return {
        mold_part_id: matchedMoldPart?.id || rawMoldPartId || null,
        mold_zone_id: zoneId,
        zone_name: zoneName,
        zone_type: zoneType,
        garment_part_id: matchedMoldPart?.garment_part_id || rawGpId || null,
        name: matchedMoldPart?.garment_part?.name || matchedMoldPart?.name || raw.name || 'Componente',
        item_type: raw.item_type || matchedMoldPart?.item_type || 'parte',
        view: raw.view || matchedMoldPart?.view || 'front',
        position_x: raw.position_x ?? matchedMoldPart?.position_x ?? null,
        position_y: raw.position_y ?? matchedMoldPart?.position_y ?? null,
        width: raw.width ?? matchedMoldPart?.width ?? 22,
        height: raw.height ?? matchedMoldPart?.height ?? 18,
        is_mandatory: isMandatory,
        client_spec: clientSpec,
        technical_spec: technicalSpec,
        estimated_time: totalTime,
        material_exception: raw.material_exception || raw.technical_material_exception || null,
        client_material_exception: raw.client_material_exception || null,
        is_from_mold: raw.is_from_mold !== undefined ? raw.is_from_mold : !!matchedMoldPart,
        types: allTypes,
        selected_type_id: selectedTypeId,
        selected_type_name: selectedTypeName,
        icon: matchedMoldPart?.icon || matchedMoldPart?.garment_part?.icon || raw.icon || 'bi-layers',
        exception_comment: raw.exception_comment || null,
        inventory_reference: raw.inventory_reference || null,
        inventory_description: raw.inventory_description || null
      };
    });

    const consolidatedMap = new Map<string, any>();
    for (const comp of enrichedList) {
      const cName = (comp.name || '').toLowerCase().trim();
      const key = comp.item_type === 'material'
        ? `mat_${cName}`
        : (comp.mold_part_id
          ? `mp_${comp.mold_part_id}`
          : `${cName}__${comp.mold_zone_id || comp.zone_name || 'no-zone'}__${comp.garment_part_id || 'no-gp'}`);

      if (consolidatedMap.has(key)) {
        const existing = consolidatedMap.get(key)!;
        if (!existing.exception_comment && comp.exception_comment) {
          existing.exception_comment = comp.exception_comment;
        }
        if (!existing._all_zone_ids) {
          existing._all_zone_ids = existing.mold_zone_id ? [existing.mold_zone_id] : [];
        }
        if (comp.mold_zone_id && !existing._all_zone_ids.includes(comp.mold_zone_id)) {
          existing._all_zone_ids.push(comp.mold_zone_id);
        }
        if (comp.selected_type_id || comp.selected_type_name) {
          existing.selected_type_id = comp.selected_type_id;
          existing.selected_type_name = comp.selected_type_name;
          existing.technical_spec = comp.technical_spec;
        }
      } else {
        comp._all_zone_ids = comp.mold_zone_id ? [comp.mold_zone_id] : [];
        consolidatedMap.set(key, comp);
      }
    }

    return Array.from(consolidatedMap.values());
  }

  // ==================== OPM EDIT MODAL (CON MOLD-OPM-STEPPER) ====================

  openEditOpmModal(item: any, event?: Event): void {
    if (event) event.stopPropagation();
    // Clonar para asegurar reactividad y propiedades que requiere mold-opm-stepper
    // NO pasar 'materiales' del tracking: las vinculaciones se restauran desde la ficha técnica guardada
    this.editingOpmItem = {
      ...item,
      moldId: item.mold_id || item.mold?.id || item.moldId,
      moldName: item.mold?.name || item.moldName,
      categoryName: item.mold?.category?.name || item.categoryName,
      technicalSpecId: item.technical_spec_id || item.technical_spec?.id || item.technicalSpecId,
      opmReference: item.technical_spec?.reference || item.opmReference,
      tallas: (item.tallas && item.tallas.length > 0)
        ? [...item.tallas]
        : [{ talla: item.talla || 'M', cantidad: item.cantidad_muestra || 1 }]
    };
    this.isEditingOpmSpec = true;
    this.isSavingOpm = false;
  }

  onOpmSavedFromStepper(event: any): void {
    if (!event) return;
    const specId = event.technicalSpecId;
    const itemId = event.itemId || this.editingOpmItem?.id;

    // Buscar y actualizar el ítem localmente en muestra.items
    const matchedItem = (this.muestra?.items || []).find((i: any) => i.id === itemId) || this.editingOpmItem;
    if (matchedItem) {
      matchedItem.technical_spec_id = specId;
      matchedItem.technicalSpecId = specId;
      matchedItem.opmReference = event.reference;
      matchedItem.opm_reference = event.reference;
      if (event.samTime) {
        matchedItem.totalSamTime = event.samTime;
      }
      if (!matchedItem.technical_spec) matchedItem.technical_spec = {};
      matchedItem.technical_spec.id = specId;
      matchedItem.technical_spec.reference = event.reference;
    }

    if (this.editingOpmItem && (!itemId || this.editingOpmItem.id === itemId)) {
      this.editingOpmItem.technical_spec_id = specId;
      this.editingOpmItem.technicalSpecId = specId;
      this.editingOpmItem.opmReference = event.reference;
      this.editingOpmItem.opm_reference = event.reference;
      if (event.samTime) {
        this.editingOpmItem.totalSamTime = event.samTime;
      }
    }

    // Sincronizar materiales hacia el módulo de abastecimiento / almacén
    this.syncOpmMaterialsToWarehouse(specId, event.materials, matchedItem);

    // Detectar si la Tela Principal fue vinculada o desvinculada para actualizar refs en el ítem
    const updatePayload: any = { technical_spec_id: specId };
    if (event.materials) {
      const telaMat = event.materials.find((m: any) =>
        (m.name || '').toLowerCase() === 'tela principal' && m.type === 'tela'
      );
      if (telaMat && !telaMat.siesa) {
        // Tela fue desvinculada: limpiar referencia SIESA en el ítem
        updatePayload.ref_siesa_referencia = null;
        updatePayload.ref_siesa_descripcion = null;
        if (matchedItem) {
          matchedItem.ref_siesa_referencia = null;
          matchedItem.ref_siesa_descripcion = null;
        }
      } else if (telaMat && telaMat.siesa) {
        // Tela vinculada a SIESA
        updatePayload.ref_siesa_referencia = telaMat.siesa.referencia;
        updatePayload.ref_siesa_descripcion = telaMat.siesa.descripcion || telaMat.siesa.referencia;
        if (matchedItem) {
          matchedItem.ref_siesa_referencia = telaMat.siesa.referencia;
          matchedItem.ref_siesa_descripcion = telaMat.siesa.descripcion || telaMat.siesa.referencia;
        }
      }
    }

    // Persistir la relación técnica en el ítem de la solicitud
    if (itemId) {
      this.comercialService.actualizarItem(this.solicitudId, itemId, updatePayload).subscribe({
        next: () => {
          this.loadMateriales();
          if (this.selectedOpmItem && this.selectedOpmItem.id === itemId) {
            this.selectedOpmItem.technical_spec_id = specId;
            this.loadAndEnrichTechnicalSpec(specId);
          }
        },
        error: () => {
          this.loadMateriales();
        }
      });
    }
  }

  // ==================== SINCRONIZACIÓN DE MATERIALES CON ALMACÉN ====================

  private isSyncingSpecMaterials = false;

  private inferGrupoInsumo(name: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('tela') || n.includes('forro') || n.includes('malla') || n.includes('denim') || n.includes('dril') || n.includes('entretela')) {
      return 'TELAS';
    }
    if (n.includes('botón') || n.includes('boton') || n.includes('broche')) {
      return 'BOTONES';
    }
    if (n.includes('cierre') || n.includes('cremallera') || n.includes('zipper')) {
      return 'CIERRES';
    }
    if (n.includes('hilo') || n.includes('hiladilla') || n.includes('costura')) {
      return 'HILOS';
    }
    if (n.includes('marquilla') || n.includes('etiqueta')) {
      return 'MARQUILLAS';
    }
    if (n.includes('cinta') || n.includes('reflectiv')) {
      return 'CINTAS';
    }
    if (n.includes('elástico') || n.includes('elastico') || n.includes('resorte')) {
      return 'ELASTICOS';
    }
    if (n.includes('velcro') || n.includes('contacto')) {
      return 'VELCROS';
    }
    if (n.includes('cordón') || n.includes('cordon')) {
      return 'CORDONES';
    }
    if (n.includes('sesgo') || n.includes('vivo')) {
      return 'SESGOS';
    }
    return 'OTROS';
  }

  syncOpmMaterialsToWarehouse(specId: number, materials?: any[], sourceItem?: any): void {
    if (!this.solicitudId) return;
    const currentItem = sourceItem || this.editingOpmItem;

    let matsToSync = materials;
    if (!matsToSync || matsToSync.length === 0) {
      const parts = currentItem?.technical_spec?.parts || [];
      const matParts = parts.filter((p: any) => p.item_type === 'material');
      if (matParts.length > 0) {
        matsToSync = matParts.map((p: any) => ({
          name: p.name,
          type: (p.selected_type_name || '').toLowerCase() === 'tela' || (p.name || '').toLowerCase().includes('tela') ? 'tela' : 'insumo',
          note: p.client_spec || '',
          siesa: p.inventory_reference ? {
            referencia: p.inventory_reference,
            descripcion: p.inventory_description || p.selected_type_name || '',
          } : null
        }));
      }
    }

    if (!matsToSync || matsToSync.length === 0) return;

    const units = currentItem?.tallas?.reduce((sum: number, t: any) => sum + (Number(t.cantidad) || 0), 0) || currentItem?.cantidad_muestra || 1;

    const payload = matsToSync.map((mat: any) => {
      const isTela = mat.type === 'tela';
      let siesa = mat.siesa;
      // NO auto-vincular si siesa es null: el usuario pudo haber desvinculado intencionalmente
      const ref = siesa ? siesa.referencia : (mat.inventory_reference || null);
      const desc = siesa ? siesa.descripcion : (mat.inventory_description || null);
      const color = siesa ? siesa.color : null;
      const note = mat.note || mat.client_spec || '';

      let customDesc = mat.name;
      if (desc && desc !== mat.name) {
        customDesc += ` - ${desc}`;
      }
      if (note) {
        customDesc += ` [${note}]`;
      }

      return {
        solicitud_item_id: currentItem?.id || null,
        technical_spec_id: specId,
        nombre_material: mat.name,
        tipo_material: isTela ? 'TELA' : 'INSUMO',
        grupo_insumo: this.inferGrupoInsumo(mat.name),
        origen_asignacion: ref ? 'SIESA' : 'MANUAL',
        siesa_id_item: ref || null,
        siesa_referencia: ref || null,
        siesa_descripcion: desc || null,
        siesa_color: color || null,
        descripcion_personalizada: customDesc,
        cantidad_requerida: isTela ? Math.max(1, Math.round(units * 1.5 * 10) / 10) : units,
        unidad_medida: isTela ? 'METROS' : 'UND',
        creado_por_rol: 'INGENIERIA'
      };
    });

    this.comercialService.guardarMateriales(this.solicitudId, {
      materiales: payload,
      creado_por_rol: 'INGENIERIA'
    }).subscribe({
      next: () => {
        this.loadMateriales();
      },
      error: (err) => {
        console.warn('Error al sincronizar materiales con almacén:', err);
      }
    });
  }

  syncExistingTechnicalSpecMaterials(): void {
    if (!this.muestra?.items || !this.solicitudId || this.isSyncingSpecMaterials) return;

    const existingTrackingKeys = new Set<string>();
    (this.materialesData?.materiales || []).forEach((m: any) => {
      const itemId = m.solicitud_item_id || 'no-item';
      if (m.nombre_material) {
        existingTrackingKeys.add(`${itemId}_${m.nombre_material.toLowerCase().trim()}`);
      }
      if (m.siesa_referencia) {
        existingTrackingKeys.add(`${itemId}_${m.siesa_referencia.toLowerCase().trim()}`);
      }
      if (m.descripcion_personalizada) {
        const descLower = m.descripcion_personalizada.toLowerCase().trim();
        existingTrackingKeys.add(`${itemId}_${descLower}`);
        const base = descLower.split(' - ')[0].split(' [')[0].trim();
        if (base) existingTrackingKeys.add(`${itemId}_${base}`);
      }
      if (m.tipo_material === 'TELA') {
        existingTrackingKeys.add(`${itemId}_tela principal`);
      }
    });

    const pendingPayload: any[] = [];

    this.muestra.items.forEach((item: any) => {
      const parts = item.technical_spec?.parts || [];
      const matParts = parts.filter((p: any) => p.item_type === 'material');
      const units = item.tallas?.reduce((sum: number, t: any) => sum + (Number(t.cantidad) || 0), 0) || item.cantidad_muestra || 1;

      // 1. Tela asignada directamente al ítem (ref_siesa_referencia o ref_siesa_descripcion)
      const itemTelaRef = (item.ref_siesa_referencia || '').trim();
      const itemTelaDesc = (item.ref_siesa_descripcion || '').trim();
      if (itemTelaRef || itemTelaDesc) {
        const telaKey1 = `${item.id || 'no-item'}_${itemTelaRef.toLowerCase()}`;
        const telaKey2 = `${item.id || 'no-item'}_tela principal`;
        if (!existingTrackingKeys.has(telaKey1) && !existingTrackingKeys.has(telaKey2)) {
          existingTrackingKeys.add(telaKey1);
          existingTrackingKeys.add(telaKey2);
          pendingPayload.push({
            solicitud_item_id: item.id,
            technical_spec_id: item.technical_spec_id || item.technical_spec?.id || null,
            nombre_material: 'Tela Principal',
            tipo_material: 'TELA',
            grupo_insumo: 'TELAS',
            origen_asignacion: itemTelaRef ? 'SIESA' : 'MANUAL',
            siesa_id_item: itemTelaRef || null,
            siesa_referencia: itemTelaRef || null,
            siesa_descripcion: itemTelaDesc || null,
            descripcion_personalizada: `Tela Principal${itemTelaDesc ? ' - ' + itemTelaDesc : ''}`,
            cantidad_requerida: Math.max(1, Math.round(units * 1.5 * 10) / 10),
            unidad_medida: 'METROS',
            creado_por_rol: 'INGENIERIA'
          });
        }
      }

      // 2. Materiales guardados en la ficha técnica / OPM
      matParts.forEach((p: any) => {
        const ref = p.inventory_reference || '';
        const name = p.name || 'Material';
        const key = `${item.id || 'no-item'}_${(ref || name).toLowerCase().trim()}`;

        if (existingTrackingKeys.has(key)) return;
        existingTrackingKeys.add(key);

        const isTela = (p.selected_type_name || '').toLowerCase() === 'tela' ||
                       name.toLowerCase().includes('tela') ||
                       name.toLowerCase().includes('forro') ||
                       name.toLowerCase().includes('malla') ||
                       name.toLowerCase().includes('entretela');

        let customDesc = name;
        if (p.inventory_description) customDesc += ` - ${p.inventory_description}`;
        if (p.client_spec) customDesc += ` [${p.client_spec}]`;

        pendingPayload.push({
          solicitud_item_id: item.id,
          technical_spec_id: item.technical_spec_id || item.technical_spec?.id,
          nombre_material: name,
          tipo_material: isTela ? 'TELA' : 'INSUMO',
          grupo_insumo: this.inferGrupoInsumo(name),
          origen_asignacion: ref ? 'SIESA' : 'MANUAL',
          siesa_id_item: ref || null,
          siesa_referencia: ref || null,
          siesa_descripcion: p.inventory_description || null,
          descripcion_personalizada: customDesc,
          cantidad_requerida: isTela ? Math.max(1, Math.round(units * 1.5 * 10) / 10) : units,
          unidad_medida: isTela ? 'METROS' : 'UND',
          creado_por_rol: 'INGENIERIA'
        });
      });
    });

    if (pendingPayload.length > 0) {
      this.isSyncingSpecMaterials = true;
      this.comercialService.guardarMateriales(this.solicitudId, {
        materiales: pendingPayload,
        creado_por_rol: 'INGENIERIA'
      }).subscribe({
        next: () => {
          this.isSyncingSpecMaterials = false;
          this.comercialService.listarMaterialesSolicitud(this.solicitudId).subscribe({
            next: (mRes) => {
              if (mRes.success && mRes.data) {
                this.materialesData = mRes.data;
              }
            }
          });
        },
        error: (err) => {
          this.isSyncingSpecMaterials = false;
          console.warn('Error sincronizando materiales previos con almacén:', err);
        }
      });
    }
  }

  closeEditOpmModal(): void {
    if (this.stepperComponent) {
      if (this.stepperComponent.autoSaveTimer) {
        clearTimeout(this.stepperComponent.autoSaveTimer);
        this.stepperComponent.autoSaveTimer = null;
      }
      this.stepperComponent.generarOpmFinal(true);
    }
    this.isEditingOpmSpec = false;
    const prevItem = this.editingOpmItem;
    setTimeout(() => {
      if (this.editingOpmItem === prevItem) {
        this.editingOpmItem = null;
      }
    }, 1200);
    // Sincronizar materiales en segundo plano silenciosamente
    this.loadMateriales();
  }

  // ==================== TECHNICAL STEP-BY-STEP & DATA SHEET ====================

  // Accordion state for step-by-step operations breakdown
  expandedSteps: Record<number, boolean> = {};

  toggleStepExpansion(stepNumber: number, event?: Event): void {
    if (event) event.stopPropagation();
    this.expandedSteps[stepNumber] = !this.expandedSteps[stepNumber];
  }

  isStepExpanded(stepNumber: number): boolean {
    return !!this.expandedSteps[stepNumber];
  }

  expandAllSteps(expand: boolean = true): void {
    const steps = this.getTechnicalSteps();
    steps.forEach(s => {
      this.expandedSteps[s.stepNumber] = expand;
    });
  }

  areAllStepsExpanded(): boolean {
    const steps = this.getTechnicalSteps();
    if (!steps || steps.length === 0) return false;
    return steps.every(s => !!this.expandedSteps[s.stepNumber]);
  }

  getTotalOperationsCount(): number {
    const steps = this.getTechnicalSteps();
    return steps.reduce((acc, step) => acc + (step.operations?.length || (step.estimatedTime > 0 ? 1 : 0)), 0);
  }

  private readonly ASSEMBLY_ORDER: Record<string, number> = {
    'cuello': 1,
    'pecho': 2,
    'espalda': 3,
    'manga': 4,
    'pretina': 5,
    'pierna_bota': 6,
    'general': 7,
    'opcional': 8
  };

  getTechnicalSteps(): any[] {
    if (!this.selectedOpmItem) return [];
    const allParts = this.getAllItemParts(this.selectedOpmItem);

    // Sort parts according to standard garment manufacturing sequence
    const sorted = [...allParts].sort((a, b) => {
      const orderA = this.ASSEMBLY_ORDER[a.zone_type || 'general'] || 99;
      const orderB = this.ASSEMBLY_ORDER[b.zone_type || 'general'] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    });

    return sorted.map((p, idx) => {
      const variantName = this.extractVariantName(p);
      let instruction = p.technical_spec || '';
      let operations: any[] = [];

      if (p.types && p.types.length > 0) {
        let matchedT = p.types.find((t: any) => Number(t.id) === Number(p.selected_type_id));
        if (!matchedT && p.selected_type_name) {
          matchedT = p.types.find((t: any) => (t.name || '').toLowerCase().trim() === (p.selected_type_name || '').toLowerCase().trim());
        }
        if (!matchedT && p.types.length === 1) {
          matchedT = p.types[0];
        }
        if (matchedT) {
          if (!instruction) {
            instruction = matchedT.technical_description || '';
          }
          if (Array.isArray(matchedT.operations) && matchedT.operations.length > 0) {
            operations = matchedT.operations;
          }
        }
      }

      if ((!operations || operations.length === 0) && Array.isArray(p.operations) && p.operations.length > 0) {
        operations = p.operations;
      }

      if (!instruction) {
        instruction = `Confección y ensamble de ${p.name} según variante ${variantName}. Armado con costura de seguridad y pespunte según patrón base.`;
      }

      const zoneLabel = p.zone_name || (p.zone?.name) || this.getZoneLabel(p.zone_type);
      const time = Number(p.estimated_time || p.total_time || 0);

      const normalizedOps = (operations && operations.length > 0)
        ? operations.map((op: any, opIdx: number) => ({
            index: opIdx + 1,
            name: op.operation_name || op.name || 'Operación de ensamble',
            machine: op.machine_name || op.machine || 'Plana 1 Aguja',
            time: Number(op.execution_time || op.time || 0),
            category: op.category || 'Ensamble',
            notes: op.notes || op.comment || ''
          }))
        : [];

      return {
        stepNumber: idx + 1,
        partName: p.name || 'Operación',
        zoneName: zoneLabel,
        zoneType: p.zone_type || 'general',
        variantName: variantName,
        technicalInstruction: instruction,
        estimatedTime: time,
        clientRequirement: p.exception_comment || p.client_spec || '',
        material: p.material_exception || p.client_material_exception || null,
        isMandatory: p.is_mandatory !== false,
        icon: p.icon || this.getZoneIcon(p.zone_type),
        operations: normalizedOps
      };
    });
  }

  getTechnicalSummaryList(): { label: string; value: string; icon: string; highlight?: boolean }[] {
    if (!this.selectedOpmItem) return [];
    const parts = this.getAllItemParts(this.selectedOpmItem);
    const list: { label: string; value: string; icon: string; highlight?: boolean }[] = [];

    // 1. Tela Principal
    list.push({
      label: 'Tela Principal Base',
      value: this.selectedOpmItem.ref_siesa_descripcion || this.selectedOpmItem.ref_siesa_referencia || 'Según tejido base de solicitud',
      icon: 'bi-droplet-fill',
      highlight: true
    });

    // 2. Puntadas por Pulgada (PPP)
    list.push({
      label: 'Densidad de Puntada (PPP)',
      value: '10 a 12 puntadas por pulgada (confección estándar liviano/pesado)',
      icon: 'bi-activity'
    });

    // 3. Hilo de Confección
    list.push({
      label: 'Hilo de Costura',
      value: 'Hilo 100% poliéster calibre 120 / 75 según especificación de tela',
      icon: 'bi-dash-lg'
    });

    // 4. Operaciones clave
    const cuelloPart = parts.find(p => (p.zone_type || '').includes('cuello') || (p.name || '').toLowerCase().includes('cuello'));
    if (cuelloPart) {
      list.push({
        label: 'Cuello / Solapa',
        value: `${this.extractVariantName(cuelloPart)} · ${cuelloPart.technical_spec || 'Fusionado y pespunteado a 1/16"'}`,
        icon: 'bi-gem'
      });
    }

    const pecheraPart = parts.find(p => (p.zone_type || '').includes('pecho') || (p.name || '').toLowerCase().includes('pechera') || (p.name || '').toLowerCase().includes('bolsillo'));
    if (pecheraPart) {
      list.push({
        label: 'Delantero / Bolsillos',
        value: `${this.extractVariantName(pecheraPart)} · ${pecheraPart.technical_spec || 'Armado y fijado con atraques de seguridad'}`,
        icon: 'bi-columns'
      });
    }

    const mangaPart = parts.find(p => (p.zone_type || '').includes('manga') || (p.name || '').toLowerCase().includes('manga') || (p.name || '').toLowerCase().includes('puño'));
    if (mangaPart) {
      list.push({
        label: 'Mangas / Puños',
        value: `${this.extractVariantName(mangaPart)} · ${mangaPart.technical_spec || 'Pegado de manga con sesgo / sangría y puño fusionado'}`,
        icon: 'bi-layers-fill'
      });
    }

    // 5. Botones y Ojales
    list.push({
      label: 'Botones y Ojales',
      value: 'Ojales reforzados con botones de pasta 4 orificios según diseño',
      icon: 'bi-record-circle'
    });

    // 6. Planchado y Empaque
    list.push({
      label: 'Terminación y Empaque',
      value: `${this.muestra?.tipo_empaque || 'Bolsa individual'} · ${this.muestra?.material_empaque || 'Doblado de fábrica con cartón soporte'}`,
      icon: 'bi-box-seam-fill'
    });

    return list;
  }

  // ==================== TRAZABILIDAD DE MATERIALES E INSUMOS ====================

  materialesData: any = {
    metricas: { total: 0, entregados: 0, parciales: 0, pendientes: 0, no_disponibles: 0, porcentaje_entrega: 0, semaforo: 'PENDIENTE' },
    materiales: []
  };
  isLoadingMateriales = false;
  showMaterialModal = false;
  materialModalTab: 'siesa' | 'manual' = 'siesa';
  siesaSoloConStock: boolean = true;
  siesaSearchQuery: string = '';
  siesaSearchResults: any[] = [];
  isSearchingSiesa = false;
  siesaSelectedCategory: string = 'TODOS';

  nuevoMaterial: any = {
    id: null,
    solicitud_item_id: null,
    tipo_material: 'INSUMO',
    grupo_insumo: 'BOTONES',
    origen_asignacion: 'SIESA',
    siesa_id_item: '',
    siesa_referencia: '',
    siesa_descripcion: '',
    siesa_id_color: '',
    siesa_color: '',
    descripcion_personalizada: '',
    cantidad_requerida: 1,
    unidad_medida: 'UND',
  };

  // Modal Despacho Rápido
  showDespachoModal = false;
  despachoItem: any = null;
  despachoCantidad = 1;
  despachoEsTotal = true;
  despachoObservaciones = '';
  isSavingDespacho = false;

  // Acordeón de Desglose de Prendas y Partes por Material
  expandedMaterialKeys: Set<string> = new Set<string>();

  toggleMaterialExpansion(key: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.expandedMaterialKeys.has(key)) {
      this.expandedMaterialKeys.delete(key);
    } else {
      this.expandedMaterialKeys.add(key);
    }
  }

  isMaterialExpanded(key: string): boolean {
    return this.expandedMaterialKeys.has(key);
  }

  getMaterialBreakdownForPrenda(item: any, matName: string): { cantidadPartes: number; partes: string[] } {
    if (!item) return { cantidadPartes: 0, partes: [] };

    const target = (matName || '').toLowerCase().trim();

    // 1. Si la ficha técnica tiene el material explícito guardado
    const specParts = item.technical_spec?.parts || [];
    const matPart = specParts.find((p: any) => p.item_type === 'material' && (p.name || '').toLowerCase().trim() === target);

    if (matPart && matPart.zone_name) {
      if (matPart.zone_name.includes(' | ')) {
        const list = matPart.zone_name.split(' | ').map((s: string) => s.trim()).filter((s: string) => !!s);
        return { cantidadPartes: list.length, partes: list };
      }
      if (matPart.zone_name.includes(', ') && !matPart.zone_name.includes('Toda la prenda')) {
        const list = matPart.zone_name.split(', ').map((s: string) => s.trim()).filter((s: string) => !!s);
        return { cantidadPartes: list.length, partes: list };
      }
    }

    // 2. Extraer de las partes de corte y confección de la prenda
    const allParts = this.getAllItemParts(item).filter((p: any) => p.item_type !== 'material');
    const partesEncontradas = new Set<string>();

    for (const part of allParts) {
      const partName = part.name || 'Parte';
      const variantName = this.extractVariantName(part);
      const partLabel = variantName ? `${partName} (${variantName})` : partName;
      const text = `${partName} ${variantName} ${part.technical_spec || ''} ${part.client_spec || ''}`.toLowerCase();

      if (target.includes('tela principal')) {
        partesEncontradas.add(partLabel);
      } else if (target.includes('hilo')) {
        partesEncontradas.add(partLabel);
      } else if (target.includes('entretela')) {
        if (text.includes('cuello') || text.includes('puño') || text.includes('fusion') || text.includes('cartera') || text.includes('pretina')) {
          partesEncontradas.add(partLabel);
        }
      } else if (target.includes('botón') || target.includes('boton')) {
        if (text.includes('botón') || text.includes('boton') || text.includes('pechera') || text.includes('cartera') || text.includes('ojal')) {
          partesEncontradas.add(partLabel);
        }
      } else if (target.includes('cremallera') || target.includes('cierre') || target.includes('zipper')) {
        if (text.includes('cremallera') || text.includes('cierre') || text.includes('zipper')) {
          partesEncontradas.add(partLabel);
        }
      } else if (target.includes('broche')) {
        if (text.includes('broche')) {
          partesEncontradas.add(partLabel);
        }
      } else if (target.includes('elástico') || target.includes('elastico') || target.includes('resorte')) {
        if (text.includes('elástico') || text.includes('elastico') || text.includes('resorte') || text.includes('pretina')) {
          partesEncontradas.add(partLabel);
        }
      }
    }

    // Si es tela principal o hilo, asegurar que al menos esté en la prenda base
    if (target.includes('tela principal') && partesEncontradas.size === 0) {
      partesEncontradas.add('Cuerpo / Prenda Base');
    }
    if (target.includes('hilo') && partesEncontradas.size === 0) {
      partesEncontradas.add('Costura y Ensamble');
    }

    const list = Array.from(partesEncontradas);
    return { cantidadPartes: list.length || 1, partes: list.length ? list : ['Prenda Base'] };
  }

  get materialesAgrupados(): any[] {
    const rawList = this.materialesData?.materiales || [];
    if (!rawList.length) return [];

    const map = new Map<string, any>();

    for (const m of rawList) {
      let rawName = (m.nombre_material || '').trim();
      if (!rawName && m.descripcion_personalizada) {
        const split = m.descripcion_personalizada.split(' - ');
        const candidate = split[0].split(' [')[0].trim();
        if (m.tipo_material === 'TELA' && (candidate.toUpperCase().startsWith('TEL') || candidate === m.siesa_referencia)) {
          rawName = 'Tela Principal';
        } else {
          rawName = candidate;
        }
      }
      if (!rawName && m.tipo_material === 'TELA') rawName = 'Tela Principal';
      if (!rawName && m.siesa_descripcion) rawName = m.siesa_descripcion;
      if (!rawName) rawName = 'Insumo';

      const key = rawName.toLowerCase().trim();

      if (!map.has(key)) {
        map.set(key, {
          key: key,
          nombre: rawName,
          tipo_material: m.tipo_material,
          grupo_insumo: m.grupo_insumo,
          unidad_medida: m.unidad_medida || (m.tipo_material === 'TELA' ? 'METROS' : 'UND'),
          cantidad_requerida_total: 0,
          cantidad_entregada_total: 0,
          siesa_referencia: m.siesa_referencia || null,
          siesa_descripcion: m.siesa_descripcion || null,
          siesa_color: m.siesa_color || null,
          descripcion_personalizada: m.descripcion_personalizada || null,
          creado_por_rol: m.creado_por_rol || 'INGENIERIA',
          rawItems: [],
          prendasMap: new Map<number, any>()
        });
      }

      const group = map.get(key);
      group.rawItems.push(m);
      group.cantidad_requerida_total += Number(m.cantidad_requerida) || 0;
      group.cantidad_entregada_total += Number(m.cantidad_entregada) || 0;

      if (m.siesa_referencia && !group.siesa_referencia) {
        group.siesa_referencia = m.siesa_referencia;
        group.siesa_descripcion = m.siesa_descripcion;
        group.siesa_color = m.siesa_color;
      }
      if (m.descripcion_personalizada && !group.descripcion_personalizada) {
        group.descripcion_personalizada = m.descripcion_personalizada;
      }

      const itemId = m.solicitud_item_id;
      if (itemId && !group.prendasMap.has(itemId)) {
        const itemObj = (this.muestra?.items || []).find((i: any) => i.id === itemId);
        const breakdown = this.getMaterialBreakdownForPrenda(itemObj, rawName);
        group.prendasMap.set(itemId, {
          itemId: itemId,
          prendaNombre: itemObj?.descripcion || itemObj?.item_cliente || `Prenda #${itemId}`,
          prendaReferencia: itemObj?.siesa_referencia || '',
          cantidadPartes: breakdown.cantidadPartes,
          partes: breakdown.partes,
          cantidadRequerida: Number(m.cantidad_requerida) || 0,
          unidadMedida: m.unidad_medida || group.unidad_medida,
          trackingId: m.id
        });
      }
    }

    // Fallback: si prendasMap no tiene entradas por alguna razón, computar desde muestra.items
    for (const group of map.values()) {
      if (group.prendasMap.size === 0 && this.muestra?.items?.length) {
        this.muestra.items.forEach((item: any) => {
          const breakdown = this.getMaterialBreakdownForPrenda(item, group.nombre);
          if (breakdown.cantidadPartes > 0) {
            group.prendasMap.set(item.id, {
              itemId: item.id,
              prendaNombre: item.descripcion || item.item_cliente || `Prenda #${item.id}`,
              prendaReferencia: item.siesa_referencia || '',
              cantidadPartes: breakdown.cantidadPartes,
              partes: breakdown.partes,
              cantidadRequerida: group.cantidad_requerida_total,
              unidadMedida: group.unidad_medida
            });
          }
        });
      }
    }

    return Array.from(map.values()).map(g => {
      const hasSiesa = !!g.siesa_referencia;
      const descLimpia = (g.descripcion_personalizada || '').trim();
      const hasSpecificManualDesc = descLimpia && descLimpia.toLowerCase() !== g.nombre.toLowerCase();

      let estadoDefinicion: 'SIESA' | 'MANUAL' | 'PENDIENTE' = 'PENDIENTE';
      if (hasSiesa) {
        estadoDefinicion = 'SIESA';
      } else if (hasSpecificManualDesc) {
        estadoDefinicion = 'MANUAL';
      }

      const prendasDesglose = Array.from(g.prendasMap.values());
      const prendasCount = prendasDesglose.length || 1;

      let estadoEntrega = 'PENDIENTE';
      if (g.cantidad_entregada_total >= g.cantidad_requerida_total && g.cantidad_requerida_total > 0) {
        estadoEntrega = 'ENTREGADO';
      } else if (g.cantidad_entregada_total > 0) {
        estadoEntrega = 'PARCIAL';
      }

      return {
        ...g,
        estadoDefinicion,
        prendasCount,
        prendasDesglose,
        estadoEntrega,
        firstTrackingId: g.rawItems[0]?.id || null,
        firstTrackingItem: g.rawItems[0] || null
      };
    });
  }

  abrirModalDefinirMaterial(mat: any): void {
    const rawItem = mat.firstTrackingItem || mat.rawItems?.[0] || null;
    const rawId = rawItem?.id || null;
    const itemId = rawItem?.solicitud_item_id || mat.prendasDesglose?.[0]?.itemId || null;

    this.nuevoMaterial = {
      id: rawId,
      solicitud_item_id: itemId,
      nombre_material: mat.nombre,
      tipo_material: mat.tipo_material,
      grupo_insumo: mat.grupo_insumo,
      origen_asignacion: mat.siesa_referencia ? 'SIESA' : 'MANUAL',
      siesa_id_item: mat.siesa_referencia || '',
      siesa_referencia: mat.siesa_referencia || '',
      siesa_descripcion: mat.siesa_descripcion || '',
      siesa_id_color: '',
      siesa_color: mat.siesa_color || '',
      descripcion_personalizada: mat.descripcion_personalizada || mat.nombre,
      cantidad_requerida: mat.cantidad_requerida_total || 1,
      unidad_medida: mat.unidad_medida || (mat.tipo_material === 'TELA' ? 'METROS' : 'UND'),
    };

    let searchQ = mat.nombre;
    const lower = mat.nombre.toLowerCase();
    if (lower.includes('tela principal')) searchQ = 'DRIL';
    else if (lower.includes('entretela')) searchQ = 'ENTRETELA';
    else if (lower.includes('hilo')) searchQ = 'HILO';
    else if (lower.includes('cierre') || lower.includes('cremallera')) searchQ = 'CIERRE';
    else if (lower.includes('broche')) searchQ = 'BROCHE';
    else if (lower.includes('elástico') || lower.includes('elastico')) searchQ = 'ELASTICO';
    else if (lower.includes('botón') || lower.includes('boton')) searchQ = 'BOTON';

    this.siesaSearchQuery = searchQ;
    this.siesaSearchResults = [];
    this.materialModalTab = mat.siesa_referencia ? 'siesa' : 'siesa';
    this.showMaterialModal = true;
    this.buscarInsumosSiesa();
  }

  loadMateriales(shouldSync: boolean = true): void {
    if (!this.solicitudId) return;
    this.isLoadingMateriales = true;
    this.comercialService.listarMaterialesSolicitud(this.solicitudId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.materialesData = res.data;
          if (shouldSync) {
            this.syncExistingTechnicalSpecMaterials();
          }
        }
        this.isLoadingMateriales = false;
      },
      error: () => {
        this.isLoadingMateriales = false;
      }
    });
  }

  abrirModalAgregarMaterial(solicitudItemId: number | null = null, tipo: 'TELA' | 'INSUMO' = 'INSUMO'): void {
    this.nuevoMaterial = {
      id: null,
      solicitud_item_id: solicitudItemId,
      nombre_material: tipo === 'TELA' ? 'Tela Principal' : 'Insumo',
      tipo_material: tipo,
      grupo_insumo: tipo === 'TELA' ? 'TELAS' : 'BOTONES',
      origen_asignacion: 'SIESA',
      siesa_id_item: '',
      siesa_referencia: '',
      siesa_descripcion: '',
      siesa_id_color: '',
      siesa_color: '',
      descripcion_personalizada: '',
      cantidad_requerida: 1,
      unidad_medida: tipo === 'TELA' ? 'METROS' : 'UND',
    };
    this.siesaSearchQuery = '';
    this.siesaSearchResults = [];
    this.materialModalTab = 'siesa';
    this.showMaterialModal = true;
    this.buscarInsumosSiesa();
  }

  cerrarModalMaterial(): void {
    this.showMaterialModal = false;
  }

  setMaterialModalTab(tab: 'siesa' | 'manual'): void {
    this.materialModalTab = tab;
    this.nuevoMaterial.origen_asignacion = tab === 'siesa' ? 'SIESA' : 'MANUAL';
  }

  toggleSiesaStock(): void {
    this.siesaSoloConStock = !this.siesaSoloConStock;
    this.buscarInsumosSiesa();
  }

  buscarInsumosSiesa(): void {
    this.isSearchingSiesa = true;
    this.comercialService.buscarInsumosSiesa({
      q: this.siesaSearchQuery,
      con_stock: this.siesaSoloConStock,
      bodega: 'MP001',
      grupo: this.siesaSelectedCategory !== 'TODOS' ? this.siesaSelectedCategory : undefined
    }).subscribe({
      next: (res) => {
        this.siesaSearchResults = res.data || [];
        this.isSearchingSiesa = false;
      },
      error: () => {
        this.siesaSearchResults = [];
        this.isSearchingSiesa = false;
      }
    });
  }

  seleccionarInsumoSiesa(item: any): void {
    this.nuevoMaterial.siesa_id_item = item.id_item;
    this.nuevoMaterial.siesa_referencia = item.referencia;
    this.nuevoMaterial.siesa_descripcion = item.descripcion;
    this.nuevoMaterial.siesa_id_color = item.id_color;
    this.nuevoMaterial.siesa_color = item.color;
    if (!this.nuevoMaterial.nombre_material) {
      this.nuevoMaterial.nombre_material = item.es_tela ? 'Tela Principal' : item.descripcion;
    }
    this.nuevoMaterial.tipo_material = item.es_tela ? 'TELA' : 'INSUMO';
    this.nuevoMaterial.grupo_insumo = item.grupo;
    this.nuevoMaterial.unidad_medida = item.es_tela ? 'METROS' : 'UND';
    this.nuevoMaterial.descripcion_personalizada = `${item.referencia} - ${item.descripcion} (${item.color || 'ESTÁNDAR'})`;
  }

  guardarNuevoMaterial(): void {
    if (this.materialModalTab === 'manual' && !this.nuevoMaterial.descripcion_personalizada?.trim()) {
      Swal.fire('Atención', 'Por favor ingresa la descripción o nombre del material', 'warning');
      return;
    }

    if (this.materialModalTab === 'siesa' && !this.nuevoMaterial.siesa_referencia) {
      Swal.fire('Atención', 'Por favor selecciona un material del catálogo de SIESA o cambia a modo manual', 'warning');
      return;
    }

    if (!this.nuevoMaterial.cantidad_requerida || this.nuevoMaterial.cantidad_requerida <= 0) {
      Swal.fire('Atención', 'Ingresa una cantidad requerida válida mayor a 0', 'warning');
      return;
    }

    const payload = {
      materiales: [this.nuevoMaterial],
      creado_por_rol: 'INGENIERIA'
    };

    this.comercialService.guardarMateriales(this.solicitudId, payload).subscribe({
      next: () => {
        const isEditing = !!this.nuevoMaterial.id;
        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2200,
          timerProgressBar: true
        });
        Toast.fire({
          icon: 'success',
          title: isEditing ? 'Material definido y vinculado' : 'Material agregado'
        });

        // Si se vinculó Tela Principal con SIESA, actualizar también el ítem localmente
        if (this.nuevoMaterial.tipo_material === 'TELA' && this.nuevoMaterial.siesa_referencia && this.nuevoMaterial.solicitud_item_id) {
          const itemMatch = (this.muestra?.items || []).find((i: any) => i.id === this.nuevoMaterial.solicitud_item_id);
          if (itemMatch) {
            itemMatch.ref_siesa_referencia = this.nuevoMaterial.siesa_referencia;
            itemMatch.ref_siesa_descripcion = this.nuevoMaterial.siesa_descripcion;
          }
        }

        this.cerrarModalMaterial();
        this.loadMateriales(false);
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo guardar el material', 'error');
      }
    });
  }

  despacharTodosLosMateriales(): void {
    if (!this.solicitudId) return;
    Swal.fire({
      title: '¿Despachar todos los materiales?',
      text: 'Se confirmará la entrega total (100%) de todos los insumos y telas requeridos para esta muestra.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, despachar todo',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.comercialService.despacharTodosMateriales(this.solicitudId).subscribe({
          next: () => {
            const Toast = Swal.mixin({
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 2500,
              timerProgressBar: true
            });
            Toast.fire({
              icon: 'success',
              title: 'Todos los materiales han sido despachados'
            });
            this.loadMateriales(false);
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo registrar el despacho general', 'error');
          }
        });
      }
    });
  }

  eliminarMaterial(id: number): void {
    Swal.fire({
      title: '¿Eliminar material?',
      text: 'Se removerá este requerimiento de insumo para la muestra.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        // Remover de la vista inmediatamente (optimista)
        if (this.materialesData?.materiales) {
          this.materialesData.materiales = this.materialesData.materiales.filter((m: any) => m.id !== id);
        }
        this.comercialService.eliminarMaterial(id).subscribe({
          next: () => {
            const Toast = Swal.mixin({
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 2000,
              timerProgressBar: true
            });
            Toast.fire({
              icon: 'success',
              title: 'Material eliminado'
            });
            this.loadMateriales();
          },
          error: (err) => {
            const Toast = Swal.mixin({
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 2500,
              timerProgressBar: true
            });
            Toast.fire({
              icon: 'error',
              title: err.error?.message || 'No se pudo eliminar el material'
            });
            this.loadMateriales();
          }
        });
      }
    });
  }

  // ==================== DESPACHO RÁPIDO ====================

  abrirModalDespacho(mat: any): void {
    this.despachoItem = mat;
    const saldo = Math.max(0, (mat.cantidad_requerida || 0) - (mat.cantidad_entregada || 0));
    this.despachoCantidad = saldo > 0 ? saldo : (mat.cantidad_requerida || 1);
    this.despachoEsTotal = true;
    this.despachoObservaciones = '';
    this.showDespachoModal = true;
  }

  cerrarModalDespacho(): void {
    this.showDespachoModal = false;
    this.despachoItem = null;
  }

  confirmarDespacho(): void {
    if (!this.despachoItem?.id) return;
    if (this.despachoCantidad <= 0) {
      Swal.fire('Atención', 'Ingresa una cantidad de entrega válida', 'warning');
      return;
    }

    this.isSavingDespacho = true;
    const payload = {
      cantidad_despachada: this.despachoCantidad,
      es_entrega_total: this.despachoEsTotal,
      observaciones_despacho: this.despachoObservaciones,
      modo_despacho: 'acumular'
    };

    this.comercialService.despacharMaterial(this.despachoItem.id, payload).subscribe({
      next: () => {
        this.isSavingDespacho = false;
        Swal.fire({
          icon: 'success',
          title: 'Entrega Registrada',
          text: 'Se actualizó el estado de despacho del material',
          timer: 1500,
          showConfirmButton: false
        });
        this.cerrarModalDespacho();
        this.loadMateriales();
      },
      error: (err) => {
        this.isSavingDespacho = false;
        Swal.fire('Error', err.error?.message || 'No se pudo registrar la entrega', 'error');
      }
    });
  }
}
