import { Component, OnInit } from '@angular/core';
import { ReportService } from '../../../services/report.service';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { AuthService } from '../../../services/auth.service';
import { Report } from '../../../models/report';
import Swal from 'sweetalert2';
import * as bootstrap from 'bootstrap';

@Component({
  selector: 'app-report-list',
  templateUrl: './report-list.component.html',
  styleUrls: ['./report-list.component.css']
})
export class ReportListComponent implements OnInit {
  // Paginación
  paginatorId = 'reportListPaginator';
  
  reports: Report[] = [];
  currentReports: Report[] = [];
  loading = false;

  // Filtros
  filters = {
    busqueda: '',
    creador_nombre: '',
    cliente: '',
    prenda: '',
    item: '',
    origen: '',
    tipo: '',
    estado: ''
  };

  // Liberación
  reporteSeleccionado: Report | null = null;
  respuestaLiberacion: string = '';
  modalLiberacionInstance: any = null;
  selectedFile: File | null = null; 
  evidencia_respuesta: string = '';

  constructor(
    private reportService: ReportService,
    private authService: AuthService,
    public paginationService: PaginationService
  ) {}

  ngOnInit(): void {
    this.obtenerReportes();

    // Inicializar el modal de liberación
    const modalEl = document.getElementById('modalLiberacion');
    if (modalEl) this.modalLiberacionInstance = new bootstrap.Modal(modalEl);
  }


   // Método para validar si el botón debe mostrarse
  puedeMostrarBoton(): boolean {
    const ahora = new Date();
    const diaSemana = ahora.getDay(); // 0: domingo, 1: lunes, ..., 6: sábado
    const hora = ahora.getHours();
    const minutos = ahora.getMinutes();

    // Lunes a Viernes (1-5)
    if (diaSemana >= 1 && diaSemana <= 5) {
      return (hora > 7 || (hora === 7 && minutos >= 0)) && (hora < 16); // 7 AM a 4 PM
    }

    // Sábado (6)
    if (diaSemana === 6) {
      return (hora > 7 || (hora === 7 && minutos >= 0)) && (hora < 12); // 7 AM a 12 PM
    }

    // Fuera de horario laboral (domingo o fuera de horas)
    return false;
  }
  
  // ✅ Captura de archivo (solo se guarda en memoria hasta crear reporte)
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  // ✅ Cargar los reportes del usuario autenticado
  obtenerReportes(): void {
    this.loading = true;

    this.reportService.getReports().subscribe({
      next: (res) => {
        this.reports = res.data || [];
        
        // Inicializar paginador
        this.paginationService.initializePaginator(
          this.paginatorId,
          this.reports,
          10,
          this.filters,
          this.filterFunction
        ).subscribe(state => {
          this.currentReports = state.currentData;
        });

        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        Swal.fire('Error', 'No se pudieron cargar los reportes', 'error');
        console.error(err);
      }
    });
  }

  // Función de filtrado - BUSCA EN TODOS LOS CAMPOS
  filterFunction: FilterFunction = (report: Report, filtros: any) => {
    const busqueda = (filtros.busqueda || '').toLowerCase().trim();
    const creador = (filtros.creador_nombre || '').toLowerCase().trim();
    const cliente = (filtros.cliente || '').toLowerCase().trim();
    const prenda = (filtros.prenda || '').toLowerCase().trim();
    const item = (filtros.item || '').toLowerCase().trim();
    const origen = (filtros.origen || '').toLowerCase().trim();
    const tipo = (filtros.tipo || '').toLowerCase().trim();
    const estado = (filtros.estado || '').toLowerCase().trim();

    // Filtro por búsqueda general - TODOS LOS CAMPOS DE LA TABLA
    if (busqueda) {
      const matchBusqueda = 
        (report.id?.toString() || '').toLowerCase().includes(busqueda) ||
        (report.creador_nombre || '').toLowerCase().includes(busqueda) ||
        (report.origen || '').toLowerCase().includes(busqueda) ||
        (report.tipo_reporte || '').toLowerCase().includes(busqueda) ||
        (report.cliente || '').toLowerCase().includes(busqueda) ||
        (report.item || '').toLowerCase().includes(busqueda) ||
        (report.prenda || '').toLowerCase().includes(busqueda) ||
        (report.estado || '').toLowerCase().includes(busqueda) ||
        (report.fecha_creacion?.toString() || '').toLowerCase().includes(busqueda) ||
        (report.fecha_actualizacion?.toString() || '').toLowerCase().includes(busqueda) ||
        (report.observacion || '').toLowerCase().includes(busqueda);
      
      if (!matchBusqueda) return false;
    }

    // Filtro por creador/solicitante
    if (creador && (report.creador_nombre || '').toLowerCase() !== creador) {
      return false;
    }

    // Filtro por cliente
    if (cliente && (report.cliente || '').toLowerCase() !== cliente) {
      return false;
    }

    // Filtro por prenda
    if (prenda && (report.prenda || '').toLowerCase() !== prenda) {
      return false;
    }

    // Filtro por item
    if (item && (report.item || '').toLowerCase() !== item) {
      return false;
    }

    // Filtro por origen
    if (origen && (report.origen || '').toLowerCase() !== origen) {
      return false;
    }

    // Filtro por tipo
    if (tipo && (report.tipo_reporte || '').toLowerCase() !== tipo) {
      return false;
    }

    // Filtro por estado
    if (estado && (report.estado || '').toLowerCase() !== estado) {
      return false;
    }

    return true;
  };

  // Aplicar filtros
  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.reports,
      undefined,
      this.filters,
      this.filterFunction
    );
    
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    this.currentReports = state?.currentData || [];
  }

  // Limpiar filtros
  clearFilters(): void {
    this.filters = {
      busqueda: '',
      creador_nombre: '',
      cliente: '',
      prenda: '',
      item: '',
      origen: '',
      tipo: '',
      estado: ''
    };
    this.applyFilters();
  }

  // Obtener valores únicos para filtros de dropdown
  get creadores(): string[] {
    return [...new Set(this.reports.map(r => r.creador_nombre).filter(Boolean))];
  }

  get clientes(): string[] {
    return [...new Set(this.reports.map(r => r.cliente).filter(Boolean))];
  }

  get prendas(): string[] {
    return [...new Set(this.reports.map(r => r.prenda).filter(Boolean))];
  }

  get items(): string[] {
    return [...new Set(this.reports.map(r => r.item).filter(Boolean))];
  }

  get origenes(): string[] {
    return [...new Set(this.reports.map(r => r.origen).filter(Boolean))];
  }

  get tipos(): string[] {
    return [...new Set(this.reports.map(r => r.tipo_reporte).filter(Boolean))];
  }

  get estados(): string[] {
    return [...new Set(this.reports.map(r => r.estado).filter(Boolean))];
  }

  // ✅ Abrir evidencia en nueva pestaña (si existe)
  verEvidencia(id: number, estado: string): void {
    this.reportService.getEvidenceByReport(id).subscribe({
      next: (url: string) => {
        if (!url) {
          Swal.fire({
            icon: 'error',
            title: 'No disponible',
            text: 'La evidencia no está disponible en este momento.',
          });
          return;
        }
        // ✅ Cambiar estado a "en proceso" solo si está pendiente
        if (estado.toLowerCase() === 'pendiente') {
          this.reportService.updateStatusToInProcess(id, this.authService.user.id).subscribe({
            next: (res) => {
              console.log('Estado actualizado a en proceso', res);
              // Actualizar estado localmente
              const report = this.reports.find(r => r.id === id);
              if (report) {
                report.estado = 'en proceso';
                this.applyFilters();
              }
            },
            error: (err) => {
              console.error('Error al actualizar estado', err);
            }
          });
        }
        // Abrir la URL en una nueva pestaña del navegador
        window.open(url, '_blank');
      },
      error: () => {
        Swal.fire({
          icon: 'info',
          title: 'Ups',
          text: 'No existe evidencia asociada a este reporte.',
        });
      },
    });
  }

  verDetalle(id: number, estado: string): void {
    // 🔹 Buscar el reporte dentro del array reports
    const reporte = this.reports.find(r => r.id === id);
    if (!reporte) {
      Swal.fire('Error', 'No se encontró el reporte', 'error');
      return;
    }

    // ✅ Abrir modal con SweetAlert2 mostrando la información completa
    Swal.fire({
      title: `Detalle del Reporte #${id}`,
      html: `
    <table style="width: 100%; text-align: left; border-collapse: collapse; border-radius: 8px; overflow: hidden;">
      <tbody>
        <tr style="background-color: #f8f9fa;">
          <td style="padding: 12px 16px; font-weight: 600; color: #495057; width: 35%;">Origen</td>
          <td style="padding: 12px 16px; color: #212529;">${reporte.origen}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px 16px; font-weight: 600; color: #495057;">Tipo</td>
          <td style="padding: 12px 16px; color: #212529;">${reporte.tipo_reporte}</td>
        </tr>
        <tr style="background-color: #f8f9fa;">
          <td style="padding: 12px 16px; font-weight: 600; color: #495057;">Item</td>
          <td style="padding: 12px 16px; color: #212529;">${reporte.item}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px 16px; font-weight: 600; color: #495057;">Prenda</td>
          <td style="padding: 12px 16px; color: #212529;">${reporte.prenda}</td>
        </tr>
        <tr style="background-color: #f8f9fa;">
          <td style="padding: 12px 16px; font-weight: 600; color: #495057;">Observación</td>
          <td style="padding: 12px 16px; color: #212529;">${reporte.observacion || '-'}</td>
        </tr>
      </tbody>
    </table>
  `,
      showCloseButton: true,
    });

    // ✅ Cambiar estado a "en proceso" solo si está pendiente
    if (estado.toLowerCase() === 'pendiente') {
      this.reportService.updateStatusToInProcess(id, this.authService.user.id).subscribe({
        next: (res) => {
          console.log('Estado actualizado a en proceso', res);
          // Actualizar estado localmente
          const report = this.reports.find(r => r.id === id);
          if (report) {
            report.estado = 'en proceso';
            this.applyFilters();
          }
        },
        error: (err) => {
          console.error('Error al actualizar estado', err);
        }
      });
    }
  }

  // Abrir modal y preparar datos
  abrirModalLiberacion(reporte: Report): void {
    this.reporteSeleccionado = reporte;
    this.respuestaLiberacion = '';

    // (re)crear instancia del modal si no existe
    const modalEl = document.getElementById('modalLiberacion');
    if (modalEl) {
      this.modalLiberacionInstance = new bootstrap.Modal(modalEl);
      this.modalLiberacionInstance.show();
    } else {
      console.warn('Modal de liberación no encontrado en el DOM (id=modalLiberacion).');
    }
  }

  // Confirmar liberación: valide y llame al servicio
  confirmarLiberacion(): void {
    if (!this.reporteSeleccionado) {
      Swal.fire('Error', 'No hay reporte seleccionado', 'error');
      return;
    }

    const texto = (this.respuestaLiberacion || '').trim();
    if (!texto) {
      Swal.fire('Atención', 'Debes ingresar una respuesta antes de liberar.', 'warning');
      return;
    }

    if (this.selectedFile) {
      const formData = new FormData();
      formData.append('id', this.reporteSeleccionado.id.toString());
      formData.append('evidencia_respuesta', this.selectedFile);

      this.reportService.saveLiberationEvidence(formData).subscribe({
        next: (res) => {
          const payload = {
            id_reporte: this.reporteSeleccionado!.id,
            liberado_por: this.authService.user.id,
            respuesta: texto,
            evidencia_respuesta: res.url,
          };

          this.reportService.liberarReporte(payload).subscribe({
            next: () => {
              Swal.fire('Liberado', 'El reporte fue liberado correctamente.', 'success');
              this.actualizarReporteLocal();
            },
            error: () => Swal.fire('Error', 'No se pudo liberar el reporte.', 'error'),
          });
        },
        error: (err) => {
          console.error('Error subiendo evidencia:', err);
          Swal.fire('Error', 'No se pudo subir la evidencia.', 'error');
        },
      });
    } else {
      const payload = {
        id_reporte: this.reporteSeleccionado.id,
        liberado_por: this.authService.user.id,
        respuesta: texto,
        evidencia_respuesta: null,
      };
      this.reportService.liberarReporte(payload).subscribe({
        next: (res) => {
          if (this.modalLiberacionInstance) this.modalLiberacionInstance.hide();
          Swal.fire('Liberado', 'El reporte fue liberado correctamente.', 'success');
          this.actualizarReporteLocal();
        },
        error: (err) => {
          console.error('Error al liberar reporte:', err);
          Swal.fire('Error', 'No se pudo liberar el reporte.', 'error');
        }
      });
    }
  }

  // Actualizar reporte localmente después de liberar
  private actualizarReporteLocal(): void {
    const idx = this.reports.findIndex(r => r.id === this.reporteSeleccionado!.id);
    if (idx !== -1) {
      const ahora = new Date().toISOString();
      this.reports[idx].estado = 'liberado';
      this.reports[idx].liberado_por = this.authService.user.id;
      this.reports[idx].fecha_respuesta = ahora;
      this.reports[idx].respuesta = this.respuestaLiberacion;
      this.reports[idx].actualizado_por = this.authService.user.id;
      this.reports[idx].fecha_actualizacion = ahora;
      this.applyFilters();
    } else {
      this.obtenerReportes();
    }
  }
}