import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthorizationManagerFacade } from '../../services/authorization-manager.facade';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { PaginationService, FilterFunction } from '../../shared/pagination/pagination.service';
import Swal from 'sweetalert2';

import { ModalManageUserComponent } from './modals/modal-manage-user/modal-manage-user.component';
import { ModalStructureComponent } from './modals/modal-structure/modal-structure.component';
import { ModalMaintenanceComponent } from './modals/modal-maintenance/modal-maintenance.component';
import { ModalAuditComponent } from './modals/modal-audit/modal-audit.component';

@Component({
  selector: 'app-authorization-manager',
  templateUrl: './authorization-manager.component.html'
})
export class AuthorizationManagerComponent implements OnInit, OnDestroy {
  @ViewChild('modalManageUser') modalManageUser!: ModalManageUserComponent;
  @ViewChild('modalStructure') modalStructure!: ModalStructureComponent;
  @ViewChild('modalMaintenance') modalMaintenance!: ModalMaintenanceComponent;
  @ViewChild('modalAudit') modalAudit!: ModalAuditComponent;

  // datasets
  users: any[] = [];
  profiles: any[] = [];
  modules: any[] = [];
  permissions: any[] = [];

  // UI
  loading = false;
  errorMessage = '';

  // search + pagination (client)
  paginatorId = 'auth-users-paginator';
  filters: any = { busqueda: '', perfil_id: '', module_id: '', permission_id: '' };
  pagedUsers: any[] = [];
  private subscription: Subscription = new Subscription();

  // Custom Dropdowns
  activeDropdown: 'perfil' | 'module' | 'permission' | null = null;
  dropdownSearch: string = '';

  constructor(
    private facade: AuthorizationManagerFacade,
    private authService: AuthService,
    private router: Router,
    public paginationService: PaginationService
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
    // 1. Filtro por búsqueda
    const term = (filtros.busqueda || '').toLowerCase().trim();
    if (term) {
      const matchSearch = (user.firstName ?? user.name ?? '').toLowerCase().includes(term) ||
                          (user.lastName ?? '').toLowerCase().includes(term) ||
                          (user.email ?? '').toLowerCase().includes(term) ||
                          String(user.id).includes(term);
      if (!matchSearch) return false;
    }

    // 2. Filtro por perfil
    if (filtros.perfil_id) {
      const pId = Number(filtros.perfil_id);
      const hasPerfil = user.perfiles && user.perfiles.some((p: any) => p.id === pId);
      if (!hasPerfil) return false;
    }

    // Calcular permisos efectivos para módulo o permiso si se requiere
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

  // -----------------------
  // CUSTOM DROPDOWNS
  // -----------------------
  toggleDropdown(type: 'perfil' | 'module' | 'permission') {
    if (this.activeDropdown === type) {
      this.activeDropdown = null;
    } else {
      this.activeDropdown = type;
      this.dropdownSearch = ''; // Reset search
    }
  }

  selectDropdownOption(type: 'perfil' | 'module' | 'permission', id: string | number) {
    this.filters[type + '_id'] = id;
    this.activeDropdown = null;
    this.applyFilters();
  }

  getFilteredDropdownOptions(type: 'perfil' | 'module' | 'permission') {
    const term = this.dropdownSearch.toLowerCase().trim();
    let options: any[] = [];
    if (type === 'perfil') options = this.profiles;
    if (type === 'module') options = this.modules;
    if (type === 'permission') options = this.permissions;

    if (!term) return options;
    return options.filter(o => o.name?.toLowerCase().includes(term));
  }

  getDropdownLabel(type: 'perfil' | 'module' | 'permission'): string {
    const val = this.filters[type + '_id'];
    if (!val) return type === 'perfil' ? 'Todos los Perfiles' : (type === 'module' ? 'Todos los Módulos' : 'Todos los Permisos');
    
    if (type === 'perfil') return this.profiles.find(p => p.id == val)?.name || 'Todos los Perfiles';
    if (type === 'module') return this.modules.find(m => m.id == val)?.name || 'Todos los Módulos';
    if (type === 'permission') {
        const pm = this.permissions.find(p => p.id == val);
        return pm ? `${pm.name} (${pm.module?.name})` : 'Todos los Permisos';
    }
    return '';
  }

  // -----------------------
  // OTRAS ACCIONES DIRECTAS
  // -----------------------
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
}