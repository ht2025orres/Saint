// pagination.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface PaginatorConfig {
  content: any[];
  totalElements: number;
  totalPages: number;
  number: number;
  numberOfElements: number;
  size: number;
}

export interface PaginationState {
  [x: string]: any;
  currentData: any[];
  paginator: PaginatorConfig;
  pages: number[];
}

export interface FilterFunction<T = any> {
  (item: T, filters: any): boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PaginationService {
  private paginationStates = new Map<string, BehaviorSubject<PaginationState>>();

  constructor() { }

  /**
   * Inicializa un paginador para una interfaz específica
   */
  initializePaginator(
    instanceId: string, 
    data: any[], 
    pageSize: number = 10,
    filters?: any,
    filterFunction?: FilterFunction
  ): Observable<PaginationState> {
    
    if (!this.paginationStates.has(instanceId)) {
      const initialState: PaginationState = {
        currentData: [],
        paginator: {
          content: [],
          totalElements: 0,
          totalPages: 0,
          number: 0,
          numberOfElements: 0,
          size: pageSize
        },
        pages: []
      };
      this.paginationStates.set(instanceId, new BehaviorSubject(initialState));
    }

    this.updatePaginator(instanceId, data, pageSize, filters, filterFunction);
    
    return this.paginationStates.get(instanceId)!.asObservable();
  }

  /**
   * Actualiza los datos del paginador (útil cuando cambian los filtros)
   */
  updatePaginator(
    instanceId: string, 
    data: any[], 
    pageSize?: number,
    filters?: any,
    filterFunction?: FilterFunction,
    preservePage: boolean = false
  ): void {
    const subject = this.paginationStates.get(instanceId);
    if (!subject) return;

    const currentState = subject.value;
    const actualPageSize = pageSize || currentState.paginator.size;

    // Aplicar filtros si existen
    let filteredData = data;
    if (filters && filterFunction) {  
      filteredData = data.filter(item => filterFunction(item, filters));
    }

    // Configurar paginador
    const totalPages = Math.ceil(filteredData.length / actualPageSize);
    const currentPage = preservePage ? currentState.paginator.number : 0;
    const safePage = Math.min(Math.max(currentPage, 0), Math.max(totalPages - 1, 0));

    const paginator: PaginatorConfig = {
      content: filteredData,
      totalElements: filteredData.length,
      totalPages,
      number: safePage,
      numberOfElements: Math.min(actualPageSize, filteredData.length),
      size: actualPageSize
    };

    // Calcular páginas visibles
    const pages = this.calculateVisiblePages(paginator);

    // Obtener datos de la página actual
    const currentData = this.getCurrentPageData(filteredData, paginator);

    const newState: PaginationState = {
      currentData,
      paginator,
      pages
    };

    subject.next(newState);
  }

  /**
   * Cambia a una página específica
   */
  changePage(instanceId: string, page: number): void {
    const subject = this.paginationStates.get(instanceId);
    if (!subject) return;

    const currentState = subject.value;
    const newPaginator = { ...currentState.paginator, number: page };
    
    const currentData = this.getCurrentPageData(newPaginator.content, newPaginator);
    const pages = this.calculateVisiblePages(newPaginator);

    const newState: PaginationState = {
      currentData,
      paginator: newPaginator,
      pages
    };

    subject.next(newState);

    // Scroll automático al paginador
    setTimeout(() => {
      const paginatorElement = document.querySelector(`[data-paginator-id="${instanceId}"]`);
      if (paginatorElement) {
        paginatorElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 0);
  }

  /**
   * Cambia el tamaño de página
   */
  changePageSize(instanceId: string, newPageSize: number): void {
    const subject = this.paginationStates.get(instanceId);
    if (!subject) return;

    const currentState = subject.value;
    const paginator: PaginatorConfig = {
      ...currentState.paginator,
      size: newPageSize,
      totalPages: Math.ceil(currentState.paginator.totalElements / newPageSize),
      number: 0, // Reset a primera página
      numberOfElements: Math.min(newPageSize, currentState.paginator.totalElements)
    };

    const currentData = this.getCurrentPageData(currentState.paginator.content, paginator);
    const pages = this.calculateVisiblePages(paginator);

    const newState: PaginationState = {
      currentData,
      paginator,
      pages
    };

    subject.next(newState);
  }

  /**
   * Aplica filtros al paginador
   */
  applyFilters(
    instanceId: string, 
    filters: any, 
    filterFunction: FilterFunction
  ): void {
    const subject = this.paginationStates.get(instanceId);
    if (!subject) return;

    const currentState = subject.value;
    
    // Aplicar filtros a los datos originales
    const filteredData = currentState.paginator.content.filter(item => 
      filterFunction(item, filters)
    );

    // Reconfigurar paginador con datos filtrados
    const paginator: PaginatorConfig = {
      content: filteredData,
      totalElements: filteredData.length,
      totalPages: Math.ceil(filteredData.length / currentState.paginator.size),
      number: 0, // Reset a primera página
      numberOfElements: Math.min(currentState.paginator.size, filteredData.length),
      size: currentState.paginator.size
    };

    const currentData = this.getCurrentPageData(filteredData, paginator);
    const pages = this.calculateVisiblePages(paginator);

    const newState: PaginationState = {
      currentData,
      paginator,
      pages
    };

    subject.next(newState);
  }

  /**
   * Limpia filtros
   */
  clearFilters(instanceId: string, originalData: any[]): void {
    this.updatePaginator(instanceId, originalData);
  }

  /**
   * Obtiene el estado actual de un paginador
   */
  getPaginatorState(instanceId: string): PaginationState | null {
    const subject = this.paginationStates.get(instanceId);
    return subject ? subject.value : null;
  }

  /**
   * Destruye un paginador (limpia memoria)
   */
  destroyPaginator(instanceId: string): void {
    const subject = this.paginationStates.get(instanceId);
    if (subject) {
      subject.complete();
      this.paginationStates.delete(instanceId);
    }
  }

  /**
   * Calcula las páginas visibles
   */
  private calculateVisiblePages(paginator: PaginatorConfig): number[] {
    const maxVisible = 6;
    const totalPages = paginator.totalPages;
    const currentPage = paginator.number + 1;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;

    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  /**
   * Obtiene los datos de la página actual
   */
  private getCurrentPageData(data: any[], paginator: PaginatorConfig): any[] {
    const start = paginator.number * paginator.size;
    const end = start + paginator.size;
    return data.slice(start, end);
  }

  /**
   * Helpers para el template
   */
  getStartIndex(paginator: PaginatorConfig): number {
    return paginator.totalElements === 0 ? 0 : paginator.number * paginator.size + 1;
  }

  getEndIndex(paginator: PaginatorConfig): number {
    const endIndex = (paginator.number + 1) * paginator.size;
    return Math.min(endIndex, paginator.totalElements);
  }
}
