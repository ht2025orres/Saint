/**
 * ==========================================================================
 * TEMPLATE COMPARTIDO - Detalles de Orden de Compra (Ventana Emergente / Popup)
 * ==========================================================================
 *
 * Genera el documento HTML completo para la ventana emergente flotante del
 * navegador al ver los detalles de una Orden de Compra (OC).
 *
 * @module shared/templates/orden-compra-popup.template
 */

export interface OrdenCompraPopupData {
  id: number;
  numero_orden: string;
  cliente: string;
  pv_asociado?: string | null;
  estado: string;
  fecha_registro?: string;
  created_at?: string;
  fecha_recepcion?: string;
  fecha_entrega_estimada?: string;
  dias_entrega?: number | string;
  usuario_creacion?: string;
  usuario_registro?: string;
  observaciones?: string;
  archivo_url?: string;
  items?: Array<{
    codigo_item?: string;
    referencia?: string;
    descripcion: string;
    cantidad: number;
    precio_unitario?: number;
    precio_total?: number;
    unidad_medida?: string;
  }>;
}

function formatCurrency(val: any): string {
  if (val === null || val === undefined || isNaN(Number(val))) return '$0';
  return Number(val).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '—';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function formatearFecha(fechaStr?: string | null): string {
  if (!fechaStr) return 'N/A';
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return String(fechaStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(fechaStr);
  }
}

function calcularDiasRestantesInfo(fechaEntrega?: string | null): { texto: string; bg: string; color: string; border: string } {
  if (!fechaEntrega) return { texto: 'N/A', bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const entrega = new Date(fechaEntrega);
  entrega.setHours(0, 0, 0, 0);
  const diffMs = entrega.getTime() - hoy.getTime();
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (dias < 0) {
    const abs = Math.abs(dias);
    return {
      texto: `⚠️ Vencida hace ${abs} día${abs !== 1 ? 's' : ''}`,
      bg: '#FEF2F2',
      color: '#DC2626',
      border: '#FECACA'
    };
  } else if (dias === 0) {
    return {
      texto: '⏳ Entrega hoy',
      bg: '#FFFBEB',
      color: '#D97706',
      border: '#FDE68A'
    };
  } else if (dias <= 3) {
    return {
      texto: `⏰ ${dias} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`,
      bg: '#FFFBEB',
      color: '#D97706',
      border: '#FDE68A'
    };
  } else {
    return {
      texto: `✅ ${dias} días restantes`,
      bg: '#F0FDF4',
      color: '#16A34A',
      border: '#BBF7D0'
    };
  }
}

export function generarHtmlDetalleOrdenCompra(orden: OrdenCompraPopupData, items: any[] = []): string {
  const listaItems = items.length > 0 ? items : (orden.items || []);
  const estado = (orden.estado || 'PENDIENTE').toUpperCase();

  const estadoBadgeMap: Record<string, { bg: string; color: string; label: string }> = {
    'PENDIENTE': { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
    'PROCESADA': { bg: '#D1FAE5', color: '#065F46', label: 'Procesada' },
    'RECHAZADA': { bg: '#FEE2E2', color: '#991B1B', label: 'Rechazada' }
  };
  const badgeInfo = estadoBadgeMap[estado] || { bg: '#F3F4F6', color: '#374151', label: estado };

  const fechaReg = formatearFecha(orden.created_at || orden.fecha_registro);
  const fechaRec = formatearFecha(orden.fecha_recepcion);
  const fechaEnt = formatearFecha(orden.fecha_entrega_estimada);
  const diasInfo = calcularDiasRestantesInfo(orden.fecha_entrega_estimada);
  const registradoPor = escapeHtml(orden.usuario_creacion || orden.usuario_registro || 'Sistema');

  // Cálculos totales de ítems
  const totalCantidad = listaItems.reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);
  const totalValor = listaItems.reduce((acc, it) => {
    const subt = Number(it.precio_total) || (Number(it.cantidad || 0) * Number(it.precio_unitario || 0));
    return acc + subt;
  }, 0);

  // Filas de ítems
  const itemsRowsHtml = listaItems.length > 0 ? listaItems.map((item, idx) => {
    const codigo = escapeHtml(item.codigo_item || item.referencia || '—');
    const descripcion = escapeHtml(item.descripcion);
    const cant = Number(item.cantidad) || 0;
    const precioUnit = Number(item.precio_unitario) || 0;
    const precioTotal = Number(item.precio_total) || (cant * precioUnit);
    const bgRow = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';

    return `
      <tr style="background:${bgRow};">
        <td style="padding:10px 12px; border-bottom:1px solid #E2E8F0; font-weight:700; color:#1E293B; font-size:12px;">${codigo}</td>
        <td style="padding:10px 12px; border-bottom:1px solid #E2E8F0; color:#334155; font-size:12px; line-height:1.4;">${descripcion}</td>
        <td style="padding:10px 12px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:700; color:#0F172A; font-size:12px;">${cant}</td>
        <td style="padding:10px 12px; border-bottom:1px solid #E2E8F0; text-align:right; color:#475569; font-size:12px;">${formatCurrency(precioUnit)}</td>
        <td style="padding:10px 12px; border-bottom:1px solid #E2E8F0; text-align:right; font-weight:700; color:#4338CA; font-size:12px;">${formatCurrency(precioTotal)}</td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="5" style="padding:24px; text-align:center; color:#94A3B8; font-style:italic; font-size:12px;">
        No se encontraron ítems desglosados para esta orden.
      </td>
    </tr>
  `;

  // Sección de observaciones si existen
  const observacionesHtml = orden.observaciones ? `
    <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; padding:12px 16px; margin-bottom:20px;">
      <div style="font-size:12px; font-weight:700; color:#92400E; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
        ℹ️ Observaciones / Motivo de Rechazo:
      </div>
      <div style="font-size:12px; color:#78350F; line-height:1.5;">${escapeHtml(orden.observaciones)}</div>
    </div>
  ` : '';

  // Botón desvincular
  const botonDesvincularHtml = (estado === 'PROCESADA' && orden.pv_asociado) ? `
    <button onclick="desvincularPVSiesa(${orden.id}, '${escapeHtml(orden.numero_orden)}', '${escapeHtml(orden.pv_asociado)}')"
      style="background:#FFFBEB; color:#B45309; border:1px solid #FCD34D; padding:8px 18px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s;">
      🔗 Desvincular PV (${escapeHtml(orden.pv_asociado)})
    </button>
  ` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Detalles Orden de Compra: ${escapeHtml(orden.numero_orden)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #F1F5F9; color: #1E293B; padding: 20px; font-size: 13px; }
    .container { max-width: 940px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #E2E8F0; }
    .header-logos { padding: 14px 20px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; }
    .header-banner { background: linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%); color: #FFFFFF; padding: 20px 24px; }
    .header-title { font-size: 18px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.01em; }
    .header-sub { font-size: 13px; opacity: 0.9; }
    .content-body { padding: 24px; }
    .grid-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .info-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px; }
    .card-label { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; display: block; }
    .card-value { font-size: 13px; font-weight: 700; color: #0F172A; }
    .table-container { border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #F1F5F9; padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #CBD5E1; }
    .footer-actions { background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: gap; }
    .btn { padding: 9px 18px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }
    .btn-primary { background: #4F46E5; color: #FFFFFF; }
    .btn-primary:hover { background: #4338CA; }
    .btn-secondary { background: #E2E8F0; color: #334155; }
    .btn-secondary:hover { background: #CBD5E1; }
    @media (max-width: 700px) {
      .grid-cards { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- Header Logos Institucionales -->
    <div class="header-logos">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="text-align:center; padding:0 8px; border-right:1px solid #E2E8F0;">
            <img src="https://colegioprovidencia.edu.co/Sdp/app/assets/img/colegio.png" alt="Colegio" style="max-height:36px; width:auto; display:inline-block;">
          </td>
          <td style="text-align:center; padding:0 8px; border-right:1px solid #E2E8F0;">
            <img src="https://colegioprovidencia.edu.co/Sdp/app/assets/img/protejer.png" alt="Protejer" style="max-height:36px; width:auto; display:inline-block;">
          </td>
          <td style="text-align:center; padding:0 8px; border-right:1px solid #E2E8F0;">
            <img src="https://colegioprovidencia.edu.co/Sdp/app/assets/img/renueva.png" alt="Renueva" style="max-height:36px; width:auto; display:inline-block;">
          </td>
          <td style="text-align:center; padding:0 8px;">
            <img src="https://colegioprovidencia.edu.co/Sdp/app/assets/img/formacion.png" alt="Formación" style="max-height:36px; width:auto; display:inline-block;">
          </td>
        </tr>
      </table>
    </div>

    <!-- Header Banner -->
    <div class="header-banner">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="header-title">Detalles de Orden de Compra: ${escapeHtml(orden.numero_orden)}</div>
          <div class="header-sub">Cliente: <strong>${escapeHtml(orden.cliente)}</strong></div>
        </div>
        <div>
          <span style="background:${badgeInfo.bg}; color:${badgeInfo.color}; font-size:11px; font-weight:800; padding:6px 14px; border-radius:999px; text-transform:uppercase;">
            ${badgeInfo.label}
          </span>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="content-body">
      <!-- Grid 1: Fechas y Estado -->
      <div class="grid-cards">
        <div class="info-card">
          <span class="card-label">PV Siesa</span>
          <span class="card-value" style="color:${orden.pv_asociado ? '#059669' : '#D97706'};">
            ${orden.pv_asociado ? escapeHtml(orden.pv_asociado) : 'Sin vincular'}
          </span>
        </div>
        <div class="info-card">
          <span class="card-label">Fecha Registro</span>
          <span class="card-value">${fechaReg}</span>
        </div>
        <div class="info-card">
          <span class="card-label">Fecha Recepción</span>
          <span class="card-value">${fechaRec}</span>
        </div>
        <div class="info-card">
          <span class="card-label">Entrega Estimada</span>
          <span class="card-value">${fechaEnt}</span>
        </div>
      </div>

      <!-- Grid 2: Días, Creador, Ítems -->
      <div class="grid-cards">
        <div class="info-card" style="background:${diasInfo.bg}; border-color:${diasInfo.border};">
          <span class="card-label" style="color:${diasInfo.color};">Días para Entrega</span>
          <span class="card-value" style="color:${diasInfo.color}; font-size:12px;">${diasInfo.texto}</span>
        </div>
        <div class="info-card">
          <span class="card-label">Registrado por</span>
          <span class="card-value" style="font-size:12px;">${registradoPor}</span>
        </div>
        <div class="info-card">
          <span class="card-label">Total Ítems</span>
          <span class="card-value" style="color:#4F46E5;">${listaItems.length} tipo${listaItems.length !== 1 ? 's' : ''} (${totalCantidad} uds)</span>
        </div>
        <div class="info-card">
          <span class="card-label">Total Orden</span>
          <span class="card-value" style="color:#4F46E5;">${formatCurrency(totalValor)}</span>
        </div>
      </div>

      <!-- Observaciones -->
      ${observacionesHtml}

      <!-- Tabla de Ítems -->
      <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:13px; font-weight:800; color:#0F172A;">📦 Ítems Registrados (${listaItems.length})</span>
        <span style="font-size:11px; color:#64748B;">Cant. Total: <strong>${totalCantidad}</strong></span>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">Código / Ref</th>
              <th style="text-align:left;">Descripción</th>
              <th style="text-align:center;">Cant.</th>
              <th style="text-align:right;">Precio Unit.</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
          ${listaItems.length > 0 ? `
            <tfoot>
              <tr style="background:#F8FAFC; font-weight:800; border-top:2px solid #CBD5E1;">
                <td colspan="2" style="padding:10px 12px; text-align:right; font-size:12px; color:#334155;">TOTALES:</td>
                <td style="padding:10px 12px; text-align:center; font-size:12px; color:#0F172A;">${totalCantidad}</td>
                <td style="padding:10px 12px; text-align:right; font-size:12px; color:#64748B;">—</td>
                <td style="padding:10px 12px; text-align:right; font-size:13px; color:#4338CA;">${formatCurrency(totalValor)}</td>
              </tr>
            </tfoot>
          ` : ''}
        </table>
      </div>
    </div>

    <!-- Footer Acciones -->
    <div class="footer-actions">
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <button onclick="verDocumentoOriginal(${orden.id})" class="btn btn-primary">
          📄 Ver Documento Original
        </button>
        ${botonDesvincularHtml}
      </div>
      <div>
        <button onclick="window.close()" class="btn btn-secondary">
          ✖ Cerrar Ventana
        </button>
      </div>
    </div>
  </div>

  <script>
    function verDocumentoOriginal(id) {
      if (window.opener && typeof window.opener.verDocumentoDesdePopup === 'function') {
        window.opener.verDocumentoDesdePopup(id);
      } else {
        alert('Abriendo visor en la ventana principal...');
      }
    }

    function desvincularPVSiesa(id, numOrden, pv) {
      if (confirm('¿Está seguro de desvincular el PV ' + pv + ' de la OC ' + numOrden + '?\\n\\nLa orden volverá a estado PENDIENTE.')) {
        if (window.opener && typeof window.opener.desvincularDesdePopup === 'function') {
          window.opener.desvincularDesdePopup(id);
          window.close();
        } else {
          alert('Acción completada. Por favor recargue la ventana principal.');
        }
      }
    }
  </script>
</body>
</html>`;
}
