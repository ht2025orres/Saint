import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { PaginationService, PaginationState } from '../pagination.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-shared-paginator',
  templateUrl: './shared-paginator.component.html',
  styleUrls: ['./shared-paginator.component.css']
})
export class SharedPaginatorComponent implements OnInit, OnDestroy {
  @Input() instanceId!: string;
  @Input() showPageSizeSelector: boolean = true;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50, 100];
  @Input() defaultPageSize: number = 10;
  @Input() noDataMessage: string = 'No se encontraron datos';
  @Input() loading: boolean = false;

  paginationState: PaginationState | null = null;
  private subscription: Subscription = new Subscription();

  constructor(private paginationService: PaginationService) {}

  ngOnInit(): void {
    if (!this.instanceId) {
      console.error('SharedPaginatorComponent: instanceId es requerido');
      return;
    }

    // Suscribirse al observable del paginador (si no existe, el servicio lo crea con estado inicial)
    this.subscription.add(
      this.paginationService.getOrCreateObservable(this.instanceId, this.defaultPageSize)
        .subscribe(state => {
          this.paginationState = state;
        })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  changePage(page: number): void {
    console.log('Cambiando a página:', page);
    this.paginationService.changePage(this.instanceId, page);
  }

  onPageSizeChange(newSize: number): void {
    console.log('Cambiando tamaño de página:', newSize);
    this.paginationService.changePageSize(this.instanceId, newSize);
  }

  getStartIndex(): number {
    return this.paginationState 
      ? this.paginationService.getStartIndex(this.paginationState.paginator)
      : 0;
  }

  getEndIndex(): number {
    return this.paginationState 
      ? this.paginationService.getEndIndex(this.paginationState.paginator)
      : 0;
  }
}