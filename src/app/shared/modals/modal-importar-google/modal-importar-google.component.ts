import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef
} from '@angular/core';
import { ProyectoService, GoogleCalendarEventoImport } from '../../../services/proyectos.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-importar-google',
  templateUrl: './modal-importar-google.component.html',
  styleUrls: ['./modal-importar-google.component.scss']
})
export class ModalImportarGoogleComponent implements OnChanges {
  @Input() show: boolean = false;
  @Input() usuarios: { id: number; nombre: string; email?: string }[] = [];
  @Input() usuarioActualId: number = 0;
  @Input() usuarioActualEmail: string = '';
  @Input() esLiderOGestor: boolean = true;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onImportado = new EventEmitter<number>();

  // Filtros
  selectedEmail: string = '';
  fechaDesde: string = '';
  fechaHasta: string = '';
  busquedaTexto: string = '';

  // Estado de carga y datos
  loadingEventos: boolean = false;
  guardando: boolean = false;
  errorMsg: string | null = null;
  eventos: GoogleCalendarEventoImport[] = [];

  // Asignación masiva
  responsableMasivoId: number | null = null;
  todosSeleccionados: boolean = false;

  // Modal de Detalle
  eventoSeleccionadoDetalle: GoogleCalendarEventoImport | null = null;
  vistaDetalleTab: 'formato' | 'plano' = 'formato';

  constructor(
    private proyectoService: ProyectoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue === true) {
      this._inicializarModal();
    }
  }

  private _inicializarModal(): void {
    this.errorMsg = null;
    this.busquedaTexto = '';
    this.responsableMasivoId = null;
    this.todosSeleccionados = false;
    this.eventoSeleccionadoDetalle = null;
    this.vistaDetalleTab = 'formato';

    // Email por defecto: el corporativo del usuario actual o el primero disponible
    if (!this.selectedEmail) {
      this.selectedEmail = this.usuarioActualEmail || '';
    }

    // Fechas por defecto: inicio de este mes y fin del próximo mes
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const inicioMes = new Date(y, m, 1);
    const finProximo = new Date(y, m + 2, 0);

    this.fechaDesde = this._formatDate(inicioMes);
    this.fechaHasta = this._formatDate(finProximo);

    if (this.selectedEmail) {
      this.consultarEventos();
    }
  }

  private _formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  consultarEventos(): void {
    if (!this.selectedEmail) {
      this.errorMsg = 'Debes seleccionar o ingresar un correo para consultar el calendario.';
      return;
    }

    this.loadingEventos = true;
    this.errorMsg = null;
    this.eventos = [];
    this.todosSeleccionados = false;
    this.cdr.markForCheck();

    const timeMin = this.fechaDesde ? `${this.fechaDesde}T00:00:00Z` : undefined;
    const timeMax = this.fechaHasta ? `${this.fechaHasta}T23:59:59Z` : undefined;

    this.proyectoService.getGoogleCalendarEventsToImport(this.selectedEmail, timeMin, timeMax)
      .subscribe({
        next: (resp) => {
          this.loadingEventos = false;
          if (resp.success) {
            const userConsultado = this.usuarios.find(u => u.email === this.selectedEmail);
            const defaultResponsableId = userConsultado ? userConsultado.id : (this.usuarioActualId || undefined);

            this.eventos = (resp.items || []).map(ev => ({
              ...ev,
              seleccionado: false,
              responsable_id: defaultResponsableId,
              fecha_limite: ev.start ? ev.start.replace('T', ' ').slice(0, 16) : undefined,
              notas: ''
            }));
          } else {
            this.errorMsg = resp.message || 'No fue posible obtener los eventos.';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loadingEventos = false;
          this.errorMsg = err?.error?.message || 'Error al conectar con Google Calendar. Verifica que la cuenta tenga autorización.';
          this.cdr.markForCheck();
        }
      });
  }

  get eventosFiltrados(): GoogleCalendarEventoImport[] {
    if (!this.busquedaTexto.trim()) {
      return this.eventos;
    }
    const q = this.busquedaTexto.toLowerCase();
    return this.eventos.filter(e =>
      (e.summary && e.summary.toLowerCase().includes(q)) ||
      (e.description && this.stripHtml(e.description).toLowerCase().includes(q)) ||
      (e.location && e.location.toLowerCase().includes(q))
    );
  }

  get esErrorAutorizacion(): boolean {
    if (!this.errorMsg) return false;
    const m = this.errorMsg.toLowerCase();
    return m.includes('invalid_grant') || m.includes('autorizaci') || m.includes('token') || m.includes('no hay cliente google');
  }

  reconectarGoogle(): void {
    this.proyectoService.getGoogleAuthUrl().subscribe({
      next: (res) => {
        if (res?.auth_url) {
          window.location.href = res.auth_url;
        } else {
          Swal.fire('Error', res?.message || 'No se pudo obtener la URL de Google.', 'error');
        }
      },
      error: (err) => {
        Swal.fire('Error', err?.error?.message || 'Error al conectar con Google.', 'error');
      }
    });
  }

  get totalSeleccionados(): number {
    return this.eventos.filter(e => e.seleccionado && !e.ya_importado).length;
  }

  toggleEvento(e: GoogleCalendarEventoImport): void {
    if (e.ya_importado) return;
    e.seleccionado = !e.seleccionado;
    this.actualizarEstadoTodos();
    this.cdr.markForCheck();
  }

  toggleSeleccionarTodos(): void {
    this.todosSeleccionados = !this.todosSeleccionados;
    this.eventosFiltrados.forEach(e => {
      if (!e.ya_importado) {
        e.seleccionado = this.todosSeleccionados;
      }
    });
    this.cdr.markForCheck();
  }

  actualizarEstadoTodos(): void {
    const disponibles = this.eventosFiltrados.filter(e => !e.ya_importado);
    this.todosSeleccionados = disponibles.length > 0 && disponibles.every(e => e.seleccionado);
    this.cdr.markForCheck();
  }

  aplicarResponsableMasivo(): void {
    if (!this.responsableMasivoId) return;
    const id = Number(this.responsableMasivoId);
    this.eventos.forEach(e => {
      if (e.seleccionado && !e.ya_importado) {
        e.responsable_id = id;
      }
    });
  }

  importarSeleccionados(): void {
    const paraImportar = this.eventos.filter(e => e.seleccionado && !e.ya_importado);

    if (paraImportar.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Ningún evento seleccionado',
        text: 'Por favor selecciona al menos un evento disponible para importar.',
        confirmButtonColor: '#4f46e5',
      });
      return;
    }

    // Validar que cada uno tenga responsable
    const sinResponsable = paraImportar.find(e => !e.responsable_id);
    if (sinResponsable) {
      Swal.fire({
        icon: 'warning',
        title: 'Falta responsable asignado',
        text: `El evento "${sinResponsable.summary || 'Sin título'}" no tiene un responsable asignado.`,
        confirmButtonColor: '#4f46e5',
      });
      return;
    }

    const payload = paraImportar.map(e => ({
      google_event_id: e.id,
      titulo: e.summary || '(Sin título de evento)',
      descripcion: this.cleanHtmlToText(e.description) || undefined,
      fecha_limite_entrega: e.fecha_limite || undefined,
      responsable_id: Number(e.responsable_id),
      notas: e.notas || 'Importado desde Google Calendar'
    }));

    this.guardando = true;
    this.cdr.markForCheck();

    this.proyectoService.importarTareasGoogle(payload).subscribe({
      next: (res) => {
        this.guardando = false;
        this.cdr.markForCheck();

        Swal.fire({
          icon: 'success',
          title: '¡Tareas Importadas!',
          text: res?.message || `Se importaron ${paraImportar.length} tarea(s) correctamente.`,
          timer: 2500,
          showConfirmButton: false
        });

        this.onImportado.emit(paraImportar.length);
        this.cerrar();
      },
      error: (err) => {
        this.guardando = false;
        this.cdr.markForCheck();
        Swal.fire({
          icon: 'error',
          title: 'Error al importar',
          text: err?.error?.message || 'Ocurrió un error al guardar las tareas en Saint.',
          confirmButtonColor: '#4f46e5',
        });
      }
    });
  }

  // ── DETALLE DEL EVENTO ─────────────────────────────────────────────────────

  abrirDetalle(evento: GoogleCalendarEventoImport, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.eventoSeleccionadoDetalle = evento;
    this.vistaDetalleTab = 'formato';
    this.cdr.markForCheck();
  }

  cerrarDetalle(): void {
    this.eventoSeleccionadoDetalle = null;
    this.cdr.markForCheck();
  }

  importarEventoIndividual(evento: GoogleCalendarEventoImport): void {
    if (evento.ya_importado) return;

    if (!evento.responsable_id) {
      Swal.fire({
        icon: 'warning',
        title: 'Falta responsable asignado',
        text: 'Por favor asigna un responsable para esta tarea antes de importarla.',
        confirmButtonColor: '#4f46e5',
      });
      return;
    }

    const payload = [{
      google_event_id: evento.id,
      titulo: evento.summary || '(Sin título de evento)',
      descripcion: this.cleanHtmlToText(evento.description) || undefined,
      fecha_limite_entrega: evento.fecha_limite || undefined,
      responsable_id: Number(evento.responsable_id),
      notas: evento.notas || 'Importado desde Google Calendar'
    }];

    this.guardando = true;
    this.cdr.markForCheck();

    this.proyectoService.importarTareasGoogle(payload).subscribe({
      next: (res) => {
        this.guardando = false;
        evento.ya_importado = true;
        evento.seleccionado = false;
        if (res?.data && res.data[0]?.id) {
          evento.tarea_id = res.data[0].id;
          evento.tarea_estado = res.data[0].estado || 'pendiente';
        }
        this.actualizarEstadoTodos();
        this.cdr.markForCheck();

        Swal.fire({
          icon: 'success',
          title: '¡Tarea Importada!',
          text: `La tarea "${evento.summary || 'Sin título'}" se importó correctamente.`,
          timer: 2200,
          showConfirmButton: false
        });

        this.onImportado.emit(1);
      },
      error: (err) => {
        this.guardando = false;
        this.cdr.markForCheck();
        Swal.fire({
          icon: 'error',
          title: 'Error al importar',
          text: err?.error?.message || 'Ocurrió un error al guardar la tarea en Saint.',
          confirmButtonColor: '#4f46e5',
        });
      }
    });
  }

  // ── HELPERS DE TEXTO Y FECHAS ──────────────────────────────────────────────

  stripHtml(html: string | null | undefined): string {
    if (!html) return '';
    return html
      .replace(/<br\s*[\/]?>/gi, ' ')
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  cleanHtmlToText(html: string | null | undefined): string {
    if (!html) return '';
    return html
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  formatearFechaHora(val?: string | null): string {
    if (!val) return 'No especificada';
    try {
      const raw = val.includes('T') ? val : `${val}T00:00:00`;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleString('es-CO', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: val.includes('T') ? '2-digit' : undefined,
        minute: val.includes('T') ? '2-digit' : undefined,
      });
    } catch {
      return val;
    }
  }

  esUrl(str?: string | null): boolean {
    if (!str) return false;
    const s = str.trim().toLowerCase();
    return s.startsWith('http://') || s.startsWith('https://');
  }

  cerrar(): void {
    this.eventoSeleccionadoDetalle = null;
    this.onCerrar.emit();
  }
}
