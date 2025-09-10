import {Component, Input, OnChanges, OnInit, SimpleChanges, Output, EventEmitter} from '@angular/core';

@Component({
  selector: 'app-paginador',
  templateUrl: './paginador.component.html',
  styleUrls: ['./paginador.component.css']
})
export class PaginadorComponent implements OnInit, OnChanges {

  @Input() paginator: any;
  @Output() pageChange = new EventEmitter<number>();
  
  pages: number[];
  begin: number;
  end: number;
  
  // Exponer Math para usar en el template
  Math = Math;

  constructor() { }

  ngOnInit(): void {
    this.initPaginator();
  }

  ngOnChanges(changes: SimpleChanges) {
    const paginatorUpdate = changes.paginator;

    if (paginatorUpdate.previousValue) {
      this.initPaginator();
    }
  }

  /**
   * Maneja el clic en una página específica
   * Ya no navega por router, solo emite el evento
   */
  onPageClick(page: number, event: Event) {
    event.preventDefault();
    if (page >= 0 && page < this.paginator.totalPages) {
      this.pageChange.emit(page);
    }
  }

  /**
   * Navega a la página anterior
   */
  goToPrevious(event: Event) {
    event.preventDefault();
    if (this.paginator.number > 0) {
      this.pageChange.emit(this.paginator.number - 1);
    }
  }

  /**
   * Navega a la página siguiente
   */
  goToNext(event: Event) {
    event.preventDefault();
    if (this.paginator.number < this.paginator.totalPages - 1) {
      this.pageChange.emit(this.paginator.number + 1);
    }
  }

  /**
   * Navega a la primera página
   */
  goToFirst(event: Event) {
    event.preventDefault();
    if (this.paginator.number > 0) {
      this.pageChange.emit(0);
    }
  }

  /**
   * Navega a la última página
   */
  goToLast(event: Event) {
    event.preventDefault();
    const lastPage = this.paginator.totalPages - 1;
    if (this.paginator.number < lastPage) {
      this.pageChange.emit(lastPage);
    }
  }

  private initPaginator(): void {
    if (!this.paginator || this.paginator.totalPages <= 0) {
      this.pages = [];
      return;
    }

    this.begin = Math.min(Math.max(1, this.paginator.number - 4), this.paginator.totalPages - 5);
    this.end = Math.max(Math.min(this.paginator.totalPages, this.paginator.number + 4), 6);

    if (this.paginator.totalPages > 5) {
      this.pages = new Array(this.end - this.begin + 1).fill(0)
          .map((valor, indice) => indice + this.begin);
    }
    else {
      this.pages = new Array(this.paginator.totalPages).fill(0)
          .map((valor, indice) => indice + 1);
    }
  }
}