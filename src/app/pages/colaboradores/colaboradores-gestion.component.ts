import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

export interface Colaborador {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo_corporativo: string;
  correo_personal: string;
  telefono: string;
  cargo: string;
  usuario_siesa_nube: string;
  usuario_glpi: string;
  password_conecta: string;
  password_saint: string;
  requiere_siesa_nube: boolean;
  requiere_conecta: boolean;
  requiere_saint: boolean;
  requiere_correo: boolean;
  requiere_glpi: boolean;
  firma_canva_generada: boolean;
  estado: string;
  fecha_ingreso: string;
}

@Component({
  selector: 'app-colaboradores-gestion',
  templateUrl: './colaboradores-gestion.component.html',
  styleUrls: ['./colaboradores-gestion.component.scss']
})
export class ColaboradoresGestionComponent implements OnInit {
  colaboradores: Colaborador[] = [];
  loading = false;
  syncing = false;
  searchTerm = '';
  estadoFilter = '';

  selectedColaborador: Colaborador | null = null;
  showModal = false;
  saving = false;

  pagination = {
    current_page: 1,
    last_page: 1,
    total: 0
  };

  // Modal de Gestión Multi-Plataforma (GLPI DB & Google OAuth2)
  showPlatformsModal = false;
  platformStatusLoading = false;
  platformActionLoading = false;
  platformStatusData: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadColaboradores();
  }

  loadColaboradores(page: number = 1): void {
    this.loading = true;
    let url = `${environment.URL_API_LARAVEL}/colaboradores?page=${page}`;
    if (this.searchTerm) {
      url += `&search=${encodeURIComponent(this.searchTerm)}`;
    }
    if (this.estadoFilter) {
      url += `&estado=${this.estadoFilter}`;
    }

    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.colaboradores = res.data || [];
        this.pagination.current_page = res.current_page;
        this.pagination.last_page = res.last_page;
        this.pagination.total = res.total;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando colaboradores', err);
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    this.loadColaboradores(1);
  }

  // Modal Vista Previa Sincronización Siesa
  mostrarModalSiesaPreview = false;
  cargandoSiesaPreview = false;
  ejecutandoSiesaSync = false;
  siesaPreviewSummary: any = null;
  activeSiesaTab: 'nuevos' | 'actualizados' | 'inactivados' = 'nuevos';

  abrirPreviewSiesa(): void {
    this.mostrarModalSiesaPreview = true;
    this.cargandoSiesaPreview = true;
    this.siesaPreviewSummary = null;
    this.http.post<any>(`${environment.URL_API_LARAVEL}/colaboradores/sync`, { dry_run: true }).subscribe({
      next: (res: any) => {
        this.cargandoSiesaPreview = false;
        this.siesaPreviewSummary = res.summary || res;
        const det = this.siesaPreviewSummary?.detalles || {};
        if (det.nuevos && det.nuevos.length > 0) {
          this.activeSiesaTab = 'nuevos';
        } else if (det.actualizados && det.actualizados.length > 0) {
          this.activeSiesaTab = 'actualizados';
        } else if (det.inactivados && det.inactivados.length > 0) {
          this.activeSiesaTab = 'inactivados';
        } else {
          this.activeSiesaTab = 'nuevos';
        }
      },
      error: (err: any) => {
        this.cargandoSiesaPreview = false;
        console.error('Error cargando preview Siesa:', err);
        alert('Error de Conexión Siesa: ' + (err?.error?.message || 'Ocurrió un problema al consultar Siesa Nómina Web.'));
        this.mostrarModalSiesaPreview = false;
      }
    });
  }

  cerrarPreviewSiesa(): void {
    this.mostrarModalSiesaPreview = false;
    this.siesaPreviewSummary = null;
  }

  confirmarYEjecutarSiesaSync(): void {
    this.ejecutandoSiesaSync = true;
    this.http.post<any>(`${environment.URL_API_LARAVEL}/colaboradores/sync`, { dry_run: false }).subscribe({
      next: (res: any) => {
        alert(res.message || 'Sincronización de colaboradores ejecutada con éxito desde Siesa Nómina Web.');
        this.ejecutandoSiesaSync = false;
        this.cerrarPreviewSiesa();
        this.loadColaboradores(1);
      },
      error: (err: any) => {
        console.error('Error al aplicar sincronización Siesa', err);
        alert('Error de Sincronización: ' + (err?.error?.message || 'Ocurrió un error al aplicar los cambios.'));
        this.ejecutandoSiesaSync = false;
      }
    });
  }

  syncSiesa(): void {
    this.abrirPreviewSiesa();
  }

  openEditModal(colaborador: Colaborador): void {
    this.selectedColaborador = { ...colaborador };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedColaborador = null;
  }

  saveColaborador(): void {
    if (!this.selectedColaborador) return;
    this.saving = true;

    this.http.put<any>(`${environment.URL_API_LARAVEL}/colaboradores/${this.selectedColaborador.id}`, this.selectedColaborador).subscribe({
      next: (res) => {
        alert('Colaborador actualizado y provisionado con éxito.');
        this.saving = false;
        this.closeModal();
        this.loadColaboradores(this.pagination.current_page);
      },
      error: (err) => {
        alert('Error al guardar: ' + (err.error?.message || err.message));
        this.saving = false;
      }
    });
  }

  // ==========================================
  // GESTIÓN MULTI-PLATAFORMA (GLPI & GOOGLE)
  // ==========================================
  abrirModalPlataformas(colaborador: Colaborador): void {
    this.selectedColaborador = colaborador;
    this.showPlatformsModal = true;
    this.cargarEstadoPlataformas(colaborador.id);
  }

  cerrarModalPlataformas(): void {
    this.showPlatformsModal = false;
    this.platformStatusData = null;
  }

  cargarEstadoPlataformas(colaboradorId: number): void {
    this.platformStatusLoading = true;
    this.http.get<any>(`${environment.URL_API_LARAVEL}/colaboradores/${colaboradorId}/platform-status`).subscribe({
      next: (res) => {
        this.platformStatusData = res;
        this.platformStatusLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar estado de plataformas:', err);
        this.platformStatusLoading = false;
      }
    });
  }

  ejecutarAccionGlpi(accion: 'create' | 'enable' | 'disable', customUsername?: string): void {
    if (!this.selectedColaborador) return;
    this.platformActionLoading = true;

    const payload: any = { action: accion };
    if (customUsername) {
      payload.custom_username = customUsername;
    }

    this.http.post<any>(`${environment.URL_API_LARAVEL}/colaboradores/${this.selectedColaborador.id}/manage-glpi`, payload).subscribe({
      next: (res) => {
        Swal.fire('Éxito', res.message || 'Acción en GLPI ejecutada con éxito', 'success');
        this.platformActionLoading = false;
        this.cargarEstadoPlataformas(this.selectedColaborador!.id);
        this.loadColaboradores(this.pagination.current_page);
      },
      error: (err) => {
        this.platformActionLoading = false;
        if (err.status === 409 && err.error?.conflict) {
          const suggested = (err.error.existing_username || '') + '2';
          Swal.fire({
            title: 'Nomenclatura Duplicada en GLPI',
            html: `
              <div class="text-left text-xs text-slate-700 flex flex-col gap-2">
                <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-medium">
                  <i class="bi bi-exclamation-triangle-fill text-amber-600 me-1"></i>
                  ${err.error.message}
                </div>
                <p class="font-bold text-slate-800 mt-1">Escribe el nuevo nombre de usuario que deseas asignarle en GLPI:</p>
              </div>
            `,
            input: 'text',
            inputValue: suggested,
            showCancelButton: true,
            confirmButtonText: 'Crear con este usuario',
            cancelButtonText: 'Cancelar',
            customClass: {
              confirmButton: 'bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700',
              cancelButton: 'bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-300'
            },
            inputValidator: (value) => {
              if (!value || !value.trim()) {
                return 'Debes ingresar un nombre de usuario válido';
              }
              return null;
            }
          }).then((result) => {
            if (result.isConfirmed && result.value) {
              this.ejecutarAccionGlpi('create', result.value.trim());
            }
          });
        } else {
          Swal.fire('Error en GLPI', err.error?.message || err.message, 'error');
        }
      }
    });
  }

  ejecutarAccionGoogle(accion: 'create' | 'suspend' | 'activate'): void {
    if (!this.selectedColaborador) return;
    this.platformActionLoading = true;

    this.http.post<any>(`${environment.URL_API_LARAVEL}/colaboradores/${this.selectedColaborador.id}/manage-google`, { action: accion }).subscribe({
      next: (res) => {
        alert(res.message || 'Acción en Google Workspace ejecutada con éxito');
        this.platformActionLoading = false;
        this.cargarEstadoPlataformas(this.selectedColaborador!.id);
        this.loadColaboradores(this.pagination.current_page);
      },
      error: (err) => {
        alert('Error en Google Workspace: ' + (err.error?.message || err.message));
        this.platformActionLoading = false;
      }
    });
  }
}
