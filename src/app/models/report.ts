export interface Report {
  id: number;
  origen: 'calidad' | 'produccion';
  tipo_reporte: 'FT DESCRIPCION' | 'FT FOTO' | 'FT TALLA' | 'patronaje';
  op_reporte: string;
  cliente: string;
  item: string;
  prenda: string;
  observacion?: string;
  evidencia?: string;
  estado: string;
  prioridad?: 'alta' | 'media' | 'baja';
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  creado_por?: number;
  creador_nombre?: string;
  liberado_por?: number | null;
  actualizado_por?: number | null;
  fecha_respuesta?: string | null;
  respuesta?: string | null;
}
