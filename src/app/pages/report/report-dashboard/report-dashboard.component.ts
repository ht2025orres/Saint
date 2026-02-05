import { Component, OnInit, OnDestroy } from '@angular/core';
import { ReportService } from '../../../services/report.service';
import { Chart, registerables } from 'chart.js';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

Chart.register(...registerables);

interface Month {
  name: string;
  value: string;
}

@Component({
  selector: 'app-report-dashboard',
  templateUrl: './report-dashboard.component.html',
  styleUrls: ['./report-dashboard.component.css']
})
export class ReportDashboardComponent implements OnInit, OnDestroy {
  // Datos
  reports: any[] = [];
  allReports: any[] = []; // Copia para filtrado
  loading = false;
  searchTerm = '';
  errorMessage = '';

  // Filtros de fecha
  selectedMonth: string;
  selectedYear: number;
  
  months: Month[] = [
    { name: 'Enero', value: '01' },
    { name: 'Febrero', value: '02' },
    { name: 'Marzo', value: '03' },
    { name: 'Abril', value: '04' },
    { name: 'Mayo', value: '05' },
    { name: 'Junio', value: '06' },
    { name: 'Julio', value: '07' },
    { name: 'Agosto', value: '08' },
    { name: 'Septiembre', value: '09' },
    { name: 'Octubre', value: '10' },
    { name: 'Noviembre', value: '11' },
    { name: 'Diciembre', value: '12' }
  ];
  
  years: number[] = [];

  // Resumen
 resumen: any = {
  total: 0,
  con_respuesta: 0,
  cumplen: 0,
  porcentaje_cumplimiento: 0,
  resumen_diario: []
};
  // Gráficas
  chartUsuarios: Chart | null = null;
  chartEstados: any ;

  constructor(private reportService: ReportService) {
    // Inicializar con fecha actual
    const current = new Date();
    this.selectedMonth = (current.getMonth() + 1).toString().padStart(2, '0');
    this.selectedYear = current.getFullYear();
    
    // Generar últimos 5 años
    this.years = Array.from({ length: 5 }, (_, i) => current.getFullYear() - i);
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    // Destruir gráficas al salir del componente
    this.destroyCharts();
  }

  /**
   * Carga los datos del dashboard
   */
  loadDashboard(): void {
  this.loading = true;
  this.errorMessage = '';

  const year = this.selectedYear;
  const month = parseInt(this.selectedMonth, 10);

  this.reportService.getDashboardData(year, month).subscribe({
    next: (response) => {
      if (response.reportes && response.resumen) {
        this.allReports = response.reportes;
        this.reports = [...this.allReports];
        this.resumen = response.resumen;

        // ✅ Calcular cumplimiento
        const total = this.resumen.total || 0;
        const liberados = this.resumen.liberados || 0;
        const pendientes = this.resumen.pendientes || 0;

        this.resumen.cumplen = liberados;
        this.resumen.porcentaje_cumplimiento =
          total > 0 ? ((liberados / total) * 100).toFixed(2) : 0;

        // ✅ Renderizar las gráficas
        if (response.topUsuarios && response.estados) {
          this.renderCharts(response.topUsuarios, response.estados);
        }
      } else {
        this.errorMessage = 'Estructura de datos inválida en la respuesta.';
      }

      this.loading = false;
    },
    error: (error) => {
      console.error('Error al cargar dashboard:', error);
      this.errorMessage = 'Error al conectar con el servidor';
      this.loading = false;
    }
  });
}


  /**
   * Aplica filtro de búsqueda
   */
  applyFilter(): void {
    if (!this.searchTerm.trim()) {
      this.reports = [...this.allReports];
      return;
    }

    const term = this.searchTerm.toLowerCase().trim();
    this.reports = this.allReports.filter(report =>
      Object.values(report).some(value =>
        value?.toString().toLowerCase().includes(term)
      )
    );
  }

  /**
   * Limpia filtros y recarga
   */
  resetFilter(): void {
    this.searchTerm = '';
    this.reports = [...this.allReports];
  }

  /**
   * Retorna reportes filtrados (para usar en template)
   */
  filteredReports(): any[] {
    return this.reports;
  }

  /**
   * Renderiza las gráficas
   */
  renderCharts(topUsuarios: any, estados: any): void {
    // Destruir gráficas anteriores
    this.destroyCharts();

    // Esperar a que el DOM se actualice
    setTimeout(() => {
      this.createUsuariosChart(topUsuarios);
      this.createEstadosChart(estados);
    }, 100);
  }

  /**
   * Crea gráfica de usuarios
   */
  private createUsuariosChart(topUsuarios: any): void {
  const canvas = document.getElementById('chartUsuarios') as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Destruir el gráfico anterior si ya existe
  if (this.chartUsuarios) {
    this.chartUsuarios.destroy();
  }

  this.chartUsuarios = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(topUsuarios),
      datasets: [{
        label: 'Reportes por Usuario',
        data: Object.values(topUsuarios),
        fill: false,
        borderColor: '#007bff',
        backgroundColor: '#007bff',
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#007bff',
        pointStyle: 'triangle',
        pointRadius: 8,
        pointHoverRadius: 10,
        borderWidth: 3,
        tension: 0.4 // suaviza las líneas
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#333',
            font: { size: 13, weight: 'bold' }
          }
        },
        title: {
          display: true,
          text: 'Top 5 Usuarios con Más Reportes',
          color: '#333',
          font: { size: 16, weight: 'bold' },
          padding: { top: 10, bottom: 20 }
        },
        tooltip: {
          backgroundColor: '#0056b3',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: (context) => ` ${context.parsed.y} reportes`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#333',
            font: { size: 12 }
          },
          grid: {
            color: '#e5e5e5'
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#333',
            stepSize: 1,
            font: { size: 12 }
          },
          grid: {
            color: '#e5e5e5'
          }
        }
      }
    }
  });
}


  /**
   * Crea gráfica de estados
   */
  private createEstadosChart(estados: any): void {
    const canvas = document.getElementById('chartEstados') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.chartEstados = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(estados),
        datasets: [{
          data: Object.values(estados),
          backgroundColor: [
            '#007bff',
            '#ffc107',
            '#28a745',
            '#dc3545',
            '#6c757d'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'right'
          }
        }
      }
    });
  }

  /**
   * Destruye las gráficas
   */
  private destroyCharts(): void {
    if (this.chartUsuarios) {
      this.chartUsuarios.destroy();
      this.chartUsuarios = null;
    }
    if (this.chartEstados) {
      this.chartEstados.destroy();
      this.chartEstados = null;
    }
  }

  exportarExcel(): void {
    if (!this.reports.length) {
      alert('No hay datos para exportar');
      return;
    }

    // 🔹 Mapear datos con nombres amigables
    const data = this.reports.map(r => ({
      ID: r.id,
      OP: r.op_reporte,
      Cliente: r.cliente,
      Usuario: r.usuario,
      Estado: r.estado,
      Prioridad: r.prioridad,
      'Fecha Creación': r.fecha_creacion
        ? new Date(r.fecha_creacion).toLocaleString()
        : '',
      'Fecha Respuesta': r.fecha_respuesta
        ? new Date(r.fecha_respuesta).toLocaleString()
        : '',
      'Tiempo Atención (h)': (r.minutos_laborales / 60).toFixed(2)
    }));

    // 🔹 Crear hoja
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

    // 🔹 Crear libro
    const workbook: XLSX.WorkBook = {
      Sheets: { Reporte: worksheet },
      SheetNames: ['Reporte']
    };

    // 🔹 Exportar
    const excelBuffer: any = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const blob = new Blob([excelBuffer], {
      type: 'application/octet-stream'
    });

    const nombreArchivo = `reporte_fichas_${this.selectedYear}_${this.selectedMonth}.xlsx`;

    saveAs(blob, nombreArchivo);
  }
}