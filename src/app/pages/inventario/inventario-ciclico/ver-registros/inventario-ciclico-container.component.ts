import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventarioService } from 'src/app/services/inventario.service';
import { PaginationService } from 'src/app/shared/pagination/pagination.service';
import { Subscription } from 'rxjs';
import { UserService } from 'src/app/services/user.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-inventario-ciclico-container',
  templateUrl: './inventario-ciclico-container.component.html',
  styleUrls: ['./inventario-ciclico-container.component.css']
})
export class InventarioCiclicoContainerComponent implements OnInit, OnDestroy {
  bodega: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';
  conteos: any[] = [];
  conteosPaginados: any[] = [];
  usuariosMap: Map<number, any> = new Map();
  loading = false;
  error = false;
  busqueda = '';
  busquedaExacta = false;
  filtroTipoItem = '';

  // Bodegas
  bodegas: any[] = [];

  // Calendar dropdown
  showCalendar = false;
  calendarViewDate: Date = new Date();
  calendarEvents: any = {};
  calendarStartDate: string | null = null;
  calendarEndDate: string | null = null;
  calendarYears: number[] = [];

  // Paginación
  instanceId = 'ciclico-registros';
  private paginatorSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventarioService: InventarioService,
    private userService: UserService,
    private paginationService: PaginationService
  ) {}

  ngOnInit(): void {
    this.cargarUsuarios();
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    this.fechaInicio = firstDay.toISOString().split('T')[0];
    this.fechaFin = now.toISOString().split('T')[0];
    this.calendarStartDate = this.fechaInicio;
    this.calendarEndDate = this.fechaFin;

    const currentYear = now.getFullYear();
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      this.calendarYears.push(i);
    }

    this.route.queryParams.subscribe(params => {
      this.bodega = params['bodega'] || '';
      this.cargarBodegas();
    });
  }

  cargarBodegas(): void {
    this.inventarioService.getBodegas().subscribe({
      next: (resp) => {
        if (resp.success) {
          this.bodegas = resp.data;
          if (!this.bodega && this.bodegas.length > 0) {
            this.bodega = this.bodegas[0].codigo;
          }
          if (this.bodega) {
            this.cargarConteos();
            this.cargarEventosCalendario();
            this.aplicarSeleccionCalendario(); // Ensure initial data load for the table after bodega is set
          }
        }
      }
    });
  }

  cargarUsuarios(): void {
    this.userService.getAllBasic().subscribe({
      next: (usuarios) => {
        usuarios.forEach(u => this.usuariosMap.set(u.id, u));
      },
      error: () => {
        console.warn('No se pudieron cargar los usuarios');
      }
    });
  }

  getNombreUsuario(id: any): string {
    if (!id) return 'N/A';
    const userId = Number(id);
    const usuario = this.usuariosMap.get(userId);
    if (!usuario) return `ID: ${id}`;
    
    return usuario.nombre_completo || `ID: ${id}`;
  }

  onBodegaChange(): void {
    if (this.bodega !== 'MP001') {
      this.filtroTipoItem = '';
    }
    // Update URL to reflect selected bodega
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { bodega: this.bodega },
      queryParamsHandling: 'merge'
    });
    
    this.cargarConteos();
    this.cargarEventosCalendario();
  }

  ngOnDestroy(): void {
    this.paginatorSub?.unsubscribe();
    this.paginationService.destroyPaginator(this.instanceId);
  }

  // ========== DATA LOADING ==========

  cargarConteos(): void {
    this.loading = true;
    this.error = false;

    if (this.paginatorSub) {
      this.paginatorSub.unsubscribe();
      this.paginatorSub = null;
    }

    this.inventarioService.getCiclicoPorRango(this.fechaInicio, this.fechaFin, this.bodega).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.conteos = resp.data;
          this.aplicarFiltros();
        }
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  aplicarFiltros(): void {
    const filterFn = (item: any): boolean => {
      let matchBusqueda = true;
      if (this.busqueda) {
        const q = (this.busqueda || '').toString().toLowerCase().trim();
        const idSiesa = (item.id_item_siesa || '').toString().toLowerCase().trim();
        const ref = (item.referencia || '').toString().toLowerCase().trim();
        const desc = (item.descripcion || '').toString().toLowerCase().trim();

        if (this.busquedaExacta) {
          matchBusqueda = idSiesa === q || ref === q;
        } else {
          matchBusqueda = idSiesa.includes(q) ||
                          ref.includes(q) ||
                          desc.includes(q);
        }
      }

      let matchTipo = true;
      if (this.filtroTipoItem) {
        if (this.filtroTipoItem === 'telas') {
          matchTipo = (item.referencia || '').startsWith('1110');
        } else if (this.filtroTipoItem === 'insumos') {
          matchTipo = !(item.referencia || '').startsWith('1110');
        }
      }

      return matchBusqueda && matchTipo;
    };

    if (!this.paginatorSub) {
      this.paginatorSub = this.paginationService.initializePaginator(
        this.instanceId,
        this.conteos,
        25,
        { busqueda: this.busqueda, busquedaExacta: this.busquedaExacta, tipo: this.filtroTipoItem },
        filterFn
      ).subscribe(state => {
        this.conteosPaginados = state.currentData;
      });
    } else {
      this.paginationService.updatePaginator(
        this.instanceId,
        this.conteos,
        25,
        { busqueda: this.busqueda, busquedaExacta: this.busquedaExacta, tipo: this.filtroTipoItem },
        filterFn
      );
    }
  }

  // ========== CALENDAR ==========

  toggleCalendar(): void {
    this.showCalendar = !this.showCalendar;
    if (this.showCalendar) {
      this.cargarEventosCalendario();
    }
  }

  cargarEventosCalendario(): void {
    this.inventarioService.getCiclicoEventos(this.bodega).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.calendarEvents = {};
          resp.data.forEach((ev: any) => {
            this.calendarEvents[ev.fecha] = ev.total;
          });
        }
      }
    });
  }

  handleMonthChange(month: number): void {
    this.calendarViewDate = new Date(this.calendarViewDate.getFullYear(), month, 1);
    this.cargarEventosCalendario();
  }

  handleYearChange(year: number): void {
    this.calendarViewDate = new Date(year, this.calendarViewDate.getMonth(), 1);
    this.cargarEventosCalendario();
  }

  handlePrevMonth(): void {
    this.calendarViewDate = new Date(this.calendarViewDate.getFullYear(), this.calendarViewDate.getMonth() - 1, 1);
    this.cargarEventosCalendario();
  }

  handleNextMonth(): void {
    this.calendarViewDate = new Date(this.calendarViewDate.getFullYear(), this.calendarViewDate.getMonth() + 1, 1);
    this.cargarEventosCalendario();
  }

  handleDaySelected(dateStr: string): void {
    if (!this.calendarStartDate || (this.calendarStartDate && this.calendarEndDate)) {
      this.calendarStartDate = dateStr;
      this.calendarEndDate = null;
    } else {
      if (new Date(this.calendarStartDate) > new Date(dateStr)) {
        this.calendarStartDate = dateStr;
        this.calendarEndDate = null;
      } else {
        this.calendarEndDate = dateStr;
      }
    }
  }

  aplicarSeleccionCalendario(): void {
    if (this.calendarStartDate) {
      this.fechaInicio = this.calendarStartDate;
      this.fechaFin = this.calendarEndDate || this.calendarStartDate;
      this.showCalendar = false;
      this.cargarConteos();
    }
  }

  handleResetSelection(): void {
    this.calendarStartDate = null;
    this.calendarEndDate = null;
  }

  // ========== HELPERS ==========

  get rangoTexto(): string {
    return `${this.formatDateDisplay(this.fechaInicio)} — ${this.formatDateDisplay(this.fechaFin)}`;
  }

  formatDateDisplay(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  formatFechaConteo(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getZonasConteo(conteo: any): string[] {
    if (!conteo.zonas || conteo.zonas.length === 0) return [];
    return conteo.zonas.map((z: any) => z.nombre);
  }

  get diferencias(): { positivas: number; negativas: number; iguales: number } {
    let positivas = 0, negativas = 0, iguales = 0;
    this.conteos.forEach(c => {
      const diff = Number(c.cantidad_fisica) - Number(c.cantidad_siesa);
      if (diff > 0) positivas++;
      else if (diff < 0) negativas++;
      else iguales++;
    });
    return { positivas, negativas, iguales };
  }

  volverAGestionBodegas(): void {
    this.router.navigate(['/inventario/gestion-bodegas']);
  }

  downloadExcel(): void {
    Swal.fire({
      icon: 'info',
      title: 'Generando Excel',
      text: 'Espera mientras se genera el archivo...',
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.inventarioService.exportarMovimientosCiclicoExcel(
      this.bodega, this.fechaInicio, this.fechaFin
    ).subscribe({
      next: (response: Blob) => {
        const filename = `conteos_ciclicos_${this.bodega}_${this.fechaInicio}_${this.fechaFin}.xlsx`;
        const url = window.URL.createObjectURL(response);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        Swal.fire('Éxito', 'Excel descargado correctamente.', 'success');
      },
      error: () => {
        Swal.fire('Error', 'No se pudo descargar el archivo.', 'error');
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.calendar-dropdown-container') && this.showCalendar) {
      this.showCalendar = false;
    }
  }
}
