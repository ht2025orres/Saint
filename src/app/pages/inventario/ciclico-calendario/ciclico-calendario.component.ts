import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { InventarioService } from 'src/app/services/inventario.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-ciclico-calendario',
  templateUrl: './ciclico-calendario.component.html',
  styleUrls: ['./ciclico-calendario.component.css']
})
export class CiclicoCalendarioComponent implements OnInit {
  viewDate: Date = new Date();
  days: any[] = [];
  eventos: any = {};
  firstDayOffset: number = 0;
  bodegaOrigen: string = '';
  monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  years: number[] = [];

  // Rango de fechas
  startDate: string | null = null;
  endDate: string | null = null;
  loadingItems: boolean = false;

  constructor(
    private inventarioService: InventarioService,
    private route: ActivatedRoute
  ) { 
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      this.years.push(i);
    }
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.bodegaOrigen = params['bodega'] || '';
    });
    this.cargarEventos();
  }

  onMonthChange(month: string) {
    this.viewDate = new Date(this.viewDate.getFullYear(), parseInt(month), 1);
    this.cargarEventos();
  }

  onYearChange(year: string) {
    this.viewDate = new Date(parseInt(year), this.viewDate.getMonth(), 1);
    this.cargarEventos();
  }

  cargarEventos() {
    this.inventarioService.getCiclicoEventos(this.bodegaOrigen).subscribe(resp => {
      if (resp.success) {
        this.eventos = {};
        resp.data.forEach((ev: any) => {
          this.eventos[ev.fecha] = ev.total;
        });
        this.generateCalendar();
      }
    });
  }

  generateCalendar() {
    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    this.firstDayOffset = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    this.days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      this.days.push({
        day: i,
        date: dateStr,
        hasEvents: !!this.eventos[dateStr],
        totalEvents: this.eventos[dateStr] || 0
      });
    }
  }

  isToday(dateStr: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  }

  prevMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
    this.cargarEventos();
  }

  nextMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
    this.cargarEventos();
  }

  async verDetallesDia(day: any) {
    if (!day) return;

    // Lógica de selección de rango
    if (!this.startDate || (this.startDate && this.endDate)) {
      // Nueva selección: primer clic establece el inicio
      this.startDate = day.date;
      this.endDate = null;
    } else {
      // Segundo clic establece el fin (o el mismo día si se repite)
      const secondDate = day.date;
      
      if (new Date(this.startDate) > new Date(secondDate)) {
        // Si el segundo clic es antes del primero, lo tomamos como nuevo inicio
        this.startDate = secondDate;
        this.endDate = null;
      } else {
        this.endDate = secondDate;
      }
    }
  }

  consultarSeleccion() {
    if (!this.startDate) return;

    if (!this.endDate || this.startDate === this.endDate) {
      this.fetchAndShowItems(this.startDate);
    } else {
      this.fetchAndShowRangeItems(this.startDate, this.endDate);
    }
  }

  fetchAndShowItems(fecha: string) {
    this.loadingItems = true;
    this.inventarioService.getCiclicoPorFecha(fecha, this.bodegaOrigen).subscribe(resp => {
      this.loadingItems = false;
      if (resp.success) {
        if (resp.data.length > 0) {
          this.mostrarModalDetalles(`Día ${fecha}`, resp.data);
        } else {
          Swal.fire('Sin conteos', `No se realizaron conteos el día ${fecha} en esta bodega`, 'info');
          this.resetSelection();
        }
      }
    });
  }

  fetchAndShowRangeItems(inicio: string, fin: string) {
    this.loadingItems = true;
    this.inventarioService.getCiclicoPorRango(inicio, fin, this.bodegaOrigen).subscribe(resp => {
      this.loadingItems = false;
      if (resp.success) {
        if (resp.data.length > 0) {
          this.mostrarModalDetalles(`Rango ${inicio} a ${fin}`, resp.data);
        } else {
          Swal.fire('Sin conteos', `No se realizaron conteos en el rango seleccionado en esta bodega`, 'info');
          this.resetSelection();
        }
      }
    });
  }

  resetSelection() {
    this.startDate = null;
    this.endDate = null;
  }

  isInRange(dateStr: string): boolean {
    if (!this.startDate || !this.endDate) return false;
    const date = new Date(dateStr);
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    return date >= start && date <= end;
  }

  isStartDate(dateStr: string): boolean {
    return dateStr === this.startDate;
  }

  isEndDate(dateStr: string): boolean {
    return dateStr === this.endDate;
  }

  mostrarModalDetalles(titulo: string, conteos: any[]) {
    let rows = '';
    conteos.forEach(c => {
      rows += `
        <tr>
          <td>${c.referencia}</td>
          <td>${c.cantidad_fisica}</td>
          <td>$${new Intl.NumberFormat().format(c.valor_unitario)}</td>
          <td>${c.usuario?.nombre_completo || 'N/A'}</td>
        </tr>
      `;
    });

    Swal.fire({
      title: `Conteos: ${titulo}`,
      html: `
        <div class="table-responsive">
          <table class="table table-sm table-striped" style="font-size: 12px;">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Cant</th>
                <th>Valor Uni</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `,
      width: '800px',
      confirmButtonText: 'Cerrar'
    });
  }
}
