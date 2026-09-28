export interface IconOption {
  name: string;
  label: string;
  category: string;
}

export interface SharedOperation {
  operation_name: string;
  machine_name: string;
  execution_time: number;
  category?: string;
}

export interface AnatomicalRegion {
  id: string;
  value: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  nature?: 'structural' | 'overlay';
}

export interface GarmentPartType {
  id?: number;
  name: string;
  description?: string;
  technical_description?: string;
  total_time?: number;
  is_default?: boolean;
  is_active?: boolean;
  disabled_reason?: string;
  operations?: any[];
  _isExpanded?: boolean;
}

export interface GarmentPart {
  id?: number;
  name: string;
  code?: string;
  description?: string;
  icon?: string;
  zone?: string;
  is_active?: boolean;
  types?: GarmentPartType[];
}

export const DEFAULT_REGIONS: AnatomicalRegion[] = [
  { id: 'cuello', value: 'cuello', label: 'Cuello / Solapa', color: '#3b82f6', icon: 'bi-border-outer', description: 'Cuellos camiseros, sport, nerú, solapas, tirillas y contrastes' },
  { id: 'manga', value: 'manga', label: 'Mangas y Puños', color: '#8b5cf6', icon: 'bi-layers', description: 'Mangas cortas/largas, puños, guardapolvos, sangrías y reflectivos de brazo' },
  { id: 'pecho', value: 'pecho', label: 'Pechera y Delantero', color: '#10b981', icon: 'bi-columns', description: 'Carteras delanteras, botones, bolsillos de pecho y reflectivos frontales' },
  { id: 'espalda', value: 'espalda', label: 'Espalda y Almilla', color: '#ec4899', icon: 'bi-border-all', description: 'Almillas, canesús, tablones, fuelles de espalda y reflectivos traseros' },
  { id: 'pretina', value: 'pretina', label: 'Cintura y Pretina', color: '#06b6d4', icon: 'bi-bounding-box-circles', description: 'Pretinas rectas, anatómicas, con lengüeta, resortadas y pasadores' },
  { id: 'pierna_bota', value: 'pierna_bota', label: 'Piernas y Bota', color: '#64748b', icon: 'bi-arrows-vertical', description: 'Tiro, entrepierna, costados, dobladillos, bolsillos delanteros, posteriores y cargo' },
  { id: 'general', value: 'general', label: 'Acabados y General', color: '#94a3b8', icon: 'bi-gem', description: 'Logos, bordados, marquillas, braguetas, figurados y confección general de la prenda' },
];

export const DEFAULT_CATEGORIES: string[] = [
  'Ensamble',
  'Cuello',
  'Reflectivos',
  'Bolsillos',
  'Mangas',
  'Bota',
  'Terminación',
  'Ojal/Botón',
  'Preparación',
  'Pecho',
  'Personalización'
];

export const DEFAULT_ICON_CATEGORIES: string[] = [
  'Todos',
  'Estructura & Zonas',
  'Apliques & Adornos',
  'Cierres & Ajustes',
  'Confección & SAM',
  'Seguridad & Protección'
];

export const DEFAULT_ICONS: IconOption[] = [
  // ─── Estructura & Zonas ───
  { name: 'bi-puzzle', label: 'Pieza / Ensamble', category: 'Estructura & Zonas' },
  { name: 'bi-box-seam', label: 'Bolsillo / Caja', category: 'Estructura & Zonas' },
  { name: 'bi-border-outer', label: 'Cuello / Solapa', category: 'Estructura & Zonas' },
  { name: 'bi-layers', label: 'Manga / Capas', category: 'Estructura & Zonas' },
  { name: 'bi-columns', label: 'Pechera / Delantero', category: 'Estructura & Zonas' },
  { name: 'bi-border-all', label: 'Espalda / Canesú', category: 'Estructura & Zonas' },
  { name: 'bi-bounding-box-circles', label: 'Pretina / Cintura', category: 'Estructura & Zonas' },
  { name: 'bi-arrows-vertical', label: 'Pierna / Bota', category: 'Estructura & Zonas' },
  { name: 'bi-layout-sidebar', label: 'Bragueta / Costado', category: 'Estructura & Zonas' },
  { name: 'bi-circle-square', label: 'Puño / Botón', category: 'Estructura & Zonas' },
  { name: 'bi-wallet', label: 'Bolsillo Diagonal / Cartera', category: 'Estructura & Zonas' },
  { name: 'bi-bag', label: 'Bolsillo Cargo / Fuelle', category: 'Estructura & Zonas' },
  { name: 'bi-card-heading', label: 'Tapa de Bolsillo', category: 'Estructura & Zonas' },
  { name: 'bi-grid-3x3', label: 'Almilla / Doble Tela', category: 'Estructura & Zonas' },
  { name: 'bi-distribute-vertical', label: 'Tiro / Entrepierna', category: 'Estructura & Zonas' },

  // ─── Apliques & Adornos ───
  { name: 'bi-gem', label: 'Bordado / Joya', category: 'Apliques & Adornos' },
  { name: 'bi-stars', label: 'Aplique Especial', category: 'Apliques & Adornos' },
  { name: 'bi-patch-check', label: 'Parche / Emblema', category: 'Apliques & Adornos' },
  { name: 'bi-sun', label: 'Reflectivo Alta Visibilidad', category: 'Apliques & Adornos' },
  { name: 'bi-brightness-high', label: 'Cinta Reflectiva 5cm', category: 'Apliques & Adornos' },
  { name: 'bi-award', label: 'Escudo / Insignia', category: 'Apliques & Adornos' },
  { name: 'bi-bookmark-star', label: 'Marquilla de Marca', category: 'Apliques & Adornos' },
  { name: 'bi-badge-ad', label: 'Logo Corporativo', category: 'Apliques & Adornos' },
  { name: 'bi-palette', label: 'Vivo de Contraste', category: 'Apliques & Adornos' },
  { name: 'bi-brush', label: 'Estampado Textil', category: 'Apliques & Adornos' },
  { name: 'bi-droplet', label: 'Termofijado / Tinta', category: 'Apliques & Adornos' },
  { name: 'bi-feather', label: 'Detalle Liviano', category: 'Apliques & Adornos' },
  { name: 'bi-flag', label: 'Bandera / Cinta País', category: 'Apliques & Adornos' },

  // ─── Cierres & Ajustes ───
  { name: 'bi-tag', label: 'Marquilla / Etiqueta Talla', category: 'Cierres & Ajustes' },
  { name: 'bi-tags', label: 'Etiqueta de Lavado / Composición', category: 'Cierres & Ajustes' },
  { name: 'bi-dash-circle', label: 'Ojal / Botonera', category: 'Cierres & Ajustes' },
  { name: 'bi-slash-circle', label: 'Cremallera / Cierre', category: 'Cierres & Ajustes' },
  { name: 'bi-link-45deg', label: 'Gancho / Presilla', category: 'Cierres & Ajustes' },
  { name: 'bi-pin', label: 'Pasador / Trabilla', category: 'Cierres & Ajustes' },
  { name: 'bi-paperclip', label: 'Broche / Clip', category: 'Cierres & Ajustes' },
  { name: 'bi-sliders', label: 'Elástico de Ajuste', category: 'Cierres & Ajustes' },
  { name: 'bi-toggle-on', label: 'Botón a Presión / Broche', category: 'Cierres & Ajustes' },
  { name: 'bi-grip-vertical', label: 'Velcro / Cinta Contacto', category: 'Cierres & Ajustes' },

  // ─── Confección & SAM ───
  { name: 'bi-scissors', label: 'Tijera / Corte', category: 'Confección & SAM' },
  { name: 'bi-stopwatch', label: 'Tiempo SAM / Cronómetro', category: 'Confección & SAM' },
  { name: 'bi-gear', label: 'Máquina Plana / Confección', category: 'Confección & SAM' },
  { name: 'bi-gear-wide-connected', label: 'Fileteadora / Cerradora', category: 'Confección & SAM' },
  { name: 'bi-tools', label: 'Ajuste Mecánico', category: 'Confección & SAM' },
  { name: 'bi-rulers', label: 'Patronaje / Escala', category: 'Confección & SAM' },
  { name: 'bi-speedometer2', label: 'Velocidad de Costura', category: 'Confección & SAM' },
  { name: 'bi-check-all', label: 'Control de Calidad', category: 'Confección & SAM' },

  // ─── Seguridad & Protección ───
  { name: 'bi-shield-check', label: 'Protección Normada', category: 'Seguridad & Protección' },
  { name: 'bi-shield-shaded', label: 'Refuerzo Rodilla / Codo', category: 'Seguridad & Protección' },
  { name: 'bi-exclamation-triangle', label: 'Advertencia / Seguridad', category: 'Seguridad & Protección' },
  { name: 'bi-fire', label: 'Ignífugo / Antillama', category: 'Seguridad & Protección' },
  { name: 'bi-shield-lock', label: 'Protección Térmica / Frío', category: 'Seguridad & Protección' },
  { name: 'bi-eye', label: 'Visibilidad 360 Grados', category: 'Seguridad & Protección' },
  { name: 'bi-umbrella', label: 'Impermeable / Antifluido', category: 'Seguridad & Protección' },
  { name: 'bi-wind', label: 'Rompevientos / Vendaval', category: 'Seguridad & Protección' },
];

export const DEFAULT_SHARED_OPERATIONS: SharedOperation[] = [
  { operation_name: 'Pespuntar cuello camisero a 1/16"', machine_name: 'Plana 1 Aguja', execution_time: 0.45, category: 'Cuello' },
  { operation_name: 'Pegar cuello a escote', machine_name: 'Plana 1 Aguja', execution_time: 0.60, category: 'Cuello' },
  { operation_name: 'Asentar cuello camisero', machine_name: 'Plana 1 Aguja', execution_time: 0.50, category: 'Cuello' },
  { operation_name: 'Fusionar entretela de cuello', machine_name: 'Fusionadora Continua', execution_time: 0.30, category: 'Preparación' },
  { operation_name: 'Preparar bolsillo de parche con dobladillo', machine_name: 'Plana 1 Aguja', execution_time: 0.55, category: 'Bolsillos' },
  { operation_name: 'Pegar bolsillo de parche a delantero', machine_name: 'Plana 1 Aguja', execution_time: 0.85, category: 'Bolsillos' },
  { operation_name: 'Pegar cinta reflectiva 5cm 3M', machine_name: 'Plana 2 Agujas', execution_time: 0.90, category: 'Reflectivos' },
  { operation_name: 'Pespuntar tapa de bolsillo con velcro', machine_name: 'Plana 1 Aguja', execution_time: 0.65, category: 'Bolsillos' },
  { operation_name: 'Cerrar costados de camisa/pantalón', machine_name: 'Cerradora de Codo', execution_time: 1.10, category: 'Ensamble' },
  { operation_name: 'Filetear tiro y entrepierna con puntada de seguridad', machine_name: 'Fileteadora 5 Hilos', execution_time: 1.25, category: 'Ensamble' },
  { operation_name: 'Pegar pretina recta con elástico interno', machine_name: 'Pretinadora 4 Agujas', execution_time: 1.40, category: 'Bota' },
  { operation_name: 'Hacer dobladillo de bota 2.5cm', machine_name: 'Dobladilladora / Plana', execution_time: 0.70, category: 'Bota' },
  { operation_name: 'Abrir y presillar ojal de botón', machine_name: 'Ojaladora Automática', execution_time: 0.35, category: 'Ojal/Botón' },
  { operation_name: 'Pegar botón de 4 ojos con hilo de seguridad', machine_name: 'Botonadora Electrónica', execution_time: 0.25, category: 'Ojal/Botón' },
  { operation_name: 'Presillar remates de bolsillos y pasadores', machine_name: 'Presilladora Electrónica', execution_time: 0.40, category: 'Terminación' },
  { operation_name: 'Pegar cremallera en bragueta', machine_name: 'Plana 1 Aguja', execution_time: 0.95, category: 'Ensamble' },
  { operation_name: 'Bordar logo institucional en pecho', machine_name: 'Bordadora Multi-Cabezal', execution_time: 2.20, category: 'Personalización' }
];

