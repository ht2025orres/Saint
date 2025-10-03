import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import Swal from 'sweetalert2';

// Importa tu servicio de bodegas aquí
// import { BodegaService } from 'src/app/services/bodega.service';

@Component({
  selector: 'app-bodegas',
  templateUrl: './bodegas.component.html',
  styleUrl: './bodegas.component.css'
})
export class BodegasComponent {
  paginatorId = 'bodega-list-paginator';
  
  // Datos originales y filtrados
  bodegas: any[] = [];
  currentBodegas: any[] = [];
  totalBodegas: number = 0;

  // Filtros
  filters = {
    busqueda: ''
  };

  constructor(
    // private bodegaService: BodegaService,
    public paginationService: PaginationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarBodegas();
  }

  /**
   * Carga las bodegas desde el servicio
   */
  cargarBodegas(): void {
    // Reemplaza esto con tu servicio real
    // this.bodegaService.listarBodegas().subscribe({
    //   next: (bodegas) => {
    //     this.bodegas = bodegas;
    //     this.totalBodegas = bodegas.length;
    //     this.inicializarPaginacion();
    //   },
    //   error: () => {
    //     Swal.fire('Error', 'No se pudieron cargar las bodegas', 'error');
    //   }
    // });

    // Datos de ejemplo para desarrollo
    this.bodegas = [
      {
        codigo: 'BMP01',
        total_items: 0,
        total_existencias: 0,
        items_sin_zona: 0
      },
      {
        codigo: 'BT001',
        total_items: 0,
        total_existencias: 0,
        items_sin_zona: 0
      },
      {
        codigo: 'BT003',
        total_items: 0,
        total_existencias: 0,
        items_sin_zona: 0
      },
      {
        codigo: 'MP001',
        total_items: 0,
        total_existencias: 0,
        items_sin_zona: 0
      },
      {
        codigo: 'MP003',
        total_items: 0,
        total_existencias: 0,
        items_sin_zona: 0
      }
    ];
    
    this.totalBodegas = this.bodegas.length;
    this.inicializarPaginacion();
  }

  /**
   * Inicializa el paginador con los datos cargados
   */
  inicializarPaginacion(): void {
    if (this.bodegas.length > 0) {
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.bodegas,
        5, // Tamaño de página inicial
        this.filters,
        this.filterFunction
      ).subscribe(state => {
        this.currentBodegas = state.currentData;
      });
    }
  }

  /**
   * Aplica los filtros de búsqueda y actualiza la paginación
   */
  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.bodegas,
      undefined, // Mantener tamaño de página actual
      this.filters,
      this.filterFunction
    );
    
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    this.currentBodegas = state?.currentData || [];

  }

  /**
   * Función de filtrado para el paginador
   */
  filterFunction: FilterFunction = (bodega: any, filtros) => {
    const texto = (filtros.busqueda || '').toLowerCase().trim();
    if (!texto) return true;
    
    // Buscar en el código de la bodega
    return bodega.codigo?.toLowerCase().includes(texto);
  };

  /**
   * Navega a la vista de ítems de una bodega específica
   */
  verItemsDeBodega(codigoBodega: string): void {
    // Opción 1: Navegar a otra ruta
    // this.router.navigate(['/bodega', codigoBodega, 'items']);
    
    // Opción 2: Abrir en modal (similar a tu código de PVs)
    // Implementa según tus necesidades
    
    console.log('Ver ítems de bodega:', codigoBodega);
    
    // Ejemplo de navegación
    this.router.navigate(['/bodega', codigoBodega, 'items']);
  }

  /**
   * Obtiene el índice inicial de la página actual
   */
  getStartIndex(): number {
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    if (!state) return 0;
    return state.currentPage * state.pageSize + 1;
  }
  /**
   * Obtiene el índice final de la página actual
   */
  getEndIndex(): number {
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    if (!state) return 0;
    const end = (state.currentPage + 1) * state.pageSize;
    return Math.min(end, state.totalItems);
  }
}