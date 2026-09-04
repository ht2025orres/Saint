import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { ComercialService, Solicitud } from '../../../services/comercial.service';
import { PaginationService, PaginationState } from '../../../shared/pagination/pagination.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-costeos-list',
  templateUrl: './costeos-list.component.html',
  styleUrls: ['./costeos-list.component.css']
})
export class CosteosListComponent implements OnInit, OnDestroy {
  solicitudes: Solicitud[] = [];
  filteredCosteos: Solicitud[] = [];
  pagedCosteos: Solicitud[] = [];
  
  costeoSearch = '';
  costeoEstadoFilter = '';
  isLoading = false;

  stats = {
    total: 0,
    sinIniciar: 0,
    enProceso: 0,
    completados: 0
  };

  readonly paginatorId = 'produccion-costeos-paginator';
  private paginationSub?: Subscription;

  constructor(
    private comercialService: ComercialService,
    private router: Router,
    public paginationService: PaginationService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.loadCosteos();
  }

  ngOnDestroy(): void {
    if (this.paginationSub) this.paginationSub.unsubscribe();
    this.paginationService.destroyPaginator(this.paginatorId);
  }

  private loadTailwind(): void {
    if (!this.document.getElementById('tw-cdn-costeos')) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      link.id = 'tw-cdn-costeos';
      this.document.head.appendChild(link);
    }
    if (!this.document.getElementById('bi-cdn-costeos')) {
      const icons = this.document.createElement('link');
      icons.rel = 'stylesheet';
      icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
      icons.id = 'bi-cdn-costeos';
      this.document.head.appendChild(icons);
    }
  }

  loadCosteos(): void {
    this.isLoading = true;
    this.comercialService.listarSolicitudes({ requiere_costeo: 1 }).subscribe({
      next: (res) => {
        this.solicitudes = res.data || [];
        this.computeKPIs();
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los costeos', 'error');
        this.isLoading = false;
      }
    });
  }

  computeKPIs(): void {
    const costeoSols = this.solicitudes.filter(s => !!s.requiere_costeo);
    this.stats = {
      total: costeoSols.length,
      sinIniciar: costeoSols.filter(s => !s.estado_costeo || s.estado_costeo === 'PENDIENTE').length,
      enProceso: costeoSols.filter(s => s.estado_costeo === 'EN_PROCESO').length,
      completados: costeoSols.filter(s => s.estado_costeo === 'COMPLETADO').length,
    };
  }

  applyFilters(): void {
    let result = this.solicitudes.filter(s => !!s.requiere_costeo);
    if (this.costeoSearch.trim()) {
      const term = this.costeoSearch.toLowerCase();
      result = result.filter(s =>
        s.codigo?.toLowerCase().includes(term) ||
        s.cliente_nombre?.toLowerCase().includes(term)
      );
    }
    if (this.costeoEstadoFilter) {
      result = result.filter(s => (s.estado_costeo || 'PENDIENTE') === this.costeoEstadoFilter);
    }
    this.filteredCosteos = result;
    this.initPaginator();
  }

  private initPaginator(): void {
    if (this.paginationSub) this.paginationSub.unsubscribe();
    this.paginationSub = this.paginationService
      .initializePaginator(this.paginatorId, this.filteredCosteos, 10)
      .subscribe((state: PaginationState) => {
        this.pagedCosteos = state.currentData;
      });
  }

  cambiarEstado(sol: Solicitud, nuevoEstado: string): void {
    if (!sol.id) return;
    this.comercialService.cambiarEstadoCosteo(sol.id, nuevoEstado).subscribe({
      next: (res) => {
        sol.estado_costeo = nuevoEstado as any;
        if (res.data) {
          sol.fecha_inicio_costeo = res.data.fecha_inicio_costeo;
          sol.fecha_fin_costeo = res.data.fecha_fin_costeo;
        }
        this.computeKPIs();
        this.applyFilters();
        Swal.fire({ title: 'Estado de Costeo Actualizado', icon: 'success', timer: 1200, showConfirmButton: false });
      },
      error: () => Swal.fire('Error', 'No se pudo actualizar el estado de costeo', 'error')
    });
  }

  verDetalle(sol: Solicitud): void {
    this.router.navigate(['/costeos/detalle', sol.id]);
  }
}
