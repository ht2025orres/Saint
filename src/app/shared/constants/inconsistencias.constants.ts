/**
 * Diccionario unificado de tipos de inconsistencia para todo el sistema Saint.
 * Fuente única de verdad: si se agrega o elimina un tipo aquí, se refleja en toda la aplicación.
 */
export const TIPOS_INCONSISTENCIA: Record<string, string> = {
  'ajuste_promedio': 'Ajuste de Promedio',
  'aprovechamiento_insumos': 'Aprovechamiento de Insumos',
  'cancelacion_pedido': 'Cancelación de Pedido',
  'dano_maquina': 'Daño por Máquina',
  'devolucion_materiales': 'Devolución de Materiales',
  'documental_calidad': 'Documental Calidad',
  'documental_contabilidad': 'Documental Contabilidad',
  'empate_tendido': 'Empate de Tendido en Corte',
  'error_bordado': 'Error de Bordado',
  'error_corte': 'Error de Corte',
  'error_operario': 'Error de Operario',
  'error_patronaje': 'Error en Patronaje',
  'faltante_lista_materiales': 'Faltante en Lista de Materiales',
  'faltante_materiales': 'Faltante en Cantidad',
  'faltante_rollo': 'Faltante en Rollo de Tela',
  'imperfeccion_tela': 'Imperfecto en Tela',
  'insumo_dano_tela': 'Insumo por Daño en Tela',
  'insumo_imperfecto': 'Insumo Imperfecto',
  'montaje_modulo': 'Montaje de Módulo',
  'perdida_insumos': 'Pérdida de Insumo en Planta',
  'perdida_piezas': 'Pérdida de Piezas en Corte',
  'prenda_imperfectos': 'Prenda con Imperfectos',
  'reposicion_produccion': 'Reposición por Producción',
  'retal_incompleto': 'Retal Incompleto',
  'sobrante_tela': 'Sobrante en Rollo de Tela',
  'tonalidad_en_tela': 'Tonalidad en Tela',
  'validacion_homologo': 'Validación Homólogo',
  'validacion_reproceso': 'Validación Reproceso'
};

/**
 * Obtiene el nombre legible de un tipo de inconsistencia.
 * Si el tipo no existe en el diccionario, retorna la misma clave o string vacío.
 */
export function getNombreInconsistencia(key: string | null | undefined): string {
  if (!key) return '';
  return TIPOS_INCONSISTENCIA[key] || key;
}

/**
 * Retorna la lista completa de tipos formateada para dropdowns / selects.
 */
export function getTiposInconsistenciaOpciones(): { value: string; label: string }[] {
  return Object.keys(TIPOS_INCONSISTENCIA).map(key => ({
    value: key,
    label: TIPOS_INCONSISTENCIA[key]
  }));
}

