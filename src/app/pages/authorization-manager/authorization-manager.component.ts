import { Component, OnInit } from '@angular/core';
import { AuthorizationManagerFacade } from '../../services/authorization-manager.facade';
import { UserService } from '../../services/user.service';
import { ModulesService } from '../../services/modules.service';
import { ProfilesService } from '../../services/profiles.service';
import { PermissionsService } from '../../services/permissions.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-authorization-manager',
  templateUrl: './authorization-manager.component.html',
  styleUrls: ['./authorization-manager.component.css']
})
export class AuthorizationManagerComponent implements OnInit {

  // datasets
  users: any[] = [];
  profiles: any[] = [];
  modules: any[] = [];
  permissions: any[] = [];

  // UI
  loading = false;
  errorMessage = '';

  // selected
  selectedUser: any = null;
  selectedProfile: any = null;
  selectedModule: any = null;

  // modales
  showProfilesModal = false;
  showModulesModal = false;
  showPermissionsModal = false;
  showCreateEditModuleModal = false;
  showCreateEditPerfilModal = false;
  showCreateEditPermissionModal = false;

  // edit models
  editingModule: any = null;
  editingPerfil: any = null;
  editingPermission: any = null;

  // search + pagination (client)
  searchTerm = '';
  page = 1;
  perPage = 8;
  totalPages = 1;
  pagedUsers: any[] = [];

  // permissions effective view
  effectivePermissions: { direct: any[]; inherited: any[] } | null = null;

  constructor(
    private facade: AuthorizationManagerFacade,
    private userService: UserService,
    private moduleService: ModulesService,
    private profileService: ProfilesService,
    private permissionService: PermissionsService
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  // load initial data
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
          this.applyFiltersAndPaginate();
        },
        error: (err) => {
          console.error(err);
          this.errorMessage = 'No fue posible cargar los datos.';
        }
      });
  }

  // -----------------------
  // SEARCH + PAGINATION
  // -----------------------
  applyFiltersAndPaginate() {
    const term = this.searchTerm?.toLowerCase()?.trim() ?? '';
    const filtered = this.users.filter(u =>
      (u.name ?? '').toLowerCase().includes(term) ||
      (u.email ?? '').toLowerCase().includes(term) ||
      String(u.id).includes(term)
    );

    this.totalPages = Math.max(1, Math.ceil(filtered.length / this.perPage));
    if (this.page > this.totalPages) this.page = this.totalPages;

    const start = (this.page - 1) * this.perPage;
    this.pagedUsers = filtered.slice(start, start + this.perPage);
  }

  changePage(delta: number) {
    this.page = Math.min(Math.max(1, this.page + delta), this.totalPages);
    this.applyFiltersAndPaginate();
  }

  // -----------------------
  // OPEN / CLOSE MODALS
  // -----------------------
  openProfilesModal(user: any) {
    this.selectedUser = user;
    this.selectedProfile = null;
    this.showProfilesModal = true;
    this.loadUserEffectivePermissions(user.id);
  }

  openModulesModal(user: any) {
    this.selectedUser = user;
    this.selectedModule = null;
    this.showModulesModal = true;
    this.loadUserEffectivePermissions(user.id);
  }

  openPermissionsModal(user: any) {
    this.selectedUser = user;
    this.showPermissionsModal = true;
    this.loadUserEffectivePermissions(user.id);
  }

  closeModals() {
    this.showProfilesModal = false;
    this.showModulesModal = false;
    this.showPermissionsModal = false;
    this.showCreateEditModuleModal = false;
    this.showCreateEditPerfilModal = false;
    this.showCreateEditPermissionModal = false;
    this.selectedUser = null;
    this.effectivePermissions = null;
  }

  // -----------------------
  // ASSIGN / REMOVE
  // -----------------------
  assignProfileToUser() {
    if (!this.selectedUser || !this.selectedProfile) return;
    this.userService.assignPerfil(this.selectedUser.id, this.selectedProfile.id)
      .subscribe(() => {
        alert('Perfil asignado correctamente');
        this.loadAll(); // refrescar
        this.loadUserEffectivePermissions(this.selectedUser.id);
      }, err => console.error(err));
  }

  assignModuleToUser() {
    if (!this.selectedUser || !this.selectedModule) return;
    // No existe endpoint directo para "module-asign", trata cada módulo como permiso "module.access"
    // Buscar permiso en permissions por nombre o module_id
    const perm = this.permissions.find(p => p.module_id === this.selectedModule.id && p.name?.toLowerCase().includes('access'));
    if (!perm) {
      alert('No existe permiso asociado al módulo. Cree un permiso tipo "module.access" primero.');
      return;
    }
    this.permissionService.assignToUser(this.selectedUser.id, perm.id, 'ALLOW')
      .subscribe(() => {
        alert('Acceso al módulo asignado (permiso) correctamente');
        this.loadUserEffectivePermissions(this.selectedUser.id);
      }, err => console.error(err));
  }

  // assignPermissionToUser(permission: any, allow: 'ALLOW' | 'DENY' = 'ALLOW') {
  //   if (!this.selectedUser || !permission) return;
  //   this.permissionService.assignToUser(this.selectedUser.id, permission.id, allow)
  //     .subscribe(() => {
  //       alert('Permiso asignado');
  //       this.loadUserEffectivePermissions(this.selectedUser.id);
  //     }, err => console.error(err));
  // }

  assignPermission(permissionId: number, allow: 'ALLOW' | 'DENY') {
  if (!this.selectedUser) return;

  this.permissionService
    .assignToUser(this.selectedUser.id, permissionId, allow)
    .subscribe(() => {
      this.loadUserEffectivePermissions(this.selectedUser.id);
    });
}


  // removePermissionFromUser(permission: any) {
  //   if (!this.selectedUser || !permission) return;
  //   this.permissionService.removeFromUser(this.selectedUser.id, permission.id)
  //     .subscribe(() => {
  //       alert('Permiso removido');
  //       this.loadUserEffectivePermissions(this.selectedUser.id);
  //     }, err => console.error(err));
  // }

  // duplicate
  duplicateAccess(sourceId: number, targetId: number) {
    if (!sourceId || !targetId) return;
    this.userService.duplicatePermissions(sourceId, targetId)
      .subscribe(() => {
        alert('Permisos duplicados correctamente');
        this.loadAll();
      }, err => console.error(err));
  }

  askDuplicateTarget(sourceUserId: number) {
  const target = window.prompt('Ingrese ID destino:');

  if (!target) return;

  const targetId = Number(target);

  if (isNaN(targetId)) {
    alert('ID inválido');
    return;
  }

  this.duplicateAccess(sourceUserId, targetId);
}

// En tu AuthorizationManagerComponent
// getPermissionsByModule(moduleId: number): any[] {
//   return this.permissions.filter(perm => perm.module_id === moduleId);
// }
  // -----------------------
  // CRUD: MODULES / PERFILES / PERMISSIONS
  // -----------------------
  // Modules
  openCreateModule() {
    this.editingModule = { name: '', description: '' };
    this.showCreateEditModuleModal = true;
  }
  openEditModule(m: any) {
    this.editingModule = { ...m };
    this.showCreateEditModuleModal = true;
  }
  saveModule() {
    if (!this.editingModule) return;
    if (this.editingModule.id) {
      this.moduleService.update(this.editingModule.id, this.editingModule)
        .subscribe(() => { this.closeModals(); this.loadAll(); });
    } else {
      this.moduleService.create(this.editingModule)
        .subscribe(() => { this.closeModals(); this.loadAll(); });
    }
  }
  deleteModule(m: any) {
    if (!confirm(`Eliminar módulo "${m.name}"?`)) return;
    this.moduleService.delete(m.id).subscribe(() => this.loadAll());
  }

  // Perfiles
  openCreatePerfil() {
    this.editingPerfil = { name: '', description: '' };
    this.showCreateEditPerfilModal = true;
  }
  openEditPerfil(p: any) {
    this.editingPerfil = { ...p };
    this.showCreateEditPerfilModal = true;
  }
  savePerfil() {
    if (!this.editingPerfil) return;
    if (this.editingPerfil.id) {
      this.profileService.update(this.editingPerfil.id, this.editingPerfil)
        .subscribe(() => { this.closeModals(); this.loadAll(); });
    } else {
      this.profileService.create(this.editingPerfil)
        .subscribe(() => { this.closeModals(); this.loadAll(); });
    }
  }
  deletePerfil(p: any) {
    if (!confirm(`Eliminar perfil "${p.name}"?`)) return;
    this.profileService.delete(p.id).subscribe(() => this.loadAll());
  }

  // Permissions
  openCreatePermission() {
    this.editingPermission = { module_id: null, name: '', description: '' };
    this.showCreateEditPermissionModal = true;
  }
  openEditPermission(q: any) {
    this.editingPermission = { ...q };
    this.showCreateEditPermissionModal = true;
  }
  savePermission() {
    if (!this.editingPermission) return;
    if (this.editingPermission.id) {
      this.permissionService.update(this.editingPermission.id, this.editingPermission)
        .subscribe(() => { this.closeModals(); this.loadAll(); });
    } else {
      this.permissionService.create(this.editingPermission)
        .subscribe(() => { this.closeModals(); this.loadAll(); });
    }
  }
  deletePermission(q: any) {
    if (!confirm(`Eliminar permiso "${q.name}"?`)) return;
    this.permissionService.delete(q.id).subscribe(() => this.loadAll());
  }

  // -----------------------
  // EFFECTIVE PERMISSIONS (LIVE)
  // -----------------------
  loadUserEffectivePermissions(userId: number) {
    if (!userId) return;
    this.userService.getEffectivePermissions(userId).subscribe({
      next: (data: any) => {
        // data => { direct: [{name, allow}], inherited: [{name, allow}] }
        this.effectivePermissions = { direct: data.direct ?? [], inherited: data.inherited ?? [] };
      },
      error: err => {
        console.error(err);
        this.effectivePermissions = { direct: [], inherited: [] };
      }
    });
  }

  // Método para obtener permisos por módulo (ya lo tienes, pero aquí está mejorado)
// getPermissionsByModule(moduleId: number): any[] {
//   if (!this.permissions || !moduleId) return [];
//   return this.permissions.filter(perm => perm.module_id === moduleId);
// }

// Método mejorado para eliminar permisos
removePermissionFromUser(permission: any) {
  if (!this.selectedUser || !permission) return;
  
  // Usar SweetAlert2 para confirmar
  if (confirm(`¿Está seguro de eliminar el permiso "${permission.name}" del usuario ${this.selectedUser.name}?`)) {
    this.loading = true;
    this.permissionService.removeFromUser(this.selectedUser.id, permission.id)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: () => {
          // Notificación de éxito
          alert('Permiso eliminado correctamente');
          this.loadUserEffectivePermissions(this.selectedUser.id);
        },
        error: (err) => {
          console.error('Error al eliminar permiso:', err);
          alert('Error al eliminar el permiso. Por favor intente nuevamente.');
        }
      });
  }
}

// Método mejorado para asignar permisos con feedback visual
assignPermissionToUser(permission: any, allow: 'ALLOW' | 'DENY' = 'ALLOW') {
  if (!this.selectedUser || !permission) return;
  
  this.loading = true;
  this.permissionService.assignToUser(this.selectedUser.id, permission.id, allow)
    .pipe(finalize(() => this.loading = false))
    .subscribe({
      next: () => {
        const action = allow === 'ALLOW' ? 'permitido' : 'denegado';
        alert(`Permiso ${action} correctamente`);
        this.loadUserEffectivePermissions(this.selectedUser.id);
      },
      error: (err) => {
        console.error('Error al asignar permiso:', err);
        alert('Error al asignar el permiso. Por favor intente nuevamente.');
      }
    });
}
// En tu AuthorizationManagerComponent

// Filtros
selectedModuleFilter: string | number = 'all';

onModuleFilterChange(moduleId: string | number) {
  this.selectedModuleFilter = moduleId;
}

getFilteredModules(): any[] {
  if (this.selectedModuleFilter === 'all') {
    return this.modules;
  }
  return this.modules.filter(module => module.id === this.selectedModuleFilter);
}

getFilteredPermissions(): any[] {
  if (this.selectedModuleFilter === 'all') {
    return this.permissions;
  }
  return this.permissions.filter(perm => perm.module_id === this.selectedModuleFilter);
}

// Métodos de ayuda para permisos
getPermissionsByModule(moduleId: number): any[] {
  return this.permissions.filter(perm => perm.module_id === moduleId);
}

getDirectPermissionsByModule(moduleId: number): any[] {
  if (!this.effectivePermissions?.direct) return [];
  return this.effectivePermissions.direct.filter(perm => {
    const permission = this.permissions.find(p => p.id === perm.id);
    return permission && permission.module_id === moduleId;
  });
}

getInheritedPermissionsByModule(moduleId: number): any[] {
  if (!this.effectivePermissions?.inherited) return [];
  return this.effectivePermissions.inherited.filter(perm => {
    const permission = this.permissions.find(p => p.id === perm.id);
    return permission && permission.module_id === moduleId;
  });
}

isPermissionAssigned(permissionId: number, allow: string): boolean {
  const direct = this.effectivePermissions?.direct || [];
  return direct.some(perm => perm.id === permissionId && perm.allow === allow);
}

getPermissionStatus(permissionId: number): string | null {
  const direct = this.effectivePermissions?.direct || [];
  const permission = direct.find(perm => perm.id === permissionId);
  return permission ? permission.allow : null;
}

// Métodos de resumen
getTotalAllowedPermissions(): number {
  const direct = this.effectivePermissions?.direct || [];
  return direct.filter(perm => perm.allow === 'ALLOW').length;
}

getTotalDeniedPermissions(): number {
  const direct = this.effectivePermissions?.direct || [];
  return direct.filter(perm => perm.allow === 'DENY').length;
}

getTotalPermissions(): number {
  const direct = this.effectivePermissions?.direct || [];
  const inherited = this.effectivePermissions?.inherited || [];
  return direct.length + inherited.length;
}

// Método para guardar cambios
savePermissionChanges() {
  // Aquí puedes implementar la lógica para guardar todos los cambios
  this.closeModals();
}
}
