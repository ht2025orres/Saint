import { Component, OnInit, OnDestroy } from '@angular/core';
import { EmailLogService } from 'src/app/services/email-log.service';
import { PaginationService } from 'src/app/shared/pagination/pagination.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-email-logs',
  templateUrl: './email-logs.component.html',
  styleUrls: ['./email-logs.component.css']
})
export class EmailLogsComponent implements OnInit, OnDestroy {
  paginatorId = 'email-logs-paginator';

  isLoading = false;
  logs: any[] = [];
  currentLogs: any[] = [];
  totalLogs = 0;

  stats = {
    total: 0,
    sent: 0,
    failed: 0,
    queued: 0
  };

  filters = {
    to_email: '',
    subject: '',
    status: '',
    fecha_desde: '',
    fecha_hasta: ''
  };

  showDetailModal = false;
  selectedLog: any = null;

  constructor(
    private emailLogService: EmailLogService,
    public paginationService: PaginationService
  ) { }

  ngOnInit(): void {
    this.cargarLogs();
  }

  ngOnDestroy(): void {
    this.paginationService.destroyPaginator(this.paginatorId);
  }

  cargarLogs(): void {
    this.isLoading = true;
    const queryFilters = {
      ...this.filters,
      all: true
    };

    this.emailLogService.getAll(queryFilters).subscribe({
      next: (res) => {
        this.logs = res.data || [];
        this.totalLogs = this.logs.length;
        this.inicializarPaginacion();
        this.cargarStats();
      },
      error: (err) => {
        console.error('Error al cargar logs de correo:', err);
        Swal.fire('Error', 'No se pudieron cargar los logs de correo', 'error');
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  cargarStats(): void {
    this.emailLogService.getStats().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.stats = res.data;
        }
      },
      error: (err) => {
        console.error('Error al cargar estadísticas de correo:', err);
      }
    });
  }

  inicializarPaginacion(): void {
    this.paginationService.initializePaginator(
      this.paginatorId,
      this.logs,
      15
    ).subscribe(state => {
      this.currentLogs = state.currentData;
    });
  }

  applyFilters(): void {
    this.cargarLogs();
  }

  limpiarFiltros(): void {
    this.filters = {
      to_email: '',
      subject: '',
      status: '',
      fecha_desde: '',
      fecha_hasta: ''
    };
    this.cargarLogs();
  }

  verDetalle(log: any): void {
    this.selectedLog = log;
    this.showDetailModal = true;
  }

  cerrarModal(): void {
    this.showDetailModal = false;
    this.selectedLog = null;
  }

  reintentarEnvio(log: any): void {
    Swal.fire({
      title: '¿Reintentar envío?',
      text: 'Se volverá a encolar este correo para ser enviado inmediatamente.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#002A3F',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, reintentar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true;
        this.emailLogService.resend(log.id).subscribe({
          next: (res) => {
            Swal.fire({
              title: 'Re-encolado',
              text: 'El correo ha sido puesto en la cola correctamente.',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
            this.cargarLogs();
          },
          error: (err) => {
            console.error('Error al reenviar correo:', err);
            Swal.fire('Error', err.error?.message || 'No se pudo reenviar el correo', 'error');
            this.isLoading = false;
          }
        });
      }
    });
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

  formatContext(context: any): string {
    if (!context) return '{}';
    return JSON.stringify(context, null, 2);
  }
}
