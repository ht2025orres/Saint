import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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

  syncSiesa(): void {
    if (confirm('¿Desea ejecutar la sincronización de colaboradores desde Siesa Nómina Web?')) {
      this.syncing = true;
      this.http.post<any>(`${environment.URL_API_LARAVEL}/colaboradores/sync`, {}).subscribe({
        next: (res) => {
          alert(`Sincronización completada:\n- Leídos: ${res.summary.siesa_activos_leidos}\n- Nuevos: ${res.summary.nuevos_creados}\n- Inactivados por retiro: ${res.summary.inactivados_retiros}`);
          this.syncing = false;
          this.loadColaboradores(1);
        },
        error: (err) => {
          alert('Error durante la sincronización: ' + (err.error?.message || err.message));
          this.syncing = false;
        }
      });
    }
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

  ejecutarAccionGlpi(accion: 'create' | 'enable' | 'disable'): void {
    if (!this.selectedColaborador) return;
    this.platformActionLoading = true;

    this.http.post<any>(`${environment.URL_API_LARAVEL}/colaboradores/${this.selectedColaborador.id}/manage-glpi`, { action: accion }).subscribe({
      next: (res) => {
        alert(res.message || 'Acción en GLPI ejecutada con éxito');
        this.platformActionLoading = false;
        this.cargarEstadoPlataformas(this.selectedColaborador!.id);
        this.loadColaboradores(this.pagination.current_page);
      },
      error: (err) => {
        alert('Error en GLPI: ' + (err.error?.message || err.message));
        this.platformActionLoading = false;
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
