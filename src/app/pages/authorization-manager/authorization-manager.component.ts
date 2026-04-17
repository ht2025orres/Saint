import { Component, OnInit } from '@angular/core';
import { AuthorizationManagerFacade } from '../../services/authorization-manager.facade';
import { UserService } from '../../services/user.service';
import { ModulesService } from '../../services/modules.service';
import { ProfilesService } from '../../services/profiles.service';
import { PermissionsService } from '../../services/permissions.service';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

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

  // search + pagination (client)
  searchTerm = '';
  page = 1;
  perPage = 8;
  totalPages = 1;
  pagedUsers: any[] = [];

  // ---- NEW MEGA MODAL STATE ----
  showUserManageModal = false;
  editingUser: any = null;
  userPassword = '';
  userPasswordConfirm = '';
  
  // Tabs for permissions filter
  selectedModuleFilter: string | number = 'all';
  
  // Permissions state
  effectivePermissions: { direct: any[]; inherited: any[] } | null = null;
  userProfiles: any[] = []; // to manage profiles

  // ---- STRUCTURE MODAL STATE ----
  showStructureModal = false;
  activeStructureTab: 'modules' | 'profiles' | 'permissions' = 'modules';
  
  // Edit items
  editingModule: any = null;
  editingPerfil: any = null;
  editingPermission: any = null;

  constructor(
    private facade: AuthorizationManagerFacade,
    private userService: UserService,
    private moduleService: ModulesService,
    private profileService: ProfilesService,
    private permissionService: PermissionsService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadAll();
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
      (u.firstName ?? u.name ?? '').toLowerCase().includes(term) ||
      (u.lastName ?? '').toLowerCase().includes(term) ||
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
  // MEGA MODAL USUARIO
  // -----------------------
  openManageUser(user: any) {
    // Copia profunda para no afectar la tabla directamente hasta guardar
    this.editingUser = { ...user, firstName: user.firstName || user.name, lastName: user.lastName || '' };
    this.userPassword = '';
    this.userPasswordConfirm = '';
    
    // Cargar perfil actual del usuario para el checkbox
    this.userProfiles = Array.isArray(user.perfiles) ? [...user.perfiles] : [];
    
    this.selectedModuleFilter = 'all';
    this.showUserManageModal = true;
    
    this.loadUserEffectivePermissions(user.id);
  }

  closeUserMegaModal() {
    this.showUserManageModal = false;
    this.editingUser = null;
    this.effectivePermissions = null;
  }

  saveMegaUser() {
    if (this.userPassword && this.userPassword !== this.userPasswordConfirm) {
      Swal.fire('Error', 'Las contraseñas no coinciden', 'error');
      return;
    }

    const payload = {
      id: this.editingUser.id,
      firstName: this.editingUser.firstName,
      lastName: this.editingUser.lastName,
      email: this.editingUser.email,
      password: this.userPassword || undefined,
      perfiles: this.userProfiles // pasamos el array de perfiles asignados
    };

    this.loading = true;
    this.userService.saveUser(payload as any)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: () => {
          Swal.fire('Guardado', 'Información del usuario actualizada', 'success');
          this.closeUserMegaModal();
          this.loadAll();
        },
        error: (err) => {
          console.error(err);
          Swal.fire('Error', 'No se pudo guardar la información del usuario', 'error');
        }
      });
  }

  toggleUserStatus() {
    if (!this.editingUser) return;
    const action = this.editingUser.enabled ? this.userService.disableUser(this.editingUser) : this.userService.enableUser(this.editingUser);
    const label = this.editingUser.enabled ? 'desactivado' : 'activado';

    this.loading = true;
    action.pipe(finalize(() => this.loading = false))
      .subscribe({
        next: () => {
          this.editingUser.enabled = !this.editingUser.enabled;
          Swal.fire('Éxito', `Usuario ${label} correctamente`, 'success');
          this.loadAll();
        },
        error: (err) => {
          console.error(err);
          Swal.fire('Error', 'No se pudo cambiar el estado del usuario', 'error');
        }
      });
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
                window.location.reload(); // Recargar para aplicar todos los cambios de sesión
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

  loadUserEffectivePermissions(userId: number) {
    this.permissionService.getEffectivePermissions(userId).subscribe({
      next: (data: any) => {
        this.effectivePermissions = { direct: data.direct ?? [], inherited: data.inherited ?? [] };
      },
      error: err => {
        console.error(err);
        this.effectivePermissions = { direct: [], inherited: [] };
      }
    });
  }

  // Lógica perfiles local
  hasProfile(perfilId: number): boolean {
    return this.userProfiles.some(p => p.id === perfilId);
  }

  getSortedProfiles(): any[] {
    // Retornamos de tal manera que los asigandos queden de primeros
    return [...this.profiles].sort((a, b) => {
      const hasA = this.hasProfile(a.id) ? 1 : 0;
      const hasB = this.hasProfile(b.id) ? 1 : 0;
      return hasB - hasA;
    });
  }

  toggleProfile(prof: any, event: any) {
    const isChecked = event.target.checked;
    if (isChecked) {
      if (!this.hasProfile(prof.id)) { this.userProfiles.push(prof); }
    } else {
      this.userProfiles = this.userProfiles.filter(p => p.id !== prof.id);
    }
  }

  // Permisos Logic
  getPermissionStatus(permissionId: number): string | null {
    const direct = this.effectivePermissions?.direct || [];
    const found = direct.find(p => p.id === permissionId);
    return found ? found.allow : null;
  }

  assignPermission(permission: any, allow: 'ALLOW' | 'DENY') {
    if (!this.editingUser) return;
    this.permissionService.assignToUser(this.editingUser.id, permission.id, allow)
      .subscribe(() => this.loadUserEffectivePermissions(this.editingUser.id));
  }

  removePermission(permission: any) {
    if (!this.editingUser) return;
    this.permissionService.removeFromUser(this.editingUser.id, permission.id)
      .subscribe(() => this.loadUserEffectivePermissions(this.editingUser.id));
  }

  isInherited(permissionId: number): boolean {
    const inherited = this.effectivePermissions?.inherited || [];
    return inherited.some(p => p.id === permissionId);
  }

  // Filtros visuales para Permisos en MegaModal
  getFilteredPermissions(): any[] {
    if (this.selectedModuleFilter === 'all') {
      return this.permissions;
    }
    return this.permissions.filter(perm => perm.module_id === this.selectedModuleFilter);
  }

  getPermissionsCountByModule(moduleId: number): number {
    return this.permissions.filter(p => p.module_id === moduleId).length;
  }

  askDuplicateTarget() {
    const target = window.prompt('Ingrese el ID del usuario DESTINO:');
    if (!target) return;
    const targetId = Number(target);
    if (isNaN(targetId)) return alert('ID inválido');
    
    this.userService.duplicatePermissions(this.editingUser.id, targetId)
      .subscribe(() => {
        Swal.fire('Éxito', 'Permisos duplicados correctamente', 'success');
      }, err => console.error(err));
  }


  // -----------------------
  // STRUCTURE MODAL (Módulos, Perfiles, Permisos)
  // -----------------------
  openStructureModal() {
    this.activeStructureTab = 'modules';
    this.showStructureModal = true;
  }

  closeStructureModal() {
    this.showStructureModal = false;
    this.editingModule = null;
    this.editingPerfil = null;
    this.editingPermission = null;
  }

  // --- Módulos CRUD
  openCreateModule() { this.editingModule = { name: '', description: '' }; }
  openEditModule(m: any) { this.editingModule = { ...m }; }
  cancelEditModule() { this.editingModule = null; }
  saveModule() {
    if (!this.editingModule.name) return;
    const req = this.editingModule.id 
      ? this.moduleService.update(this.editingModule.id, this.editingModule)
      : this.moduleService.create(this.editingModule);
    
    req.subscribe(() => {
      this.editingModule = null;
      this.loadAll();
    });
  }
  deleteModule(m: any) {
    if (confirm(`¿Eliminar módulo "${m.name}"?`)) {
      this.moduleService.delete(m.id).subscribe(() => this.loadAll());
    }
  }

  // --- Perfiles CRUD
  openCreatePerfil() { this.editingPerfil = { name: '', description: '' }; }
  openEditPerfil(p: any) { this.editingPerfil = { ...p }; }
  cancelEditPerfil() { this.editingPerfil = null; }
  savePerfil() {
    if (!this.editingPerfil.name) return;
    const req = this.editingPerfil.id 
      ? this.profileService.update(this.editingPerfil.id, this.editingPerfil)
      : this.profileService.create(this.editingPerfil);
    
    req.subscribe(() => {
      this.editingPerfil = null;
      this.loadAll();
    });
  }
  deletePerfil(p: any) {
    if (confirm(`¿Eliminar perfil "${p.name}"?`)) {
      this.profileService.delete(p.id).subscribe(() => this.loadAll());
    }
  }

  // --- Permisos de Perfiles
  isPerfilPermissionChecked(permissionId: number): boolean {
    // Verificamos ambas variantes por consistencia con el backend
    const pp = this.editingPerfil?.perfil_permissions || this.editingPerfil?.perfilPermissions || [];
    return pp.some((x:any) => x.permission_id === permissionId && x.allow === 'ALLOW');
  }

  togglePerfilPermission(permission: any, event: any) {
    if(!this.editingPerfil || !this.editingPerfil.id) return;
    const isChecked = event.target.checked;
    
    // Inicializar el array si no existe
    if (!this.editingPerfil.perfil_permissions && !this.editingPerfil.perfilPermissions) {
      this.editingPerfil.perfil_permissions = [];
    }
    
    const permissionsList = this.editingPerfil.perfil_permissions || this.editingPerfil.perfilPermissions;

    if (isChecked) {
      permissionsList.push({ permission_id: permission.id, allow: 'ALLOW' });
      this.permissionService.assignToPerfil(this.editingPerfil.id, permission.id, 'ALLOW')
        .subscribe(() => {
          // No recargamos todo para no perder el estado del scroll en el modal
          // pero actualizamos los datos en segundo plano
          this.facade.loadInitialData().subscribe(res => {
            this.profiles = res.profiles ?? [];
          });
        });
    } else {
      const index = permissionsList.findIndex((x:any) => x.permission_id === permission.id);
      if (index > -1) permissionsList.splice(index, 1);
      
      this.permissionService.removeFromPerfil(this.editingPerfil.id, permission.id)
        .subscribe(() => {
          this.facade.loadInitialData().subscribe(res => {
            this.profiles = res.profiles ?? [];
          });
        });
    }
  }

  // --- Permisos CRUD
  openCreatePermission() { this.editingPermission = { module_id: null, name: '', description: '' }; }
  openEditPermission(q: any) { this.editingPermission = { ...q }; }
  cancelEditPermission() { this.editingPermission = null; }
  savePermission() {
    if (!this.editingPermission.name || !this.editingPermission.module_id) return;
    const req = this.editingPermission.id 
      ? this.permissionService.update(this.editingPermission.id, this.editingPermission)
      : this.permissionService.create(this.editingPermission);
    
    req.subscribe(() => {
      this.editingPermission = null;
      this.loadAll();
    });
  }
  deletePermission(q: any) {
    if (confirm(`¿Eliminar permiso "${q.name}"?`)) {
      this.permissionService.delete(q.id).subscribe(() => this.loadAll());
    }
  }
}
