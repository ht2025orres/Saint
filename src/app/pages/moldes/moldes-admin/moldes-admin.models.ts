export interface MoldPart {
  id?: number;
  mold_zone_id?: number | null;
  zone_name?: string;
  zone_type?: string;
  name: string;
  field_name?: string;
  garment_component_id?: number;
  garment_part_id?: number;
  position_x: number | null;
  position_y: number | null;
  width?: number | null;
  height?: number | null;
  item_type: string;
  is_mandatory: boolean;
  editing?: boolean;
  view?: 'front' | 'back';
  description?: string;
  icon?: string;
  types?: any[];
}

export interface ZoneTypeOption {
  value: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  opcionalesEjemplo: string;
}

export const ZONE_TYPE_OPTIONS: ZoneTypeOption[] = [
  { 
    value: 'cuello', 
    label: 'Cuello / Solapa', 
    color: '#3b82f6', 
    icon: 'bi-border-outer', 
    description: 'Cuello camisero, sport, nerú, solapas y tirillas',
    opcionalesEjemplo: 'Opcionales: Contrastes de color, tirillas'
  },
  { 
    value: 'manga', 
    label: 'Mangas y Puños', 
    color: '#8b5cf6', 
    icon: 'bi-layers', 
    description: 'Mangas cortas, largas, puños, guardapolvos y sangrías',
    opcionalesEjemplo: 'Opcionales: Cintas reflectivas en brazo, contrastes'
  },
  { 
    value: 'pecho', 
    label: 'Pechera y Delantero', 
    color: '#10b981', 
    icon: 'bi-columns', 
    description: 'Cartera delantera, botones, broches y cierres',
    opcionalesEjemplo: 'Opcionales: Bolsillos de parche, tapa, reflectivos en torso'
  },
  { 
    value: 'espalda', 
    label: 'Espalda y Almilla', 
    color: '#ec4899', 
    icon: 'bi-border-all', 
    description: 'Almilla, canesú, tablones y espaldas lisas',
    opcionalesEjemplo: 'Opcionales: Cintas reflectivas, fuelles de ventilación'
  },
  { 
    value: 'pretina', 
    label: 'Cintura y Pretina', 
    color: '#06b6d4', 
    icon: 'bi-bounding-box-circles', 
    description: 'Pretinas anatómicas, elásticos, pasadores y cordones',
    opcionalesEjemplo: 'Opcionales: Pasadores dobles, bolsillos secretos'
  },
  { 
    value: 'pierna_bota', 
    label: 'Piernas y Bota', 
    color: '#64748b', 
    icon: 'bi-arrows-vertical', 
    description: 'Tiros delanteros, traseros, botas y dobladillos',
    opcionalesEjemplo: 'Opcionales: Bolsillos tipo cargo, cremalleras en bota'
  },
  { 
    value: 'general', 
    label: 'Acabados y General', 
    color: '#94a3b8', 
    icon: 'bi-gem', 
    description: 'Bordados, marquillas, costuras de refuerzo, braguetas y acabados transversales',
    opcionalesEjemplo: 'Opcionales: Bragueta figurada, costuras de 2 agujas, etiquetas'
  },
];
