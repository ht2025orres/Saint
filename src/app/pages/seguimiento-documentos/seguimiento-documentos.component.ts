import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { SeguimientoDocumentosService, DocumentoSeguimiento } from 'src/app/services/seguimiento-documentos.service';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-seguimiento-documentos',
  templateUrl: './seguimiento-documentos.component.html',
  styleUrls: ['./seguimiento-documentos.component.css']
})
export class SeguimientoDocumentosComponent implements OnInit, OnDestroy {
  paginatorId = 'seguimiento-documentos-paginator';

  isLoading = false;
  isLogistica = false;
  isConsultante = false;
  hasSearched = false;

  documentos: DocumentoSeguimiento[] = [];
  currentDocumentos: DocumentoSeguimiento[] = [];
  totalDocumentos = 0;

  // KPIs
  kpis = {
    pendientes: 0,
    enProceso: 0,
    procesados: 0,
    anulados: 0,
    cerrados: 0,
    cerradosIncompletos: 0
  };

  // Campo específico para consultantes (Creador de Siesa)
  creadorSearch = '';

  // Filtros generales
  filters = {
    busqueda: '', // Buscar por consecuticos de SS o de OC
    tipo: '',     // SS o SC
    estado_visual: '', // PENDIENTE, EN_PROCESO, PROCESADO
    fecha_desde: '',
    fecha_hasta: ''
  };

  mostrarDetalleModal = false;
  documentoSeleccionado: DocumentoSeguimiento | null = null;

  constructor(
    public paginationService: PaginationService,
    private seguimientoService: SeguimientoDocumentosService,
    public authService: AuthService,
    @Inject(DOCUMENT) private document: Document
  ) { }

  ngOnInit(): void {
    this.loadTailwind();

    // Verificar permisos
    const isAdmin = this.authService.hasPermission(1);
    this.isLogistica = this.authService.hasPermission(50) || isAdmin;
    this.isConsultante = this.authService.hasPermission(51);

    // Carga inicial automática solo para logística
    if (this.isLogistica) {
      this.cargarSeguimientos();
    }
  }

  private loadTailwind(): void {
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
    this.document.head.appendChild(link);

    const icons = this.document.createElement('link');
    icons.rel = 'stylesheet';
    icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
    this.document.head.appendChild(icons);
  }

  ngOnDestroy(): void {
    const links = this.document.head.querySelectorAll('link[href*="tailwindcss"], link[href*="bootstrap-icons"]');
    links.forEach(link => link.remove());
  }

  cargarSeguimientos(): void {
    // Si no es logística, validar que se haya escrito un creador
    if (!this.isLogistica && !this.creadorSearch.trim()) {
      Swal.fire('Atención', 'Por favor, ingrese su usuario de Siesa para realizar la consulta.', 'warning');
      return;
    }

    this.isLoading = true;
    this.hasSearched = true;

    // Mapear parámetros del API
    const params: any = {};
    if (this.creadorSearch.trim()) {
      params.creador = this.creadorSearch.trim();
    }
    if (this.filters.busqueda.trim()) {
      params.consecutive = this.filters.busqueda.trim();
    }
    if (this.filters.tipo) {
      params.tipo = this.filters.tipo;
    }
    if (this.filters.estado_visual) {
      params.estado_visual = this.filters.estado_visual;
    }
    if (this.filters.fecha_desde) {
      params.fecha_desde = this.filters.fecha_desde;
    }
    if (this.filters.fecha_hasta) {
      params.fecha_hasta = this.filters.fecha_hasta;
    }

    this.seguimientoService.obtenerSeguimientos(params).subscribe({
      next: (res) => {
        this.documentos = res.data || [];
        this.totalDocumentos = this.documentos.length;
        this.calcularKpis();
        this.inicializarPaginacion();
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudieron cargar los seguimientos desde Siesa', 'error');
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  calcularKpis(): void {
    this.kpis.pendientes = this.documentos.filter(d => d.estado_visual === 'PENDIENTE').length;
    this.kpis.enProceso = this.documentos.filter(d => d.estado_visual === 'EN_PROCESO').length;
    this.kpis.procesados = this.documentos.filter(d => d.estado_visual === 'PROCESADO').length;
    this.kpis.anulados = this.documentos.filter(d => d.estado_visual === 'ANULADO').length;
    this.kpis.cerrados = this.documentos.filter(d => d.estado_ss?.toLowerCase() === 'cerrado').length;
    this.kpis.cerradosIncompletos = this.documentos.filter(d => d.cerrada_incompleta).length;
  }

  inicializarPaginacion(): void {
    if (this.documentos.length > 0) {
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.documentos,
        15,
        this.filters,
        this.filterDocumentos
      ).subscribe(state => {
        this.currentDocumentos = state.currentData;
      });
    } else {
      this.currentDocumentos = [];
    }
  }

  filterDocumentos: FilterFunction = (doc: DocumentoSeguimiento, filtros) => {
    // Nota: El backend ya realiza el filtrado principal para optimizar rendimiento de base de datos
    // Esta función maneja filtros locales rápidos si es necesario.
    return true;
  };

  applyFilters(): void {
    this.cargarSeguimientos();
  }

  limpiarFiltros(): void {
    this.filters = {
      busqueda: '',
      tipo: '',
      estado_visual: '',
      fecha_desde: '',
      fecha_hasta: ''
    };
    if (this.isLogistica) {
      this.creadorSearch = '';
      this.cargarSeguimientos();
    } else {
      // El consultante limpia su tabla y estado de búsqueda
      this.documentos = [];
      this.currentDocumentos = [];
      this.totalDocumentos = 0;
      this.hasSearched = false;
    }
  }

  abrirDetalle(doc: DocumentoSeguimiento): void {
    this.documentoSeleccionado = doc;
    this.mostrarDetalleModal = true;
  }

  cerrarDetalle(): void {
    this.mostrarDetalleModal = false;
    this.documentoSeleccionado = null;
  }

  getStartIndex(): number {
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    return state ? state.paginator.number * state.paginator.size + 1 : 0;
  }

  getEndIndex(): number {
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    if (!state) return 0;
    const end = (state.paginator.number + 1) * state.paginator.size;
    return Math.min(end, state.paginator.totalElements);
  }
}
