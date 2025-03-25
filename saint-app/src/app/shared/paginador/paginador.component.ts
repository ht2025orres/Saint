import {Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-paginador',
  templateUrl: './paginador.component.html',
  styleUrls: ['./paginador.component.css']
})
export class PaginadorComponent implements OnInit, OnChanges {

  @Input() paginator: any;
  pages: number[];
  begin: number;
  end: number;
  status: string

  constructor(private activatedRoute: ActivatedRoute) { }

  ngOnInit(): void {
    this.initPaginator();
    this.activatedRoute.paramMap.subscribe(params => {
      this.status = params.get('status');
  });
  }

  ngOnChanges(changes: SimpleChanges) {
    const paginatorUpdate = changes.paginator;

    if (paginatorUpdate.previousValue) {
      this.initPaginator();
    }
  }


  private initPaginator(): void {
    this.begin = Math.min(Math.max(1, this.paginator.number - 4), this.paginator.totalPages - 5);
    this.end = Math.max(Math.min(this.paginator.totalPages, this.paginator.number + 4), 6);

    if (this.paginator.totalPages > 5) {
      this.pages = new Array(this.end - this.begin + 1).fill(0)
          .map((valor, indice) => indice + this.begin);
    }
    else {
      this.pages = new Array(this.paginator.totalPages).fill(0)
          .map((valor, indice) => indice + 1);
    }
  }
}
