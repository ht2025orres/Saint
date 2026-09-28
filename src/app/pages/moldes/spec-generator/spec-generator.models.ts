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
  mold_zone_id?: number | null;
  zone_name?: string;
  zone_type?: string;
  garment_part_id?: number | null;
  _all_zone_ids?: number[];
  _all_part_ids?: number[];
  name: string;
  item_type: 'tela' | 'insumo' | 'parte';
  view: 'front' | 'back';
  position_x: number | null;
  position_y: number | null;
  width?: number | null;
  height?: number | null;
  is_mandatory: boolean;
  client_spec: string;
  technical_spec: string;
  material_exception: OpmMaterial | null;
  client_material_exception?: OpmMaterial | null;
  is_from_mold: boolean;
  is_expanded?: boolean;
  types?: any[];
  selected_type_id?: number | null;
  selected_type_name?: string;
  total_time?: number;
  icon?: string;
  exception_comment?: string | null;
}

export interface ZoneTypeOption {
  value: string;
  label: string;
  color: string;
  icon: string;
}

export const ZONE_TYPE_OPTIONS: ZoneTypeOption[] = [
  { value: 'cuello', label: 'Cuello / Solapa', color: '#3b82f6', icon: 'bi-border-outer' },
  { value: 'manga', label: 'Mangas y Puños', color: '#8b5cf6', icon: 'bi-layers' },
  { value: 'pecho', label: 'Pechera y Delantero', color: '#10b981', icon: 'bi-columns' },
  { value: 'espalda', label: 'Espalda y Almilla', color: '#ec4899', icon: 'bi-border-all' },
  { value: 'pretina', label: 'Cintura y Pretina', color: '#06b6d4', icon: 'bi-bounding-box-circles' },
  { value: 'pierna_bota', label: 'Piernas y Bota', color: '#64748b', icon: 'bi-arrows-vertical' },
  { value: 'general', label: 'Acabados y General', color: '#94a3b8', icon: 'bi-gem' },
];
