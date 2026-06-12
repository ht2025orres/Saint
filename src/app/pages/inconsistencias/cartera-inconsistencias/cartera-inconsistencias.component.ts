import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import Swal from 'sweetalert2';
import { getDetallesHtml, generarTiemposHtml, generarEvidenciasHtml } from '../../../shared/templates/detalles-popup.template';

interface InconsistenciaCartera {
  id: number;
  id_inconsistencia: string;
  Cliente: string;
  tipo_de_orden: string;
  precio_total_inconsistencia: number;
  fecha_inconsistencia: string;
  codigo_inconsistencia: string;
  cantidad_inconsistencia: number;
  item: string;
  nombre_item: string;
  descripcion_inconsistencia: string;
  etapa: string;
  estado_inconsistencia: string;
  evidencias?: any;
  evidencias_urls?: any;
}

@Component({
  selector: 'app-cartera-inconsistencias',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './cartera-inconsistencias.component.html',
  styleUrls: ['./cartera-inconsistencias.component.css']
})
export class CarteraInconsistenciasComponent implements OnInit {
  inconsistencias: InconsistenciaCartera[] = [];
  modalesAbiertos: { inconsistencia: InconsistenciaCartera, notaCredito: string }[] = [];
  cargando = false;

  constructor(private inconsistenciasService: InconsistenciaService) { }

  tipos_inco: { [key: string]: string } = {};

  ngOnInit(): void {
    this.cargarInconsistencias();
    this.obtenerTipos();

    (window as any).aprobarCarteraDesdePopup = (id: number, notaCredito: string) => {
      const inco = this.inconsistencias.find(i => i.id === id);
      if (inco) this.pedirNotaCreditoYAprobar(inco, notaCredito);
    };
  }

  obtenerTipos() {
    fetch('/assets/config/config.json')
      .then(r => r.json())
      .then(json => this.tipos_inco = json);
  }

  cargarInconsistencias(): void {
    this.cargando = true;
    this.inconsistenciasService.listarInconsistenciasPorDepartamento().subscribe({
      next: (res: any) => {
        this.inconsistencias = res.data || [];
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        Swal.fire('Error', 'No se pudieron cargar las inconsistencias', 'error');
      }
    });
  }

  traducirEtapa(etapa: string): string {
    const etapas: { [key: string]: string } = {
      'lider': 'Aprobación Líder',
      'calidad': 'Aprobación Calidad',
      'logistica': 'Aprobación Logística',
      'trazo': 'Aprobación Trazo',
      'patronaje': 'Aprobación Patronaje',
      'contabilidad': 'Aprobación Contabilidad',
      'cartera': 'Aprobación Cartera',
      'finalizacion': 'Finalización'
    };
    return etapas[etapa] || etapa;
  }

  abrirModalDetalles(inconsistencia: any): void {
    let archivos: string[] = [];
    if (Array.isArray(inconsistencia.evidencias_urls) && inconsistencia.evidencias_urls.length > 0) {
      archivos = inconsistencia.evidencias_urls;
    } else if (Array.isArray(inconsistencia.evidencias) && inconsistencia.evidencias.length > 0) {
      archivos = inconsistencia.evidencias;
    }

    const evidenciasHtml = archivos.length > 0 ? archivos.map((url: string, i: number) => {
      const ext = url.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
        return `<div style="text-align: center; margin-bottom: 10px;">
                  <span style="display:block;font-size:12px;color:#888;">Evidencia ${i + 1}</span>
                  <img src="${url}" style="max-width:100%; max-height: 400px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer;" onclick="window.open('${url}', '_blank')">
                </div>`;
      }
      return `<div style="margin-bottom: 10px;">
                <a href="${url}" target="_blank" style="background:#72BE44; color:white; padding: 6px 12px; text-decoration:none; border-radius: 4px; font-size:12px; display:inline-block;">Abrir Archivo Adjunto ${i + 1}</a>
              </div>`;
    }).join('') : '<p style="color:#888; font-size:13px; font-style:italic; text-align:center;">No hay evidencias adjuntas.</p>';

    const win = window.open('', '_blank', 'width=900,height=750,scrollbars=yes,resizable=yes');
    if (win) {
      win.document.write('<p style="font-family:sans-serif;text-align:center;padding:20px;">Cargando detalles...</p>');
    }

    this.inconsistenciasService.obtenerTiemposProceso(inconsistencia.id_inconsistencia || inconsistencia.id).subscribe({
      next: (res: any) => {
        // Usar funciones compartidas
        const tiemposHtml = generarTiemposHtml(res, this.traducirEtapa.bind(this));
        const evidenciasHtml = generarEvidenciasHtml(archivos);

        let botonesAccionHtml = '';
        const estado = inconsistencia.estado_inconsistencia || '';
        const terminada = inconsistencia.etapa === 'terminada';
        const inactiva = estado === 'Denegada' || estado === 'Aprobada' || inconsistencia.fecha_anulacion;
        
        if (!terminada && !inactiva) {
          botonesAccionHtml = `
            <div style="margin-top:30px; padding-top:20px; border-top:1px solid #D0D0D0; text-align:center;">
              <h3 style="margin-bottom:15px; font-size:14px; color:#333;">Acciones de Cartera</h3>
              <div style="text-align:left; margin-bottom:14px;">
                <label style="display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:4px;">
                  Número de Nota Crédito / Documento <span style="color:red;">*</span>
                </label>
                <input id="cartera-nota-credito"
                  type="text"
                  placeholder="Ej: NC-2026-00123"
                  style="width:100%; border:1px solid #D1D5DB; border-radius:6px; padding:8px 10px; font-size:13px; box-sizing:border-box; outline:none;"
                  onfocus="this.style.borderColor='#3B82F6'"
                  onblur="this.style.borderColor='#D1D5DB'"
                >
              </div>
              <button onclick="
                var nota = document.getElementById('cartera-nota-credito').value.trim();
                if (!nota) { alert('Debe ingresar el número de Nota Crédito.'); return; }
                window.opener.aprobarCarteraDesdePopup(${inconsistencia.id}, nota);
                window.close();
              " style="background:#22c55e; color:white; border:none; padding:10px 24px; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer; margin:0 5px;">
                ✅ Generar Nota Crédito y Aprobar
              </button>
            </div>
          `;
        }

        const htmlContent = getDetallesHtml(
          inconsistencia,
          tiemposHtml,
          evidenciasHtml,
          botonesAccionHtml,
          this.tipos_inco,
          this.traducirEtapa.bind(this),
          {
            mostrarSeccionAnulacion: false,
            mostrarFooter: false,
            mostrarInfoEconomica: true,
            mostrarBotonesAccion: true
          }
        );

        if (win) {
          win.document.open();
          win.document.write(htmlContent);
          win.document.close();
        }
      },
      error: (err) => {
        if (win) {
          win.document.open();
          win.document.write('<p style="color:red; text-align:center; padding:20px;">Error al cargar los detalles de la inconsistencia.</p>');
          win.document.close();
        }
      }
    });
  }

  pedirNotaCreditoYAprobar(inco: any, notaCredito: string): void {
    if (!notaCredito || notaCredito.trim() === '') {
      Swal.fire('Campo requerido', 'Debe ingresar el número de Nota Crédito.', 'warning');
      return;
    }
    this.aprobarEnBackend(inco.id, notaCredito.trim());
  }

  aprobarEnBackend(id: number, notaCredito: string): void {
    Swal.showLoading();

    this.inconsistenciasService.aprobarInconsistencia(
      id.toString(),
      notaCredito  // Se guarda directo en la columna nota_credito en el backend
    ).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Inconsistencia aprobada y notificada', 'success');
        this.cargarInconsistencias();
      },
      error: (err) => {
        Swal.fire('Error', 'Hubo un problema al aprobar', 'error');
      }
    });
  }
}
