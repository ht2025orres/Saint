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

  paginationState: PaginationState | null = null;
  private subscription: Subscription = new Subscription();

  constructor(private paginationService: PaginationService) {}

  ngOnInit(): void {
    console.log('SharedPaginatorComponent inicializado con instanceId:', this.instanceId);
    
    if (!this.instanceId) {
      console.error('SharedPaginatorComponent: instanceId es requerido');
      return;
    }

    // Intentar obtener el estado actual del paginador
    const currentState = this.paginationService.getPaginatorState(this.instanceId);
    console.log('Estado actual del paginador:', currentState);

    if (currentState) {
      this.paginationState = currentState;
      
      // Suscribirse a los cambios del paginador existente
      this.subscription.add(
        this.paginationService.initializePaginator(this.instanceId, currentState.paginator.content)
          .subscribe(state => {
            console.log('Nuevo estado recibido:', state);
            this.paginationState = state;
          })
      );
    } else {
      // Si no hay estado, crear uno vacío temporal
      this.paginationState = {
        currentData: [],
        paginator: {
          content: [],
          totalElements: 0,
          totalPages: 0,
          number: 0,
          numberOfElements: 0,
          size: this.pageSizeOptions[1] || 10
        },
        pages: []
      };
      console.log('Estado temporal creado:', this.paginationState);
    }
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