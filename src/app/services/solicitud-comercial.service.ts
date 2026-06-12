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
      let items: any[] = content.items;

      // OCR Fallback si el PDF es escaneado
      if (items.length < 10) {
        const scaleOCR = 2.0;
        const viewportOCR = page.getViewport({ scale: scaleOCR });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewportOCR.width); canvas.height = Math.floor(viewportOCR.height);
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport: viewportOCR }).promise;
        const ocrRes = await Tesseract.recognize(canvas.toDataURL('image/png'), 'spa');
        (ocrRes.data as any).lines.forEach((tl: any) => tl.words.forEach((w: any) => {
          if (!w.text?.trim()) return;
          items.push({ str: w.text, transform: [(w.bbox.x1 - w.bbox.x0) / scaleOCR, 0, 0, 10, w.bbox.x0 / scaleOCR, -(tl.bbox.y0 / scaleOCR)], width: (w.bbox.x1 - w.bbox.x0) / scaleOCR });
        }));
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
    if (nitM) structuredData.cabecera.nit = nitM[2].trim().replace(/\./g, '');

    // 2. Número OC
    const ocM = fullText.match(/(NUMERO|PEDIDO|ORDEN|OC|COMPRA|P\.O|PO):?\s*([A-Z0-9\-\.]{3,25})/i);
    if (ocM) structuredData.cabecera.numero_oc = ocM[2].trim();

    // 3. Cliente
    const cliM = fullText.match(/(SEÑORES|CLIENTE|NOMBRE|PROVEEDOR|COMPRADOR):?\s*([A-ZÑ\s\.]{5,60})/i);
    if (cliM && !/^\d+$/.test(cliM[2].trim())) structuredData.cabecera.cliente_nombre = cliM[2].trim();

    // 4. Fechas (Heurística: Primera fecha suele ser solicitud, segunda entrega)
    const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/g;
    const dates = fullText.match(dateRegex);
    if (dates && dates.length > 0) {
      structuredData.cabecera.fecha_solicitud = dates[0];
      if (dates.length > 1) structuredData.cabecera.fecha_entrega = dates[1];
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