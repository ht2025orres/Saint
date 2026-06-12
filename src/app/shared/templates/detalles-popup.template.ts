/**
 * ==========================================================================
 * TEMPLATE COMPARTIDO - Detalles de Inconsistencia (Popup)
 * ==========================================================================
 *
 * Este archivo centraliza la generación del HTML para la ventana emergente
 * (popup) que muestra los detalles completos de una inconsistencia.
 *
 * Es utilizado por los siguientes componentes:
 *   - AprobacionComponent (aprobacion)
 *   - CarteraInconsistenciasComponent (cartera-inconsistencias)
 *   - HistoricoComponent (historico)
 *   - MisInconsistenciasComponent (mis-inconsistencias)
 *
 * @module shared/templates/detalles-popup.template
 */

// ─── INTERFACES ────────────────────────────────────────────────────────────

/**
 * Opciones de configuración para personalizar el popup según el componente
 * que lo invoque. Permite activar/desactivar secciones opcionales.
 */
export interface DetallesPopupOpciones {
  /** Si es true, muestra la sección de anulación cuando la inconsistencia fue anulada */
  mostrarSeccionAnulacion?: boolean;
  /** Si es true, muestra el footer institucional al final del documento */
  mostrarFooter?: boolean;
  /** Si es true, muestra la sección de información económica (precio unitario, total, acción) */
  mostrarInfoEconomica?: boolean;
  /** Si es true, muestra los botones de acción (Aprobar/Rechazar/Espera) */
  mostrarBotonesAccion?: boolean;
}

// ─── FUNCIONES AUXILIARES ──────────────────────────────────────────────────

/**
 * Formatea un valor numérico a moneda colombiana (COP).
 * @param val - El valor numérico o string a formatear
 * @returns String formateado como moneda o 'N/A' si no hay valor
 */
function formatCurrency(val: any): string {
  return val
    ? Number(val).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
    : 'N/A';
}

/**
 * Escapa caracteres HTML especiales para prevenir inyección de código.
 * @param text - Texto a sanitizar
 * @returns Texto seguro para insertar en HTML
 */
function escapeHtml(text: string): string {
  if (!text) return 'N/A';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Formatea una fecha ISO a formato legible en español colombiano.
 * @param fecha - Fecha en formato ISO string
 * @returns Fecha formateada (ej: "4 jun. 2026") o 'N/A'
 */
function formatearFecha(fecha: string): string {
  if (!fecha) return 'N/A';
  return new Date(fecha).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

// ─── SECCIONES HTML REUTILIZABLES ──────────────────────────────────────────

/**
 * Genera el encabezado con los 4 logos institucionales.
 */
function getCabeceraLogosHtml(): string {
  return `
    <div style="padding:18px 24px;border-bottom:1px solid #D0D0D0;background:#ffffff;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <td style="text-align:center;padding:0 8px;border-right:1px solid #d2d2d2;">
                    <img src="https://colegioprovidencia.edu.co/Sdp/app/assets/img/colegio.png" alt="Colegio" style="display:block;margin:0 auto;max-width:100%;width:120px;height:auto;">
                </td>
                <td style="text-align:center;padding:0 8px;border-right:1px solid #d2d2d2;">
                    <img src="https://colegioprovidencia.edu.co/Sdp/app/assets/img/protejer.png" alt="Protejer" style="display:block;margin:0 auto;max-width:100%;width:120px;height:auto;">
                </td>
                <td style="text-align:center;padding:0 8px;border-right:1px solid #d2d2d2;">
                    <img src="https://colegioprovidencia.edu.co/Sdp/app/assets/img/renueva.png" alt="Renueva" style="display:block;margin:0 auto;max-width:100%;width:120px;height:auto;">
                </td>
                <td style="text-align:center;padding:0 8px;">
                    <img src="https://colegioprovidencia.edu.co/Sdp/app/assets/img/formacion.png" alt="Formación" style="display:block;margin:0 auto;max-width:100%;width:120px;height:auto;">
                </td>
            </tr>
        </table>
    </div>`;
}

/**
 * Genera la sección de información de anulación (solo se muestra si la
 * inconsistencia fue anulada).
 * @param inconsistencia - Datos de la inconsistencia
 */
function getSeccionAnulacionHtml(inconsistencia: any): string {
  const esAnulada = inconsistencia.estado_inconsistencia === 'anulado'
    || inconsistencia.es_anulada
    || inconsistencia.fecha_anulacion;

  if (!esAnulada) return '';

  return `
    <div style="display:inline-block;border-left:3px solid #DC2626;padding:4px 10px;margin-bottom:14px;">
        <span style="font-size:11px;font-weight:600;color:#991B1B;letter-spacing:0.07em;text-transform:uppercase;">
            Información de Anulación
        </span>
    </div>
    <table width="100%" cellpadding="8" cellspacing="0" border="1" style="border-collapse: collapse; border-color: #FECACA; font-size:12px; width:100%; background:#FEF2F2; margin-bottom: 20px;">
      <tbody>
        <tr>
          <td width="25%" style="font-weight:600; color:#991B1B;">Anulada por:</td>
          <td width="75%" style="color:#991B1B;">${escapeHtml(inconsistencia.anulado_por || inconsistencia.nombre_persona_que_anulo || 'Usuario')}</td>
        </tr>
        <tr>
          <td style="font-weight:600; color:#991B1B;">Motivo:</td>
          <td style="color:#991B1B;">${escapeHtml(inconsistencia.razon_anulacion)}</td>
        </tr>
      </tbody>
    </table>`;
}

/**
 * Genera el footer institucional del documento.
 */
function getFooterHtml(): string {
  return `
    <div style="background-color:#002A3F;padding:14px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <td style="font-size:11px;color:rgba(255,255,255,0.45);font-weight:300;">
                    © ${new Date().getFullYear()} Centro de Formación Integral Providencia
                </td>
                <td style="text-align:right;font-size:11px;color:rgba(255,255,255,0.35);font-weight:300;">
                    Documento Electrónico
                </td>
            </tr>
        </table>
    </div>`;
}

// ─── FUNCIÓN PRINCIPAL ─────────────────────────────────────────────────────

/**
 * Genera el HTML completo para la ventana emergente de detalles de una
 * inconsistencia. Es la función principal que consumen todos los componentes.
 *
 * @param inconsistencia   - Objeto con todos los datos de la inconsistencia
 * @param tiemposHtml      - HTML pre-renderizado con la tabla de tiempos del proceso
 * @param evidenciasHtml   - HTML pre-renderizado con las imágenes/archivos de evidencia
 * @param botonesAccionHtml - HTML pre-renderizado con los botones de acción (Aprobar, Rechazar, etc.)
 *                           Los botones deben referenciar `window.opener.aprobarDesdePopup(id, accionInput)`
 *                           para poder leer el textarea de acción embebido en el popup.
 * @param tipos_inco       - Mapa de códigos de tipo de inconsistencia a nombres legibles
 * @param traducirEtapa    - Función que convierte el código de etapa a nombre legible
 * @param opciones         - Opciones de configuración para personalizar secciones del popup
 * @returns String con el documento HTML completo listo para escribir en un window.open()
 */
export function getDetallesHtml(
  inconsistencia: any,
  tiemposHtml: string,
  evidenciasHtml: string,
  botonesAccionHtml: string,
  tipos_inco: any,
  traducirEtapa: (etapa: string) => string,
  opciones: DetallesPopupOpciones = {}
): string {
  // Opciones por defecto: mostrar económica y botones, no mostrar anulación ni footer
  const {
    mostrarSeccionAnulacion = false,
    mostrarFooter = false,
    mostrarInfoEconomica = true,
    mostrarBotonesAccion = true
  } = opciones;

  // Resolver el nombre del solicitante (varía según el componente que envía los datos)
  const nombreSolicitante = inconsistencia.solicitante
    || inconsistencia.nombre_solicitante
    || 'N/A';

  // Resolver el nombre del cliente (varía entre 'Cliente' y 'cliente')
  const nombreCliente = inconsistencia.Cliente
    || inconsistencia.cliente
    || 'N/A';

  // ── Sección: Información Económica + Acción (con textarea editable si no hay acción) ──
  const tieneAccion = inconsistencia.accion_inconsistencia && inconsistencia.accion_inconsistencia.trim() !== '';
  const esEtapaCalidad = inconsistencia.etapa === 'calidad';
  const esContabilidad = inconsistencia.tipo_inconsistencia === 'documental_contabilidad'
    || (inconsistencia.tipo_inconsistencia || '').toLowerCase().includes('contabilidad');

  // Si la inconsistencia está en calidad y no tiene acción, mostramos un textarea editable
  // para que calidad pueda ingresar la acción directamente en el popup sin abrir un Swal extra
  const campoAccionHtml = tieneAccion
    ? `<td colspan="3">${inconsistencia.accion_inconsistencia}</td>`
    : esEtapaCalidad
      ? `<td colspan="3">
           <textarea
             id="accion-inconsistencia-popup"
             style="width:100%;min-height:80px;border:1px solid #CBD5E1;border-radius:4px;padding:8px;font-size:12px;resize:vertical;"
             placeholder="Describe la acción correctiva o preventiva a implementar..."
           ></textarea>
           <small style="color:#64748b; font-size:11px;">⚠️ Campo obligatorio para aprobar</small>
         </td>`
      : `<td colspan="3" style="color:#94a3b8; font-style:italic;">No especificada.</td>`;

  // Fila de Nota Crédito: solo visible en inconsistencias de tipo contabilidad
  const notaCreditoFila = esContabilidad ? `
                <tr>
                  <td style="background:#F8FAFC; font-weight:600; color:#1e40af;">🧾 Nota Crédito:</td>
                  <td colspan="3" style="font-weight:600; color:#1e40af;">
                    ${inconsistencia.nota_credito
                      ? inconsistencia.nota_credito
                      : '<span style="color:#94a3b8; font-style:italic;">Pendiente de aprobación por Cartera</span>'}
                  </td>
                </tr>` : '';

  const infoEconomicaHtml = mostrarInfoEconomica ? `
            <div style="display:inline-block;border-left:3px solid #72BE44;padding:4px 10px;margin-bottom:14px;">
                <span style="font-size:11px;font-weight:600;color:#002A3F;letter-spacing:0.07em;text-transform:uppercase;">
                    Información Económica y Acción
                </span>
            </div>
            <table width="100%" cellpadding="8" cellspacing="0" border="1" style="border-collapse: collapse; border-color: #E2E8F0; font-size:12px; width:100%; margin-bottom: 20px;">
              <tbody>
                <tr>
                  <td width="20%" style="background:#F8FAFC; font-weight:600;">Precio Unitario:</td>
                  <td width="30%">${formatCurrency(inconsistencia.precio_unitario)}</td>
                  <td width="20%" style="background:#F8FAFC; font-weight:600;">Total Inconsistencia:</td>
                  <td width="30%" style="font-weight:600; color:#d32f2f;">${formatCurrency(inconsistencia.precio_total_inconsistencia)}</td>
                </tr>
                <tr>
                  <td style="background:#F8FAFC; font-weight:600;">Acción a Tomar:</td>
                  ${campoAccionHtml}
                </tr>
                ${notaCreditoFila}
              </tbody>
            </table>` : '';


  // ── Sección: Anulación (opcional) ──
  const anulacionHtml = mostrarSeccionAnulacion ? getSeccionAnulacionHtml(inconsistencia) : '';

  // ── Sección: Footer (opcional) ──
  const footerHtml = mostrarFooter ? getFooterHtml() : '';

  // ── Sección: Botones de acción (opcional) ──
  const botonesHtml = mostrarBotonesAccion ? botonesAccionHtml : '';

  // ── Documento HTML completo ──
  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Detalles de Inconsistencia #${inconsistencia.id_inconsistencia || inconsistencia.id}</title>
</head>
<body style="margin:0;padding:0;background-color:#EAEAEA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="background-color:#EAEAEA;padding:32px 16px;">
    <div style="max-width:800px;margin:0 auto;background:#ffffff;border:1px solid #C8C8C8;">

        <!-- CABECERA: Logos institucionales -->
        ${getCabeceraLogosHtml()}

        <!-- TÍTULO: Nombre de la institución -->
        <div style="padding:14px 24px;text-align:center;border-bottom:1px solid #d2d2d2;">
            <span style="font-size:15px;font-weight:700;color:#000;letter-spacing:0.06em;text-transform:uppercase;">
                Centro de Formación Integral Providencia
            </span>
        </div>
        <div style="padding:9px 24px;text-align:center;">
            <span style="font-size:12px;font-weight:600;color:#333531;letter-spacing:0.08em;text-transform:uppercase;">
                Reporte de Inconsistencia #${inconsistencia.id_inconsistencia || inconsistencia.id}
            </span>
        </div>

        <!-- CUERPO: Contenido principal del reporte -->
        <div style="padding:24px;">

            <!-- Sección: Detalles Generales -->
            <div style="display:inline-block;border-left:3px solid #72BE44;padding:4px 10px;margin-bottom:14px;">
                <span style="font-size:11px;font-weight:600;color:#002A3F;letter-spacing:0.07em;text-transform:uppercase;">
                    Detalles Generales
                </span>
            </div>
            <table width="100%" cellpadding="8" cellspacing="0" border="1" style="border-collapse: collapse; border-color: #E2E8F0; font-size:12px; width:100%; margin-bottom: 20px;">
              <tbody>
                <tr>
                  <td width="20%" style="background:#F8FAFC; font-weight:600;">Fecha:</td>
                  <td width="30%">${formatearFecha(inconsistencia.fecha_inconsistencia)}</td>
                  <td width="20%" style="background:#F8FAFC; font-weight:600;">Cliente:</td>
                  <td width="30%">${escapeHtml(nombreCliente)}</td>
                </tr>
                <tr>
                  <td style="background:#F8FAFC; font-weight:600;">Proceso:</td>
                  <td>${traducirEtapa(inconsistencia.etapa) || inconsistencia.etapa || 'N/A'}</td>
                  <td style="background:#F8FAFC; font-weight:600;">Consecutivo:</td>
                  <td>${inconsistencia.id_inconsistencia || inconsistencia.id}</td>
                </tr>
                <tr>
                  <td style="background:#F8FAFC; font-weight:600;">Nombre Solicitante:</td>
                  <td colspan="3">${escapeHtml(nombreSolicitante)}</td>
                </tr>
              </tbody>
            </table>

            <!-- Sección: Detalles de la Inconsistencia -->
            <div style="display:inline-block;border-left:3px solid #72BE44;padding:4px 10px;margin-bottom:14px;">
                <span style="font-size:11px;font-weight:600;color:#002A3F;letter-spacing:0.07em;text-transform:uppercase;">
                    Detalles de la Inconsistencia
                </span>
            </div>
            <table width="100%" cellpadding="8" cellspacing="0" border="1" style="border-collapse: collapse; border-color: #E2E8F0; font-size:12px; width:100%; text-align:center; margin-bottom: 20px;">
              <thead style="background:#F8FAFC;">
                <tr>
                  <th style="font-weight:600; padding:8px;">Tipo</th>
                  <th style="font-weight:600; padding:8px; width:10%;">Cant. Sol.</th>
                  <th style="font-weight:600; padding:8px; width:10%;">Cant. Inc.</th>
                  <th style="font-weight:600; padding:8px; width:40%;">Descripción Ítem</th>
                  <th style="font-weight:600; padding:8px; width:15%;">Orden</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:8px;">${tipos_inco[inconsistencia.tipo_inconsistencia] || inconsistencia.tipo_inconsistencia || 'N/A'}</td>
                  <td style="padding:8px;">${inconsistencia.cantidad_solicitada_op || '0'}</td>
                  <td style="padding:8px; color:#d32f2f; font-weight:bold;">${inconsistencia.cantidad_inconsistencia || '0'}</td>
                  <td style="padding:8px;">${escapeHtml(inconsistencia.item || 'N/A')}</td>
                  <td style="padding:8px;">${escapeHtml(inconsistencia.tipo_de_orden || 'N/A')} <br> <span style="font-size:10px; color:#666;">${inconsistencia.estado_orden || ''}</span></td>
                </tr>
              </tbody>
            </table>

            <!-- Sección: Descripción de la Situación -->
            <div style="display:inline-block;border-left:3px solid #72BE44;padding:4px 10px;margin-bottom:14px;">
                <span style="font-size:11px;font-weight:600;color:#002A3F;letter-spacing:0.07em;text-transform:uppercase;">
                    Descripción de la Situación
                </span>
            </div>
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:4px; padding:16px; font-size:12px; color:#333; margin-bottom:20px; min-height:80px;">
                ${escapeHtml(inconsistencia.descripcion_inconsistencia || 'No se proporcionó una descripción.')}
            </div>

            <!-- Sección: Información Económica y Acción (condicional) -->
            ${infoEconomicaHtml}

            <!-- Sección: Tiempos del Proceso -->
            <div style="display:inline-block;border-left:3px solid #72BE44;padding:4px 10px;margin-bottom:14px;margin-top:10px;">
                <span style="font-size:11px;font-weight:600;color:#002A3F;letter-spacing:0.07em;text-transform:uppercase;">
                    Tiempos del Proceso
                </span>
            </div>
            <div style="margin-bottom:20px;">
              ${tiemposHtml}
            </div>

            <!-- Sección: Información de Anulación (condicional) -->
            ${anulacionHtml}

            <!-- Sección: Evidencias Adjuntas -->
            <div style="display:inline-block;border-left:3px solid #72BE44;padding:4px 10px;margin-bottom:14px;">
                <span style="font-size:11px;font-weight:600;color:#002A3F;letter-spacing:0.07em;text-transform:uppercase;">
                    Evidencias
                </span>
            </div>
            <div style="border:1px solid #E2E8F0; padding:12px; font-size:12px; border-radius:4px; background:#FAFAFA; margin-bottom: 20px;">
              ${evidenciasHtml}
            </div>

            <!-- Sección: Botones de Acción (condicional) -->
            ${botonesHtml}
        </div>

        <!-- FOOTER: Pie institucional (condicional) -->
        ${footerHtml}

    </div>
</div>
</body>
</html>
  `;
}

// ─── FUNCIONES AUXILIARES PARA TIEMPOS Y EVIDENCIAS ────────────────────────

/**
 * Genera el HTML de la tabla de tiempos del proceso a partir de la
 * respuesta del servicio `obtenerTiemposProceso`.
 *
 * @param res             - Respuesta del backend con los tiempos
 * @param traducirEtapa   - Función para traducir códigos de etapa a nombres legibles
 * @returns HTML string con la tabla de tiempos o un mensaje si no hay tiempos
 */
export function generarTiemposHtml(
  res: any,
  traducirEtapa: (etapa: string) => string
): string {
  let tiemposHtml = '<p style="color:#888; font-size:13px; font-style:italic;">No se registraron tiempos.</p>';

  if (res.tiempos) {
    const debugInco = res.debug_inco || {};
    let rows = '';
    let index = 1;

    Object.entries(res.tiempos)
      .filter(([key]) => key !== 'total' && key !== 'finalizacion')
      .forEach(([etapa, tiempo]: [string, any]) => {
        if (tiempo) {
          // Determinar el campo del responsable según la etapa
          const nombreCampo = etapa === 'finalizacion' ? 'nombre_consumo' : `nombre_${etapa}`;
          const responsable = debugInco[nombreCampo] || 'Sin asignar';

          // Formatear la duración en días/horas/minutos
          const duracionStr = tiempo.dias
            ? `${Math.floor(tiempo.dias)}d ${tiempo.horas}h ${tiempo.minutos}m`
            : `${tiempo.horas || 0}h ${tiempo.minutos || 0}m`;

          rows += `
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">${index++}</td>
              <td style="padding:8px; border-bottom:1px solid #eee;">${traducirEtapa(etapa)}</td>
              <td style="padding:8px; border-bottom:1px solid #eee;">${responsable}</td>
              <td style="padding:8px; border-bottom:1px solid #eee; color:#000; font-weight:500;">${duracionStr}</td>
            </tr>
          `;
        }
      });

    if (rows) {
      tiemposHtml = `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:12px; width:100%; text-align:center; border:1px solid #E2E8F0;">
          <thead style="background:#F8FAFC;">
            <tr>
              <th style="font-weight:600; padding:8px; width:50px; border-bottom:1px solid #E2E8F0;">#</th>
              <th style="font-weight:600; padding:8px; border-bottom:1px solid #E2E8F0;">Etapa</th>
              <th style="font-weight:600; padding:8px; border-bottom:1px solid #E2E8F0;">Responsable</th>
              <th style="font-weight:600; padding:8px; border-bottom:1px solid #E2E8F0;">Duración</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }
  }

  return tiemposHtml;
}

/**
 * Genera el HTML de la sección de evidencias a partir de un array de URLs.
 * Diferencia entre imágenes (las muestra inline) y otros archivos (muestra un botón de descarga).
 *
 * @param archivos - Array de URLs de las evidencias
 * @returns HTML string con las evidencias renderizadas
 */
export function generarEvidenciasHtml(archivos: string[]): string {
  if (!archivos || archivos.length === 0) {
    return '<p style="color:#888; font-size:13px; font-style:italic; text-align:center;">No hay evidencias adjuntas.</p>';
  }

  return archivos.map((url: string, i: number) => {
    const ext = url.split('.').pop()?.toLowerCase();

    // Si es una imagen, mostrarla directamente
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return `<div style="text-align: center; margin-bottom: 10px;">
                <span style="display:block;font-size:12px;color:#888;">Evidencia ${i + 1}</span>
                <img src="${url}" style="max-width:100%; max-height: 400px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer;" onclick="window.open('${url}', '_blank')">
              </div>`;
    }

    // Para otros tipos de archivo, mostrar un botón de descarga
    return `<div style="margin-bottom: 10px;">
              <a href="${url}" target="_blank" style="background:#72BE44; color:white; padding: 6px 12px; text-decoration:none; border-radius: 4px; font-size:12px; display:inline-block;">Abrir Archivo Adjunto ${i + 1}</a>
            </div>`;
  }).join('');
}

/**
 * Genera el HTML premium para el Swal (SweetAlert2) de visualización de evidencias.
 * Diferencia imágenes (con preview), PDFs y otros archivos con diseño enriquecido.
 * Esta función centraliza el HTML que antes estaba disperso en los componentes .ts.
 *
 * @param archivos - Array de URLs de las evidencias
 * @returns HTML string completo para insertar en el `html` del Swal.fire()
 */
export function generarEvidenciasSwalHtml(archivos: string[]): string {
  if (!archivos || archivos.length === 0) {
    return '<p style="color:#888; font-size:13px; font-style:italic; text-align:center;">Esta inconsistencia no tiene evidencias adjuntas.</p>';
  }

  const items = archivos.map((url: string, index: number) => {
    const extension = url.split('.').pop()?.toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return `
        <div style="
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: #ffffff;
          border-radius: 0.5rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        " onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';"
           onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';">
          <p style="margin:0 0 0.75rem 0; font-size:0.875rem; font-weight:600; color:#64748b; text-align:center;">
            Evidencia ${index + 1}
          </p>
          <img src="${url}"
               alt="Evidencia ${index + 1}"
               style="max-width:100%; max-height:60vh; width:auto; height:auto; cursor:pointer; border-radius:0.375rem; display:block; margin:0 auto;"
               onclick="window.open('${url}', '_blank')"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div style="display:none; text-align:center; padding:1rem; color:#ef4444;">
            <p style="margin:0;">Error al cargar la imagen</p>
            <a href="${url}" target="_blank" style="color:#3b82f6; text-decoration:underline; margin-top:0.5rem; display:inline-block;">Abrir en nueva pestaña</a>
          </div>
        </div>`;
    }

    if (extension === 'pdf') {
      return `
        <div style="
          margin-bottom: 1rem; padding: 1.25rem;
          background: #fef2f2; border-radius: 0.5rem;
          text-align: center; border: 1px solid #fecaca;
        ">
          <p style="margin:0 0 1rem 0; font-size:0.875rem; font-weight:600; color:#991b1b;">Documento PDF</p>
          <a href="${url}" target="_blank" style="
            display:inline-flex; align-items:center; gap:0.5rem;
            padding:0.75rem 1.5rem; background:#dc2626; color:white;
            text-decoration:none; border-radius:0.375rem; font-weight:600;"
            onmouseover="this.style.background='#b91c1c';" onmouseout="this.style.background='#dc2626';">
            <i class="fas fa-file-pdf" style="font-size:1.125rem;"></i>
            <span>Abrir PDF ${index + 1}</span>
          </a>
        </div>`;
    }

    return `
      <div style="
        margin-bottom: 1rem; padding: 1.25rem;
        background: #f8fafc; border-radius: 0.5rem;
        text-align: center; border: 1px solid #e2e8f0;
      ">
        <p style="margin:0 0 1rem 0; font-size:0.875rem; font-weight:600; color:#475569;">Archivo adjunto</p>
        <a href="${url}" target="_blank" style="
          display:inline-flex; align-items:center; gap:0.5rem;
          padding:0.75rem 1.5rem; background:#64748b; color:white;
          text-decoration:none; border-radius:0.375rem; font-weight:600;"
          onmouseover="this.style.background='#475569';" onmouseout="this.style.background='#64748b';">
          <i class="fas fa-file" style="font-size:1.125rem;"></i>
          <span>Abrir archivo ${index + 1}</span>
        </a>
      </div>`;
  }).join('');

  return `<div style="max-height:70vh; overflow-y:auto; padding:0.5rem; text-align:center;">${items}</div>`;
}

/**
 * Genera el HTML del formulario para registrar consumo en SweetAlert.
 *
 * @returns HTML string con el formulario
 */
export function getConsumoFormHtml(): string {
  return `
    <div class="swal-custom-form">
      <div class="mb-3">
        <label for="tipo-consumo" class="form-label fw-bold">Tipo de consumo:</label>
        <select id="tipo-consumo" class="form-select">
          <option value="">Selecciona una opción</option>
          <option value="consumo">Consumo</option>
          <option value="gasto">Gasto</option>
          <option value="devolucion">Devolución</option>
        </select>
      </div>
      
      <!-- Container para Devolución y Gasto (un solo input) -->
      <div id="codigo-simple-container" class="mb-3" style="display: none;">
        <label id="codigo-simple-label" class="form-label fw-bold">Código:</label>
        <input 
          type="text" 
          id="codigo-simple" 
          class="form-control" 
          placeholder="Ingresa el código"
        />
        <small id="codigo-simple-hint" class="form-text text-muted"></small>
      </div>

      <!-- Container para Consumo (dos inputs) -->
      <div id="codigo-consumo-container" style="display: none;">
        <div class="mb-3">
          <label for="codigo-trn" class="form-label fw-bold">Código TRN:</label>
          <input 
            type="text" 
            id="codigo-trn" 
            class="form-control" 
            placeholder="Ej: TRN-12345"
          />
          <small class="form-text text-muted">Ingresa el código de transferencia</small>
        </div>
        <div class="mb-3">
          <label for="codigo-consumo" class="form-label fw-bold">Código de Consumo:</label>
          <input 
            type="text" 
            id="codigo-consumo" 
            class="form-control" 
            placeholder="Ej: CONS-12345"
          />
          <small class="form-text text-muted">Ingresa el código de consumo</small>
        </div>
      </div>
    </div>
  `;
}

/**
 * Genera el HTML para la confirmación de consumo.
 * 
 * @param datos - Datos del consumo a confirmar
 * @param tipoTexto - Texto a mostrar para el tipo de consumo
 * @returns HTML string de confirmación
 */
export function getConfirmacionConsumoHtml(datos: any, tipoTexto: string): string {
  let codigosHtml = '';
  if (datos.tipo === 'consumo') {
    codigosHtml = `
      <p><strong>Código TRN:</strong> ${datos.codigoTrn}</p>
      <p><strong>Código Consumo:</strong> ${datos.codigoConsumo}</p>
    `;
  } else {
    codigosHtml = `<p><strong>Código:</strong> ${datos.codigo}</p>`;
  }

  return `
    <div class="text-start">
      <p><strong>Tipo:</strong> ${tipoTexto}</p>
      ${codigosHtml}
    </div>
  `;
}
