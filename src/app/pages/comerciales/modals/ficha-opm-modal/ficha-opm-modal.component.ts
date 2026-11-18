import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { MoldService } from '../../../../services/mold.service';

@Component({
  selector: 'app-ficha-opm-modal',
  templateUrl: './ficha-opm-modal.component.html',
  styleUrls: ['./ficha-opm-modal.component.css']
})
export class FichaOpmModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() item: any = null;
  @Input() trackingMateriales: any[] = [];
  @Input() observaciones = '';

  @Output() onClose = new EventEmitter<void>();

  opmActiveView: 'front' | 'back' = 'front';
  selectedZone: any = null;
  expandedSidebarZoneKey: string | null = null;
  activeItem: any = null;

  get trackingMetricas(): any {
    const mats = this.trackingMateriales || [];
    const total = mats.length;
    const entregados = mats.filter((m: any) => m.estado_entrega === 'ENTREGADO').length;
    const parciales = mats.filter((m: any) => m.estado_entrega === 'PARCIAL').length;
    const pendientes = mats.filter((m: any) => m.estado_entrega === 'PENDIENTE' || !m.estado_entrega).length;
    const pct = total > 0 ? Math.round((entregados / total) * 100) : 0;
    const semaforo = pct === 100 && total > 0 ? 'COMPLETO' : (entregados > 0 || parciales > 0 ? 'PARCIAL' : 'PENDIENTE');

    return {
      total,
      entregados,
      parciales,
      pendientes,
      porcentaje_entrega: pct,
      semaforo
    };
  }

  get conteoCostosValidados(): number {
    return (this.trackingMateriales || []).filter(m => m.estado_costo === 'VIGENTE' || (m.costo_vigente_final && m.costo_vigente_final > 0)).length;
  }

  get conteoCostosPendientes(): number {
    return (this.trackingMateriales || []).filter(m => this.esInsumoPendiente(m)).length;
  }

  esInsumoPendiente(m: any): boolean {
    if (!m) return true;
    const costo = Number(m.costo_vigente_final || m.costo_vigente_logistica || m.ultimo_costo_siesa || 0);
    if (costo <= 0) return true;
    if (m.costo_vigente_logistica !== null && Number(m.costo_vigente_logistica) > 0) return false;
    if (m.estado_costo === 'VIGENTE' || m.estado_costo === 'ALERTA') return false;
    return m.estado_costo === 'DESACTUALIZADO' || m.estado_costo === 'SIN_MOVIMIENTO';
  }

  private readonly ZONE_METADATA: Record<string, { label: string; icon: string; bgClass: string; color: string }> = {
    'cuello': { label: 'Cuello / Solapa', icon: 'bi-border-outer', bgClass: 'bg-blue-500', color: '#3b82f6' },
    'manga': { label: 'Mangas y Puños', icon: 'bi-layers-fill', bgClass: 'bg-indigo-500', color: '#6366f1' },
    'pecho': { label: 'Pechera y Delantero', icon: 'bi-columns', bgClass: 'bg-emerald-500', color: '#10b981' },
    'espalda': { label: 'Espalda y Almilla', icon: 'bi-border-all', bgClass: 'bg-pink-500', color: '#ec4899' },
    'pretina': { label: 'Cintura y Pretina', icon: 'bi-bounding-box-circles', bgClass: 'bg-cyan-500', color: '#06b6d4' },
    'pierna_bota': { label: 'Piernas y Bota', icon: 'bi-arrows-vertical', bgClass: 'bg-slate-500', color: '#64748b' },
    'general': { label: 'General / Acabados', icon: 'bi-gem', bgClass: 'bg-amber-500', color: '#f59e0b' }
  };

  private readonly FRONT_ZONE_TYPES = new Set(['cuello', 'pecho', 'manga', 'pretina', 'pierna_bota', 'general']);
  private readonly BACK_ZONE_TYPES = new Set(['espalda']);

  constructor(private moldService: MoldService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item'] || changes['visible']) {
      if (this.visible && this.item) {
        this.initItemData(this.item);
      } else if (!this.visible) {
        this.selectedZone = null;
        this.expandedSidebarZoneKey = null;
      }
    }
  }

  private initItemData(item: any): void {
    this.activeItem = { ...item };
    this.opmActiveView = 'front';
    this.selectedZone = null;
    this.expandedSidebarZoneKey = null;

    const initialMoldParts = item.mold?.parts || [];
    const initialRawParts = item.technical_spec?.parts || item.draftComponents || [];
    const initialEnriched = this.enrichAndConsolidateComponents(initialRawParts, initialMoldParts);

    if (!this.activeItem.technical_spec) this.activeItem.technical_spec = {};
    this.activeItem.technical_spec.parts = initialEnriched;

    const moldId = item.mold?.id || item.mold_id || item.moldId;
    const specId = item.technical_spec_id || item.technicalSpecId || item.technical_spec?.id;

    if (moldId) {
      this.moldService.getMold(moldId).subscribe({
        next: (res: any) => {
          const fullMold = res.data || res;
          if (fullMold && this.activeItem) {
            this.activeItem.mold = {
              ...this.activeItem.mold,
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
    const moldParts = this.activeItem?.mold?.parts || [];

    if (specId) {
      this.moldService.getTechnicalSpec(specId).subscribe({
        next: (specRes: any) => {
          const spec = specRes?.data || specRes;
          if (spec && this.activeItem) {
            this.activeItem.technical_spec = spec;
            const rawParts = (spec.parts && spec.parts.length > 0)
              ? spec.parts
              : (this.activeItem.draftComponents || []);
            const enriched = this.enrichAndConsolidateComponents(rawParts, moldParts);
            this.activeItem.technical_spec.parts = enriched;
          }
        },
        error: () => {
          if (this.activeItem) {
            const rawParts = this.activeItem.technical_spec?.parts || this.activeItem.draftComponents || [];
            const enriched = this.enrichAndConsolidateComponents(rawParts, moldParts);
            if (!this.activeItem.technical_spec) this.activeItem.technical_spec = {};
            this.activeItem.technical_spec.parts = enriched;
          }
        }
      });
    } else {
      if (this.activeItem) {
        const rawParts = this.activeItem.technical_spec?.parts || this.activeItem.draftComponents || [];
        const enriched = this.enrichAndConsolidateComponents(rawParts, moldParts);
        if (!this.activeItem.technical_spec) this.activeItem.technical_spec = {};
        this.activeItem.technical_spec.parts = enriched;
      }
    }
  }

  getCanonicalOptionalParts(): any[] {
    return [
      {
        id: 9100,
        code: 'BRG_FIG',
        name: 'Bragueta y Figurado',
        icon: 'bi-layout-sidebar',
        description: 'Bragueta delantera con aletilla, aletillón, cremallera o botones.',
        types: [
          { id: 9101, name: 'Bragueta con Cremallera y Aletilla Sencilla', technical_description: 'Bragueta con cremallera de nylon / metálica y aletilla reforzada', total_time: 1.85, is_default: true },
          { id: 9102, name: 'Bragueta con Botones y Aletillón Completo', technical_description: 'Bragueta tradicional con botones ocultos y aletillón protector', total_time: 2.20 }
        ]
      },
      {
        id: 9200,
        code: 'PAS_FIG',
        name: 'Pasadores de Pretina',
        icon: 'bi-grip-vertical',
        description: 'Juego de pasadores perimetrales para correa de soporte.',
        types: [
          { id: 9201, name: 'Juego de 5 Pasadores Estándar (1 cm)', technical_description: 'Cinco pasadores dobles con atraque reforzado', total_time: 0.95, is_default: true },
          { id: 9202, name: 'Juego de 7 Pasadores Anchos Tácticos (2 cm)', technical_description: 'Siete pasadores anchos para reata táctica o industrial', total_time: 1.40 }
        ]
      },
      {
        id: 9300,
        code: 'REL_FIG',
        name: 'Bolsillo Relojero / Monedero',
        icon: 'bi-cash-coin',
        description: 'Bolsillo monedero delantero insertado en boca de bolsillo.',
        types: [
          { id: 9301, name: 'Bolsillo Monedero Clásico Claveteado', technical_description: 'Bolsillo relojero oculto en boca derecha con remaches', total_time: 0.75, is_default: true }
        ]
      },
      {
        id: 9400,
        code: 'GAR_FIG',
        name: 'Garra Trasera / Marquilla Cuero',
        icon: 'bi-tag-fill',
        description: 'Marquilla o parche de identificación en cintura trasera.',
        types: [
          { id: 9401, name: 'Garra Sintética Cosida Perimetral', technical_description: 'Parche sintético o cuero con pespunte perimetral', total_time: 0.60, is_default: true }
        ]
      }
    ];
  }

  enrichAndConsolidateComponents(sourceParts: any[], moldParts: any[] = []): any[] {
    const canonicalOptionals = this.getCanonicalOptionalParts();
    const moldZones = this.activeItem?.mold?.zones || [];

    const enrichedList: any[] = sourceParts.map((raw: any): any => {
      const rawName = (raw.name || raw.garment_part?.name || '').toLowerCase().trim();
      const rawZoneType = (raw.zone_type || raw.garment_part?.zone_type || '').toLowerCase().trim();
      let matchedZone = moldZones.find((z: any) => Number(z.id) === Number(raw.mold_zone_id));

      if (!matchedZone && rawZoneType) {
        matchedZone = moldZones.find((z: any) => (z.zone_type || '').toLowerCase().trim() === rawZoneType);
      }
      if (!matchedZone && rawName) {
        matchedZone = moldZones.find((z: any) => (z.name || '').toLowerCase().trim() === rawName);
      }

      const inferredZone = matchedZone ? (matchedZone.zone_type || matchedZone.name) : (rawZoneType || this.inferZoneFromPartName(rawName));
      const canonicalOpt = canonicalOptionals.find(c => c.name.toLowerCase() === rawName || rawName.includes(c.code.toLowerCase()));

      let types = raw.types || raw.garment_part?.types || [];
      if ((!types || types.length === 0) && canonicalOpt) {
        types = canonicalOpt.types;
      }

      return {
        ...raw,
        name: raw.name || raw.garment_part?.name || canonicalOpt?.name || 'Componente',
        zone_type: inferredZone,
        zone_name: matchedZone?.name || raw.zone_name || this.getZoneLabel(inferredZone),
        types: types,
        is_mandatory: raw.is_mandatory !== undefined ? raw.is_mandatory : (raw.garment_part?.is_mandatory ?? true)
      };
    });

    const consolidatedMap = new Map<string, any>();
    enrichedList.forEach(part => {
      const key = `${part.name}`.toLowerCase().trim();
      if (!consolidatedMap.has(key)) {
        consolidatedMap.set(key, { ...part });
      } else {
        const existing = consolidatedMap.get(key);
        consolidatedMap.set(key, {
          ...existing,
          ...part,
          _all_zone_ids: Array.from(new Set([...(existing._all_zone_ids || [existing.mold_zone_id]), part.mold_zone_id].filter(Boolean)))
        });
      }
    });

    return Array.from(consolidatedMap.values());
  }

  close(): void {
    this.selectedZone = null;
    this.expandedSidebarZoneKey = null;
    this.onClose.emit();
  }

  toggleOpmView(view?: 'front' | 'back'): void {
    if (view) {
      this.opmActiveView = view;
    } else {
      this.opmActiveView = this.opmActiveView === 'front' ? 'back' : 'front';
    }
    this.selectedZone = null;
  }

  get hasOpmBackView(): boolean {
    const mold = this.activeItem?.mold;
    if (!mold) return false;
    return !!mold.back_image_signed_url ||
           !!mold.back_image_url ||
           !!this.getFallbackBackImage(mold) ||
           (mold.zones || []).some((z: any) => (z.view || '').toLowerCase() === 'back');
  }

  getFallbackFrontImage(mold?: any): string | null {
    if (!mold) return null;
    const name = (mold.name || '').toLowerCase();
    if (name.includes('camisa')) return 'assets/garments/camisa_front.png';
    if (name.includes('chaqueta')) return 'assets/garments/chaqueta_front.png';
    if (name.includes('pantalon') || name.includes('pantalón')) return 'assets/garments/pantalon_front.png';
    if (name.includes('overol')) return 'assets/garments/overol_front.png';
    if (name.includes('polo')) return 'assets/garments/polo_front.png';
    if (name.includes('buzo')) return 'assets/garments/buzo_front.png';
    if (name.includes('camiseta')) return 'assets/garments/camiseta_front.png';
    if (name.includes('chaleco')) return 'assets/garments/chaleco_front.png';
    if (name.includes('delantal')) return 'assets/garments/delantal_front.png';
    if (name.includes('gorra')) return 'assets/garments/gorra_front.png';
    return null;
  }

  getFallbackBackImage(mold?: any): string | null {
    if (!mold) return null;
    const name = (mold.name || '').toLowerCase();
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

  getActiveOpmImage(): string {
    const mold = this.activeItem?.mold;
    if (!mold) return '';
    if (this.opmActiveView === 'back') {
      return mold.back_image_signed_url ||
             mold.back_image_url ||
             this.getFallbackBackImage(mold) ||
             mold.image_signed_url ||
             mold.image_url ||
             '';
    }
    return mold.image_signed_url ||
           mold.image_url ||
           this.getFallbackFrontImage(mold) ||
           '';
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
    return this.ZONE_METADATA[key]?.color || '#64748b';
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

  private isZoneTypeForView(zoneType: string, view: string): boolean {
    if (view === 'back') {
      return this.BACK_ZONE_TYPES.has(zoneType) ||
             ['manga', 'pretina', 'pierna_bota', 'general'].includes(zoneType);
    }
    return this.FRONT_ZONE_TYPES.has(zoneType);
  }

  getActiveZones(): any[] {
    if (!this.activeItem?.mold) return [];
    const zones = this.activeItem.mold.zones || [];
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
    const allParts = this.getAllItemParts(this.activeItem);
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
    const allParts = this.getAllItemParts(this.activeItem);
    const currentView = this.opmActiveView;
    const allMoldZones = this.activeItem?.mold?.zones || [];
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
    const list = allPartsList || this.getAllItemParts(this.activeItem);
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
      try { pts = JSON.parse(pts); } catch (e) { pts = []; }
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
    if (!this.activeItem) return [];
    const allParts = this.getAllItemParts(this.activeItem);
    const moldZones = this.activeItem?.mold?.zones || [];
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
          material: p.material_exception || p.client_material_exception || null,
          icon: this.getOptionalIcon(p.name || ''),
          zoneName: zoneLabel
        };
      });
  }

  getConsolidatedMaterials(): any[] {
    if (!this.activeItem) return [];
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
      map.get(key)!.sourceParts.add(partLabel);
      if (siesaRef && !map.get(key)!.siesaRef) map.get(key)!.siesaRef = siesaRef;
      if (siesaDesc && !map.get(key)!.siesaDesc) map.get(key)!.siesaDesc = siesaDesc;
      if (color && !map.get(key)!.color) map.get(key)!.color = color;
      if (comment && !map.get(key)!.comment) map.get(key)!.comment = comment;
    };

    const allParts = this.getAllItemParts(this.activeItem);

    allParts.forEach((part) => {
      const partName = part.name || 'Parte';
      const variantName = this.extractVariantName(part);
      const partLabel = `${partName} (${variantName})`;
      const matExc = part.material_exception || part.client_material_exception;
      const comment = part.exception_comment || part.client_spec || '';

      addMat('Tela Principal', partLabel, 'tela', this.activeItem.ref_siesa_referencia, this.activeItem.ref_siesa_descripcion, undefined, undefined);
      addMat('Hilo de Confección', partLabel, 'insumo');

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
    if (n.includes('cuello') || n.includes('solapa') || n.includes('pie de cuello')) return 'cuello';
    if (n.includes('manga') || n.includes('puño') || n.includes('sisa')) return 'manga';
    if (n.includes('pecho') || n.includes('delantero') || n.includes('bolsillo') || n.includes('cartera') || n.includes('pechera')) return 'pecho';
    if (n.includes('espalda') || n.includes('almilla') || n.includes('canesu') || n.includes('canesú')) return 'espalda';
    if (n.includes('pretina') || n.includes('cintura') || n.includes('pasador')) return 'pretina';
    if (n.includes('pierna') || n.includes('bota') || n.includes('tiro') || n.includes('rodilla')) return 'pierna_bota';
    return 'general';
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
      if (!!p.technical_spec || !!p.inventory_reference || !!p.inventory_description) {
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

  getOpmBadgeInfo(item: any): { label: string; bgClass: string; icon: string } {
    const state = this.getOpmState(item);
    if (state === 'COMPLETO') {
      return {
        label: 'Especificación Completa',
        bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: 'bi-check-circle-fill'
      };
    } else if (state === 'EN_PROCESO') {
      return {
        label: 'Especificación en Proceso',
        bgClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        icon: 'bi-gear-fill'
      };
    }
    return {
      label: 'Borrador Comercial',
      bgClass: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: 'bi-clock-history'
    };
  }
}

