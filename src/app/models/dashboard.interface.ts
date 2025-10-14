// models/dashboard.interface.ts
export interface DashboardFilters {
  start?: string;
  end?: string;
  cliente?: string;
  limit?: number;
}

export interface DashboardResponse {
  success: boolean;
  data: {
    overview: {
      total_reportes: number;
      total_empaques: number;
      total_precintos: number;
      clientes_unicos: number;
      dias_con_recepcion: number;
      ultima_actualizacion: string;
    };
    estados: Array<{
      estado: string;
      total: number;
    }>;
    clientes: string[];
    top_clientes: Array<{
      cliente: string;
      total_empaques: number;
    }>;
    por_fecha: Array<{
      fecha_ingreso: string;
      total_empaques: number;
      total_reportes: number;
    }>;
    precintosColor: Array<{
      color: string;
      total_precintos: number;
    }>;
    range: {
      start: string;
      end: string;
    };
  };
  error?: string;
}