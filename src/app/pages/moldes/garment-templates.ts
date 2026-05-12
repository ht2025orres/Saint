/**
 * Ilustraciones SVG de prendas ensambladas (fashion flats).
 * ViewBox: 0 0 200 200
 */

interface GarmentLayer {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: string;
  strokeDasharray?: string;
}

interface GarmentPoint {
  name: string;
  field_name: string;
  x: number;
  y: number;
  item_type?: 'tela' | 'insumo';
}

export interface GarmentTemplate {
  layers: GarmentLayer[];
  points: GarmentPoint[];
  image?: string;      // Ruta a ilustración frontal
  backImage?: string;  // Ruta a ilustración trasera
}

// ===================== CAMISA MANGA LARGA =====================
export const CAMISA_MANGA_LARGA: GarmentTemplate = {
  image: 'assets/garments/camisa.png',
  layers: [
    // Sombra suave
    { d: 'M62,42 C82,37 118,37 138,42 L148,172 C118,180 82,180 52,172 Z', fill: '#e8edf2', stroke: 'none' },
    // Cuerpo principal
    { d: 'M60,40 C80,35 120,35 140,40 L150,170 C120,178 80,178 50,170 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Manga izquierda
    { d: 'M60,40 L22,58 L12,135 L38,142 L55,88', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    // Manga derecha
    { d: 'M140,40 L178,58 L188,135 L162,142 L145,88', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    // Puño izquierdo
    { d: 'M12,135 L38,142 L40,148 L14,141 Z', fill: '#e2e8f0', stroke: '#475569', strokeWidth: '1' },
    // Puño derecho
    { d: 'M188,135 L162,142 L160,148 L186,141 Z', fill: '#e2e8f0', stroke: '#475569', strokeWidth: '1' },
    // Cuello
    { d: 'M82,40 Q100,56 118,40 L114,30 Q100,36 86,30 Z', fill: '#e2e8f0', stroke: '#1e293b', strokeWidth: '1.5' },
    // Solapa cuello izq
    { d: 'M86,30 L82,40 L92,48 L96,38 Z', fill: '#f1f5f9', stroke: '#475569', strokeWidth: '0.8' },
    // Solapa cuello der
    { d: 'M114,30 L118,40 L108,48 L104,38 Z', fill: '#f1f5f9', stroke: '#475569', strokeWidth: '0.8' },
    // Línea de botones central
    { d: 'M100,48 L100,170', stroke: '#94a3b8', strokeWidth: '0.8', strokeDasharray: '4,3' },
    // Botones
    { d: 'M100,60 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.5' },
    { d: 'M100,80 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.5' },
    { d: 'M100,100 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.5' },
    { d: 'M100,120 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.5' },
    { d: 'M100,140 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.5' },
    // Bolsillo izquierdo
    { d: 'M65,68 L85,68 L85,88 L65,88 Z', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    { d: 'M65,68 L85,68', stroke: '#94a3b8', strokeWidth: '1' },
    // Costuras laterales
    { d: 'M60,40 Q55,100 50,170', stroke: '#e2e8f0', strokeWidth: '0.6', strokeDasharray: '2,2' },
    { d: 'M140,40 Q145,100 150,170', stroke: '#e2e8f0', strokeWidth: '0.6', strokeDasharray: '2,2' },
    // Dobladillo
    { d: 'M50,170 C80,178 120,178 150,170', stroke: '#475569', strokeWidth: '1' },
  ],
  points: [
    { name: 'Cuello', field_name: 'shirt_collar', x: 50, y: 18 },
    { name: 'Hombro Izq', field_name: 'shoulders', x: 30, y: 20 },
    { name: 'Hombro Der', field_name: 'shoulders', x: 70, y: 20 },
    { name: 'Manga Izquierda', field_name: 'sleeves', x: 12, y: 45 },
    { name: 'Manga Derecha', field_name: 'sleeves', x: 88, y: 45 },
    { name: 'Puño Izq', field_name: 'cuffs', x: 14, y: 70 },
    { name: 'Puño Der', field_name: 'cuffs', x: 86, y: 70 },
    { name: 'Botones', field_name: 'button', x: 50, y: 40 },
    { name: 'Bolsillo', field_name: 'purses', x: 37, y: 40 },
    { name: 'Dobladillo', field_name: 'hem', x: 50, y: 87 },
  ]
};

// ===================== CAMISA MANGA CORTA / POLO =====================
export const CAMISA_POLO: GarmentTemplate = {
  image: 'assets/garments/polo.png',
  layers: [
    { d: 'M62,47 C82,42 118,42 138,47 L145,172 C118,180 82,180 55,172 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M60,45 C80,40 120,40 140,45 L143,170 C115,178 85,178 57,170 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Manga corta izq
    { d: 'M60,45 L28,62 L35,95 L58,88', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    // Manga corta der
    { d: 'M140,45 L172,62 L165,95 L142,88', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    // Cuello polo
    { d: 'M85,45 Q100,60 115,45 L112,36 Q100,42 88,36 Z', fill: '#e2e8f0', stroke: '#1e293b', strokeWidth: '1.5' },
    // Cartera (placket)
    { d: 'M97,60 L97,100 M103,60 L103,100', stroke: '#94a3b8', strokeWidth: '0.8' },
    // Botones cartera
    { d: 'M100,70 m-1.5,0 a1.5,1.5 0 1,0 3,0 a1.5,1.5 0 1,0 -3,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.5' },
    { d: 'M100,85 m-1.5,0 a1.5,1.5 0 1,0 3,0 a1.5,1.5 0 1,0 -3,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.5' },
    // Dobladillo
    { d: 'M57,170 C85,178 115,178 143,170', stroke: '#475569', strokeWidth: '1' },
    // Costuras manga
    { d: 'M58,88 Q59,65 60,45', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '2,2' },
    { d: 'M142,88 Q141,65 140,45', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '2,2' },
  ],
  points: [
    { name: 'Cuello', field_name: 'shirt_collar', x: 50, y: 22 },
    { name: 'Cartera', field_name: 'front_adjustment', x: 50, y: 40 },
    { name: 'Manga Izq', field_name: 'sleeves', x: 22, y: 38 },
    { name: 'Manga Der', field_name: 'sleeves', x: 78, y: 38 },
    { name: 'Pecho', field_name: 'composition', x: 37, y: 45 },
    { name: 'Dobladillo', field_name: 'hem', x: 50, y: 87 },
  ]
};

// ===================== PANTALÓN =====================
export const PANTALON: GarmentTemplate = {
  image: 'assets/garments/pantalon.png',
  layers: [
    // Sombra
    { d: 'M67,22 L133,22 L143,185 L113,185 Q100,105 87,185 L57,185 Z', fill: '#e8edf2', stroke: 'none' },
    // Silueta principal
    { d: 'M65,20 L135,20 L145,183 L115,183 Q100,103 85,183 L55,183 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Pretina
    { d: 'M65,20 L135,20 L136,38 L64,38 Z', fill: '#e2e8f0', stroke: '#334155', strokeWidth: '1.2' },
    // Costura pretina
    { d: 'M65,29 L135,29', stroke: '#94a3b8', strokeWidth: '0.6', strokeDasharray: '3,2' },
    // Bragueta/cierre
    { d: 'M100,38 L100,75 Q92,77 92,68', stroke: '#64748b', strokeWidth: '1.2' },
    // Bolsillos delanteros
    { d: 'M68,38 C75,38 82,42 82,55', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    { d: 'M132,38 C125,38 118,42 118,55', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    // Costura entrepierna
    { d: 'M100,75 Q100,103 100,103', stroke: '#e2e8f0', strokeWidth: '0.6', strokeDasharray: '2,2' },
    // Costuras laterales
    { d: 'M65,38 Q60,110 55,183', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '2,2' },
    { d: 'M135,38 Q140,110 145,183', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '2,2' },
    // Rodillas
    { d: 'M72,130 Q78,128 85,130', stroke: '#e2e8f0', strokeWidth: '0.4' },
    { d: 'M115,130 Q122,128 128,130', stroke: '#e2e8f0', strokeWidth: '0.4' },
    // Dobladillo piernas
    { d: 'M55,183 L85,183 M115,183 L145,183', stroke: '#475569', strokeWidth: '1' },
    // Botón pretina
    { d: 'M100,29 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.5' },
    // Pasadores
    { d: 'M75,20 L75,26 M90,20 L90,26 M110,20 L110,26 M125,20 L125,26', stroke: '#94a3b8', strokeWidth: '0.8' },
  ],
  points: [
    { name: 'Pretina', field_name: 'waistband', x: 50, y: 14 },
    { name: 'Cierre', field_name: 'zipper', x: 50, y: 28 },
    { name: 'Bolsillo Izq', field_name: 'purses', x: 37, y: 24 },
    { name: 'Bolsillo Der', field_name: 'purses', x: 63, y: 24 },
    { name: 'Entrepierna', field_name: 'crotch', x: 50, y: 42 },
    { name: 'Bota Izq', field_name: 'boot', x: 35, y: 92 },
    { name: 'Bota Der', field_name: 'boot', x: 65, y: 92 },
    { name: 'Presillas', field_name: 'loops', x: 38, y: 11 },
  ]
};

// ===================== CHAQUETA =====================
export const CHAQUETA: GarmentTemplate = {
  image: 'assets/garments/chaqueta.png',
  layers: [
    { d: 'M62,38 C82,33 118,33 138,38 L148,172 C118,180 82,180 52,172 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M60,36 C80,31 120,31 140,36 L150,170 C120,178 80,178 50,170 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Mangas
    { d: 'M60,36 L18,56 L8,140 L36,148 L55,85', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    { d: 'M140,36 L182,56 L192,140 L164,148 L145,85', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    // Cuello solapa
    { d: 'M80,36 L75,50 L90,65 L100,50 L110,65 L125,50 L120,36', fill: '#e2e8f0', stroke: '#1e293b', strokeWidth: '1.5' },
    // Cierre/cremallera central
    { d: 'M100,50 L100,170', stroke: '#64748b', strokeWidth: '1.5' },
    // Bolsillos
    { d: 'M62,100 L88,100 L88,120 L62,120 Z', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    { d: 'M112,100 L138,100 L138,120 L112,120 Z', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    // Dobladillo
    { d: 'M50,170 C80,178 120,178 150,170', stroke: '#475569', strokeWidth: '1.2' },
    // Puños
    { d: 'M8,140 L36,148 L38,154 L10,146 Z', fill: '#e2e8f0', stroke: '#475569', strokeWidth: '0.8' },
    { d: 'M192,140 L164,148 L162,154 L190,146 Z', fill: '#e2e8f0', stroke: '#475569', strokeWidth: '0.8' },
  ],
  points: [
    { name: 'Cuello', field_name: 'shirt_collar', x: 50, y: 20 },
    { name: 'Hombros', field_name: 'shoulders', x: 30, y: 18 },
    { name: 'Cierre', field_name: 'zipper', x: 50, y: 55 },
    { name: 'Manga Izq', field_name: 'sleeves', x: 12, y: 48 },
    { name: 'Manga Der', field_name: 'sleeves', x: 88, y: 48 },
    { name: 'Bolsillo Izq', field_name: 'purses', x: 37, y: 55 },
    { name: 'Bolsillo Der', field_name: 'purses', x: 63, y: 55 },
    { name: 'Dobladillo', field_name: 'hem', x: 50, y: 87 },
  ]
};

// ===================== CHALECO =====================
export const CHALECO: GarmentTemplate = {
  image: 'assets/garments/chaleco.png',
  layers: [
    { d: 'M67,42 C82,37 118,37 133,42 L140,162 C118,170 82,170 60,162 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M65,40 C80,35 120,35 135,40 L142,160 C120,168 80,168 58,160 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Sisa izq
    { d: 'M65,40 Q55,60 58,90', fill: 'none', stroke: '#334155', strokeWidth: '1.5' },
    // Sisa der
    { d: 'M135,40 Q145,60 142,90', fill: 'none', stroke: '#334155', strokeWidth: '1.5' },
    // Cuello V
    { d: 'M85,40 L100,65 L115,40', fill: 'none', stroke: '#1e293b', strokeWidth: '1.5' },
    // Cierre
    { d: 'M100,65 L100,160', stroke: '#64748b', strokeWidth: '1' },
    // Bolsillos
    { d: 'M68,95 L92,95 L92,115 L68,115 Z', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    { d: 'M108,95 L132,95 L132,115 L108,115 Z', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    // Dobladillo
    { d: 'M58,160 C80,168 120,168 142,160', stroke: '#475569', strokeWidth: '1' },
  ],
  points: [
    { name: 'Cuello', field_name: 'neckline', x: 50, y: 25 },
    { name: 'Hombro Izq', field_name: 'shoulders', x: 32, y: 20 },
    { name: 'Hombro Der', field_name: 'shoulders', x: 68, y: 20 },
    { name: 'Cierre', field_name: 'zipper', x: 50, y: 55 },
    { name: 'Bolsillo Izq', field_name: 'purses', x: 40, y: 53 },
    { name: 'Dobladillo', field_name: 'hem', x: 50, y: 82 },
  ]
};

// ===================== BUZO / SUDADERA =====================
export const BUZO: GarmentTemplate = {
  image: 'assets/garments/buzo.png',
  layers: [
    { d: 'M62,47 C82,42 118,42 138,47 L145,172 C118,180 82,180 55,172 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M60,45 C80,40 120,40 140,45 L143,170 C115,178 85,178 57,170 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Mangas
    { d: 'M60,45 L20,62 L10,140 L40,148 L55,90', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    { d: 'M140,45 L180,62 L190,140 L160,148 L145,90', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    // Capucha
    { d: 'M82,45 Q75,30 80,15 Q100,5 120,15 Q125,30 118,45', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    // Cordón capucha
    { d: 'M95,45 L92,65 M105,45 L108,65', stroke: '#94a3b8', strokeWidth: '0.8' },
    // Bolsillo canguro
    { d: 'M70,110 Q100,118 130,110 L130,140 Q100,148 70,140 Z', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    // Puños
    { d: 'M10,140 L40,148 L42,155 L12,147 Z', fill: '#e2e8f0', stroke: '#475569', strokeWidth: '0.8' },
    { d: 'M190,140 L160,148 L158,155 L188,147 Z', fill: '#e2e8f0', stroke: '#475569', strokeWidth: '0.8' },
    // Rib inferior
    { d: 'M57,170 C85,178 115,178 143,170 L143,175 C115,183 85,183 57,175 Z', fill: '#e2e8f0', stroke: '#475569', strokeWidth: '0.8' },
  ],
  points: [
    { name: 'Capucha', field_name: 'hood', x: 50, y: 8 },
    { name: 'Cuello', field_name: 'neckline', x: 50, y: 23 },
    { name: 'Manga Izq', field_name: 'sleeves', x: 14, y: 48 },
    { name: 'Manga Der', field_name: 'sleeves', x: 86, y: 48 },
    { name: 'Puño Izq', field_name: 'cuffs', x: 14, y: 73 },
    { name: 'Puño Der', field_name: 'cuffs', x: 86, y: 73 },
    { name: 'Bolsillo', field_name: 'purses', x: 50, y: 63 },
    { name: 'Cotilla (Rib)', field_name: 'busybody', x: 50, y: 87 },
  ]
};

// ===================== CAMISETA / T-SHIRT =====================
export const CAMISETA: GarmentTemplate = {
  image: 'assets/garments/camiseta.png',
  layers: [
    { d: 'M62,47 C82,42 118,42 138,47 L145,172 C118,180 82,180 55,172 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M60,45 C80,40 120,40 140,45 L143,170 C115,178 85,178 57,170 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Manga corta izq
    { d: 'M60,45 L30,60 L35,90 L58,82', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    // Manga corta der
    { d: 'M140,45 L170,60 L165,90 L142,82', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    // Cuello redondo
    { d: 'M85,45 Q100,55 115,45', fill: 'none', stroke: '#1e293b', strokeWidth: '1.5' },
    // Dobladillo
    { d: 'M57,170 C85,178 115,178 143,170', stroke: '#475569', strokeWidth: '1' },
  ],
  points: [
    { name: 'Cuello', field_name: 'neckline', x: 50, y: 24 },
    { name: 'Manga Izq', field_name: 'sleeves', x: 22, y: 35 },
    { name: 'Manga Der', field_name: 'sleeves', x: 78, y: 35 },
    { name: 'Pecho', field_name: 'composition', x: 50, y: 45 },
    { name: 'Estampado', field_name: 'stamped', x: 50, y: 55 },
    { name: 'Dobladillo', field_name: 'hem', x: 50, y: 87 },
  ]
};

// ===================== OVEROL =====================
export const OVEROL: GarmentTemplate = {
  image: 'assets/garments/overol.png',
  layers: [
    { d: 'M62,22 C82,17 118,17 138,22 L148,185 L118,185 Q100,115 82,185 L52,185 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M60,20 C80,15 120,15 140,20 L150,183 L120,183 Q100,113 80,183 L50,183 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Mangas
    { d: 'M60,20 L22,38 L12,115 L38,122 L55,68', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    { d: 'M140,20 L178,38 L188,115 L162,122 L145,68', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    // Cuello redondo
    { d: 'M85,20 Q100,30 115,20', fill: 'none', stroke: '#1e293b', strokeWidth: '1.5' },
    // Cierre central
    { d: 'M100,30 L100,113', stroke: '#64748b', strokeWidth: '1.5' },
    // Cinturón
    { d: 'M55,100 L145,100 L145,108 L55,108 Z', fill: '#e2e8f0', stroke: '#475569', strokeWidth: '0.8' },
    // Bolsillos pecho
    { d: 'M65,45 L82,45 L82,62 L65,62 Z', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    { d: 'M118,45 L135,45 L135,62 L118,62 Z', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    // Costuras piernas
    { d: 'M80,113 Q80,148 80,183', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '2,2' },
    { d: 'M120,113 Q120,148 120,183', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '2,2' },
  ],
  points: [
    { name: 'Cuello', field_name: 'neckline', x: 50, y: 12 },
    { name: 'Manga Izq', field_name: 'sleeves', x: 12, y: 38 },
    { name: 'Manga Der', field_name: 'sleeves', x: 88, y: 38 },
    { name: 'Bolsillo Pecho', field_name: 'purses', x: 37, y: 27 },
    { name: 'Cierre', field_name: 'zipper', x: 50, y: 35 },
    { name: 'Cinturón', field_name: 'waistband', x: 50, y: 52 },
    { name: 'Bota Izq', field_name: 'boot', x: 35, y: 92 },
    { name: 'Bota Der', field_name: 'boot', x: 65, y: 92 },
  ]
};

// ===================== BERMUDA / SHORT =====================
export const BERMUDA: GarmentTemplate = {
  layers: [
    { d: 'M67,22 L133,22 L138,120 L108,120 Q100,80 92,120 L62,120 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M65,20 L135,20 L140,118 L110,118 Q100,78 90,118 L60,118 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Pretina
    { d: 'M65,20 L135,20 L136,36 L64,36 Z', fill: '#e2e8f0', stroke: '#334155', strokeWidth: '1.2' },
    // Bragueta
    { d: 'M100,36 L100,65 Q94,67 94,60', stroke: '#64748b', strokeWidth: '1.2' },
    // Bolsillos
    { d: 'M68,36 C75,36 80,40 80,50', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    { d: 'M132,36 C125,36 120,40 120,50', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    // Bolsillos cargo lateral
    { d: 'M62,70 L82,70 L82,95 L62,95 Z', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.7' },
    { d: 'M118,70 L138,70 L138,95 L118,95 Z', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.7' },
    // Dobladillo
    { d: 'M60,118 L90,118 M110,118 L140,118', stroke: '#475569', strokeWidth: '1' },
    // Pasadores
    { d: 'M78,20 L78,26 M100,20 L100,26 M122,20 L122,26', stroke: '#94a3b8', strokeWidth: '0.8' },
  ],
  points: [
    { name: 'Pretina', field_name: 'waistband', x: 50, y: 14 },
    { name: 'Cierre', field_name: 'zipper', x: 50, y: 28 },
    { name: 'Bolsillo Cargo', field_name: 'purses', x: 35, y: 45 },
    { name: 'Bota Izq', field_name: 'boot', x: 37, y: 60 },
    { name: 'Bota Der', field_name: 'boot', x: 63, y: 60 },
  ]
};

// ===================== DELANTAL / BATA =====================
export const DELANTAL: GarmentTemplate = {
  image: 'assets/garments/delantal.png',
  layers: [
    { d: 'M62,27 C82,22 118,22 138,27 L142,175 C118,183 82,183 58,175 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M60,25 C80,20 120,20 140,25 L144,173 C120,181 80,181 56,173 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Cuello V
    { d: 'M85,25 L100,48 L115,25', fill: 'none', stroke: '#1e293b', strokeWidth: '1.5' },
    // Mangas cortas
    { d: 'M60,25 L32,40 L38,70 L58,62', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    { d: 'M140,25 L168,40 L162,70 L142,62', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.5' },
    // Bolsillos grandes
    { d: 'M64,90 L92,90 L92,130 L64,130 Z', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    { d: 'M108,90 L136,90 L136,130 L108,130 Z', fill: 'none', stroke: '#cbd5e1', strokeWidth: '0.8' },
    // Amarre cintura
    { d: 'M56,85 L144,85', stroke: '#94a3b8', strokeWidth: '0.8', strokeDasharray: '4,3' },
    // Cintas laterales
    { d: 'M56,85 L45,90 L42,82', stroke: '#94a3b8', strokeWidth: '0.8' },
    { d: 'M144,85 L155,90 L158,82', stroke: '#94a3b8', strokeWidth: '0.8' },
    // Dobladillo
    { d: 'M56,173 C80,181 120,181 144,173', stroke: '#475569', strokeWidth: '1' },
  ],
  points: [
    { name: 'Cuello', field_name: 'neckline', x: 50, y: 18 },
    { name: 'Manga Izq', field_name: 'sleeves', x: 24, y: 28 },
    { name: 'Manga Der', field_name: 'sleeves', x: 76, y: 28 },
    { name: 'Amarre', field_name: 'waistband', x: 50, y: 43 },
    { name: 'Bolsillo Izq', field_name: 'purses', x: 39, y: 55 },
    { name: 'Bolsillo Der', field_name: 'purses', x: 61, y: 55 },
    { name: 'Dobladillo', field_name: 'hem', x: 50, y: 88 },
  ]
};

// ===================== FALDA =====================
export const FALDA: GarmentTemplate = {
  layers: [
    { d: 'M72,22 L128,22 L145,168 L55,168 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M70,20 L130,20 L147,166 L53,166 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Pretina
    { d: 'M70,20 L130,20 L131,36 L69,36 Z', fill: '#e2e8f0', stroke: '#334155', strokeWidth: '1.2' },
    // Costura pretina
    { d: 'M70,28 L130,28', stroke: '#94a3b8', strokeWidth: '0.6', strokeDasharray: '3,2' },
    // Pliegues
    { d: 'M85,36 L80,166', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '3,3' },
    { d: 'M100,36 L100,166', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '3,3' },
    { d: 'M115,36 L120,166', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '3,3' },
    // Cierre lateral
    { d: 'M70,36 L63,80', stroke: '#64748b', strokeWidth: '0.8' },
    // Dobladillo
    { d: 'M53,166 L147,166', stroke: '#475569', strokeWidth: '1.2' },
    // Botón pretina
    { d: 'M100,28 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.5' },
  ],
  points: [
    { name: 'Pretina', field_name: 'waistband', x: 50, y: 14 },
    { name: 'Cierre', field_name: 'zipper', x: 35, y: 28 },
    { name: 'Largo', field_name: 'length', x: 50, y: 55 },
    { name: 'Dobladillo', field_name: 'hem', x: 50, y: 84 },
  ]
};

// ===================== SLACK (Pantalón de vestir) =====================
export const SLACK: GarmentTemplate = {
  image: 'assets/garments/pantalon.png',
  layers: [],
  points: [
    { name: 'Pretina', field_name: 'waistband', x: 50, y: 14 },
    { name: 'Cierre', field_name: 'zipper', x: 50, y: 28 },
    { name: 'Bolsillo Izq', field_name: 'purses', x: 37, y: 24 },
    { name: 'Bolsillo Der', field_name: 'purses', x: 63, y: 24 },
    { name: 'Pliegue', field_name: 'pleat', x: 42, y: 55 },
    { name: 'Bota Izq', field_name: 'boot', x: 35, y: 92 },
    { name: 'Bota Der', field_name: 'boot', x: 65, y: 92 },
  ]
};

// ===================== COFIA =====================
export const COFIA: GarmentTemplate = {
  image: 'assets/garments/cofia.png',
  layers: [
    { d: 'M52,102 C52,52 148,52 148,102 C148,115 140,120 100,122 C60,120 52,115 52,102 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M50,100 C50,50 150,50 150,100 C150,113 142,118 100,120 C58,118 50,113 50,100 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Elástico inferior
    { d: 'M55,108 Q100,118 145,108', fill: 'none', stroke: '#475569', strokeWidth: '1.2' },
    { d: 'M58,112 Q100,120 142,112', fill: 'none', stroke: '#94a3b8', strokeWidth: '0.6', strokeDasharray: '2,2' },
    // Pliegues superiores
    { d: 'M80,55 Q82,80 80,100', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '3,3' },
    { d: 'M100,52 Q100,75 100,100', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '3,3' },
    { d: 'M120,55 Q118,80 120,100', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '3,3' },
  ],
  points: [
    { name: 'Copa', field_name: 'crown', x: 50, y: 35 },
    { name: 'Elástico', field_name: 'elastic', x: 50, y: 58 },
  ]
};

// ===================== TAPABOCA =====================
export const TAPABOCA: GarmentTemplate = {
  image: 'assets/garments/tapaboca.png',
  layers: [
    { d: 'M42,72 C42,62 70,52 100,52 C130,52 158,62 158,72 L155,108 C155,125 130,140 100,140 C70,140 45,125 45,108 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M40,70 C40,60 68,50 100,50 C132,50 160,60 160,70 L157,106 C157,123 132,138 100,138 C68,138 43,123 43,106 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Pliegues horizontales
    { d: 'M50,75 L150,75', stroke: '#cbd5e1', strokeWidth: '0.7' },
    { d: 'M48,88 L152,88', stroke: '#cbd5e1', strokeWidth: '0.7' },
    { d: 'M50,101 L150,101', stroke: '#cbd5e1', strokeWidth: '0.7' },
    // Clip nariz
    { d: 'M80,55 L120,55', stroke: '#64748b', strokeWidth: '1.5' },
    // Elásticos orejas
    { d: 'M40,70 Q25,85 30,110', stroke: '#94a3b8', strokeWidth: '1' },
    { d: 'M160,70 Q175,85 170,110', stroke: '#94a3b8', strokeWidth: '1' },
  ],
  points: [
    { name: 'Clip Nariz', field_name: 'nose_clip', x: 50, y: 28 },
    { name: 'Cuerpo', field_name: 'body', x: 50, y: 48 },
    { name: 'Elástico Izq', field_name: 'elastic', x: 17, y: 48 },
    { name: 'Elástico Der', field_name: 'elastic', x: 83, y: 48 },
  ]
};

// ===================== GORRA =====================
export const GORRA: GarmentTemplate = {
  image: 'assets/garments/gorra.png',
  layers: [
    { d: 'M52,102 C52,62 148,62 148,102 L148,115 L52,115 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M50,100 C50,60 150,60 150,100 L150,113 L50,113 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.8' },
    // Copa/parte superior
    { d: 'M60,100 Q100,40 140,100', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1' },
    // Visera
    { d: 'M45,113 C45,113 30,130 50,138 L160,138 C170,130 155,113 155,113 Z', fill: '#e2e8f0', stroke: '#334155', strokeWidth: '1.5' },
    // Costuras copa
    { d: 'M100,55 L100,100', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '3,3' },
    { d: 'M75,65 L80,105', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '3,3' },
    { d: 'M125,65 L120,105', stroke: '#e2e8f0', strokeWidth: '0.5', strokeDasharray: '3,3' },
    // Botón superior
    { d: 'M100,55 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.5' },
  ],
  points: [
    { name: 'Copa', field_name: 'crown', x: 50, y: 35 },
    { name: 'Visera', field_name: 'visor', x: 50, y: 70 },
    { name: 'Frente', field_name: 'front_panel', x: 50, y: 50 },
  ]
};

// ===================== CONJUNTO (Camisa + Pantalón) =====================
export const CONJUNTO: GarmentTemplate = {
  image: 'assets/garments/camisa.png',
  layers: [
    // === PARTE SUPERIOR ===
    { d: 'M62,12 C82,7 118,7 138,12 L145,82 C118,88 82,88 55,82 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M60,10 C80,5 120,5 140,10 L143,80 C115,86 85,86 57,80 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.5' },
    // Mangas cortas
    { d: 'M60,10 L38,22 L42,45 L58,40', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.2' },
    { d: 'M140,10 L162,22 L158,45 L142,40', fill: '#f1f5f9', stroke: '#334155', strokeWidth: '1.2' },
    // Cuello
    { d: 'M88,10 Q100,20 112,10', fill: 'none', stroke: '#1e293b', strokeWidth: '1.2' },
    // Botones
    { d: 'M100,25 m-1.5,0 a1.5,1.5 0 1,0 3,0 a1.5,1.5 0 1,0 -3,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.4' },
    { d: 'M100,40 m-1.5,0 a1.5,1.5 0 1,0 3,0 a1.5,1.5 0 1,0 -3,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.4' },
    { d: 'M100,55 m-1.5,0 a1.5,1.5 0 1,0 3,0 a1.5,1.5 0 1,0 -3,0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: '0.4' },
    // === PARTE INFERIOR ===
    { d: 'M67,92 L133,92 L140,188 L112,188 Q100,140 88,188 L60,188 Z', fill: '#e8edf2', stroke: 'none' },
    { d: 'M65,90 L135,90 L142,186 L114,186 Q100,138 86,186 L58,186 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.5' },
    // Pretina
    { d: 'M65,90 L135,90 L136,102 L64,102 Z', fill: '#e2e8f0', stroke: '#334155', strokeWidth: '1' },
    // Separador visual
    { d: 'M50,86 L150,86', stroke: '#94a3b8', strokeWidth: '0.5', strokeDasharray: '4,3' },
  ],
  points: [
    { name: 'Cuello', field_name: 'shirt_collar', x: 50, y: 6 },
    { name: 'Manga Izq', field_name: 'sleeves', x: 24, y: 16 },
    { name: 'Manga Der', field_name: 'sleeves', x: 76, y: 16 },
    { name: 'Pecho', field_name: 'composition', x: 50, y: 25 },
    { name: 'Pretina', field_name: 'waistband', x: 50, y: 48 },
    { name: 'Bota Izq', field_name: 'boot', x: 37, y: 94 },
    { name: 'Bota Der', field_name: 'boot', x: 63, y: 94 },
  ]
};

// ===================== GENÉRICO / OTROS =====================
export const GENERICO: GarmentTemplate = {
  layers: [
    { d: 'M30,30 L170,30 L170,170 L30,170 Z', fill: '#f8fafc', stroke: '#334155', strokeWidth: '1.5' },
    { d: 'M30,50 L170,50 M30,150 L170,150', stroke: '#e2e8f0', strokeWidth: '0.8', strokeDasharray: '5,5' },
    { d: 'M100,30 L100,170', stroke: '#e2e8f0', strokeWidth: '0.8', strokeDasharray: '5,5' },
  ],
  points: [
    { name: 'Centro', field_name: '', x: 50, y: 50 },
  ]
};

/**
 * Puntos obligatorios por categoría, mapeados exactamente a los campos
 * de la ficha técnica (formControlName).
 * Las coordenadas x,y son porcentajes relativos al canvas de la imagen.
 * item_type: 'tela' = telas/composición, 'insumo' = todo lo demás.
 *
 * Campos extraídos de: create-technical-sheet.component.html
 */

// Componentes que son tipo TELA
const TELA_FIELDS = new Set(['main_fabric','contrast_fabric','lining','composition']);

interface PointDef { name: string; x: number; y: number; }

// ── Posiciones para prendas superiores (camisa/polo/buzo/camiseta) ──
const PTS_UPPER: { [key: string]: PointDef } = {
  shirt_collar:       { name: 'Cuello',           x: 50, y: 10 },
  shoulders:          { name: 'Hombros',          x: 28, y: 18 },
  sleeve_connection:  { name: 'Unión Mangas',     x: 22, y: 25 },
  sleeves:            { name: 'Mangas',            x: 14, y: 35 },
  cuffs:              { name: 'Puños',             x: 10, y: 48 },
  front_adjustment:   { name: 'Ajuste Frente',    x: 50, y: 30 },
  button:             { name: 'Botón',             x: 50, y: 40 },
  purses:             { name: 'Carteras',          x: 38, y: 45 },
  pockets:            { name: 'Bolsillos',         x: 62, y: 45 },
  back:               { name: 'Espalda',           x: 75, y: 50 },
  closed_sides:       { name: 'Cerrado Costados', x: 25, y: 60 },
  shoulder_union:     { name: 'Unión Hombros',    x: 50, y: 16 },
  opening:            { name: 'Aberturas',         x: 70, y: 70 },
  darts:              { name: 'Pinzas',            x: 38, y: 55 },
  cuts:               { name: 'Cortes',            x: 62, y: 55 },
  hem:                { name: 'Dobladillo',        x: 50, y: 88 },
  lining:             { name: 'Forro',             x: 72, y: 30 },
  hood:               { name: 'Capucha',           x: 50, y: 5 },
  reflective:         { name: 'Reflectivo',        x: 50, y: 72 },
  composition:        { name: 'Composición',       x: 50, y: 80 },
};

// ── Posiciones para prendas inferiores (pantalón/jean/slack) ──
const PTS_LOWER: { [key: string]: PointDef } = {
  waistband:    { name: 'Pretina',          x: 50, y: 8 },
  button:       { name: 'Botón',            x: 50, y: 12 },
  zipper:       { name: 'Cierre',           x: 50, y: 22 },
  figured:      { name: 'Figurado',         x: 40, y: 30 },
  pins:         { name: 'Pasadores',        x: 60, y: 10 },
  side_pulls:   { name: 'Tiros',            x: 35, y: 18 },
  pockets:      { name: 'Bolsillos',        x: 30, y: 22 },
  busybody:     { name: 'Cotilla',          x: 65, y: 35 },
  crotch:       { name: 'Entrepierna',      x: 50, y: 42 },
  closed_sides: { name: 'Cerrado Costados', x: 28, y: 50 },
  boot:         { name: 'Bota',             x: 35, y: 90 },
  reflective:   { name: 'Reflectivo',       x: 60, y: 65 },
  composition:  { name: 'Composición',      x: 50, y: 75 },
};

// ── Posiciones para overol (combinación superior + inferior) ──
const PTS_OVEROL: { [key: string]: PointDef } = {
  shirt_collar:       { name: 'Cuello',           x: 50, y: 8 },
  shoulders:          { name: 'Hombros',          x: 28, y: 14 },
  sleeve_connection:  { name: 'Unión Mangas',     x: 22, y: 20 },
  sleeves:            { name: 'Mangas',            x: 14, y: 30 },
  button:             { name: 'Botón',             x: 50, y: 25 },
  pockets:            { name: 'Bolsillos',         x: 62, y: 28 },
  front_adjustment:   { name: 'Ajuste Frente',    x: 50, y: 35 },
  back:               { name: 'Espalda',           x: 75, y: 40 },
  closed_sides:       { name: 'Cerrado Costados', x: 25, y: 45 },
  side_pulls:         { name: 'Tiros',            x: 35, y: 50 },
  crotch:             { name: 'Entrepierna',      x: 50, y: 55 },
  boot:               { name: 'Bota',             x: 35, y: 90 },
  reflective:         { name: 'Reflectivo',       x: 60, y: 70 },
  composition:        { name: 'Composición',      x: 50, y: 80 },
};

// ── Posiciones para delantal/batola ──
const PTS_DELANTAL: { [key: string]: PointDef } = {
  neckline:     { name: 'Escote',           x: 50, y: 12 },
  button:       { name: 'Botón',            x: 50, y: 25 },
  pockets:      { name: 'Bolsillos',        x: 38, y: 50 },
  straps:       { name: 'Tiras',            x: 22, y: 35 },
  opening:      { name: 'Aberturas',        x: 72, y: 45 },
  finished:     { name: 'Terminado',        x: 50, y: 60 },
  hem:          { name: 'Dobladillo',        x: 50, y: 88 },
  reflective:   { name: 'Reflectivo',       x: 50, y: 72 },
  composition:  { name: 'Composición',      x: 50, y: 80 },
};

/** Mapa de categoría ID → imágenes frontal y trasera */
const CATEGORY_IMAGE_MAP: { [id: number]: { image: string; backImage?: string; type: string } } = {
  1:  { image: 'assets/garments/camisa.png',    backImage: 'assets/garments/camisa_back.png',    type: 'camisa' },
  2:  { image: 'assets/garments/buzo.png',      backImage: 'assets/garments/buzo_back.png',      type: 'buzo' },
  3:  { image: 'assets/garments/polo.png',      backImage: 'assets/garments/polo_back.png',      type: 'polo' },
  4:  { image: 'assets/garments/delantal.png',  backImage: 'assets/garments/delantal_back.png',  type: 'delantal' },
  5:  { image: 'assets/garments/chaqueta.png',  backImage: 'assets/garments/chaqueta_back.png',  type: 'chaqueta' },
  6:  { image: 'assets/garments/pantalon.png',  backImage: 'assets/garments/pantalon_back.png',  type: 'jean' },
  7:  { image: 'assets/garments/pantalon.png',  backImage: 'assets/garments/pantalon_back.png',  type: 'pantalon' },
  8:  { image: 'assets/garments/pantalon.png',  backImage: 'assets/garments/pantalon_back.png',  type: 'slack' },
  9:  { image: 'assets/garments/chaleco.png',   backImage: 'assets/garments/chaleco_back.png',   type: 'chaleco' },
  10: { image: 'assets/garments/cofia.png',     backImage: undefined,                             type: 'cofia' },
  11: { image: 'assets/garments/tapaboca.png',  backImage: undefined,                             type: 'tapaboca' },
  12: { image: 'assets/garments/camisa.png',    backImage: 'assets/garments/camisa_back.png',    type: 'camisa' },
  13: { image: 'assets/garments/camisa.png',    backImage: 'assets/garments/camisa_back.png',    type: 'camisa' },
  14: { image: 'assets/garments/pantalon.png',  backImage: 'assets/garments/pantalon_back.png',  type: 'pantalon' },
  15: { image: 'assets/garments/pantalon.png',  backImage: 'assets/garments/pantalon_back.png',  type: 'slack' },
  16: { image: 'assets/garments/overol.png',    backImage: 'assets/garments/overol_back.png',    type: 'overol' },
  17: { image: 'assets/garments/camisa.png',    backImage: 'assets/garments/camisa_back.png',    type: 'camisa' },
  18: { image: 'assets/garments/camisa.png',    backImage: 'assets/garments/camisa_back.png',    type: 'camisa' },
  19: { image: 'assets/garments/gorra.png',     backImage: 'assets/garments/gorra_back.png',     type: 'gorra' },
  20: { image: 'assets/garments/delantal.png',  backImage: 'assets/garments/delantal_back.png',  type: 'delantal' },
  21: { image: 'assets/garments/camiseta.png',  backImage: 'assets/garments/camiseta_back.png',  type: 'camiseta' },
};

/**
 * Devuelve la plantilla completa para una categoría.
 * @param description Descripción textual de la categoría (para fallback)
 * @param categoryId  ID numérico de la categoría (1-22)
 */
export function getGarmentTemplate(description: string, categoryId?: number): GarmentTemplate {
  const id = categoryId ? Number(categoryId) : 0;
  const mapping = CATEGORY_IMAGE_MAP[id];

  if (mapping) {
    return {
      image: mapping.image,
      backImage: mapping.backImage,
      layers: [],
      points: [],
    };
  }

  // 22 - Otros o categoría desconocida → genérico sin imagen (upload)
  return { ...GENERICO, points: [] };
}
