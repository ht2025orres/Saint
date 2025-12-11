import { Component } from '@angular/core';
import { TechnicalDataSheetsReportService } from '../../services/technical-data-sheets-report.service';
import Swal from 'sweetalert2';
import { takeUntil, tap } from 'rxjs/operators';
import { TechnicalDataSheet } from '../../models/TechnicalDataSheet';
import { Chart } from 'chart.js';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import * as moment from 'moment';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-technical-data-sheets-report',
  templateUrl: './technical-data-sheets-report.component.html',
  styleUrls: ['./technical-data-sheets-report.component.css']
})
export class TechnicalDataSheetsReportComponent {
  private destroy$ = new Subject<void>();
  
  loading = false; 
  pages: number[];
  paginator: any;
  isModalOpen: boolean = false;
  filtrotabla: any;
  filteredTable: TechnicalDataSheet[] = [];
  filterGrafi: TechnicalDataSheet[] = [];
  datos_table: TechnicalDataSheet[] = [];
  cantidadop: number = 0;
  cantidadfc: number = 0;
  cantidadfcs: number = 0;
  chart: any;
  datosFiltro: TechnicalDataSheet[] = [];
  // Agregar estas nuevas propiedades
  textoFiltro: string = '';
  tipoFiltro: string = 'todos'; // Filtro predeterminado
  months = [
    { value: '1', name: 'Enero' },
    { value: '2', name: 'Febrero' },
    { value: '3', name: 'Marzo' },
    { value: '4', name: 'Abril' },
    { value: '5', name: 'Mayo' },
    { value: '6', name: 'Junio' },
    { value: '7', name: 'Julio' },
    { value: '8', name: 'Agosto' },
    { value: '9', name: 'Septiembre' },
    { value: '10', name: 'Octubre' },
    { value: '11', name: 'Noviembre' },
    { value: '12', name: 'Diciembre' }
  ];
  years = Array.from(
    { length: moment().year() - 2020 },
    (_, i) => moment().year() - i
  ).sort((a, b) => b - a);

  selectedMonth: number = (moment().month() + 1);// Convertimos a string porque el <select> usa strings
  selectedYear: number = moment().year();
  
  constructor(private technicalreportservices: TechnicalDataSheetsReportService) { }

  ngOnInit(): void {
    this.reloadListdb();
  }
  
  reloadListdb() {
    this.loading = true;
    this.technicalreportservices.getAlldb()
      .pipe(
        tap((response: TechnicalDataSheet[]) => {
          this.datos_table = response;
          this.datosFiltro = this.datos_table;
          this.filteredTable = this.datos_table.slice(0, 15);
          this.configurePaginator(this.datos_table);
          this.filterByMonth();
        }),
        takeUntil(this.destroy$) // Cerrar la suscripción cuando destroy$ emita
      )
      .subscribe({
        next: () => this.loading = false,
        error: () => {
          Swal.fire('Error', 'No se han podido cargar los datos', 'error');
          this.loading = false;
        }
      });
  }
  setDefaultFilters() {
    const now = moment();
    this.selectedMonth = now.month() + 1; // Moment.js usa meses de 0-11, sumamos 1.
    this.selectedYear = now.year();
  }
  
  filterByMonth(): void {
    if (!this.selectedMonth || !this.selectedYear) return;
  
    this.filterGrafi = this.datos_table.filter(item => {
    if (!item.date_creation) return false;
    
    // Parsear la fecha usando moment directamente
    const itemDate = moment(item.date_creation, 'YYYY-MM-DD');
    const itemYear = itemDate.year();
    const itemMonth = itemDate.month() + 1;

    return itemYear === Number(this.selectedYear) && itemMonth === Number(this.selectedMonth);
    });
  
    // Actualizar contadores y gráfico
    this.cantidadop = this.countMatchingItems('OPM');
    this.cantidadfc = this.countMatchingItems('FICHA TECNICA');
    this.cantidadfcs = this.countMatchingItems('FICHAS TECNICAS');
  
    if (this.chart) {
      this.chart.destroy();
    }
    this.createChart();
  }
  
  
  resetFilters() {
    this.setDefaultFilters(); // Llamamos la función que pone los valores por defecto
    this.filterByMonth();
  }
  
  
  aplicarFiltro(): void {
    // Si no hay filtro, restaurar datos originales
    if (!this.textoFiltro.trim() && this.tipoFiltro === 'todos') {
      this.datosFiltro = this.datos_table;
      this.filteredTable = this.datosFiltro.slice(0, this.paginator.size);
      this.configurePaginator(this.datosFiltro);
      return;
    }

    const textoBusqueda = this.textoFiltro.toLowerCase().trim();

    // Aplicar filtro
    this.datosFiltro = this.datos_table.filter(item => {
      if (this.tipoFiltro !== 'todos') {
        const valor = {
          'codigoItem': item.id_item,
          'tipo': item.technical_data_sheet_type,
          'fecha': item.date_creation instanceof Date ? item.date_creation.toLocaleDateString() : String(item.date_creation),
          'estado': item.status
        }[this.tipoFiltro];
        return valor?.toLowerCase().includes(textoBusqueda);
      }
      
      return (
        item.id_item?.toLowerCase().includes(textoBusqueda) ||
        item.technical_data_sheet_type?.toLowerCase().includes(textoBusqueda) ||
        String(item.date_creation).toLowerCase().includes(textoBusqueda) ||
        item.status?.toLowerCase().includes(textoBusqueda)
      );
    });

    // Actualizar tabla y paginador
    this.filteredTable = this.datosFiltro.slice(0, this.paginator.size);
    this.configurePaginator(this.datosFiltro);
    this.paginator.number = 0;
  }
  
  // Método para limpiar el filtro sin recargar la página
  limpiarFiltro(): void {
    this.textoFiltro = '';
    this.tipoFiltro = 'todos';
    this.datosFiltro = this.datos_table;
    this.filteredTable = this.datosFiltro.slice(0, this.paginator.size);
    this.configurePaginator(this.datos_table);
  }
  
   // Nuevo método para recargar la tabla
  recargarTabla(): void {
    // Recargar los datos originales
    this.reloadListdb();
    
    // Reiniciar la paginación
    this.configurePaginator(this.datos_table);
    this.filteredTable = this.datos_table.slice(0, this.paginator.size);
    this.datosFiltro = this.datos_table
    // Volver a la primera página
    if (this.paginator) {
      this.paginator.number = 0;
      this.initPaginator(this.paginator);
    }
  }
  countMatchingItems(value: string): number {
    return this.filterGrafi.filter(item => {
      if (!item.date_creation) return false;
      
      const itemDate = moment(item.date_creation, 'YYYY-MM-DD');
      const matchesType = item.technical_data_sheet_type?.toUpperCase().includes(value.toUpperCase());
  
      return matchesType;
    }).length;
  }

  createChart() {
    this.chart = new Chart("MyChart", {
      type: 'bar',
      data: {
        labels: ['Categorías Del Reporte Grafico'],
        datasets: [
          {
            label: "OPM",
            data: [this.cantidadop],
            backgroundColor: '#90A4AE',
            borderColor: '#000',
            borderWidth: 1,
          },
          {
            label: "FICHAS TECNICAS",
            data: [this.cantidadfcs],
            backgroundColor: '#5C6BC0',
            borderColor: '#000',
            borderWidth: 1,
          },
          {
            label: "FICHA TECNICA",
            data: [this.cantidadfc],
            backgroundColor: '#64B5F6',
            borderColor: '#000',
            borderWidth: 1,
          }
        ]
      },
      options: {
        responsive: true,
        aspectRatio: 2.5,
        scales: {
          y: {
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  private configurePaginator(data: TechnicalDataSheet[]): void {
    const pageSize = 15;
    this.paginator = {
      content: data,
      totalElements: data.length,
      totalPages: Math.ceil(data.length / pageSize),
      number: 0,
      numberOfElements: Math.min(pageSize, data.length),
      size: pageSize
    };
    this.initPaginator(this.paginator);
  }
  

  private initPaginator(response: any): void {
    const begin = Math.min(Math.max(1, response.number - 4), response.totalPages - 5);
    const end = Math.max(Math.min(response.totalPages, response.number + 4), 6);

    if (response.totalPages > 5) {
      this.pages = new Array(end - begin + 1).fill(0)
        .map((valor, indice) => indice + begin);
    } else {
      this.pages = new Array(response.totalPages).fill(0)
        .map((valor, indice) => indice + 1);
    }
  }

  changePage(page: number): void {
    const startIndex = page * this.paginator.size;
    this.filteredTable = this.datosFiltro.slice(startIndex, startIndex + this.paginator.size);
    this.paginator.number = page;
    this.initPaginator(this.paginator);
  }
  
  getStartIndex(): number {
    return this.paginator.number * this.paginator.size + 1;
  }
  
  getEndIndex(): number {
    const endIndex = (this.paginator.number + 1) * this.paginator.size;
    return Math.min(endIndex, this.paginator.totalElements);
  }

  openModal(): void {
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  download(format: string): void {
    if (format === 'excel') {
      this.exportToExcel();
    } else if (format === 'pdf') {
      this.exportToPDF();
    }
    this.closeModal();
  }
  exportToExcel(): void {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.datosFiltro);
    const workbook: XLSX.WorkBook = {
      Sheets: { 'DatosTabla': worksheet },
      SheetNames: ['DatosTabla']
    };
  
    // Formato: "2025-02-13 08:17 AM"
    const now = moment().format('YYYY-MM-DD hh:mm A'); 
  
    // Nombre del archivo con la fecha y hora
    const fileName = `Reporte Fichas ${now}.xlsx`;
  
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data: Blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(data, fileName);
  }
  

  private exportToPDF(): void {
    try {
       //Crear PDF en modo horizontal
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
 
      doc.setFontSize(16);
      doc.text('Reporte de Datos', 15, 15);
     
       //Preparar datos para la tabla (usar filteredTable)
      const tableData = this.filteredTable.map((item, index) => [
        (index + 1).toString(),
        item.id_item || '',
        item.technical_data_sheet_type || '',
        // Compatibilidad con versiones anteriores de Angular
        item.date_creation && item.date_creation.toDate ? 
          item.date_creation.toDate().toLocaleDateString() : 
          (item.date_creation || ''),
        item.status || ''
      ]);
     
      // Uso de autoTable con verificación de tipado
      (doc as any).autoTable({
        head: [['#', 'Código ítem CFIP', 'Tipo', 'Última modificación', 'Estado']],
        body: tableData,
        startY: 25,
        styles: { 
          fontSize: 8, 
          cellPadding: 2 
        },
        headStyles: {
          fillColor: [63, 81, 181],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold'
        },
        alternateRowStyles: { 
          fillColor: [245, 245, 245] 
        },
        margin: { top: 25 },
        theme: 'grid'
      });
     
     //  Añadir marca de tiempo
      const timestamp = `Fecha de generación: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      doc.setFontSize(8);
      doc.text(timestamp, 15, doc.internal.pageSize.height - 10);
     
     //  Guardar PDF
      doc.save(`Reporte_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      Swal.fire('Error', 'No se pudo generar el PDF', 'error');
    }
  }

  getVisiblePages(): number[] {
    const maxVisible = 6;
    const totalPages = this.paginator.totalPages;
    const currentPage = this.paginator.number + 1; // Convertir a índice basado en 1
  
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
  
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
  
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  ngOnDestroy() {
    this.destroy$.next(); // Cerrar suscripciones
    this.destroy$.complete();
  
    // Limpiar el estado si es necesario
    this.datos_table = [];
    this.datosFiltro = [];
    this.filteredTable = [];
    this.loading = false;
  
    // Destruir el gráfico si existe
    if (this.chart) {
      this.chart.destroy();
    }
  }
}