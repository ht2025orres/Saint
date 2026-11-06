import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { ComercialService, Solicitud } from '../../../services/comercial.service';
import { PaginationService, PaginationState } from '../../../shared/pagination/pagination.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-muestras-list',
  templateUrl: './muestras-list.component.html',
  styleUrls: ['./muestras-list.component.css']
})
export class MuestrasListComponent implements OnInit, OnDestroy {
  solicitudes: Solicitud[] = [];
  filteredMuestras: Solicitud[] = [];
  pagedMuestras: Solicitud[] = [];
  
  muestraSearch = '';
  muestraEstadoFilter = '';
  isLoading = false;

  stats = {
    total: 0,
    sinIniciar: 0,
    enProceso: 0,
    completados: 0
  };

  readonly paginatorId = 'produccion-muestras-paginator';
  private paginationSub?: Subscription;

  constructor(
    private comercialService: ComercialService,
    private router: Router,
    public paginationService: PaginationService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.loadMuestras();
  }

  ngOnDestroy(): void {
    if (this.paginationSub) this.paginationSub.unsubscribe();
    this.paginationService.destroyPaginator(this.paginatorId);
  }

  private loadTailwind(): void {
    if (!this.document.getElementById('tw-cdn-muestras')) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      link.id = 'tw-cdn-muestras';
      this.document.head.appendChild(link);
    }
    if (!this.document.getElementById('bi-cdn-muestras')) {
      const icons = this.document.createElement('link');
      icons.rel = 'stylesheet';
      icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
      icons.id = 'bi-cdn-muestras';
      this.document.head.appendChild(icons);
    }
  }

  loadMuestras(): void {
    this.isLoading = true;
    this.comercialService.listarSolicitudes({ requiere_muestra: 1, excluir_borrador: 1 }).subscribe({
      next: (res) => {
        this.solicitudes = (res.data || []).filter((s: Solicitud) => s.estado !== 'BORRADOR');
        this.computeKPIs();
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar las muestras', 'error');
        this.isLoading = false;
      }
    });
  }

  computeKPIs(): void {
    const muestraSols = this.solicitudes.filter(s => !!s.requiere_muestra && s.estado !== 'BORRADOR');
    this.stats = {
      total: muestraSols.length,
      sinIniciar: muestraSols.filter(s => !s.estado_muestra || s.estado_muestra === 'PENDIENTE').length,
      enProceso: muestraSols.filter(s => s.estado_muestra === 'EN_PROCESO').length,
      completados: muestraSols.filter(s => s.estado_muestra === 'COMPLETADO').length,
    };
  }

  applyFilters(): void {
    let result = this.solicitudes.filter(s => !!s.requiere_muestra && s.estado !== 'BORRADOR');
    if (this.muestraSearch.trim()) {
      const term = this.muestraSearch.toLowerCase();
      result = result.filter(s =>
        s.codigo?.toLowerCase().includes(term) ||
        s.cliente_nombre?.toLowerCase().includes(term)
      );
    }
    if (this.muestraEstadoFilter) {
      result = result.filter(s => (s.estado_muestra || 'PENDIENTE') === this.muestraEstadoFilter);
    }
    this.filteredMuestras = result;
    this.initPaginator();
  }

  private initPaginator(): void {
    if (this.paginationSub) this.paginationSub.unsubscribe();
    this.paginationSub = this.paginationService
      .initializePaginator(this.paginatorId, this.filteredMuestras, 10)
      .subscribe((state: PaginationState) => {
        this.pagedMuestras = state.currentData;
      });
  }

  cambiarEstado(sol: Solicitud, nuevoEstado: string): void {
    if (!sol.id) return;
    this.comercialService.cambiarEstadoMuestra(sol.id, nuevoEstado).subscribe({
      next: (res) => {
        sol.estado_muestra = nuevoEstado as any;
        if (res.data) {
          sol.fecha_inicio_muestra = res.data.fecha_inicio_muestra;
          sol.fecha_fin_muestra = res.data.fecha_fin_muestra;
        }
        this.computeKPIs();
        this.applyFilters();
        Swal.fire({ title: 'Estado de Muestra Actualizado', icon: 'success', timer: 1200, showConfirmButton: false });
      },
      error: () => Swal.fire('Error', 'No se pudo actualizar el estado de muestra', 'error')
    });
  }

  verDetalle(sol: Solicitud): void {
    this.router.navigate(['/muestras/detalle', sol.id]);
  }

  getSemaforoFecha(fechaStr?: string | null, estado?: string | null): { label: string; badgeClass: string; icon: string; dias: number | null } {
    if (!fechaStr) {
      return { label: 'Sin fecha', badgeClass: 'bg-slate-100 text-slate-500 border-slate-200', icon: 'bi-dash', dias: null };
    }
    if (estado === 'COMPLETADO' || estado === 'FINALIZADO' || estado === 'COSTEADO' || estado === 'APROBADO') {
      return { label: 'Completado', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'bi-check-circle-fill', dias: 0 };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const parts = fechaStr.split(/[-T ]/);
    let fecha: Date;
    if (parts.length >= 3) {
      fecha = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      fecha = new Date(fechaStr);
    }
    fecha.setHours(0, 0, 0, 0);

    const diffMs = fecha.getTime() - hoy.getTime();
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      return {
        label: `Vencido (${Math.abs(diffDias)}d)`,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
        icon: 'bi-exclamation-triangle-fill',
        dias: diffDias
      };
    } else if (diffDias === 0) {
      return {
        label: 'Vence hoy',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
        icon: 'bi-clock-fill',
        dias: diffDias
      };
    } else if (diffDias <= 2) {
      return {
        label: `En ${diffDias}d`,
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
        icon: 'bi-clock-history',
        dias: diffDias
      };
    } else {
      return {
        label: `En ${diffDias}d`,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
        icon: 'bi-calendar-check',
        dias: diffDias
      };
    }
  }
}
