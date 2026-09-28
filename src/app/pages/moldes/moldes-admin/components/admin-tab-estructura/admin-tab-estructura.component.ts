import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { MoldService, GenericMaterial } from '../../../../../services/mold.service';

export interface MaterialPartGroup {
  partName: string;
  variants: string[];
  variantsCount: number;
}

export interface ConsolidatedMaterialItem {
  name: string;
  type: 'tela' | 'insumo';
  parts: MaterialPartGroup[];
  partsCount: number;
  variantsCount: number;
  sourceParts: string[];
}

@Component({
  selector: 'app-admin-tab-estructura',
  templateUrl: './admin-tab-estructura.component.html',
  styleUrls: ['./admin-tab-estructura.component.css']
})
export class AdminTabEstructuraComponent implements OnInit {
  @Input() moldName = '';
  @Input() moldDescription = '';
  @Input() mold_category_id: number | null = null;
  @Input() moldCategories: any[] = [];
  @Input() isReadOnly = false;
  @Input() structuralParts: any[] = [];
  @Input() allMoldParts: any[] = [];

  @Output() moldNameChange = new EventEmitter<string>();
  @Output() moldDescriptionChange = new EventEmitter<string>();
  @Output() moldCategoryIdChange = new EventEmitter<number | null>();

  showMaterialsManager = false;
  materialTypeTab: 'all' | 'tela' | 'insumo' = 'all';
  materialPartFilter: string = '';  // '' = todas, o nombre de la parte para filtrar
  genericMaterialPresets: GenericMaterial[] = [];

  constructor(private moldService: MoldService) {}

  ngOnInit(): void {
    this.refreshMasterMaterials();
  }

  refreshMasterMaterials(): void {
    this.genericMaterialPresets = this.moldService.getGenericMaterials();
  }

  onMasterCatalogUpdated(updatedList: GenericMaterial[]): void {
    this.genericMaterialPresets = updatedList;
  }

  get consolidatedMaterials(): ConsolidatedMaterialItem[] {
    const map = new Map<string, { 
      name: string; 
      type: 'tela' | 'insumo'; 
      partsMap: Map<string, Set<string>> 
    }>();

    // Recorrer partes del molde y sus variantes activas
    const partsToScan = (this.allMoldParts && this.allMoldParts.length > 0) ? this.allMoldParts : this.structuralParts;

    partsToScan.forEach((part: any) => {
      if (part.item_type === 'tela' || part.item_type === 'insumo') return;

      const partName = part.name || 'Parte sin nombre';
      const types = part.types || part.garmentPart?.types || part.garment_part?.types || [];

      types.forEach((t: any) => {
        if (t.is_active !== false && t.is_disabled !== true) {
          const variantName = t.name || 'Variante Estándar';
          let mats: string[] = [];
          if (Array.isArray(t.materials) && t.materials.length > 0) {
            mats = t.materials;
          } else if (typeof t.materials === 'string' && t.materials.trim()) {
            try {
              const parsed = JSON.parse(t.materials);
              if (Array.isArray(parsed) && parsed.length > 0) mats = parsed;
            } catch (e) {}
          }
          if (mats.length === 0) {
            mats = ['Tela Principal', 'Hilo de Confección'];
          }

          mats.forEach(m => {
            const rawOriginal = (m || '').trim();
            if (!rawOriginal) return;
            let raw = rawOriginal;
            if (rawOriginal.toLowerCase() === 'tela') raw = 'Tela Principal';
            if (rawOriginal.toLowerCase() === 'hilo') raw = 'Hilo de Confección';
            const key = raw.toLowerCase();
            const isTela = key.includes('tela') || key.includes('forro') || key.includes('denim') || key.includes('dril') || key.includes('malla') || key.includes('mesh');

            if (!map.has(key)) {
              map.set(key, {
                name: raw,
                type: isTela ? 'tela' : 'insumo',
                partsMap: new Map<string, Set<string>>()
              });
            }
            const item = map.get(key)!;
            if (!item.partsMap.has(partName)) {
              item.partsMap.set(partName, new Set<string>());
            }
            item.partsMap.get(partName)!.add(variantName);
          });
        }
      });
    });

    return Array.from(map.values()).map(item => {
      const parts: MaterialPartGroup[] = Array.from(item.partsMap.entries()).map(([partName, variantsSet]) => ({
        partName,
        variants: Array.from(variantsSet),
        variantsCount: variantsSet.size
      }));
      const variantsCount = parts.reduce((sum, p) => sum + p.variantsCount, 0);
      const sourceParts = parts.map(p => p.partName);

      return {
        name: item.name,
        type: item.type,
        parts,
        partsCount: parts.length,
        variantsCount,
        sourceParts
      };
    });
  }

  /** Lista filtrada según materialPartFilter y materialTypeTab */
  get filteredConsolidatedMaterials(): ConsolidatedMaterialItem[] {
    let list = this.consolidatedMaterials;
    // Filtro por tipo
    if (this.materialTypeTab !== 'all') {
      list = list.filter(m => m.type === this.materialTypeTab);
    }
    // Filtro por parte origen
    if (this.materialPartFilter) {
      const q = this.materialPartFilter.toLowerCase();
      list = list.filter(m => m.parts.some(p => p.partName.toLowerCase().includes(q)));
    }
    return list;
  }

  /** Partes únicas para los chips del filtro */
  get uniqueSourceParts(): string[] {
    const set = new Set<string>();
    this.consolidatedMaterials.forEach(m => m.parts.forEach(p => set.add(p.partName)));
    return Array.from(set).sort();
  }

  get telasConsolidadasCount(): number {
    return this.consolidatedMaterials.filter(m => m.type === 'tela').length;
  }

  get insumosConsolidadosCount(): number {
    return this.consolidatedMaterials.filter(m => m.type === 'insumo').length;
  }

  get telasCount(): number {
    return this.genericMaterialPresets.filter(m => m.type === 'tela').length;
  }

  get insumosCount(): number {
    return this.genericMaterialPresets.filter(m => m.type === 'insumo').length;
  }
}
