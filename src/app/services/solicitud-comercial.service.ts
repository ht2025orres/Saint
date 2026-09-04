import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';
import Tesseract from 'tesseract.js';

@Injectable({
  providedIn: 'root'
})
export class SolicitudComercialService {

  constructor() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }

  async parseDocument(fileOrFiles: File | File[]): Promise<any> {
    if (Array.isArray(fileOrFiles)) return this.parseImagesMultiple(fileOrFiles);
    const file = fileOrFiles;
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'xlsx': case 'xls': return this.parseExcel(file);
      case 'pdf': return this.parsePDF(file);
      case 'doc': case 'docx': return this.parseWord(file);
      case 'png': case 'jpg': case 'jpeg': return this.parseImage(file);
      default: throw new Error('Formato no soportado');
    }
  }

  async parseExcel(file: File): Promise<any> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: any[] = XLSX.utils.sheet_to_json(sheet);
    return { data: rawData, structuredData: { cabecera: {}, items: [] } };
  }

  /* ============================================================
     PDF ENGINE (HÍBRIDO V5 - ESTABILIDAD Y FIDELIDAD VISUAL)
     ============================================================ */
  async parsePDF(file: File): Promise<any> {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const scale = 1.3;
    let finalHtml = '';
    let allRawLines: any[] = [];
    let maxX = 0;

    // 1. REPRODUCCIÓN DE LÍNEAS
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let items: any[] = (content?.items || []) as any[];

      // OCR Fallback si el PDF es escaneado
      if (items.length < 10) {
        const scaleOCR = 2.0;
        const viewportOCR = page.getViewport({ scale: scaleOCR });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewportOCR.width); canvas.height = Math.floor(viewportOCR.height);
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport: viewportOCR }).promise;
        const ocrRes = await Tesseract.recognize(canvas.toDataURL('image/png'), 'spa');
        ((ocrRes?.data as any)?.lines || []).forEach((tl: any) => ((tl?.words || []).forEach((w: any) => {
          if (!w.text?.trim()) return;
          items.push({ str: w.text, transform: [(w.bbox.x1 - w.bbox.x0) / scaleOCR, 0, 0, 10, w.bbox.x0 / scaleOCR, -(tl.bbox.y0 / scaleOCR)], width: (w.bbox.x1 - w.bbox.x0) / scaleOCR });
        })));
      }

      let lines: { y: number, items: any[], page: number }[] = [];
      for (const it of items) {
        if (!it.str?.trim()) continue;
        const x = it.transform[4] * scale; const y = it.transform[5];
        const right = x + ((it.width || it.str.length * 5) * scale);
        if (right > maxX) maxX = right;
        let line = lines.find(l => Math.abs(l.y - y) <= 8);
        if (!line) { line = { y, items: [], page: i }; lines.push(line); }
        line.items.push({ ...it, xCoord: x });
      }
      lines.sort((a, b) => b.y - a.y);
      lines.forEach(l => l.items.sort((a, b) => a.xCoord - b.xCoord));
      allRawLines.push(...lines);
    }

    // 2. MOTOR DE RENDERIZADO
    let currentBlockHtml = '';
    let currentTableHtml = '';
    let isInsideTable = false;
    let globalColBounds: number[] | null = null;
    let blockPage = 1;
    let blockYTop = 0;
    let lastY = 0;

    const kwds = ['item', 'pos', 'referencia', 'material', 'descripcion', 'cant', 'unidad', 'unitario', 'precio', 'valor', 'total', 'iva', 'u.m.'];
    const footerKwds = ['subtotal', 'iva', 'total orden', 'total pedido', 'continuara', 'pagina', 'descuento', 'señor', 'atentamente', 'firma', 'elaboro', 'autoriz'];

    const closeBlock = () => {
      if (currentBlockHtml) {
        finalHtml += `<fieldset style="border:1px solid #cbd5e1; border-radius:8px; padding:12px 15px; margin-bottom:16px; background:#f8fafc;">
          <legend style="font-size:0.65rem; font-weight:bold; color:#64748b; padding:0 8px; width:auto; text-transform:uppercase;">Información General</legend>
          <div style="display:flex; flex-wrap:wrap; gap:4px 16px; line-height:1.6;">${currentBlockHtml}</div>
        </fieldset>`;
        currentBlockHtml = '';
        blockYTop = 0;
      }
    };

    const closeTable = () => {
      if (isInsideTable) {
        finalHtml += `<div class="table-container shadow-sm mb-4" style="border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; background:#fff;">
          <div style="background:#f1f5f9; padding:5px 12px; font-size:0.75rem; font-weight:bold; color:#64748b; border-bottom:1px solid #cbd5e1;">
            <i class="bi bi-grid-3x3 me-1"></i> Bloque de Ítems Detectado
          </div>
          <table style="width:100%; border-collapse:collapse; table-layout:fixed;">${currentTableHtml}</table>
        </div>`;
        currentTableHtml = '';
        isInsideTable = false;
        globalColBounds = null;
      }
    };

    allRawLines.forEach((line: any, idx: number) => {
      const txtLineFull = line.items.map((it: any) => it.str).join(' ');
      const txtLineLow = txtLineFull.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // SALTO DE PÁGINA
      if (line.page !== blockPage) {
        closeBlock(); closeTable();
        blockPage = line.page; lastY = 0;
        finalHtml += `<div style="text-align:center; padding:15px 0; border-bottom:1px dashed #ccc; margin-bottom:15px; color:#94a3b8; font-size:10px;">Página ${line.page}</div>`;
      }

      // 1. RECONOCIMIENTO DE CABECERA
      let score = 0;
      kwds.forEach((k: string) => { if (txtLineLow.includes(k)) score++; });
      const capsCount = line.items.filter((it: any) => it.str === it.str.toUpperCase() && it.str.length > 1).length;
      const isHeader = score >= 3 || (score >= 2 && capsCount >= 4);

      if (isHeader) {
        closeBlock(); closeTable();
        isInsideTable = true;
        globalColBounds = line.items.map((it: any) => it.xCoord).sort((a: number, b: number) => a - b);

        currentTableHtml += `<tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1;">`;
        globalColBounds?.forEach((bound: number) => {
          const item = line.items.find((it: any) => Math.abs(it.xCoord - bound) < 5);
          currentTableHtml += `<th style="padding:10px; font-size:0.75rem; color:#475569; text-align:left; font-weight:bold; border-right:1px solid #e2e8f0;">${item?.str || ''}</th>`;
        });
        currentTableHtml += `</tr>`;
        return;
      }

      // 2. LÓGICA DE TABLA (Preservar integridad del ítem)
      if (isInsideTable) {
        const numDensity = line.items.filter((it: any) => /[\d\.,]{2,}/.test(it.str)).length;
        const isFooterKeyword = footerKwds.some((fk: string) => txtLineLow.includes(fk));

        if (isFooterKeyword && numDensity < 2) {
          closeTable();
        } else {
          const cells = new Array(globalColBounds!.length).fill('');
          let itemsPlaced = 0;

          line.items.forEach((it: any) => {
            let bestCol = -1, minDist = 80;
            globalColBounds!.forEach((bound: number, colIdx: number) => {
              const dist = Math.abs(it.xCoord - bound);
              if (dist < minDist) { minDist = dist; bestCol = colIdx; }
            });
            if (bestCol !== -1) {
              cells[bestCol] = (cells[bestCol] ? cells[bestCol] + ' ' : '') + it.str.trim();
              itemsPlaced++;
            }
          });

          // Solo renderizamos como fila si detectamos datos mínimos, para evitar fragmentación
          if (itemsPlaced < 2 && txtLineLow.length > 5 && !isFooterKeyword) {
            currentTableHtml += `<tr><td colspan="${globalColBounds!.length}" style="padding:4px 15px; font-size:0.72rem; color:#64748b; background:#fcfcfc; border-bottom:1px solid #f1f5f9; word-break:break-word;">${txtLineFull}</td></tr>`;
          } else if (itemsPlaced > 0) {
            currentTableHtml += `<tr style="border-bottom:1px solid #f1f5f9; background:#fff;">`;
            cells.forEach(c => {
              currentTableHtml += `<td style="padding:8px 10px; font-size:0.75rem; color:#1e293b; vertical-align:top; border-right:1px solid #f1f5f9; word-break:break-word;">${c}</td>`;
            });
            currentTableHtml += `</tr>`;
          }
          return;
        }
      }

      // 3. FLOW LAYOUT (Cabeceras y Datos como bloques de texto)
      if (txtLineLow.length > 1) {
        if (blockYTop === 0) blockYTop = line.y;

        // Renderizado como texto en flujo — sin posicionamiento absoluto
        const lineText = line.items.map((it: any) => it.str).join(' ');
        currentBlockHtml += `<span style="font-size:0.78rem; color:#2d3748; font-family:'Courier New',monospace; display:inline-block; margin-right:6px;">${lineText}</span>\n`;
        lastY = line.y;

        // Salto de bloque en separación vertical grande
        if (idx < allRawLines.length - 1 && Math.abs(allRawLines[idx + 1].y - line.y) > 70) closeBlock();
      }
    });

    closeBlock(); closeTable();

    // EXTRACCIÓN ESTRUCTURADA POR REGEX (90% AUTOMATIZACIÓN)
    const structuredData = { 
      cabecera: { 
        numero_oc: '', 
        cliente_nombre: '', 
        nit: '',
        fecha_solicitud: '',
        fecha_entrega: ''
      }, 
      items: [] as any[]
    };

    const fullText = allRawLines.map(l => l.items.map((it: any) => it.str).join(' ')).join('\n');
    
    // 1. NIT
    const nitM = fullText.match(/(NIT|IDENTIFICACION|RUC|CEDULA):?\s*([\d\.\-]{7,15})/i);
    if (nitM) structuredData.cabecera.nit = nitM[2].trim();

    // 2. Número OC
    const zsonM = fullText.match(/ZSON\s+([0-9]{6,15})/i);
    if (zsonM) {
      structuredData.cabecera.numero_oc = zsonM[1].trim();
    }
    if (!structuredData.cabecera.numero_oc) {
      const pedidoM = fullText.match(/Pedido[\s\S]{1,30}?([0-9]{8,15})/i);
      if (pedidoM) {
        structuredData.cabecera.numero_oc = pedidoM[1].trim();
      }
    }
    if (!structuredData.cabecera.numero_oc) {
      const ocM = fullText.match(/(ORDEN DE ?COMPRA|O\.?C\.?|ORDER NO|P\.?O\.?|NRO\.?\s*ORDEN)\s*[:#\.\-]?\s*([A-Z0-9\-\.]{4,25})/i);
      if (ocM && !['INGENIERIA', 'PROVEEDOR', 'COMPRADOR', 'COLUMBIA', 'FECHA', 'PAGINA', 'TOTAL', 'MATERIAL'].includes(ocM[2].toUpperCase().trim())) {
        structuredData.cabecera.numero_oc = ocM[2].trim();
      }
    }

    // Si el número de OC extraído es ambiguo o corto, buscar en el nombre del archivo si fue pasado
    const fnMatch = file.name ? file.name.match(/(?:OC|ORDEN)[\s\-\_]*([0-9]{4,15})/i) : null;
    if (fnMatch && (!structuredData.cabecera.numero_oc || structuredData.cabecera.numero_oc.length < 4 || structuredData.cabecera.numero_oc.includes('001-OC'))) {
      structuredData.cabecera.numero_oc = fnMatch[1];
    }

    // Limpiar prefijos alfabéticos del número de OC (ej: POEDUCO-00008618 -> 00008618)
    if (structuredData.cabecera.numero_oc) {
      const mNumClean = structuredData.cabecera.numero_oc.match(/^[A-Za-z\-_]+([0-9]{4,15})$/);
      if (mNumClean) {
        structuredData.cabecera.numero_oc = mNumClean[1];
      }
    }

    // 3. Cliente (Busca Razones Sociales S.A., S.A.S., LTDA excluyendo Providencia)
    const saMatches = fullText.match(/([A-Z0-9\sÁÉÍÓÚÑ]{3,50}\s+(?:S\.A\.S\.|S\.A\.|LTDA\.|C\.I\.|S\.A\.S|S\.A|LTDA))/gi);
    if (saMatches) {
      const externalCli = saMatches.find((m: string) => !m.toUpperCase().includes('PROVIDENCIA'));
      if (externalCli) {
        structuredData.cabecera.cliente_nombre = externalCli.trim();
      }
    }
    
    if (!structuredData.cabecera.cliente_nombre) {
      const cliM = fullText.match(/(SEÑORES|CLIENTE|RAZON SOCIAL|EMPRESA|FACTURAR A|COMPRADOR):?\s*([A-ZÑ\s\.]{5,60})/i);
      if (cliM && !/^\d+$/.test(cliM[2].trim()) && !cliM[2].toUpperCase().includes('PROVIDENCIA')) {
        structuredData.cabecera.cliente_nombre = cliM[2].trim();
      }
    }

    // 4. Fechas (Detección por etiquetas explícitas de Fecha de Orden y Prometido/Entrega)
    const parseFechaEspanolTS = (raw: string): string => {
      if (!raw) return '';
      const meses: { [key: string]: string } = {
        'ENE': '01', 'ENERO': '01', 'FEB': '02', 'FEBRERO': '02', 'MAR': '03', 'MARZO': '03',
        'ABR': '04', 'ABRIL': '04', 'MAY': '05', 'MAYO': '05', 'JUN': '06', 'JUNIO': '06',
        'JUL': '07', 'JULIO': '07', 'AGO': '08', 'AGOSTO': '08', 'SEP': '09', 'SET': '09', 'SEPTIEMBRE': '09',
        'OCT': '10', 'OCTUBRE': '10', 'NOV': '11', 'NOVIEMBRE': '11', 'DIC': '12', 'DICIEMBRE': '12'
      };

      const mTxt = raw.trim().match(/^(\d{1,2})[\s\-\/\.]([A-Z]{3,10})[\s\-\/\.](\d{2,4})$/i);
      if (mTxt) {
        const dia = mTxt[1].padStart(2, '0');
        const mesNum = meses[mTxt[2].toUpperCase()] || '01';
        const anio = mTxt[3].length === 2 ? '20' + mTxt[3] : mTxt[3];
        return `${anio}-${mesNum}-${dia}`;
      }

      const mNum = raw.trim().match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})$/);
      if (mNum) {
        if (mNum[1].length === 4) {
          return `${mNum[1]}-${mNum[2].padStart(2, '0')}-${mNum[3].padStart(2, '0')}`;
        } else {
          const anio = mNum[3].length === 2 ? '20' + mNum[3] : mNum[3];
          return `${anio}-${mNum[2].padStart(2, '0')}-${mNum[1].padStart(2, '0')}`;
        }
      }
      return '';
    };

    const mFechaOrden = fullText.match(/(?:ORDEN\s+DE\s+COMPRA[\s\S]{1,40}?|Fecha\s*(?:de)?\s*(?:orden|pedido|solicitud)[\s\S]{1,40}?|FECHA[\s\S]{1,30}?)(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}|\d{1,2}[\.\/\-][A-Z]{3,10}[\.\/\-]\d{2,4})/i);
    if (mFechaOrden) {
      structuredData.cabecera.fecha_solicitud = parseFechaEspanolTS(mFechaOrden[1]);
    }

    const mFechaProm = fullText.match(/(?:Prometido|PLAZO\s+ENTREGA|Fecha\s*(?:de)?\s*(?:entrega|promesa))[\s\S]{1,60}?(\d{8}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (mFechaProm) {
      const rawE = mFechaProm[1];
      if (rawE.length === 8 && /^\d+$/.test(rawE)) {
        structuredData.cabecera.fecha_entrega = `${rawE.substring(0, 4)}-${rawE.substring(4, 6)}-${rawE.substring(6, 8)}`;
      } else {
        structuredData.cabecera.fecha_entrega = parseFechaEspanolTS(rawE);
      }
    }

    if (!structuredData.cabecera.fecha_entrega) {
      const mYMD = fullText.match(/(202\d{5})/);
      if (mYMD) {
        const rawYMD = mYMD[1];
        structuredData.cabecera.fecha_entrega = `${rawYMD.substring(0, 4)}-${rawYMD.substring(4, 6)}-${rawYMD.substring(6, 8)}`;
      }
    }

    // 5. Extracción local de Ítems de la Tabla (Formatos Posición y Formato IMECO / Siesa)
    const parseSmartNumber = (s: string): number => {
      if (!s) return 0;
      s = s.trim();
      if (s.includes(',') && s.includes('.')) {
        if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
          return parseFloat(s.replace(/,/g, ''));
        } else {
          return parseFloat(s.replace(/\./g, '').replace(',', '.'));
        }
      }
      if (s.includes(',')) {
        if (/,\d{3}$/.test(s)) return parseFloat(s.replace(/,/g, ''));
        return parseFloat(s.replace(',', '.'));
      }
      return parseFloat(s) || 0;
    };

    let itemPendiente: any = null;
    const patternImeco = /([\d\.]+)\s+[\$]?([\d\.\,]+)\s+([A-Z0-9]{2,6})\s+(UND|MTR|KG|CJA|PAR|PCS|PZA)\s+([A-Z0-9\-\.\_]{3,20})\s+(.*)/i;

    const extraerTallaLocal = (str: string, ref: string = ''): string => {
      const tallasValidas = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '48', '50'];
      const full = ((str || '') + ' ' + (ref || '')).trim();
      if (!full) return '';

      // 1. Etiqueta explícita pero solo si coincide con una talla válida
      const m1 = full.match(/\b(?:talla|case|size|tl)\s*[:#\.]?\s*([A-Z0-9]{1,4})\b/i);
      if (m1) {
        const cand = m1[1].toUpperCase();
        if (tallasValidas.includes(cand)) return cand;
      }

      // 2. Palabra completa delimitada
      const m2 = full.match(/\b(5XL|4XL|3XL|2XL|XXXL|XXL|XL|XS|28|30|32|34|35|36|37|38|39|40|41|42|43|44|45|46|48|50|S|M|L)\b/i);
      if (m2) {
        const cand = m2[1].toUpperCase();
        if (tallasValidas.includes(cand)) return cand;
      }

      // 3. Empotrado en código de referencia (ej: CMLCXLCR -> XL, CMLCXXLCR -> XXL, OMLLIXXL -> XXL, BJCT32CR -> 32)
      if (ref) {
        const refUpper = ref.trim().toUpperCase();
        const m3 = refUpper.match(/(3XL|2XL|XXXL|XXL|XL|XS|28|30|32|34|36|38|40|42|44|46|48)/i);
        if (m3) {
          const cand = m3[1].toUpperCase();
          if (tallasValidas.includes(cand)) return cand;
        }

        const m4 = refUpper.match(/[A-Z]{2,5}(S|M|L)[A-Z]{1,3}/i);
        if (m4) {
          const cand = m4[1].toUpperCase();
          if (tallasValidas.includes(cand)) return cand;
        }
      }

      return '';
    };

    allRawLines.forEach((line: any) => {
      const lineText = line.items.map((it: any) => it.str).join(' ').trim();
      if (!lineText) return;

      // Ignorar cabeceras de tabla y footers
      if (/(^pos\.?\s|material\s+descripci|subtotal|descuento|iva\s|total\s|condiciones|horario|pagar|docto|comprador|proveedor)/i.test(lineText)) {
        return;
      }

      // 1. Patrón IMECO / Siesa Exacto (Ej: 3.0000 $111,096.00 BP01 UND BJLC34 BLUE JEAN LOGO CASE 34...)
      const patternExact = /^([\d\.]+)\s+[\$]?([\d\.\,]+)\s+(?:BP\d{2}\s+)?(UND|MTR|KG|CJA|PAR|PCS|PZA)\s+([A-Z0-9\-\.\_]{3,20})\s+(.*)/i;
      const mExact = lineText.match(patternExact);
      if (mExact) {
        const q = parseFloat(mExact[1]) || 1;
        const t = parseSmartNumber(mExact[2]);
        const um = mExact[3];
        const cod = mExact[4].trim();
        const resto = mExact[5].trim();

        let p = 0;
        let desc = resto;
        const mUnit = resto.match(/[\$]?([\d\.\,]{3,15})\s+\d{1,2}\.\d{2}/);
        if (mUnit) {
          p = parseSmartNumber(mUnit[1]);
          desc = resto.replace(/[\$]?[\d\.\,]{3,15}\s+\d{1,2}\.\d{2}.*/, '').trim();
        }

        const tallaExt = extraerTallaLocal(desc, cod);

        structuredData.items.push({
          item_cfip: cod,
          item_cliente: cod,
          descripcion: desc || cod,
          cantidad: q,
          talla: tallaExt,
          precio_unitario: p > 0 ? p : (t / q),
          precio_total: t,
          unidad_medida: um
        });
        return;
      }

      // Probar patrón IMECO / Siesa Docto
      const mImeco = lineText.match(patternImeco);
      if (mImeco) {
        const q = parseFloat(mImeco[1]) || 0;
        const t = parseSmartNumber(mImeco[2]);
        const cod = mImeco[5].trim();
        let descRaw = mImeco[6].trim();

        let p = 0;
        const mUnit = descRaw.match(/[\$]?([\d\.\,]{3,15})\s+\d{1,2}\.\d{2}/);
        if (mUnit) {
          p = parseSmartNumber(mUnit[1]);
          descRaw = descRaw.replace(/[\$]?[\d\.\,]{3,15}\s+\d{1,2}\.\d{2}.*/, '').trim();
        }

        if (q > 0) {
          structuredData.items.push({
            item_cfip: cod,
            item_cliente: cod,
            descripcion: descRaw || cod,
            cantidad: q,
            talla: extraerTallaLocal(descRaw, cod),
            precio_unitario: p > 0 ? p : (t / q),
            precio_total: t,
            unidad_medida: mImeco[4]
          });
        }
        return;
      }

      // 1. Inicio de ítem por posición de 4-5 dígitos (ej: 00010, 00020)
      const mPos = lineText.match(/^(\d{4,5})\s+([A-Z0-9\-\.]{3,20})\s+(.*)/i);
      if (mPos) {
        if (itemPendiente && itemPendiente.cantidad > 0) {
          structuredData.items.push(itemPendiente);
        }
        const codigo = mPos[2].trim();
        const resto = mPos[3].trim();

        // SAP format: desc + fecha + qty + UM + precio_unit + iva + precio_total (todo en una línea)
        // Fecha puede ser YYYYMMDD o DD.MM.YYYY
        // Ej: CAMIBUSO VARIAS TALLAS  20251128  19 U  31.878,00  0,0  605.682,00
        // Ej: BLUSA TIPO COLUMBIA     20.12.2025  3  PZA  84.694,00 19,0  302.357,58
        const mSAP = resto.match(/^(.+?)\s+(\d{8}|\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4})\s+(\d+)\s+(U|UND|MTR|KG|CJA|PAR|PCS|PZA)\s+([0-9\.\,]+)\s+[0-9\.\,]+\s+([0-9\.\,]+)\s*$/i);
        if (mSAP) {
          const descSAP = mSAP[1].replace(/\s+/g, ' ').trim();
          const qtySAP = parseInt(mSAP[3], 10);
          const puSAP = parseSmartNumber(mSAP[5]);
          const ptSAP = parseSmartNumber(mSAP[6]);
          const tallaSAP = extraerTallaLocal(descSAP, codigo);

          structuredData.items.push({
            item_cfip: codigo,
            item_cliente: codigo,
            descripcion: descSAP,
            cantidad: qtySAP,
            talla: tallaSAP,
            precio_unitario: puSAP,
            precio_total: ptSAP,
            unidad_medida: mSAP[4].toUpperCase() === 'U' ? 'UND' : mSAP[4].toUpperCase()
          });
          itemPendiente = null;
          return;
        }
        
        // Intentar extraer valores numéricos del resto de la misma línea
        const numsEnLinea = resto.match(/(\d[\d\.\,]*)/g);
        itemPendiente = {
          item_cfip: codigo,
          item_cliente: codigo,
          descripcion: resto.replace(/\s*\d[\d\.\,]*\s*/g, ' ').trim() || codigo,
          cantidad: 0,
          talla: '',
          precio_unitario: 0,
          precio_total: 0,
          unidad_medida: 'UND'
        };

        // Si la misma línea tiene al menos 3 números, extraer qty/price/total
        if (numsEnLinea && numsEnLinea.length >= 3) {
          const last3 = numsEnLinea.slice(-3);
          const q = parseSmartNumber(last3[0]);
          const p = parseSmartNumber(last3[1]);
          const t = parseSmartNumber(last3[2]);
          if (q > 0 && p > 0) {
            itemPendiente.cantidad = q;
            itemPendiente.precio_unitario = p;
            itemPendiente.precio_total = t > 0 ? t : q * p;
            // Limpiar números de la descripción
            itemPendiente.descripcion = resto;
            last3.forEach(n => { itemPendiente.descripcion = itemPendiente.descripcion.replace(n, ''); });
            itemPendiente.descripcion = itemPendiente.descripcion.replace(/\s+/g, ' ').trim();
            structuredData.items.push(itemPendiente);
            itemPendiente = null;
          }
        }
        return;
      }

      // 2. Si hay un ítem pendiente, buscar línea con valores numéricos
      if (itemPendiente) {
        // Buscar patrón: [algo]cantidad precio_unitario precio_total (3 últimos nums)
        const allNums = lineText.match(/(\d[\d\.\,]*)/g);
        if (allNums && allNums.length >= 3) {
          const last3 = allNums.slice(-3);
          const q = parseSmartNumber(last3[0]);
          const p = parseSmartNumber(last3[1]);
          const t = parseSmartNumber(last3[2]);

          if (q > 0 && q < 100000 && p > 0) {
            itemPendiente.cantidad = q;
            itemPendiente.precio_unitario = p;
            itemPendiente.precio_total = t > 0 ? t : q * p;
            itemPendiente.descripcion = itemPendiente.descripcion.replace(/\s+/g, ' ').trim();
            structuredData.items.push(itemPendiente);
            itemPendiente = null;
            return;
          }
        }

        // Acumular descripción (pero ignorar footers)
        if (lineText.length > 2) {
          itemPendiente.descripcion += ' ' + lineText;
        }
      }
    });

    if (itemPendiente && itemPendiente.cantidad > 0) {
      structuredData.items.push(itemPendiente);
    }

    // Fallback para formato de Orden de Compra Oracle / POEDUCO
    if (structuredData.items.length === 0) {
      let currentItem: any = null;
      allRawLines.forEach((line: any) => {
        const lineText = line.items.map((it: any) => it.str).join(' ').trim();
        if (!lineText) return;

        // Inicio de ítem (ej: 1CAMISETA..., 10PANTALON..., 6PANTALON...)
        const mStart = lineText.match(/^(\d{1,3})([A-ZÁÉÍÓÚÑ]{3,}.*)/i);
        if (mStart) {
          const descIni = mStart[2].trim();
          if (/^(CAMISETA|PANTALON|OVEROL|BLUSA|CHALECO|CORTAVIENTO|CHAQUETA|CONJUNTO|CALZADO|BOTA|GORRA|TAPABOCA|CINTURON|JEAN|T-SHIRT|POLO)/i.test(descIni)) {
            if (currentItem && currentItem.cantidad > 0) {
              structuredData.items.push(currentItem);
            }
            currentItem = {
              item_cfip: '',
              item_cliente: '',
              descripcion: descIni,
              cantidad: 0,
              talla: '',
              precio_unitario: 0,
              precio_total: 0,
              unidad_medida: 'UND'
            };
            return;
          }
        }

        if (currentItem) {
          // Detectar línea de Prometido Qty + UM + Total (ej: Prometido 3 UND 93,585)
          const mProm = lineText.match(/Prometido\s+(\d+)\s+(UND|MTR|KG|CJA|PAR|PCS|PZA)?\s*[\$]?\s*([0-9\.\,]+)/i);
          if (mProm) {
            const qty = parseFloat(mProm[1]) || 0;
            const um = mProm[2] || 'UND';
            const tot = parseSmartNumber(mProm[3]);

            currentItem.cantidad = qty;
            currentItem.unidad_medida = um;
            currentItem.precio_total = tot;
            if (qty > 0 && currentItem.precio_unitario === 0) {
              currentItem.precio_unitario = tot / qty;
            }

            // Extraer código de 8 dígitos al final de la descripción si existe
            const mCode = currentItem.descripcion.match(/(\b\d{7,10}\b)/);
            if (mCode) {
              currentItem.item_cfip = mCode[1];
              currentItem.item_cliente = mCode[1];
              currentItem.descripcion = currentItem.descripcion.replace(mCode[1], '').trim();
            }

            // Limpiar encabezados de página acumulados en la descripción
            currentItem.descripcion = currentItem.descripcion.replace(/\d*\s*Orden de compra.*$/i, '').trim();
            currentItem.talla = extraerTallaLocal(currentItem.descripcion, currentItem.item_cfip);

            if (currentItem.cantidad > 0 && currentItem.descripcion) {
              structuredData.items.push(currentItem);
            }
            currentItem = null;
            return;
          }

          // Código numérico solo en una línea (ej: 10049725)
          const mCode = lineText.match(/^(\d{7,10})$/);
          if (mCode) {
            currentItem.item_cfip = mCode[1];
            currentItem.item_cliente = mCode[1];
            return;
          }

          // Precio Unitario (ej: 31,195 UND)
          const mPrice = lineText.match(/^([0-9\.\,]+)\s+(UND|MTR|KG|CJA|PAR|PCS|PZA)/i);
          if (mPrice) {
            currentItem.precio_unitario = parseSmartNumber(mPrice[1]);
            currentItem.unidad_medida = mPrice[2];
            return;
          }

          // Acumular líneas de descripción intermedia
          if (!/(Solicitado|Las fechas|Total de|Información|Orden POEDUCO|Página|Notas)/i.test(lineText)) {
            currentItem.descripcion += ' ' + lineText;
          }
        }
      });

      if (currentItem && currentItem.cantidad > 0) {
        structuredData.items.push(currentItem);
      }
    }

    return { html: `<div class="pdf-container" style="user-select:text;">${finalHtml}</div>`, structuredData };
  }

  async parseWord(file: File): Promise<any> {
    const res = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return { html: res.value };
  }

  async parseImage(file: File): Promise<any> {
    const res = await Tesseract.recognize(file, 'spa');
    return { text: res.data.text, structuredData: { cabecera: {}, items: [] } };
  }

  async parseImagesMultiple(files: File[]): Promise<any> {
    let t = '';
    for (const f of files) {
      const res = await Tesseract.recognize(f, 'spa');
      t += res.data.text + '\n';
    }
    return { text: t, structuredData: { cabecera: {}, items: [] } };
  }
}