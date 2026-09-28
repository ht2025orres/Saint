import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { ComponentItem } from '../../spec-generator.component';
import { MoldService, GenericMaterial } from '../../../../../services/mold.service';

export interface SpecConsolidatedMaterial {
  name: string;
  type: 'tela' | 'insumo';
  sourceParts: string[];
  comment: string;
  siesaRef: any | null;  // OpmMaterial-like object if linked
  isExtra: boolean;       // true if manually added by user
}

@Component({
  selector: 'app-spec-tab-estructura',
  templateUrl: './spec-tab-estructura.component.html',
  styleUrls: ['./spec-tab-estructura.component.css']
})
export class SpecTabEstructuraComponent implements OnInit {
  @Input() context: 'comercial' | 'muestras' | 'molde' = 'comercial';
  @Input() generalDescription = '';
  @Input() clientGeneralDescription = '';
  @Input() itemData: any = null;
  @Input() solicitudData: any = null;
  @Input() components: ComponentItem[] = [];
  @Input() mold: any = null;

  @Output() generalDescriptionChange = new EventEmitter<string>();
  @Output() openSiesaForComponent = new EventEmitter<number>();
  @Output() openManualForComponent = new EventEmitter<number>();
  @Output() onClearMaterialException = new EventEmitter<number>();

  // ─── Consolidated Materials State ───
  materialTypeTab: 'all' | 'tela' | 'insumo' = 'all';
  materialPartFilter = '';
  extraMaterials: SpecConsolidatedMaterial[] = [];
  materialComments: Map<string, string> = new Map();
  materialSiesaRefs: Map<string, any> = new Map();

  // Add extra material picker
  showAddExtraMaterial = false;
  materialPickerSearch = '';
  manualCustomName = '';
  materialPickerTab: 'all' | 'tela' | 'insumo' = 'all';
  extraMaterialType: 'tela' | 'insumo' = 'insumo';
  masterMaterials: GenericMaterial[] = [];

  constructor(private moldService: MoldService) {}

  ngOnInit(): void {
    this.masterMaterials = this.moldService.getGenericMaterials();
  }

  // ─── Computed: Master Material Picker ───
  get filteredPickerMaterials(): GenericMaterial[] {
    let list = this.masterMaterials || [];
    if (this.materialPickerTab !== 'all') {
      list = list.filter(m => m.type === this.materialPickerTab);
    }
    if (this.materialPickerSearch.trim()) {
      const q = this.materialPickerSearch.toLowerCase().trim();
      list = list.filter(m => m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q));
    }
    return list;
  }

  // ─── Computed: Consolidated Materials ───
  get consolidatedMaterials(): SpecConsolidatedMaterial[] {
    const map = new Map<string, {
      name: string;
      type: 'tela' | 'insumo';
      sourceParts: Set<string>;
    }>();

    const addMaterialToMap = (materialName: string, partLabel: string, forceType?: 'tela' | 'insumo' | string) => {
      const rawOriginal = (materialName || '').trim();
      if (!rawOriginal) return;
      let raw = rawOriginal;
      if (rawOriginal.toLowerCase() === 'tela') raw = 'Tela Principal';
      if (rawOriginal.toLowerCase() === 'hilo') raw = 'Hilo de Confección';
      if (rawOriginal.toLowerCase() === 'botones' || rawOriginal.toLowerCase() === 'botón' || rawOriginal.toLowerCase() === 'boton') raw = 'Botones';
      if (rawOriginal.toLowerCase() === 'cremallera' || rawOriginal.toLowerCase() === 'cierre' || rawOriginal.toLowerCase() === 'zipper') raw = 'Cremallera / Cierre';
      if (rawOriginal.toLowerCase() === 'velcro' || rawOriginal.toLowerCase() === 'contacto') raw = 'Velcro / Contacto';
      if (rawOriginal.toLowerCase() === 'broches' || rawOriginal.toLowerCase() === 'broche') raw = 'Broches Metálicos';
      if (rawOriginal.toLowerCase() === 'elastico' || rawOriginal.toLowerCase() === 'elástico' || rawOriginal.toLowerCase() === 'resorte') raw = 'Elástico';
      if (rawOriginal.toLowerCase() === 'reflectivo' || rawOriginal.toLowerCase() === 'reflectiva' || rawOriginal.toLowerCase() === 'cinta reflectiva') raw = 'Cinta Reflectiva';
      if (rawOriginal.toLowerCase() === 'cordon' || rawOriginal.toLowerCase() === 'cordón') raw = 'Cordón de Ajuste';
      if (rawOriginal.toLowerCase() === 'ojaletes' || rawOriginal.toLowerCase() === 'ojalete') raw = 'Ojaletes Metálicos';
      if (rawOriginal.toLowerCase() === 'entretela' || rawOriginal.toLowerCase() === 'fusionado' || rawOriginal.toLowerCase() === 'fusionar') raw = 'Entretela Fusionable';
      if (rawOriginal.toLowerCase() === 'sesgo' || rawOriginal.toLowerCase() === 'vivo') raw = 'Sesgo / Vivo';
      if (rawOriginal.toLowerCase() === 'forro') raw = 'Tela Forro';
      if (rawOriginal.toLowerCase() === 'malla' || rawOriginal.toLowerCase() === 'mesh') raw = 'Malla Transpirable / Mesh';

      const key = raw.toLowerCase();
      const isTela = forceType ? (forceType === 'tela') : (key.includes('tela') || key.includes('forro') || key.includes('denim') || key.includes('dril') || key.includes('malla') || key.includes('mesh'));

      if (!map.has(key)) {
        map.set(key, {
          name: raw,
          type: isTela ? 'tela' : 'insumo',
          sourceParts: new Set<string>()
        });
      }
      map.get(key)!.sourceParts.add(partLabel);
    };

    // 1. Scan ONLY configured parts (parts that have a chosen variant or specification)
    const configuredParts = (this.components || []).filter(c => 
      c && c.item_type === 'parte' && (!!c.selected_type_id || !!c.selected_type_name || !!c.technical_spec)
    );

    configuredParts.forEach((part) => {
      const partName = part.name || 'Parte';
      const types = part.types || [];

      // Find the specific selected variant
      let selectedVariant: any = null;
      if (part.selected_type_id) {
        selectedVariant = types.find((t: any) => Number(t.id) === Number(part.selected_type_id));
      }
      if (!selectedVariant && part.selected_type_name) {
        selectedVariant = types.find((t: any) => t.name === part.selected_type_name);
      }

      const partLabel = selectedVariant?.name ? `${partName} (${selectedVariant.name})` : partName;

      // Base materials for every garment part
      addMaterialToMap('Tela Principal', partLabel, 'tela');
      addMaterialToMap('Hilo de Confección', partLabel, 'insumo');

      // Check explicit materials configured on variant
      if (selectedVariant) {
        let mats: any[] = [];
        if (Array.isArray(selectedVariant.materials) && selectedVariant.materials.length > 0) {
          mats = selectedVariant.materials;
        } else if (typeof selectedVariant.materials === 'string' && selectedVariant.materials.trim()) {
          try {
            const parsed = JSON.parse(selectedVariant.materials);
            if (Array.isArray(parsed)) mats = parsed;
          } catch (e) {}
        }

        mats.forEach(m => {
          if (typeof m === 'string') addMaterialToMap(m, partLabel);
          else if (m && typeof m === 'object' && m.name) addMaterialToMap(m.name, partLabel, m.type);
        });
      }

      // Intelligent detection from text (part name, variant name, technical description, operations)
      const textCorpus = [
        part.name || '',
        part.client_spec || '',
        part.technical_spec || '',
        selectedVariant?.name || '',
        selectedVariant?.description || '',
        selectedVariant?.technical_description || '',
        ...(Array.isArray(selectedVariant?.operations) ? selectedVariant.operations.map((op: any) => `${op.name || ''} ${op.description || ''}`) : [])
      ].join(' ').toLowerCase();

      if (textCorpus.includes('cremallera') || textCorpus.includes('cierre') || textCorpus.includes('zipper')) {
        addMaterialToMap('Cremallera / Cierre', partLabel, 'insumo');
      }
      if (textCorpus.includes('botón') || textCorpus.includes('boton') || textCorpus.includes('botones') || textCorpus.includes('ojal') || textCorpus.includes('pechera')) {
        addMaterialToMap('Botones', partLabel, 'insumo');
      }
      if (textCorpus.includes('velcro') || textCorpus.includes('contacto') || textCorpus.includes('mágico') || textCorpus.includes('magico')) {
        addMaterialToMap('Velcro / Contacto', partLabel, 'insumo');
      }
      if (textCorpus.includes('broche') || textCorpus.includes('broches') || textCorpus.includes('presión') || textCorpus.includes('presion')) {
        addMaterialToMap('Broches Metálicos', partLabel, 'insumo');
      }
      if (textCorpus.includes('elástico') || textCorpus.includes('elastico') || textCorpus.includes('resorte') || textCorpus.includes('encauchado') || textCorpus.includes('encauchar')) {
        addMaterialToMap('Elástico', partLabel, 'insumo');
      }
      if (textCorpus.includes('reflectivo') || textCorpus.includes('reflectiva') || textCorpus.includes('reflejante') || textCorpus.includes('alta visibilidad')) {
        addMaterialToMap('Cinta Reflectiva', partLabel, 'insumo');
      }
      if (textCorpus.includes('cordón') || textCorpus.includes('cordon') || textCorpus.includes('reata') || textCorpus.includes('jareta')) {
        addMaterialToMap('Cordón de Ajuste', partLabel, 'insumo');
      }
      if (textCorpus.includes('ojalete') || textCorpus.includes('ojaletes') || textCorpus.includes('ojalillo')) {
        addMaterialToMap('Ojaletes Metálicos', partLabel, 'insumo');
      }
      if (textCorpus.includes('entretela') || textCorpus.includes('fusionado') || textCorpus.includes('fusionar') || textCorpus.includes('cuello') || textCorpus.includes('puño') || textCorpus.includes('puños')) {
        addMaterialToMap('Entretela Fusionable', partLabel, 'tela');
      }
      if (textCorpus.includes('sesgo') || textCorpus.includes('vivo') || textCorpus.includes('ribete')) {
        addMaterialToMap('Sesgo / Vivo', partLabel, 'insumo');
      }
      if (textCorpus.includes('forro') || textCorpus.includes('fondos') || textCorpus.includes('fondo bolsillo')) {
        addMaterialToMap('Tela Forro', partLabel, 'tela');
      }
      if (textCorpus.includes('malla') || textCorpus.includes('mesh') || textCorpus.includes('transpirable')) {
        addMaterialToMap('Malla Transpirable / Mesh', partLabel, 'tela');
      }
    });

    // 2. Also include explicit material components (tela/insumo type items in component list)
    (this.components || []).filter(c => c && (c.item_type === 'tela' || c.item_type === 'insumo')).forEach(mc => {
      const key = (mc.name || '').toLowerCase().trim();
      if (!key) return;
      addMaterialToMap(mc.name, mc.zone_name || 'General', mc.item_type as 'tela' | 'insumo');
    });

    const fromParts: SpecConsolidatedMaterial[] = Array.from(map.values()).map(item => {
      const matchingComp = (this.components || []).find(c =>
        c && (c.name || '').toLowerCase().trim() === item.name.toLowerCase().trim() &&
        (c.item_type === 'tela' || c.item_type === 'insumo')
      );
      const siesaException = matchingComp ? (this.context === 'comercial' ? matchingComp.client_material_exception || matchingComp.material_exception : matchingComp.material_exception) : null;
      const compComment = matchingComp ? (this.context === 'comercial' ? matchingComp.client_spec : matchingComp.technical_spec) || matchingComp.exception_comment : '';
      return {
        name: item.name,
        type: item.type,
        sourceParts: Array.from(item.sourceParts).sort(),
        comment: compComment || this.materialComments.get(item.name.toLowerCase()) || '',
        siesaRef: siesaException || this.materialSiesaRefs.get(item.name.toLowerCase()) || null,
        isExtra: false
      };
    });

    return [...fromParts, ...this.extraMaterials];
  }

  get filteredConsolidatedMaterials(): SpecConsolidatedMaterial[] {
    let list = this.consolidatedMaterials;
    if (this.materialTypeTab !== 'all') {
      list = list.filter(m => m.type === this.materialTypeTab);
    }
    if (this.materialPartFilter) {
      const q = this.materialPartFilter.toLowerCase();
      list = list.filter(m => m.sourceParts.some(p => p.toLowerCase().includes(q)) || m.isExtra);
    }
    return list;
  }

  get uniqueSourceParts(): string[] {
    const set = new Set<string>();
    this.consolidatedMaterials.forEach(m => m.sourceParts.forEach(p => set.add(p)));
    return Array.from(set).sort();
  }

  get telasConsolidadasCount(): number {
    return this.consolidatedMaterials.filter(m => m.type === 'tela').length;
  }

  get insumosConsolidadosCount(): number {
    return this.consolidatedMaterials.filter(m => m.type === 'insumo').length;
  }

  get totalZonesCount(): number {
    const zones = this.mold?.zones || [];
    const seen = new Set<string>();
    for (const z of zones) {
      seen.add((z.zone_type || z.name || `z_${z.id}`).toLowerCase().trim());
    }
    return seen.size;
  }

  get activePartsCount(): number {
    return (this.components || []).filter(c => c && c.item_type === 'parte').length;
  }

  get configuredCount(): number {
    return (this.components || []).filter(c => c && (!!c.selected_type_id || !!c.selected_type_name || !!c.client_spec || !!c.technical_spec || !!c.material_exception)).length;
  }

  get configuredPartsCount(): number {
    return (this.components || []).filter(c => c && c.item_type === 'parte' && (!!c.selected_type_id || !!c.selected_type_name || !!c.client_spec || !!c.technical_spec || !!c.material_exception)).length;
  }

  trackByMaterialName(index: number, mat: SpecConsolidatedMaterial): string {
    return mat.name + (mat.isExtra ? '_extra' : '_part');
  }

  // ─── Methods ───

  onDescChange(val: string): void {
    this.generalDescription = val;
    this.generalDescriptionChange.emit(val);
  }

  // ─── Material Actions ───

  updateMaterialComment(mat: SpecConsolidatedMaterial, comment: string): void {
    mat.comment = comment;
    this.materialComments.set(mat.name.toLowerCase(), comment);
    const comp = (this.components || []).find(c =>
      c && (c.name || '').toLowerCase().trim() === mat.name.toLowerCase().trim() &&
      (c.item_type === 'tela' || c.item_type === 'insumo')
    );
    if (comp) {
      if (this.context === 'comercial') {
        comp.client_spec = comment;
      } else {
        comp.technical_spec = comment;
      }
      comp.exception_comment = comment;
    }
  }

  linkSiesaToMaterial(mat: SpecConsolidatedMaterial): void {
    let idx = (this.components || []).findIndex(c =>
      c && (c.name || '').toLowerCase().trim() === mat.name.toLowerCase().trim() &&
      (c.item_type === 'tela' || c.item_type === 'insumo')
    );
    if (idx === -1) {
      this.components.push({
        mold_part_id: null,
        name: mat.name.trim(),
        item_type: (mat.type === 'tela' ? 'tela' : 'insumo') as any,
        view: 'front',
        position_x: null,
        position_y: null,
        is_mandatory: false,
        client_spec: mat.comment || '',
        technical_spec: mat.comment || '',
        material_exception: null,
        client_material_exception: null,
        is_from_mold: false,
        is_expanded: false,
      });
      idx = this.components.length - 1;
    }
    this.openSiesaForComponent.emit(idx);
  }

  linkManualToMaterial(mat: SpecConsolidatedMaterial): void {
    let idx = (this.components || []).findIndex(c =>
      c && (c.name || '').toLowerCase().trim() === mat.name.toLowerCase().trim() &&
      (c.item_type === 'tela' || c.item_type === 'insumo')
    );
    if (idx === -1) {
      this.components.push({
        mold_part_id: null,
        name: mat.name.trim(),
        item_type: (mat.type === 'tela' ? 'tela' : 'insumo') as any,
        view: 'front',
        position_x: null,
        position_y: null,
        is_mandatory: false,
        client_spec: mat.comment || '',
        technical_spec: mat.comment || '',
        material_exception: null,
        client_material_exception: null,
        is_from_mold: false,
        is_expanded: false,
      });
      idx = this.components.length - 1;
    }
    this.openManualForComponent.emit(idx);
  }

  clearMaterialSiesa(mat: SpecConsolidatedMaterial): void {
    mat.siesaRef = null;
    this.materialSiesaRefs.delete(mat.name.toLowerCase());
    const idx = (this.components || []).findIndex(c =>
      c && (c.name || '').toLowerCase().trim() === mat.name.toLowerCase().trim() &&
      (c.item_type === 'tela' || c.item_type === 'insumo')
    );
    if (idx >= 0) {
      this.components[idx].material_exception = null;
      this.components[idx].client_material_exception = null;
      this.onClearMaterialException.emit(idx);
    }
  }

  // ─── Extra Materials Picker ───

  addPresetMaterial(preset: GenericMaterial): void {
    // Avoid duplicate extra material if already added
    const exists = this.extraMaterials.some(m => m.name.toLowerCase() === preset.name.toLowerCase());
    if (!exists) {
      this.extraMaterials.push({
        name: preset.name,
        type: preset.type,
        sourceParts: ['Adicional'],
        comment: '',
        siesaRef: null,
        isExtra: true
      });
    }
    this.materialPickerSearch = '';
    this.showAddExtraMaterial = false;
  }

  addCustomMaterial(): void {
    const name = (this.manualCustomName?.trim() || this.materialPickerSearch?.trim());
    if (!name) return;
    const exists = this.extraMaterials.some(m => m.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
      this.extraMaterials.push({
        name,
        type: this.extraMaterialType,
        sourceParts: ['Adicional'],
        comment: '',
        siesaRef: null,
        isExtra: true
      });
    }
    this.materialPickerSearch = '';
    this.manualCustomName = '';
    this.showAddExtraMaterial = false;
  }

  removeExtraMaterial(mat: SpecConsolidatedMaterial): void {
    const idx = this.extraMaterials.indexOf(mat);
    if (idx >= 0) this.extraMaterials.splice(idx, 1);
  }
}
