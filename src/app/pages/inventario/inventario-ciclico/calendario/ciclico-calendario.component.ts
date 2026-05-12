import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-ciclico-calendario',
  templateUrl: './ciclico-calendario.component.html',
  styleUrls: ['./ciclico-calendario.component.css']
})
export class CiclicoCalendarioComponent implements OnInit, OnChanges {
  @Input() viewDate: Date = new Date();
  @Input() eventos: any = {}; // Object where keys are dates (YYYY-MM-DD) and values are event counts
  @Input() bodegaOrigen: string = '';
  @Input() loadingItems: boolean = false;
  @Input() startDate: string | null = null;
  @Input() endDate: string | null = null;
  @Input() years: number[] = [];

  @Output() monthChange = new EventEmitter<number>();
  @Output() yearChange = new EventEmitter<number>();
  @Output() prevMonth = new EventEmitter<void>();
  @Output() nextMonth = new EventEmitter<void>();
  @Output() daySelected = new EventEmitter<string>(); // Emits the date string of the selected day
  @Output() consultarSeleccion = new EventEmitter<void>();
  @Output() resetSelection = new EventEmitter<void>();

  days: any[] = [];
  firstDayOffset: number = 0;
  monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  constructor() { }

  ngOnInit(): void { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['viewDate'] || changes['eventos']) {
      this.generateCalendar();
    }
  }

  onMonthSelect(month: string) {
    this.monthChange.emit(parseInt(month));
  }

  onYearSelect(year: string) {
    this.yearChange.emit(parseInt(year));
  }

  onPrevClick() {
    this.prevMonth.emit();
  }

  onNextClick() {
    this.nextMonth.emit();
  }

  onDayClick(day: any) {
    if (day && day.date) {
      this.daySelected.emit(day.date);
    }
  }

  onConsultarClick() {
    this.consultarSeleccion.emit();
  }

  onResetClick() {
    this.resetSelection.emit();
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


}
