import { Component, OnInit } from '@angular/core';
import { ReportService } from '../../../services/report.service';
import { AuthService } from '../../../services/auth.service';
import { Report } from '../../../models/report';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-mi-report-list',
  templateUrl: './mi-report-list.component.html',
  styleUrl: './mi-report-list.component.css'
})
export class MiReportListComponent implements OnInit {
  // Paginación
  paginatorId = 'mi-reports-paginator';
  
  reports: Report[] = [];
  currentReports: Report[] = [];
  loading = false;

  // Filtros
  filters = {
    busqueda: '',
    origen: '',
    tipo: '',
    estado: ''
  };

  constructor(
    private reportService: ReportService,
    private authService: AuthService,
    public paginationService: PaginationService
  ) {}

  ngOnInit(): void {
    this.obtenerReportes();
  }

  // ✅ Cargar los reportes del usuario autenticado
  obtenerReportes(): void {
    this.loading = true;
    const userId = this.authService.user.id;

    this.reportService.getReportsByUser(userId).subscribe({
      next: (res) => {
        this.reports = res.data || [];
        
        // Inicializar paginador
        this.paginationService.initializePaginator(
          this.paginatorId,
          this.reports,
          10, // Tamaño de página por defecto
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

  // Función de filtrado
  filterFunction: FilterFunction = (report: Report, filtros: any) => {
    const busqueda = (filtros.busqueda || '').toLowerCase().trim();
    const origen = (filtros.origen || '').toLowerCase().trim();
    const tipo = (filtros.tipo || '').toLowerCase().trim();
    const estado = (filtros.estado || '').toLowerCase().trim();

    // Filtro por búsqueda general - BUSCA EN TODOS LOS CAMPOS
    if (busqueda) {
      const matchBusqueda = 
        (report.id?.toString() || '').toLowerCase().includes(busqueda) ||
        (report.origen || '').toLowerCase().includes(busqueda) ||
        (report.tipo_reporte || '').toLowerCase().includes(busqueda) ||
        (report.item || '').toLowerCase().includes(busqueda) ||
        (report.cliente || '').toLowerCase().includes(busqueda) ||
        (report.prenda || '').toLowerCase().includes(busqueda) ||
        (report.estado || '').toLowerCase().includes(busqueda) ||
        (report.fecha_creacion?.toString() || '').toLowerCase().includes(busqueda) ||
        (report.fecha_actualizacion?.toString() || '').toLowerCase().includes(busqueda);
      
      if (!matchBusqueda) return false;
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
      origen: '',
      tipo: '',
      estado: ''
    };
    this.applyFilters();
  }

  // Obtener valores únicos para filtros de dropdown
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
      this.reportService.GetEvidenceLiberationByReport(id).subscribe({
        next: (url: string) => {
          if (!url) {
            Swal.fire({
              icon: 'error',
              title: 'No disponible',
              text: 'La evidencia no está disponible en este momento.',
            });
            return;
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

}