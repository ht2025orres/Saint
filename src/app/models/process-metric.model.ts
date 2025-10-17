// src/app/models/process-metric.model.ts
export interface ProcessMetric {
  proceso: string;        // Nombre del proceso (Producción, Terminación, Empaque, etc.)
  icono: string;          // Ícono fontawesome
  color: string;          // Color principal
  entrada?: number;       // Prendas o unidades recibidas
  salida?: number;        // Prendas o unidades despachadas
  porcentajeAvance?: number; // Salida / Entrada * 100
}
