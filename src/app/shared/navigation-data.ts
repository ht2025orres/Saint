/* ══════════════════════════════════════════════════════════════════════════════
   ESTRUCTURA DE NAVEGACIÓN CENTRALIZADA - SAINT
   Single Source of Truth para Headbar (Desktop) y Sidebar (Móviles / Tablets)
   ══════════════════════════════════════════════════════════════════════════════ */

export interface SubInterface {
  label: string;
  link: string;
  icon?: string;
  perfiles?: string[];
  permissions?: number[];
  modules?: number[];
  condition?: () => boolean;
}

export interface ModuleItem {
  label: string;
  icon?: string;
  link?: string;
  subInterfaces?: SubInterface[];
  perfiles?: string[];
  permissions?: number[];
  modules?: number[];
  condition?: () => boolean;
  isOpen?: boolean; // Estado colapsable para acordeón en móvil
}

export interface AreaCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  modules: ModuleItem[];
  isOpen?: boolean; // Estado colapsable para acordeón en móvil
}

/**
 * Validador de horario laboral para permitir la generación de reportes de fichas
 */
export function puedeMostrarBotonReporte(): boolean {
  const ahora = new Date();
  const diaSemana = ahora.getDay();
  const hora = ahora.getHours();
  const minutos = ahora.getMinutes();

  if (diaSemana >= 1 && diaSemana <= 5) {
    return (hora > 7 || (hora === 7 && minutos >= 0)) && hora < 16;
  }

  if (diaSemana === 6) {
    return (hora > 7 || (hora === 7 && minutos >= 0)) && hora < 12;
  }

  return false;
}

/**
 * Retorna la estructura unificada de Áreas, Módulos y Sub-interfaces
 * con nombres limpios y sin redundancias.
 */
export function getNavigationAreas(): AreaCategory[] {
  return [
    /* ═══════════════════════════════════════════════════════
       ÁREA 1: PRODUCCIÓN
       ═══════════════════════════════════════════════════════ */
    {
      id: 'produccion',
      label: 'Producción',
      icon: 'bi bi-gear-wide-connected',
      color: '#2563EB',
      modules: [
        {
          label: 'Fichas Técnicas',
          icon: 'bi bi-file-earmark-ruled',
          modules: [6],
          permissions: [1],
          isOpen: true,
          subInterfaces: [
            { label: 'Crear Ficha Técnica', link: '/createTechnicalDataSheet/new/create', permissions: [1, 2] },
            { label: 'Fichas Terminadas', link: '/listTechnicalDataSheet/page/0/TERMINADO', permissions: [1, 2, 3, 4, 5, 31, 32, 6] },
            { label: 'Primera Revisión', link: '/listTechnicalDataSheet/page/0/PRIMERA REVISION', permissions: [1, 3] },
            { label: 'Segunda Revisión', link: '/listTechnicalDataSheet/page/0/SEGUNDA REVISION', permissions: [1, 4] },
            { label: 'En Calidad', link: '/listTechnicalDataSheet/page/0/CALIDAD', permissions: [1, 5] },
            { label: 'En Desarrollo', link: '/listTechnicalDataSheet/page/0/DESARROLLO', permissions: [1, 2] },
            { label: 'Gestión de Anulaciones', link: '/gestion-anulaciones-fichas', permissions: [1, 52] },
          ]
        },
        {
          label: 'Reportes',
          icon: 'bi bi-file-earmark-bar-graph',
          modules: [6],
          permissions: [1],
          isOpen: false,
          subInterfaces: [
            { label: 'Análisis por Mes', link: '/technical-data-sheets-report', permissions: [1, 32] },
            { label: 'Dashboard de Reportes', link: '/report-dashboard', permissions: [1, 32] },
            { label: 'Generar Reporte', link: '/create-report', permissions: [1, 31], condition: puedeMostrarBotonReporte },
            { label: 'Mis Reportes', link: '/mi-lista-report', permissions: [1, 31] },
            { label: 'Gestión de Reportes', link: '/list-report', permissions: [1, 32] },
          ]
        },
        {
          label: 'Moldes y OPM',
          icon: 'bi bi-diagram-2',
          modules: [9],
          permissions: [1, 40],
          isOpen: false,
          subInterfaces: [
            { label: 'Librería de Moldes', link: '/moldes', permissions: [1, 40] },
            { label: 'Catálogo de Partes y Operaciones', link: '/moldes/partes', permissions: [1, 40, 41] },
          ]
        },
        {
          label: 'Planeación y Tiempos',
          icon: 'bi bi-stopwatch',
          permissions: [1],
          isOpen: false,
          subInterfaces: [
            { label: 'Recepción y Procesamiento de OCs', link: '/comerciales/ordenes-compra', permissions: [1, 38] },
            { label: 'Planeación de Producción', link: '/planeacion', permissions: [1] },
            { label: 'Tiempos por Ítem', link: '/tiempos-items', permissions: [1] },
          ]
        },
        {
          label: 'Terminación y Empaque',
          icon: 'bi bi-box-seam',
          modules: [3],
          permissions: [1],
          isOpen: false,
          subInterfaces: [
            { label: 'Recepción de OP', link: '/recepcion-op', permissions: [1, 19] },
            { label: 'Distribución de PV', link: '/distribucion-pv', permissions: [1, 20, 33] },
            { label: 'Gestión de Empacadores', link: '/gestion-empacadores', permissions: [1, 21] },
            { label: 'Registrar Empaque', link: '/registrar-empaque', permissions: [1, 16] },
            { label: 'Dashboard de Empaque', link: '/dashboard-empaque', permissions: [1, 22] },
          ]
        },
        {
          label: 'Inconsistencias',
          icon: 'bi bi-exclamation-triangle',
          modules: [2],
          permissions: [1],
          isOpen: false,
          subInterfaces: [
            { label: 'Mis Inconsistencias', link: '/mis-inconsistencias', permissions: [1, 15] },
            { label: 'Generar Inconsistencias', link: '/generar-inconsistencias', permissions: [1, 15] },
            { label: 'Aprobar Inconsistencias', link: '/aprobar-inconsistencias', permissions: [1, 7, 8, 9, 10, 11, 12, 13, 29, 30] },
            { label: 'Inconsistencias Cartera', link: '/cartera-inconsistencias', permissions: [1, 28] },
            { label: 'Histórico Inconsistencias', link: '/historico-inconsistencias', permissions: [1, 9, 55] },
            { label: 'Revisión de Consumo', link: '/revision-consumo', permissions: [1, 11] },
            { label: 'Dashboard Financiero', link: '/dashboard-financiero-inconsistencias', permissions: [1, 9] },
          ]
        },
        {
          label: 'Costeos y Muestras',
          icon: 'bi bi-calculator',
          permissions: [1],
          isOpen: false,
          subInterfaces: [
            { label: 'Costeos y Cotizaciones', link: '/costeos', permissions: [1] },
            { label: 'Muestras y Confección', link: '/muestras', permissions: [1] },
          ]
        },
      ]
    },

    /* ═══════════════════════════════════════════════════════
       ÁREA 2: COMERCIAL (Sin repetir la palabra "Comercial")
       ═══════════════════════════════════════════════════════ */
    {
      id: 'comercial',
      label: 'Comercial',
      icon: 'bi bi-briefcase',
      color: '#059669',
      modules: [
        {
          label: 'Clientes y Órdenes',
          icon: 'bi bi-people',
          modules: [7],
          permissions: [1, 37, 38, 59, 60],
          isOpen: true,
          subInterfaces: [
            { label: 'Directorio de Clientes', link: '/comerciales', permissions: [1, 37, 38, 59, 60] },
            { label: 'Captura y Escaneo de OC', link: '/comerciales/captura', permissions: [1, 37, 38, 59, 60] },
          ]
        },
        {
          label: 'Finanzas',
          icon: 'bi bi-pie-chart',
          permissions: [1],
          isOpen: false,
          subInterfaces: [
            { label: 'Centros de Costos', link: '/centros-costos', permissions: [1] },
          ]
        },
      ]
    },

    /* ═══════════════════════════════════════════════════════
       ÁREA 3: ABASTECIMIENTO
       ═══════════════════════════════════════════════════════ */
    {
      id: 'abastecimiento',
      label: 'Abastecimiento',
      icon: 'bi bi-boxes',
      color: '#D97706',
      modules: [
        {
          label: 'Inventario y Bodegas',
          icon: 'bi bi-building',
          modules: [5],
          permissions: [1, 25, 26, 27, 34, 54],
          isOpen: true,
          subInterfaces: [
            { label: 'Gestión de Zonas', link: '/inventario/gestion-zonas', permissions: [1, 27, 54] },
            { label: 'Gestión de Bodegas', link: '/inventario/gestion-bodegas', permissions: [1, 25, 26, 27, 54] },
            { label: 'Conteos Cíclicos', link: '/inventario/inventario-ciclico/ver', permissions: [1, 25, 26, 27, 54] },
            { label: 'Gestión de Inventarios', link: '/inventario/gestion-inventarios', permissions: [1, 27, 54] },
            { label: 'Realizar Conteo', link: '/inventario/conteo', permissions: [1, 25, 26, 34] },
            { label: 'Histórico de Movimientos', link: '/inventario/historico-movimientos', permissions: [1, 27, 54] },
          ]
        },
        {
          label: 'Materiales',
          icon: 'bi bi-box-seam',
          permissions: [1],
          isOpen: false,
          subInterfaces: [
            { label: 'Abastecimiento y Materiales', link: '/abastecimiento', permissions: [1] },
          ]
        },
      ]
    },

    /* ═══════════════════════════════════════════════════════
       ÁREA 4: RENUEVA (Sin repetir "Renueva" en el módulo)
       ═══════════════════════════════════════════════════════ */
    {
      id: 'renueva',
      label: 'Renueva',
      icon: 'bi bi-recycle',
      color: '#7C3AED',
      modules: [
        {
          label: 'Operaciones BigBag',
          icon: 'bi bi-bag-check',
          modules: [4],
          permissions: [1],
          isOpen: true,
          subInterfaces: [
            { label: 'Dashboard BigBag', link: '/dashboard-bigbag', permissions: [1, 23, 17] },
            { label: 'Ingreso a Planta', link: '/technical-report-bigbag', permissions: [1], modules: [4] },
            { label: 'Ver Llegada de Empaques', link: '/view-report-bigbag', permissions: [1], modules: [4] },
            { label: 'Precintos BigBag', link: '/view-precinto-bigbag', permissions: [1, 18] },
          ]
        },
      ]
    },

    /* ═══════════════════════════════════════════════════════
       ÁREA 5: CONTROL
       ═══════════════════════════════════════════════════════ */
    {
      id: 'control',
      label: 'Control',
      icon: 'bi bi-graph-up-arrow',
      color: '#0284C7',
      modules: [
        {
          label: 'Seguimiento de Proyectos',
          icon: 'bi bi-kanban',
          isOpen: true,
          subInterfaces: [
            { label: 'Gestión de Proyectos', link: '/seguimiento', modules: [8], permissions: [1] },
            { label: 'Seguimiento Financiero', link: '/seguimiento-proyectos/proyectos-activos', permissions: [1, 56, 57] },
            { label: 'Seguimiento Documentos', link: '/seguimiento-documentos', modules: [10], permissions: [1, 50, 51] },
          ]
        },
        {
          label: 'Firmas Digitales',
          icon: 'bi bi-pen',
          modules: [13],
          permissions: [1, 58],
          isOpen: false,
          subInterfaces: [
            { label: 'Panel de Firmas', link: '/firmas', modules: [13], permissions: [1, 58] },
          ]
        },
      ]
    },

    /* ═══════════════════════════════════════════════════════
       ÁREA 6: ADMINISTRACIÓN
       ═══════════════════════════════════════════════════════ */
    {
      id: 'administracion',
      label: 'Administración',
      icon: 'bi bi-shield-lock',
      color: '#DC2626',
      modules: [
        {
          label: 'Seguridad y Sistema',
          icon: 'bi bi-gear',
          permissions: [1],
          isOpen: true,
          subInterfaces: [
            { label: 'Administración de Seguridad', link: '/security', permissions: [1] },
            { label: 'Workflows Engine', link: '/workflows', permissions: [1] },
            { label: 'Logs de Correos', link: '/email-logs', permissions: [1] },
          ]
        },
      ]
    },
  ];
}
