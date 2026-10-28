export interface OptionalPartType {
  id: number;
  name: string;
  technical_description?: string;
  total_time?: number;
  estimated_time?: number;
  is_default?: boolean;
  materials?: string[];
}

export interface OptionalPart {
  id: number;
  code: string;
  name: string;
  icon: string;
  description: string;
  types: OptionalPartType[];
}

export const CANONICAL_OPTIONAL_PARTS: OptionalPart[] = [
  {
    id: 9100,
    code: 'BRG_FIG',
    name: 'Bragueta y Figurado',
    icon: 'bi-layout-sidebar',
    description: 'Bragueta delantera con aletilla, aletillón, cremallera o botones.',
    types: [
      {
        id: 9101,
        name: 'Bragueta con Cremallera y Aletilla Sencilla',
        technical_description: 'Bragueta con cremallera de nylon / metálica y aletilla reforzada',
        total_time: 1.85,
        is_default: true,
        materials: ['Cremallera / Cierre', 'Tela Principal', 'Hilo de Confección']
      },
      {
        id: 9102,
        name: 'Bragueta con Botones y Aletillón Completo',
        technical_description: 'Bragueta tradicional con botones ocultos y aletillón protector',
        total_time: 2.20,
        materials: ['Botones', 'Tela Principal', 'Hilo de Confección']
      }
    ]
  },
  {
    id: 9200,
    code: 'REF_ALTA_VIS',
    name: 'Cintas Reflectivas de Alta Visibilidad',
    icon: 'bi-stars',
    description: 'Cintas reflectivas de 2.5cm y 5cm de alta visibilidad en torso, espalda, mangas o botas.',
    types: [
      {
        id: 9201,
        name: 'Reflectivo Tipo Chaleco (Torso Delantero y Espalda 5cm)',
        technical_description: 'Cinta reflectiva de 5cm cosida horizontalmente en contorno de pecho y espalda',
        total_time: 1.25,
        is_default: true,
        materials: ['Cinta Reflectiva 5cm', 'Hilo de Confección']
      },
      {
        id: 9202,
        name: 'Reflectivo Tipo Chaleco Doble (Doble Banda Torso)',
        technical_description: 'Dos bandas reflectivas horizontales paralelas en pecho y espalda',
        total_time: 1.90,
        materials: ['Cinta Reflectiva 5cm', 'Hilo de Confección']
      },
      {
        id: 9203,
        name: 'Reflectivo Tipo Chaleco y Mangas (Brazos y Torso)',
        technical_description: 'Bandas reflectivas completas en contorno de torso y en ambas mangas',
        total_time: 2.10,
        materials: ['Cinta Reflectiva 2.5cm', 'Hilo de Confección']
      },
      {
        id: 9204,
        name: 'Reflectivo en Botas (Contorno Piernas)',
        technical_description: 'Cintas reflectivas perimetrales de seguridad en la bota de ambas piernas',
        total_time: 1.00,
        materials: ['Cinta Reflectiva 2.5cm', 'Hilo de Confección']
      }
    ]
  },
  {
    id: 9300,
    code: 'LOG_BOR',
    name: 'Logos, Bordados y Marquillas',
    icon: 'bi-gem',
    description: 'Bordados corporativos, termofijados, estampados y marquillas de identificación.',
    types: [
      {
        id: 9301,
        name: 'Bordado Pecho Izquierdo y Marquilla Cuello',
        technical_description: 'Logo corporativo bordado en delantero izquierdo y marquilla de talla/marca',
        total_time: 1.80,
        is_default: true,
        materials: ['Hilo de Bordado', 'Marquilla Tejida', 'Entretela Fusionable']
      },
      {
        id: 9302,
        name: 'Estampado DTF / Vinilo Textil Espalda y Pecho',
        technical_description: 'Estampado termotransferible en delantero y espalda',
        total_time: 1.40,
        materials: ['Vinilo Textil / DTF']
      },
      {
        id: 9303,
        name: 'Marquilla Tejida en Manga / Bota',
        technical_description: 'Marquilla corporativa sobrepuesta',
        total_time: 0.80,
        materials: ['Marquilla Tejida', 'Hilo de Confección']
      }
    ]
  },
  {
    id: 9400,
    code: 'VIV_CON',
    name: 'Vivos y Contrastes Decorativos',
    icon: 'bi-palette',
    description: 'Detalles en contraste de color en cuello, carteras, sangrías o costados.',
    types: [
      {
        id: 9401,
        name: 'Vivos en Contraste Cuello y Carteras',
        technical_description: 'Insertos de tela en color de contraste en solapa y carteras',
        total_time: 1.10,
        is_default: true,
        materials: ['Tela Contraste', 'Hilo de Confección']
      },
      {
        id: 9402,
        name: 'Sesgo Doble Doblado en Bordes y Puños',
        technical_description: 'Sesgo sobrepuesto decorativo en perfiles',
        total_time: 1.30,
        materials: ['Sesgo / Vivo', 'Hilo de Confección']
      }
    ]
  }
];

