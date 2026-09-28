import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthorizationManagerFacade } from '../../services/authorization-manager.facade';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { PaginationService, FilterFunction } from '../../shared/pagination/pagination.service';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

import { ModalManageUserComponent } from './modals/modal-manage-user/modal-manage-user.component';
import { ModalStructureComponent } from './modals/modal-structure/modal-structure.component';
import { ModalMaintenanceComponent } from './modals/modal-maintenance/modal-maintenance.component';
import { ModalAuditComponent } from './modals/modal-audit/modal-audit.component';
import { ModalBulkCargoComponent } from './modals/modal-bulk-cargo/modal-bulk-cargo.component';
import { InconsistenciaService } from '../../services/inconsistencia.service';

@Component({
  selector: 'app-authorization-manager',
  templateUrl: './authorization-manager.component.html'
})
export class AuthorizationManagerComponent implements OnInit, OnDestroy {
  @ViewChild('modalManageUser') modalManageUser!: ModalManageUserComponent;
  @ViewChild('modalStructure') modalStructure!: ModalStructureComponent;
  @ViewChild('modalMaintenance') modalMaintenance!: ModalMaintenanceComponent;
  @ViewChild('modalAudit') modalAudit!: ModalAuditComponent;
  @ViewChild('modalBulkCargo') modalBulkCargo!: ModalBulkCargoComponent;

  // datasets
  users: any[] = [];
  profiles: any[] = [];
  modules: any[] = [];
  permissions: any[] = [];
  procesos: any[] = [];
  cargos: string[] = [];

  // Gestor de Departamentos (Inconsistencias)
  mostrarModalProcesos = false;
  procesosGestion: any[] = [];
  usuariosDisponibles: any[] = [];
  cargandoProcesos = false;
  procesoEnEdicion: any = null;
  filtroProceso = '';
  guardandoProceso = false;

  // UI
  loading = false;
  errorMessage = '';

  // search + pagination (client)
  paginatorId = 'auth-users-paginator';
  filters: any = { busqueda: '', perfil_id: '', module_id: '', permission_id: '', proceso_id: '', estado: '', cargo: '', plataformas: {} };
  pagedUsers: any[] = [];
  private subscription: Subscription = new Subscription();

  // Custom Dropdowns
  activeDropdown: 'perfil' | 'module' | 'permission' | 'proceso' | 'estado' | 'plataforma' | 'cargo' | null = null;
  dropdownSearch: string = '';
  showFilterPanel: boolean = false;

  // Platform filter options for toggle pills
  platformOptions = [
    { value: 'saint', label: 'Saint', icon: 'bi-shield', iconActive: 'bi-shield-check', activeClass: 'bg-blue-600 text-white border-blue-600' },
    { value: 'conecta', label: 'Conecta', icon: 'bi-diagram-2', iconActive: 'bi-diagram-2-fill', activeClass: 'bg-purple-600 text-white border-purple-600' },
    { value: 'siesa_nube', label: 'Siesa', icon: 'bi-cloud', iconActive: 'bi-cloud-check-fill', activeClass: 'bg-amber-600 text-white border-amber-600' },
    { value: 'correo', label: 'Workspace', icon: 'bi-google', iconActive: 'bi-google', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
    { value: 'glpi', label: 'GLPI', icon: 'bi-headset', iconActive: 'bi-headset', activeClass: 'bg-indigo-600 text-white border-indigo-600' }
  ];

  constructor(
    private facade: AuthorizationManagerFacade,
    private authService: AuthService,
    private router: Router,
    public paginationService: PaginationService,
    private inconsistenciasService: InconsistenciaService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.loadAll();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadAll() {
    this.loading = true;
    this.facade.loadInitialData()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (res: any) => {
          this.users = res.users ?? [];
          this.profiles = res.profiles ?? [];
          this.modules = res.modules ?? [];
          this.permissions = res.permissions ?? [];
          this.procesos = res.procesos ?? [];
          this.cargos = Array.from(new Set(this.users.map(u => (u.cargo || '').trim()).filter(Boolean))).sort();
          this.inicializarPaginacion();
        },
        error: (err) => {
          console.error(err);
          this.errorMessage = 'No fue posible cargar los datos.';
        }
      });
  }

  // -----------------------
  // PAGINACIÓN SHARED
  // -----------------------
  inicializarPaginacion(): void {
    const existingSub = this.subscription;
    this.subscription = new Subscription();
    existingSub.unsubscribe();

    this.subscription.add(
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.users,
        15,
        this.filters,
        this.filterFunction
      ).subscribe(state => {
        this.pagedUsers = state.currentData;
      })
    );
  }

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.users,
      undefined,
      this.filters,
      this.filterFunction,
      true
    );
  }

  filterFunction: FilterFunction = (user: any, filtros) => {
    // 1. Filtro por búsqueda inteligente multitérmino (Nombre, Apellidos, Cédula, Correos, Teléfono, Cargo, ID, etc.)
    const rawBusqueda = (filtros.busqueda || '').toLowerCase().trim();
    if (rawBusqueda) {
      const words = rawBusqueda.split(/\s+/).filter(Boolean);
      const fullName = `${user.firstName ?? user.name ?? ''} ${user.lastName ?? ''}`;
      const targetText = `${fullName} ${user.email ?? ''} ${user.correo_corporativo ?? ''} ${user.correo_personal ?? ''} ${user.cedula ?? ''} ${user.cargo ?? ''} ${user.telefono ?? ''} ${user.usuario_siesa_nube ?? ''} ${user.usuario_glpi ?? ''} ${user.id ?? ''}`.toLowerCase();

      const matchSearch = words.every(word => targetText.includes(word));
      if (!matchSearch) return false;
    }

    // 2. Filtro por perfil
    if (filtros.perfil_id) {
      const pId = Number(filtros.perfil_id);
      const hasPerfil = user.perfiles && user.perfiles.some((p: any) => p.id === pId);
      if (!hasPerfil) return false;
    }

    // 3. Filtro por proceso / departamento
    if (filtros.proceso_id) {
      if (filtros.proceso_id === 'sin_proceso') {
        if (user.proceso_ids && user.proceso_ids.length > 0) return false;
      } else if (filtros.proceso_id === 'multiples') {
        if (!user.proceso_ids || user.proceso_ids.length <= 1) return false;
      } else {
        const procId = Number(filtros.proceso_id);
        const hasProceso = user.proceso_ids && user.proceso_ids.includes(procId);
        if (!hasProceso) return false;
      }
    }

    // 4. Filtro por Estado
    if (filtros.estado) {
      if (filtros.estado === 'activo' && !user.enabled) return false;
      if (filtros.estado === 'inactivo' && user.enabled) return false;
    }

    // 5. Filtros por Plataformas Múltiples (Combinables simultáneamente)
    if (filtros.plataformas) {
      if (filtros.plataformas.glpi === true && !user.requiere_glpi) return false;
      if (filtros.plataformas.glpi === false && user.requiere_glpi) return false;

      if (filtros.plataformas.correo === true && !user.requiere_correo) return false;
      if (filtros.plataformas.correo === false && user.requiere_correo) return false;

      if (filtros.plataformas.siesa_nube === true && !user.requiere_siesa_nube) return false;
      if (filtros.plataformas.siesa_nube === false && user.requiere_siesa_nube) return false;

      if (filtros.plataformas.conecta === true && !user.requiere_conecta) return false;
      if (filtros.plataformas.conecta === false && user.requiere_conecta) return false;

      if (filtros.plataformas.saint === true && !user.requiere_saint) return false;
      if (filtros.plataformas.saint === false && user.requiere_saint) return false;
    }

    // 6. Filtro por Cargo
    if (filtros.cargo) {
      if ((user.cargo || '').toLowerCase().trim() !== (filtros.cargo || '').toLowerCase().trim()) return false;
    }

    // 6. Calcular permisos efectivos para módulo o permiso si se requiere
    if (filtros.module_id || filtros.permission_id) {
      const hasAccess = this.checkUserAccess(user, filtros.module_id, filtros.permission_id);
      if (!hasAccess) return false;
    }

    return true;
  };

  /**
   * Verifica de manera rápida (para el filtro de UI) si el usuario tiene acceso
   * a un módulo (al menos un permiso ALLOW) o a un permiso específico.
   */
  checkUserAccess(user: any, moduleId?: string|number, permissionId?: string|number): boolean {
    const pId = permissionId ? Number(permissionId) : null;
    const mId = moduleId ? Number(moduleId) : null;

    // Obtener los permisos efectivos del usuario (sin llamadas al backend)
    const direct = user.directPermissions || [];
    const profiles = user.perfiles || [];

    // Recopilar los permisos requeridos
    let permsToCheck: any[] = [];
    if (pId) {
      permsToCheck = [this.permissions.find(p => p.id === pId)].filter(Boolean);
    } else if (mId) {
      permsToCheck = this.permissions.filter(p => p.module_id === mId);
    }

    if (permsToCheck.length === 0) return false;

    // Verificar si tiene acceso a alguno de esos permisos (para módulo) o a ese permiso específico
    for (const p of permsToCheck) {
      // 1. Revisar directos
      const d = direct.find((dp: any) => dp.permission_id === p.id);
      if (d) {
        if (d.allow === 'ALLOW') return true;
        if (d.allow === 'DENY') continue; // Si es DENY, no cuenta, seguimos con otros si es por módulo
      } else {
        // 2. Revisar herencia
        let inheritedAllow = false;
        for (const profRef of profiles) {
          const fullProf = this.profiles.find(x => x.id === profRef.id);
          if (fullProf && fullProf.perfilPermissions) {
            const pp = fullProf.perfilPermissions.find((x: any) => x.permission_id === p.id);
            if (pp && pp.allow === 'ALLOW') {
              inheritedAllow = true;
              break;
            }
          }
        }
        if (inheritedAllow) return true;
      }
    }
    return false;
  }

  // -----------------------
  // APERTURA DE MODALES
  // -----------------------
  openMaintenanceModal() {
    this.modalMaintenance.abrir();
  }

  openStructureModal() {
    this.modalStructure.abrir();
  }

  openManageUser(user: any) {
    this.modalManageUser.abrir(user);
  }

  openAuditModal(user?: any) {
    this.modalAudit.abrir(user);
  }

  openBulkCargoModal(cargo?: string) {
    this.modalBulkCargo.abrir(cargo || this.filters.cargo || '');
  }

  // -----------------------
  // CUSTOM DROPDOWNS
  // -----------------------
  toggleDropdown(type: 'perfil' | 'module' | 'permission' | 'proceso' | 'cargo') {
    if (this.activeDropdown === type) {
      this.activeDropdown = null;
    } else {
      this.activeDropdown = type;
      this.dropdownSearch = ''; // Reset search
    }
  }

  selectDropdownOption(type: 'perfil' | 'module' | 'permission' | 'proceso' | 'cargo', val: string | number) {
    if (type === 'cargo') {
      this.filters.cargo = val;
    } else {
      this.filters[type + '_id'] = val;
    }
    this.activeDropdown = null;
    this.applyFilters();
  }

  getFilteredDropdownOptions(type: 'perfil' | 'module' | 'permission' | 'proceso' | 'cargo') {
    const term = this.dropdownSearch.toLowerCase().trim();
    if (type === 'cargo') {
      if (!term) return this.cargos;
      return this.cargos.filter(c => c.toLowerCase().includes(term));
    }
    let options: any[] = [];
    if (type === 'perfil') options = this.profiles;
    if (type === 'module') options = this.modules;
    if (type === 'permission') options = this.permissions;
    if (type === 'proceso') options = this.procesos;

    if (!term) return options;
    return options.filter(o => (o.name || o.nombre || '').toLowerCase().includes(term));
  }

  getDropdownLabel(type: 'perfil' | 'module' | 'permission' | 'proceso' | 'cargo'): string {
    if (type === 'cargo') {
      return this.filters.cargo ? this.filters.cargo : 'Todos los Cargos';
    }
    const val = this.filters[type + '_id'];
    if (!val) {
      if (type === 'perfil') return 'Todos los Perfiles';
      if (type === 'module') return 'Todos los Módulos';
      if (type === 'permission') return 'Todos los Permisos';
      if (type === 'proceso') return 'Todos los Procesos';
    }
    
    if (type === 'perfil') return this.profiles.find(p => p.id == val)?.name || 'Todos los Perfiles';
    if (type === 'module') return this.modules.find(m => m.id == val)?.name || 'Todos los Módulos';
    if (type === 'permission') {
        const pm = this.permissions.find(p => p.id == val);
        return pm ? `${pm.name} (${pm.module?.name})` : 'Todos los Permisos';
    }
    if (type === 'proceso') {
      if (val === 'sin_proceso') return '🚫 Sin Departamento (0)';
      if (val === 'multiples') return '⚡ Con Múltiples Departamentos (>1)';
      return this.procesos.find(p => p.id == val)?.nombre || 'Todos los Procesos';
    }
    return '';
  }

  hasActiveFilters(): boolean {
    const mainActive = Object.entries(this.filters).some(([k, val]) => k !== 'plataformas' && val !== '' && val !== null && val !== undefined);
    const platActive = this.filters.plataformas && Object.keys(this.filters.plataformas).length > 0;
    return mainActive || platActive;
  }

  getActiveFilterCount(): number {
    let count = Object.entries(this.filters)
      .filter(([key, val]) => key !== 'busqueda' && key !== 'plataformas' && val !== '' && val !== null && val !== undefined)
      .length;
    if (this.filters.plataformas) {
      count += Object.keys(this.filters.plataformas).length;
    }
    return count;
  }

  resetFilters(): void {
    this.filters = { busqueda: '', perfil_id: '', module_id: '', permission_id: '', proceso_id: '', estado: '', cargo: '', plataformas: {} };
    this.activeDropdown = null;
    this.applyFilters();
  }

  removeFilter(key: string): void {
    if (key.startsWith('plat_')) {
      const platKey = key.replace('plat_', '');
      if (this.filters.plataformas) {
        delete this.filters.plataformas[platKey];
      }
      this.applyFilters();
    } else if (this.filters[key] !== undefined) {
      this.filters[key] = '';
      this.applyFilters();
    }
  }

  getActiveFilterBadges(): Array<{ key: string, label: string, value: string }> {
    const badges: Array<{ key: string, label: string, value: string }> = [];

    if (this.filters.busqueda) {
      badges.push({ key: 'busqueda', label: 'Búsqueda', value: `"${this.filters.busqueda}"` });
    }
    if (this.filters.cargo) {
      badges.push({ key: 'cargo', label: 'Cargo', value: this.filters.cargo });
    }
    if (this.filters.perfil_id) {
      const pName = this.profiles.find(p => p.id == this.filters.perfil_id)?.name || this.filters.perfil_id;
      badges.push({ key: 'perfil_id', label: 'Perfil', value: pName });
    }
    if (this.filters.module_id) {
      const mName = this.modules.find(m => m.id == this.filters.module_id)?.name || this.filters.module_id;
      badges.push({ key: 'module_id', label: 'Módulo', value: mName });
    }
    if (this.filters.permission_id) {
      const pmName = this.permissions.find(p => p.id == this.filters.permission_id)?.name || this.filters.permission_id;
      badges.push({ key: 'permission_id', label: 'Permiso', value: pmName });
    }
    if (this.filters.proceso_id) {
      let prName = this.procesos.find(p => p.id == this.filters.proceso_id)?.nombre || this.filters.proceso_id;
      if (this.filters.proceso_id === 'sin_proceso') prName = 'Sin Departamento (0)';
      if (this.filters.proceso_id === 'multiples') prName = 'Múltiples Departamentos (>1)';
      badges.push({ key: 'proceso_id', label: 'Departamento', value: prName });
    }
    if (this.filters.estado) {
      badges.push({ key: 'estado', label: 'Estado', value: this.filters.estado === 'activo' ? 'Activos' : 'Inactivos' });
    }
    if (this.filters.plataformas) {
      const namesMap: any = { glpi: 'GLPI', correo: 'Workspace', siesa_nube: 'Siesa Nube', conecta: 'Conecta', saint: 'Saint' };
      Object.keys(this.filters.plataformas).forEach(platKey => {
        const val = this.filters.plataformas[platKey];
        if (val === true) {
          badges.push({ key: `plat_${platKey}`, label: 'Plataforma', value: `Con ${namesMap[platKey] || platKey}` });
        } else if (val === false) {
          badges.push({ key: `plat_${platKey}`, label: 'Plataforma', value: `Sin ${namesMap[platKey] || platKey}` });
        }
      });
    }

    return badges;
  }

  togglePlatformFilter(platKey: string, mode: 'con' | 'sin'): void {
    if (!this.filters.plataformas) {
      this.filters.plataformas = {};
    }

    const targetBool = (mode === 'con');
    const currentVal = this.filters.plataformas[platKey];

    if (currentVal === targetBool) {
      delete this.filters.plataformas[platKey];
    } else {
      this.filters.plataformas[platKey] = targetBool;
    }

    this.applyFilters();
  }

  /** Helper: obtener los nombres de procesos de un usuario */
  getUserProcesoNames(user: any): string {
    if (!user.proceso_ids || user.proceso_ids.length === 0) return '—';
    return user.proceso_ids
      .map((pid: number) => this.procesos.find(p => p.id === pid)?.nombre)
      .filter(Boolean)
      .join(', ') || '—';
  }

  // -----------------------
  // CENTRO DE CONTROL UNIFICADO
  // -----------------------
  centroControlVisible = false;
  centroControlTab: 'google' | 'siesa' | 'departamentos' | 'replicar' | 'cargo' = 'google';

  abrirCentroControl(tab: 'google' | 'siesa' | 'departamentos' | 'replicar' | 'cargo' = 'google'): void {
    this.centroControlVisible = true;
    this.centroControlTab = tab;
    if (tab === 'google') {
      this.cargarEstadoGoogleUsuariosSaint();
    } else if (tab === 'departamentos') {
      this.abrirModalProcesos();
      this.mostrarModalProcesos = false; // Lo usamos inline, no como modal separado
    }
  }

  cerrarCentroControl(): void {
    this.centroControlVisible = false;
  }

  // -----------------------
  // GOOGLE WORKSPACE MANAGEMENT
  // -----------------------
  cargandoGoogleSaint = false;
  procesandoGoogleSaint = false;
  scopeErrorGoogle = false;
  saintUsersGoogle: any[] = [];
  selectedSaintUserIds: number[] = [];
  filtroGoogleSaint = '';

  get saintUsersGoogleFiltrados(): any[] {
    if (!this.filtroGoogleSaint) return this.saintUsersGoogle;
    const txt = this.filtroGoogleSaint.toLowerCase().trim();
    return this.saintUsersGoogle.filter(u =>
      (u.nombre_completo || '').toLowerCase().includes(txt) ||
      (u.correo_corporativo || '').toLowerCase().includes(txt) ||
      (u.cargo || '').toLowerCase().includes(txt)
    );
  }

  cargarEstadoGoogleUsuariosSaint(): void {
    this.cargandoGoogleSaint = true;
    this.http.get<any>(`${environment.URL_API_LARAVEL}/google/saint-users-status`).subscribe({
      next: (res: any) => {
        this.cargandoGoogleSaint = false;
        if (res.success) {
          this.saintUsersGoogle = res.data || [];
          this.scopeErrorGoogle = !!res.scope_error;
          // Preseleccionar usuarios que no existen o están suspendidos en Google
          this.selectedSaintUserIds = this.saintUsersGoogle
            .filter(u => !u.google_exists || u.google_suspended)
            .map(u => Number(u.id));
        }
      },
      error: (err: any) => {
        this.cargandoGoogleSaint = false;
        console.error('Error cargando estado Google Workspace:', err);
      }
    });
  }

  isSaintUserSelected(id: number): boolean {
    return this.selectedSaintUserIds.includes(Number(id));
  }

  toggleSelectSaintUser(id: number): void {
    const uid = Number(id);
    const idx = this.selectedSaintUserIds.indexOf(uid);
    if (idx > -1) {
      this.selectedSaintUserIds.splice(idx, 1);
    } else {
      this.selectedSaintUserIds.push(uid);
    }
  }

  isAllSaintUsersSelected(): boolean {
    const list = this.saintUsersGoogleFiltrados;
    if (!list || list.length === 0) return false;
    return list.every(u => this.selectedSaintUserIds.includes(Number(u.id)));
  }

  toggleSelectAllSaintUsers(event: any): void {
    const checked = event?.target?.checked;
    const list = this.saintUsersGoogleFiltrados;
    if (checked) {
      list.forEach(u => {
        const uid = Number(u.id);
        if (!this.selectedSaintUserIds.includes(uid)) {
          this.selectedSaintUserIds.push(uid);
        }
      });
    } else {
      const listIds = list.map(u => Number(u.id));
      this.selectedSaintUserIds = this.selectedSaintUserIds.filter(id => !listIds.includes(id));
    }
  }

  vincularGoogleAdmin(): void {
    this.http.get<any>(`${environment.URL_API_LARAVEL}/google/auth-url`).subscribe({
      next: (res: any) => {
        if (res.success && res.auth_url) {
          window.location.href = res.auth_url;
        } else {
          Swal.fire('Error', res.message || 'No se pudo obtener la URL de autenticación.', 'error');
        }
      },
      error: (err: any) => {
        console.error(err);
        Swal.fire('Error', 'No se pudo conectar con el servidor de autenticación Google.', 'error');
      }
    });
  }

  ejecutarActivacionSeleccionadosGoogle(): void {
    if (this.selectedSaintUserIds.length === 0) return;

    this.procesandoGoogleSaint = true;
    this.http.post<any>(`${environment.URL_API_LARAVEL}/google/sync-selected-saint-users`, {
      user_ids: this.selectedSaintUserIds
    }).subscribe({
      next: (res: any) => {
        this.procesandoGoogleSaint = false;
        if (res.success) {
          Swal.fire('Google Workspace ✅', res.message || 'Usuarios sincronizados y activados correctamente en Google Workspace.', 'success');
          this.cargarEstadoGoogleUsuariosSaint();
          this.loadAll();
        } else {
          Swal.fire('Error', res.message || 'No se pudo completar la sincronización con Google Workspace.', 'error');
        }
      },
      error: (err: any) => {
        this.procesandoGoogleSaint = false;
        console.error('Error activando usuarios en Google Workspace:', err);
        Swal.fire('Error', err?.error?.message || 'Ocurrió un error al procesar las cuentas de Google Workspace.', 'error');
      }
    });
  }

  // -----------------------
  // OTRAS ACCIONES DIRECTAS
  // -----------------------
  sincronizandoSiesa = false;
  // Modal de Vista Previa Sincronización Siesa
  mostrarModalSiesaPreview = false;
  cargandoSiesaPreview = false;
  ejecutandoSiesaSync = false;
  siesaPreviewSummary: any = null;
  activeSiesaTab: 'nuevos' | 'actualizados' | 'inactivados' = 'nuevos';

  setActiveSiesaTab(tab: 'nuevos' | 'actualizados' | 'inactivados'): void {
    this.activeSiesaTab = tab;
  }

  abrirPreviewSiesa(): void {
    this.mostrarModalSiesaPreview = true;
    this.cargandoSiesaPreview = true;
    this.siesaPreviewSummary = null;
    this.facade.syncSiesa(true).subscribe({
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
        Swal.fire('Error de Conexión Siesa', err?.error?.message || 'Ocurrió un problema al consultar Siesa Nómina Web.', 'error');
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
    this.facade.syncSiesa(false)
      .pipe(finalize(() => this.ejecutandoSiesaSync = false))
      .subscribe({
        next: (res: any) => {
          Swal.fire({
            title: 'Sincronización Aplicada ✅',
            html: `<p class="text-sm font-medium text-slate-700">${res.message || 'Colaboradores sincronizados y actualizados exitosamente.'}</p>`,
            icon: 'success'
          });
          this.cerrarPreviewSiesa();
          this.loadAll();
        },
        error: (err: any) => {
          console.error('Error al aplicar sincronización Siesa', err);
          Swal.fire('Error de Sincronización', err?.error?.message || 'Ocurrió un error al aplicar los cambios.', 'error');
        }
      });
  }

  ejecutarSincronizacionSiesa(): void {
    this.abrirPreviewSiesa();
  }

  impersonateUser(user: any) {
    Swal.fire({
      title: '¿Personificar usuario?',
      text: `Entrarás al sistema como ${user.firstName || user.name}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.authService.impersonate(user.email).subscribe({
          next: () => {
            Swal.fire({
              title: 'Éxito',
              text: 'Navegando como ' + (user.firstName || user.name),
              icon: 'success',
              timer: 1500,
              showConfirmButton: false
            }).then(() => {
              this.router.navigate(['/dashboard']).then(() => {
                window.location.reload();
              });
            });
          },
          error: (err) => {
            console.error(err);
            Swal.fire('Error', 'No se pudo personificar al usuario', 'error');
            this.loading = false;
          }
        });
      }
    });
  }

  // -----------------------
  // GESTIÓN DE DEPARTAMENTOS / PROCESOS
  // -----------------------
  abrirModalProcesos(): void {
    this.mostrarModalProcesos = true;
    this.cargarProcesosGestion();
    this.cargarUsuariosDisponibles();
  }

  cerrarModalProcesos(): void {
    this.mostrarModalProcesos = false;
    this.procesoEnEdicion = null;
  }

  cargarProcesosGestion(): void {
    this.cargandoProcesos = true;
    this.inconsistenciasService.listarProcesosGestion().subscribe({
      next: (res: any) => {
        this.cargandoProcesos = false;
        if (res.success) {
          this.procesosGestion = res.data || [];
        }
      },
      error: (err) => {
        this.cargandoProcesos = false;
        console.error('Error al cargar procesos', err);
      }
    });
  }

  cargarUsuariosDisponibles(): void {
    if (this.usuariosDisponibles.length > 0) return;
    this.inconsistenciasService.obtenerUsuariosDisponibles().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.usuariosDisponibles = res.data || [];
        }
      },
      error: (err) => {
        console.error('Error al cargar usuarios disponibles', err);
      }
    });
  }

  busquedaLider = '';
  busquedaMatriz = '';
  mostrarDropdownLider = false;
  mostrarDropdownMatriz = false;

  // Modales adicionales de Proceso
  modalCrearProcesoVisible = false;
  creandoProceso = false;
  nuevoProceso: any = { nombre: '', id_lider: null, id_matriz_remplazo: null, activo: true };

  modalMiembrosVisible = false;
  guardandoMiembros = false;
  procesoMiembrosData: any = null;
  miembrosSeleccionadosIds: number[] = [];
  filtroBusquedaMiembros = '';

  abrirCrearProceso(): void {
    this.cargarUsuariosDisponibles();
    this.nuevoProceso = { nombre: '', id_lider: null, id_matriz_remplazo: null, activo: true };
    this.modalCrearProcesoVisible = true;
  }

  cerrarCrearProceso(): void {
    this.modalCrearProcesoVisible = false;
  }

  guardarNuevoProceso(): void {
    if (!this.nuevoProceso.nombre || !this.nuevoProceso.nombre.trim()) {
      Swal.fire('Atención', 'Por favor ingresa el nombre del departamento/proceso.', 'warning');
      return;
    }

    this.creandoProceso = true;
    this.inconsistenciasService.crearProcesoGestion(this.nuevoProceso).subscribe({
      next: (res: any) => {
        this.creandoProceso = false;
        if (res.success) {
          Swal.fire('Creado ✅', 'Proceso creado correctamente.', 'success');
          this.modalCrearProcesoVisible = false;
          this.cargarProcesosGestion();
          this.loadAll();
        } else {
          Swal.fire('Error', res.message || 'No se pudo crear el proceso.', 'error');
        }
      },
      error: (err) => {
        this.creandoProceso = false;
        Swal.fire('Error', err?.error?.message || 'Ocurrió un error al crear el proceso.', 'error');
      }
    });
  }

  editarProceso(proceso: any): void {
    this.procesoEnEdicion = {
      id: proceso.id,
      nombre: proceso.nombre,
      id_lider: proceso.id_lider || null,
      id_matriz_remplazo: proceso.id_matriz_remplazo || null,
      activo: proceso.activo !== false
    };
    this.busquedaLider = '';
    this.busquedaMatriz = '';
    this.mostrarDropdownLider = false;
    this.mostrarDropdownMatriz = false;
  }

  cancelarEdicionProceso(): void {
    this.procesoEnEdicion = null;
    this.mostrarDropdownLider = false;
    this.mostrarDropdownMatriz = false;
  }

  get liderSeleccionado(): any {
    if (!this.procesoEnEdicion?.id_lider) return null;
    return this.usuariosDisponibles.find(u => Number(u.id) === Number(this.procesoEnEdicion.id_lider)) || null;
  }

  get matrizSeleccionada(): any {
    if (!this.procesoEnEdicion?.id_matriz_remplazo) return null;
    return this.usuariosDisponibles.find(u => Number(u.id) === Number(this.procesoEnEdicion.id_matriz_remplazo)) || null;
  }

  get usuariosLiderFiltrados(): { recomendados: any[], otros: any[] } {
    const procId = Number(this.procesoEnEdicion?.id);
    const txt = this.busquedaLider.toLowerCase().trim();

    const filtrados = this.usuariosDisponibles.filter(u => {
      if (!txt) return true;
      return (u.nombre_completo || '').toLowerCase().includes(txt) ||
             (u.email || '').toLowerCase().includes(txt) ||
             (u.username || '').toLowerCase().includes(txt);
    });

    const recomendados = filtrados.filter(u => u.proceso_ids && u.proceso_ids.map(Number).includes(procId));
    const otros = filtrados.filter(u => !u.proceso_ids || !u.proceso_ids.map(Number).includes(procId));

    return { recomendados, otros };
  }

  get usuariosMatrizFiltrados(): { recomendados: any[], otros: any[] } {
    const procId = Number(this.procesoEnEdicion?.id);
    const txt = this.busquedaMatriz.toLowerCase().trim();

    const filtrados = this.usuariosDisponibles.filter(u => {
      if (!txt) return true;
      return (u.nombre_completo || '').toLowerCase().includes(txt) ||
             (u.email || '').toLowerCase().includes(txt) ||
             (u.username || '').toLowerCase().includes(txt);
    });

    const recomendados = filtrados.filter(u => u.proceso_ids && u.proceso_ids.map(Number).includes(procId));
    const otros = filtrados.filter(u => !u.proceso_ids || !u.proceso_ids.map(Number).includes(procId));

    return { recomendados, otros };
  }

  seleccionarLider(u: any | null): void {
    if (!this.procesoEnEdicion) return;
    this.procesoEnEdicion.id_lider = u ? u.id : null;
    this.mostrarDropdownLider = false;
    this.busquedaLider = '';
  }

  seleccionarMatriz(u: any | null): void {
    if (!this.procesoEnEdicion) return;
    this.procesoEnEdicion.id_matriz_remplazo = u ? u.id : null;
    this.mostrarDropdownMatriz = false;
    this.busquedaMatriz = '';
  }

  clearBusquedaLider(): void {
    this.busquedaLider = '';
  }

  clearBusquedaMatriz(): void {
    this.busquedaMatriz = '';
  }

  clearBusquedaSourceUser(): void {
    this.busquedaSourceUser = '';
  }

  clearBusquedaTargetUser(): void {
    this.busquedaTargetUser = '';
  }

  guardarEdicionProceso(): void {
    if (!this.procesoEnEdicion) return;

    this.guardandoProceso = true;
    const { id, id_lider, id_matriz_remplazo, nombre, activo } = this.procesoEnEdicion;

    this.inconsistenciasService.actualizarProcesoGestion(id, { id_lider, id_matriz_remplazo, nombre, activo }).subscribe({
      next: (res: any) => {
        this.guardandoProceso = false;
        if (res.success) {
          Swal.fire('Guardado ✅', 'Departamento actualizado correctamente.', 'success');
          this.procesoEnEdicion = null;
          this.cargarProcesosGestion();
          this.loadAll();
        } else {
          Swal.fire('Error', res.message || 'No se pudo actualizar el departamento.', 'error');
        }
      },
      error: (err) => {
        this.guardandoProceso = false;
        Swal.fire('Error', 'Ocurrió un error al guardar los cambios.', 'error');
      }
    });
  }

  eliminarProceso(proceso: any): void {
    Swal.fire({
      title: `¿Eliminar departamento "${proceso.nombre}"?`,
      text: 'Si el proceso tiene información vinculada (proyectos, sábanas o tareas), se desactivará de forma segura sin borrar datos.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar / desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e11d48'
    }).then((result) => {
      if (result.isConfirmed) {
        this.inconsistenciasService.eliminarProcesoGestion(proceso.id).subscribe({
          next: (res: any) => {
            if (res.success) {
              Swal.fire('Procesado ✅', res.message, 'success');
              this.cargarProcesosGestion();
              this.loadAll();
            } else {
              Swal.fire('Error', res.message || 'No se pudo eliminar el departamento.', 'error');
            }
          },
          error: (err) => {
            Swal.fire('Error', err?.error?.message || 'Error al eliminar el departamento.', 'error');
          }
        });
      }
    });
  }

  // --- Gestión de Miembros del Proceso ---
  abrirModalMiembros(proceso: any): void {
    this.cargarUsuariosDisponibles();
    this.procesoMiembrosData = proceso;
    this.miembrosSeleccionadosIds = (proceso.miembros || []).map((m: any) => Number(m.id));
    this.filtroBusquedaMiembros = '';
    this.modalMiembrosVisible = true;
  }

  cerrarModalMiembros(): void {
    this.modalMiembrosVisible = false;
    this.procesoMiembrosData = null;
    this.miembrosSeleccionadosIds = [];
  }

  isMiembroSeleccionado(userId: number): boolean {
    return this.miembrosSeleccionadosIds.includes(Number(userId));
  }

  toggleSeleccionMiembro(userId: number): void {
    const uid = Number(userId);
    const idx = this.miembrosSeleccionadosIds.indexOf(uid);
    if (idx > -1) {
      this.miembrosSeleccionadosIds.splice(idx, 1);
    } else {
      this.miembrosSeleccionadosIds.push(uid);
    }
  }

  get usuariosMiembrosFiltrados(): any[] {
    if (!this.filtroBusquedaMiembros) return this.usuariosDisponibles;
    const txt = this.filtroBusquedaMiembros.toLowerCase().trim();
    return this.usuariosDisponibles.filter(u =>
      (u.nombre_completo || '').toLowerCase().includes(txt) ||
      (u.email || '').toLowerCase().includes(txt)
    );
  }

  guardarMiembrosProceso(): void {
    if (!this.procesoMiembrosData) return;

    this.guardandoMiembros = true;
    this.inconsistenciasService.sincronizarMiembrosProceso(this.procesoMiembrosData.id, this.miembrosSeleccionadosIds).subscribe({
      next: (res: any) => {
        this.guardandoMiembros = false;
        if (res.success) {
          Swal.fire('Guardado ✅', 'Miembros del departamento actualizados correctamente.', 'success');
          this.cerrarModalMiembros();
          this.cargarProcesosGestion();
          this.loadAll();
        } else {
          Swal.fire('Error', res.message || 'No se pudieron actualizar los miembros.', 'error');
        }
      },
      error: (err) => {
        this.guardandoMiembros = false;
        Swal.fire('Error', 'Ocurrió un error al guardar los miembros.', 'error');
      }
    });
  }

  get procesosFiltrados(): any[] {
    if (!this.filtroProceso) return this.procesosGestion;
    const txt = this.filtroProceso.toLowerCase().trim();
    return this.procesosGestion.filter(p =>
      p.nombre?.toLowerCase().includes(txt) ||
      p.lider_nombre?.toLowerCase().includes(txt) ||
      p.matriz_nombre?.toLowerCase().includes(txt)
    );
  }

  // -----------------------
  // REPLICACIÓN DE PERMISOS
  // -----------------------
  sourceUserIdReplicate: number | null = null;
  targetUserIdReplicate: number | null = null;
  busquedaSourceUser = '';
  busquedaTargetUser = '';
  mostrarDropdownSourceUser = false;
  mostrarDropdownTargetUser = false;

  replicateMode: 'add' | 'replace' = 'add';
  replicateCopyDepartamentos = false;
  selectedPerfilIdsToReplicate: number[] = [];
  selectedPermissionIdsToReplicate: number[] = [];
  filtroReplicacionPermisos = '';
  procesandoReplicacion = false;

  setReplicateMode(mode: 'add' | 'replace'): void {
    this.replicateMode = mode;
  }

  toggleReplicateCopyDepartamentos(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.replicateCopyDepartamentos = !this.replicateCopyDepartamentos;
  }

  desmarcarTodosReplicacion(): void {
    this.selectedPerfilIdsToReplicate = [];
    this.selectedPermissionIdsToReplicate = [];
    this.replicateCopyDepartamentos = false;
  }

  get sourceUserReplicate(): any {
    if (!this.sourceUserIdReplicate) return null;
    return this.users.find(u => Number(u.id) === Number(this.sourceUserIdReplicate)) || null;
  }

  get targetUserReplicate(): any {
    if (!this.targetUserIdReplicate) return null;
    return this.users.find(u => Number(u.id) === Number(this.targetUserIdReplicate)) || null;
  }

  get sourceUserSearchFiltered(): any[] {
    const txt = (this.busquedaSourceUser || '').toLowerCase().trim();
    if (!txt) return this.users.slice(0, 15);
    const words = txt.split(/\s+/).filter(Boolean);
    return this.users.filter(u => {
      const full = `${u.firstName || u.name || ''} ${u.lastName || ''} ${u.email || ''} ${u.correo_corporativo || ''} ${u.cargo || ''} ${u.cedula || ''}`.toLowerCase();
      return words.every(w => full.includes(w));
    }).slice(0, 30);
  }

  get targetUserSearchFiltered(): any[] {
    const txt = (this.busquedaTargetUser || '').toLowerCase().trim();
    const available = this.users.filter(u => Number(u.id) !== Number(this.sourceUserIdReplicate));
    if (!txt) return available.slice(0, 15);
    const words = txt.split(/\s+/).filter(Boolean);
    return available.filter(u => {
      const full = `${u.firstName || u.name || ''} ${u.lastName || ''} ${u.email || ''} ${u.correo_corporativo || ''} ${u.cargo || ''} ${u.cedula || ''}`.toLowerCase();
      return words.every(w => full.includes(w));
    }).slice(0, 30);
  }

  seleccionarSourceUser(user: any | null): void {
    this.sourceUserIdReplicate = user ? Number(user.id) : null;
    this.mostrarDropdownSourceUser = false;
    this.busquedaSourceUser = '';
    
    if (user) {
      this.seleccionarTodosPermisosOrigen();
    } else {
      this.selectedPerfilIdsToReplicate = [];
      this.selectedPermissionIdsToReplicate = [];
    }
  }

  seleccionarTargetUser(user: any | null): void {
    this.targetUserIdReplicate = user ? Number(user.id) : null;
    this.mostrarDropdownTargetUser = false;
    this.busquedaTargetUser = '';
  }

  seleccionarTodosPermisosOrigen(): void {
    const src = this.sourceUserReplicate;
    if (!src) return;

    // Perfiles
    this.selectedPerfilIdsToReplicate = (src.perfiles || []).map((p: any) => Number(p.id));

    // Permisos (donde tenga ALLOW directo o heredado)
    const allowedPermIds: number[] = [];
    (this.permissions || []).forEach(p => {
      const st = this.getUserPermissionStatus(src, p.id);
      if (st.type === 'ALLOW') {
        allowedPermIds.push(Number(p.id));
      }
    });
    this.selectedPermissionIdsToReplicate = allowedPermIds;
  }

  togglePerfilToReplicate(perfilId: number): void {
    const pid = Number(perfilId);
    const idx = this.selectedPerfilIdsToReplicate.indexOf(pid);
    if (idx > -1) {
      this.selectedPerfilIdsToReplicate.splice(idx, 1);
    } else {
      this.selectedPerfilIdsToReplicate.push(pid);
    }
  }

  isPerfilSelectedToReplicate(perfilId: number): boolean {
    return this.selectedPerfilIdsToReplicate.includes(Number(perfilId));
  }

  togglePermissionToReplicate(permissionId: number): void {
    const pid = Number(permissionId);
    const idx = this.selectedPermissionIdsToReplicate.indexOf(pid);
    if (idx > -1) {
      this.selectedPermissionIdsToReplicate.splice(idx, 1);
    } else {
      this.selectedPermissionIdsToReplicate.push(pid);
    }
  }

  isPermissionSelectedToReplicate(permissionId: number): boolean {
    return this.selectedPermissionIdsToReplicate.includes(Number(permissionId));
  }

  toggleAllPermissionsInModuleToReplicate(moduleId: number, selectAll: boolean): void {
    const mPerms = (this.permissions || []).filter(p => Number(p.module_id) === Number(moduleId));
    mPerms.forEach(p => {
      const pid = Number(p.id);
      const idx = this.selectedPermissionIdsToReplicate.indexOf(pid);
      if (selectAll) {
        if (idx === -1) this.selectedPermissionIdsToReplicate.push(pid);
      } else {
        if (idx > -1) this.selectedPermissionIdsToReplicate.splice(idx, 1);
      }
    });
  }

  isAllPermissionsInModuleSelectedToReplicate(moduleId: number): boolean {
    const mPerms = (this.permissions || []).filter(p => Number(p.module_id) === Number(moduleId));
    if (mPerms.length === 0) return false;
    return mPerms.every(p => this.selectedPermissionIdsToReplicate.includes(Number(p.id)));
  }

  onToggleModulePermissions(moduleId: number, event: Event): void {
    const target = event.target as HTMLInputElement;
    this.toggleAllPermissionsInModuleToReplicate(moduleId, target ? target.checked : false);
  }

  getPermissionStatusLabel(user: any, permissionId: number, prefix: string): string {
    const st = this.getUserPermissionStatus(user, permissionId);
    let text = `${prefix}: ${st.type}`;
    if (st.isDirect) {
      text += ' (Dir)';
    } else if (st.profileName) {
      text += ` (${st.profileName})`;
    }
    return text;
  }

  getUserPermissionStatus(user: any, permissionId: number): { type: 'ALLOW' | 'DENY' | 'NONE', isDirect: boolean, profileName?: string } {
    if (!user) return { type: 'NONE', isDirect: false };

    const pId = Number(permissionId);

    // 1. Direct
    const direct = user.directPermissions?.find((dp: any) => Number(dp.permission_id) === pId);
    if (direct) {
      return { type: direct.allow, isDirect: true };
    }

    // 2. Inherited
    if (user.perfiles && user.perfiles.length > 0) {
      for (const profRef of user.perfiles) {
        const fullProf = (this.profiles || []).find((p: any) => Number(p.id) === Number(profRef.id));
        if (fullProf && fullProf.perfilPermissions) {
          const pp = fullProf.perfilPermissions.find((x: any) => Number(x.permission_id) === pId);
          if (pp && pp.allow === 'ALLOW') {
            return { type: 'ALLOW', isDirect: false, profileName: fullProf.name };
          }
          if (pp && pp.allow === 'DENY') {
            return { type: 'DENY', isDirect: false, profileName: fullProf.name };
          }
        }
      }
    }

    return { type: 'NONE', isDirect: false };
  }

  userHasProfile(user: any, profileId: number): boolean {
    if (!user || !user.perfiles || !Array.isArray(user.perfiles)) return false;
    return user.perfiles.some((p: any) => Number(p.id) === Number(profileId));
  }

  get modulesForReplication(): any[] {
    const term = (this.filtroReplicacionPermisos || '').toLowerCase().trim();
    return (this.modules || []).map(m => {
      const perms = (this.permissions || []).filter(p => Number(p.module_id) === Number(m.id) && (!term || (p.name || '').toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term)));
      return {
        ...m,
        permissions: perms
      };
    }).filter(m => m.permissions.length > 0);
  }

  ejecutarReplicacionPermisos(): void {
    const src = this.sourceUserReplicate;
    const tgt = this.targetUserReplicate;

    if (!src || !tgt) {
      Swal.fire('Atención', 'Debes seleccionar el usuario origen (copiar de) y el usuario destino (copiar a).', 'warning');
      return;
    }

    if (src.id === tgt.id) {
      Swal.fire('Atención', 'El usuario origen y destino deben ser diferentes.', 'warning');
      return;
    }

    if (this.selectedPerfilIdsToReplicate.length === 0 && this.selectedPermissionIdsToReplicate.length === 0 && !this.replicateCopyDepartamentos) {
      Swal.fire('Atención', 'Debes seleccionar al menos un perfil, permiso o la opción de departamentos para replicar.', 'warning');
      return;
    }

    const modeText = this.replicateMode === 'replace' ? 'sobrescribir todos los permisos del usuario destino' : 'fusionar los permisos seleccionados';
    const srcName = `${src.firstName || src.name} ${src.lastName || ''}`.trim();
    const tgtName = `${tgt.firstName || tgt.name} ${tgt.lastName || ''}`.trim();

    Swal.fire({
      title: '¿Confirmar replicación?',
      html: `<div class="text-left text-xs space-y-2">
        <p>Se van a replicar los permisos de <strong>${srcName}</strong> a <strong>${tgtName}</strong>.</p>
        <p class="text-slate-500 font-semibold">Modo: <code>${modeText}</code>.</p>
        <ul class="list-disc pl-4 text-slate-600">
          <li><strong>Perfiles seleccionados:</strong> ${this.selectedPerfilIdsToReplicate.length}</li>
          <li><strong>Permisos directos seleccionados:</strong> ${this.selectedPermissionIdsToReplicate.length}</li>
          <li><strong>Copiar departamentos:</strong> ${this.replicateCopyDepartamentos ? 'Sí' : 'No'}</li>
        </ul>
      </div>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, replicar permisos',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d97706'
    }).then((result) => {
      if (result.isConfirmed) {
        this.procesandoReplicacion = true;
        
        const payload = {
          source_user_id: src.id,
          target_user_id: tgt.id,
          mode: this.replicateMode,
          perfil_ids: this.selectedPerfilIdsToReplicate,
          permissions: this.selectedPermissionIdsToReplicate.map(pid => ({ permission_id: pid, allow: 'ALLOW' })),
          copy_departamentos: this.replicateCopyDepartamentos
        };

        this.facade.replicateUserPermissions(payload).subscribe({
          next: (res: any) => {
            this.procesandoReplicacion = false;
            if (res.success) {
              Swal.fire('Replicación Exitosa ✅', res.message || 'Permisos replicados correctamente.', 'success');
              this.loadAll();
            } else {
              Swal.fire('Error', res.message || 'No se pudo replicar los permisos.', 'error');
            }
          },
          error: (err: any) => {
            this.procesandoReplicacion = false;
            console.error('Error al replicar permisos:', err);
            Swal.fire('Error', err?.error?.message || 'Ocurrió un error al replicar los permisos.', 'error');
          }
        });
      }
    });
  }
}