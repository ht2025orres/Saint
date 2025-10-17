// models/RecepcionData.model.ts

/**
 * Interface para definir la estructura de datos completos de recepción
 */
export interface RecepcionCompleta {
  id_reporte_llegada_empaque: number
  num_recepcion: string | number;
  fecha_ingreso: string;
  hora_llegada: string;
  planta: string;
  num_remision: string ;
  cliente: string ;
  cant_relacionada: number;
  cantidad_fisico: number;
  diferencia_reportada: string;
  estado?: string;
  timestamp: number;
}

export class RecepcionData {
  private static readonly STORAGE_KEY = 'recepcion_seleccionada';

  /**
   * Guarda el número de recepción en localStorage
   * @param numRecepcion - Número de recepción a guardar
   */
  static setNumRecepcion(numRecepcion: string | number): void {
    try {
      if (numRecepcion !== null && numRecepcion !== undefined) {
        localStorage.setItem(this.STORAGE_KEY, numRecepcion.toString());
        console.log('Número de recepción guardado:', numRecepcion);
      }
    } catch (error) {
      console.error('Error al guardar número de recepción:', error);
    }
  }

  /**
   * Obtiene el número de recepción desde localStorage
   * @returns El número de recepción o null si no existe
   */
  static getNumRecepcion(): string | null {
    try {
      const numRecepcion = localStorage.getItem(this.STORAGE_KEY);
      console.log('Número de recepción recuperado:', numRecepcion);
      return numRecepcion;
    } catch (error) {
      console.error('Error al obtener número de recepción:', error);
      return null;
    }
  }

  /**
   * Elimina el número de recepción del localStorage
   */
  static clearNumRecepcion(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('Número de recepción eliminado del localStorage');
    } catch (error) {
      console.error('Error al eliminar número de recepción:', error);
    }
  }

  /**
   * Verifica si existe un número de recepción guardado
   * @returns true si existe, false si no
   */
  static hasNumRecepcion(): boolean {
    try {
      const numRecepcion = localStorage.getItem(this.STORAGE_KEY);
      return numRecepcion !== null && numRecepcion !== undefined && numRecepcion.trim() !== '';
    } catch (error) {
      console.error('Error al verificar número de recepción:', error);
      return false;
    }
  }

  /**
   * Guarda datos completos de la recepción
   * @param data - Objeto con todos los datos de la recepción
   */
  static setRecepcionData(data: RecepcionCompleta): void {
    try {
      const dataKey = `${this.STORAGE_KEY}_data`;
      localStorage.setItem(dataKey, JSON.stringify(data));
      console.log('Datos completos de recepción guardados:', data);
    } catch (error) {
      console.error('Error al guardar datos de recepción:', error);
    }
  }

  /**
   * Obtiene datos completos de la recepción
   * @returns Los datos completos de recepción o null si no existen
   */
  static getRecepcionData(): RecepcionCompleta | null {
    try {
      const dataKey = `${this.STORAGE_KEY}_data`;
      const data = localStorage.getItem(dataKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error al obtener datos de recepción:', error);
      return null;
    }
  }

  /**
   * Limpia todos los datos relacionados con la recepción
   */
  static clearAll(): void {
    try {
      this.clearNumRecepcion();
      const dataKey = `${this.STORAGE_KEY}_data`;
      localStorage.removeItem(dataKey);
      console.log('Todos los datos de recepción eliminados');
    } catch (error) {
      console.error('Error al limpiar datos de recepción:', error);
    }
  }
}


