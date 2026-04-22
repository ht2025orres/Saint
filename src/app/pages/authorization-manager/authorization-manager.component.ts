import { Component, OnInit } from '@angular/core';
import { AuthorizationManagerFacade } from '../../services/authorization-manager.facade';
import { UserService } from '../../services/user.service';
import { ModulesService } from '../../services/modules.service';
import { ProfilesService } from '../../services/profiles.service';
import { PermissionsService } from '../../services/permissions.service';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs/operators';
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
  perPage = 10;
  totalPages = 1;
  pagedUsers: any[] = [];

  // ---- NEW MEGA MODAL STATE ----
  showUserManageModal = false;
  editingUser: any = null;
  userPassword = '';
  userPasswordConfirm = '';

  // Tabs for permissions filter
  selectedModuleFilter: string | number = 'all';

  // Buscador de permisos dentro del modal de usuario
  permSearchTerm = '';

  // Buscador en modal de estructura
  structureSearch = '';

  // Permisos pendientes de guardar (Map<permissionId, 'ALLOW'|'DENY'|'REMOVE'>)
  pendingPermissions = new Map<number, 'ALLOW' | 'DENY' | 'REMOVE'>();

  // Perfiles pendientes (se gestiona igual que antes pero sin llamar al backend)
  pendingProfilesSynced = false; // flag para saber si hay cambios en perfiles

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

  // ---- AUDIT LOGS STATE ----
  showAuditModal = false;
  auditLogs: any[] = [];
  auditPage = 1;
  auditTotalPages = 1;
  auditTargetUserId: number | null = null; // para filtrar por usuario específico
  auditTargetUser: any = null; // objeto para mostrar nombre en el título

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
      (u.firstName ?? '').toLowerCase().includes(term) ||
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
    this.editingUser = { ...user, firstName: user.firstName || user.name, lastName: user.lastName || '' };
    this.userPassword = '';
    this.userPasswordConfirm = '';
    this.userProfiles = Array.isArray(user.perfiles) ? [...user.perfiles] : [];
    this.selectedModuleFilter = 'all';
    this.permSearchTerm = '';
    // Limpiar cambios pendientes al abrir el modal
    this.pendingPermissions = new Map();
    this.pendingProfilesSynced = false;
    this.showUserManageModal = true;
    this.loadUserEffectivePermissions(user.id);
  }

  closeUserMegaModal() {
    this.showUserManageModal = false;
    this.editingUser = null;
    this.effectivePermissions = null;
    this.pendingPermissions = new Map();
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
      perfiles: this.userProfiles
    };

    this.loading = true;

    // 1. Guardar info básica del usuario
    this.userService.saveUser(payload as any).subscribe({
      next: () => {
        // 2. Aplicar cambios de permisos pendientes en secuencia
        const permOps = Array.from(this.pendingPermissions.entries()).map(([permId, action]) => {
          const perm = this.permissions.find(p => p.id === permId);
          if (!perm) return null;
          return action === 'REMOVE'
            ? this.permissionService.removeFromUser(this.editingUser.id, permId)
            : this.permissionService.assignToUser(this.editingUser.id, permId, action as 'ALLOW' | 'DENY');
        }).filter(Boolean) as any[];

        if (permOps.length === 0) {
          // Sin cambios de permisos, finalizar
          this.loading = false;
          Swal.fire('Guardado', 'Usuario actualizado correctamente', 'success');
          this.closeUserMegaModal();
          this.loadAll();
          return;
        }

        // Ejecutar todas las ops de permisos en paralelo
        import('rxjs').then(({ forkJoin }) => {
          forkJoin(permOps).pipe(finalize(() => this.loading = false)).subscribe({
            next: () => {
              Swal.fire('Guardado', 'Usuario y permisos actualizados correctamente', 'success');
              this.closeUserMegaModal();
              this.loadAll();
            },
            error: (err) => {
              console.error(err);
              Swal.fire('Atención', 'Info guardada, pero hubo un error al aplicar algunos permisos', 'warning');
              this.closeUserMegaModal();
              this.loadAll();
            }
          });
        });
      },
      error: (err) => {
        this.loading = false;
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

  // Permisos Logic — modo batch: los cambios se acumulan localmente y se aplican al guardar
  getPermissionStatus(permissionId: number): string | null {
    // 1. Si hay un cambio pendiente, tiene prioridad visual
    if (this.pendingPermissions.has(permissionId)) {
      const pending = this.pendingPermissions.get(permissionId)!;
      return pending === 'REMOVE' ? null : pending;
    }
    // 2. Si no hay cambio pendiente, mostrar el valor guardado en BD
    const direct = this.effectivePermissions?.direct || [];
    const found = direct.find(p => p.id === permissionId);
    return found ? found.allow : null;
  }

  assignPermission(permission: any, allow: 'ALLOW' | 'DENY') {
    if (!this.editingUser) return;
    // Solo actualiza el mapa local — no llama al backend
    this.pendingPermissions.set(permission.id, allow);
  }

  removePermission(permission: any) {
    if (!this.editingUser) return;
    // Marca como REMOVE en el mapa — solo se aplica al guardar
    this.pendingPermissions.set(permission.id, 'REMOVE');
  }

  isInherited(permissionId: number): boolean {
    const inherited = this.effectivePermissions?.inherited || [];
    return inherited.some(p => p.id === permissionId);
  }

  /**
   * Filtra los permisos por módulo seleccionado Y por texto de búsqueda.
   * Se usa tanto en el modal de usuario como en gestión de perfiles.
   */
  getFilteredPermissions(): any[] {
    let list = this.permissions;

    // Filtro por módulo
    if (this.selectedModuleFilter !== 'all') {
      list = list.filter(p => p.module_id === this.selectedModuleFilter);
    }

    // Filtro por texto
    // Si el modal estructural está abierto, usamos su buscador global para filtrar también aquí
    const term = (this.showStructureModal ? this.structureSearch : this.permSearchTerm)?.trim().toLowerCase();

    if (term) {
      list = list.filter(p => p.name?.toLowerCase().includes(term));
    }

    return list;
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
    this.structureSearch = '';
    this.permSearchTerm = '';
    this.selectedModuleFilter = 'all';
    this.showStructureModal = true;
  }

  closeStructureModal() {
    this.showStructureModal = false;
    this.structureSearch = '';
    this.editingModule = null;
    this.editingPerfil = null;
    this.editingPermission = null;
  }

  // Filtrado en modal de estructura
  getFilteredModules(): any[] {
    const t = this.structureSearch.trim().toLowerCase();
    return t ? this.modules.filter(m => m.name?.toLowerCase().includes(t)) : this.modules;
  }

  getFilteredProfiles(): any[] {
    const t = this.structureSearch.trim().toLowerCase();
    return t ? this.profiles.filter(p => p.name?.toLowerCase().includes(t)) : this.profiles;
  }

  getFilteredStructurePermissions(): any[] {
    const t = this.structureSearch.trim().toLowerCase();
    if (!t) return this.permissions;
    return this.permissions.filter(p =>
      p.name?.toLowerCase().includes(t) ||
      p.module?.name?.toLowerCase().includes(t)
    );
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
  openCreatePerfil() {
    this.editingPerfil = { name: '', description: '' };
    this.selectedModuleFilter = 'all';
  }
  openEditPerfil(p: any) {
    // Normalizamos para manejar camelCase consistentemente
    const perfilPermissions = p.perfilPermissions || p.perfil_permissions || [];
    this.editingPerfil = { ...p, perfilPermissions };
    this.selectedModuleFilter = 'all';
  }
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

  // -----------------------
  // AUDIT / TRACEABILITY
  // -----------------------
  openAuditModal(user?: any) {
    if (user && typeof user === 'object') {
      this.auditTargetUserId = user.id;
      this.auditTargetUser = user;
    } else if (user) {
      // Si recibimos solo el ID por alguna razón
      this.auditTargetUserId = user;
      this.auditTargetUser = this.users.find(u => u.id === user) || null;
    } else {
      this.auditTargetUserId = null;
      this.auditTargetUser = null;
    }

    this.auditPage = 1;
    this.auditLogs = [];
    this.showAuditModal = true;
    this.loadAuditLogs();
  }

  closeAuditModal() {
    this.showAuditModal = false;
    this.auditTargetUser = null;
  }

  loadAuditLogs() {
    this.loading = true;
    const params: any = { page: this.auditPage };
    if (this.auditTargetUserId) params.target_user_id = this.auditTargetUserId;

    this.userService.getAuditLogs(params).subscribe({
      next: (res: any) => {
        this.auditLogs = res.data;
        this.auditTotalPages = res.last_page;
        this.loading = false;
      },
      error: err => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  changeAuditPage(delta: number) {
    this.auditPage += delta;
    this.loadAuditLogs();
  }

  getAuditUserDisplay(u: any): string {
    if (!u) return 'Sistema';
    const name = (u.first_name || u.firstName || u.name || '') + ' ' + (u.last_name || u.lastName || '');
    return `${name} (ID: ${u.id})`;
  }

  translateAction(action: string): string {
    const map: any = {
      'assign_permission_to_user': 'Asignación de permiso a usuario',
      'remove_permission_from_user': 'Retiro de permiso a usuario',
      'assign_permission_to_perfil': 'Asignación de permiso a perfil',
      'remove_permission_from_perfil': 'Retiro de permiso a perfil',
      'assign_perfil': 'Perfil asignado a usuario',
      'remove_perfil': 'Perfil retirado a usuario',
      'create_module': 'Creación de módulo',
      'update_module': 'Actualización de módulo',
      'delete_module': 'Eliminación de módulo',
      'create_profile': 'Creación de perfil',
      'update_profile': 'Actualización de perfil',
      'delete_profile': 'Eliminación de perfil',
      'create_permission': 'Creación de permiso',
      'update_permission': 'Actualización de permiso',
      'delete_permission': 'Eliminación de permiso',
      'impersonate': 'Personificación de cuenta'
    };
    return map[action] || action.replace(/_/g, ' ');
  }

  renderAuditDetails(data: any): string {
    if (!data) return 'N/A';

    if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
      try { data = JSON.parse(data); } catch (e) { }
    }

    if (typeof data !== 'object') return String(data);

    // Caso: Array de permisos en perfil (perfil_permissions) o usuario (permissions)
    const permsArray = data.perfil_permissions || data.permissions;
    if (permsArray && Array.isArray(permsArray)) {
      if (permsArray.length === 0) return 'Lista vacía';
      return permsArray.map((p: any) => {
        const pId = p.permission_id || p.id;
        const permObj = this.permissions.find(x => x.id === pId);
        return permObj ? permObj.name : `Permiso #${pId}`;
      }).join(', ');
    }

    // Caso: Sync de perfiles
    if (data.perfil_ids && Array.isArray(data.perfil_ids)) {
      if (data.perfil_ids.length === 0) return 'Sin perfiles';
      return data.perfil_ids.map((id: number) => {
        const prof = this.profiles.find(x => x.id === id);
        return prof ? prof.name : `Perfil #${id}`;
      }).join(', ');
    }

    const parts: string[] = [];
    if (data.permission_id) {
      const p = this.permissions.find(x => x.id === data.permission_id);
      parts.push(`Permiso: ${p ? p.name : '#' + data.permission_id}`);
    }
    if (data.allow) parts.push(`Modo: ${data.allow}`);
    if (data.name) parts.push(`Nombre: ${data.name}`);
    if (data.description) parts.push(`Desc: ${data.description}`);

    return parts.length > 0 ? parts.join(' | ') : JSON.stringify(data);
  }

  /**
   * Intenta encontrar la diferencia entre antes y después para no mostrar todo el JSON
   */
  getAuditDelta(log: any): { type: 'added' | 'removed' | 'modified' | 'complex', text: string } {
    const before = this.parseAuditData(log.before_data);
    const after = this.parseAuditData(log.after_data);

    // Si es asignación/retiro de permiso individual (fácil)
    if (log.action.includes('permission')) {
      // Si antes no estaba y ahora sí (o viceversa)
      const bPerms = before?.perfil_permissions || before?.permissions || [];
      const aPerms = after?.perfil_permissions || after?.permissions || [];

      if (Array.isArray(bPerms) && Array.isArray(aPerms)) {
        const bIds = bPerms.map(p => p.permission_id || p.id);
        const aIds = aPerms.map(p => p.permission_id || p.id);

        const added = aIds.filter(id => !bIds.includes(id));
        const removed = bIds.filter(id => !aIds.includes(id));

        if (added.length === 1 && removed.length === 0) {
          const p = this.permissions.find(x => x.id === added[0]);
          return { type: 'added', text: `Agregó: ${p ? p.name : '#' + added[0]}` };
        }
        if (removed.length === 1 && added.length === 0) {
          const p = this.permissions.find(x => x.id === removed[0]);
          return { type: 'removed', text: `Quitó: ${p ? p.name : '#' + removed[0]}` };
        }
      }
    }

    return { type: 'complex', text: 'Cambio múltiple' };
  }

  /**
   * Retorna una lista estructurada de cambios para renderizar con puntitos de colores
   */
  getAuditDetailedChanges(log: any): { name: string, status: 'added' | 'removed' | 'neutral' | 'warning' }[] {
    const before = this.parseAuditData(log.before_data);
    const after = this.parseAuditData(log.after_data);

    const bPerms = before?.perfil_permissions || before?.permissions || [];
    const aPerms = after?.perfil_permissions || after?.permissions || [];

    const result: { name: string, status: 'added' | 'removed' | 'neutral' | 'warning' }[] = [];

    if (Array.isArray(bPerms) && Array.isArray(aPerms)) {
      const bMap = new Map(bPerms.map(p => [p.permission_id || p.id, p]));
      const aMap = new Map(aPerms.map(p => [p.permission_id || p.id, p]));

      const allIds = Array.from(new Set([...bMap.keys(), ...aMap.keys()]));

      for (const id of allIds) {
        const inBefore = bMap.has(id);
        const inAfter = aMap.has(id);
        const aVal = aMap.get(id);
        const permObj = this.permissions.find(x => x.id === id);
        const name = permObj ? permObj.name : `Permiso #${id}`;

        if (inAfter && !inBefore) {
          const status = aVal?.allow === 'DENY' ? 'warning' : 'added';
          result.push({ name, status });
        } else if (!inAfter && inBefore) {
          result.push({ name, status: 'removed' });
        } else if (inAfter && inBefore && aVal?.allow !== bMap.get(id)?.allow) {
          const status = aVal?.allow === 'DENY' ? 'warning' : 'added';
          result.push({ name: `${name} (cambió a ${aVal?.allow})`, status });
        }
      }
    }

    // Si no es un array de permisos, intentar parsear campos simples
    if (result.length === 0) {
      const pId = after?.permission_id || before?.permission_id;
      if (pId) {
        const p = this.permissions.find(x => x.id === pId);
        const pName = p ? p.name : `Permiso #${pId}`;
        let status: 'added' | 'removed' | 'neutral' | 'warning' = 'neutral';

        if (after?.allow && !before?.allow) {
          status = after.allow === 'DENY' ? 'warning' : 'added';
        } else if (before?.allow && !after?.allow) {
          status = 'removed';
        } else if (after?.allow !== before?.allow) {
          status = after?.allow === 'DENY' ? 'warning' : 'added';
        }

        result.push({ name: `Permiso: ${pName}`, status });
      }

      const profId = after?.perfil_id || before?.perfil_id;
      if (profId) {
        const prof = this.profiles.find(x => x.id === profId);
        const profName = prof ? prof.name : `Perfil #${profId}`;
        const status = (after && !before) ? 'added' : (!after && before ? 'removed' : 'neutral');
        result.push({ name: `Perfil: ${profName}`, status });
      }

      const modId = after?.module_id || before?.module_id;
      if (modId) {
        const mod = this.modules.find(x => x.id === modId);
        const modName = mod ? mod.name : `Módulo #${modId}`;
        const status = (after && !before) ? 'added' : (!after && before ? 'removed' : 'neutral');
        result.push({ name: `Módulo: ${modName}`, status });
      }

      const fields = ['name', 'description', 'allow', 'email', 'firstName', 'lastName'];
      for (const f of fields) {
        const valBefore = before?.[f];
        const valAfter = after?.[f];

        if (valBefore !== valAfter) {
          if (valAfter !== undefined && valBefore === undefined) {
            result.push({ name: `${this.labelField(f)}: ${valAfter}`, status: 'added' });
          } else if (valAfter === undefined && valBefore !== undefined) {
            result.push({ name: `${this.labelField(f)}: ${valBefore}`, status: 'removed' });
          } else if (valAfter !== undefined && valBefore !== undefined) {
            // Para actualizaciones, mostrar antes y después como solicitó el usuario
            result.push({ name: `${this.labelField(f)}: "${valBefore}" → "${valAfter}"`, status: 'neutral' });
          }
        }
      }
    }

    return result;
  }

  private labelField(f: string): string {
    const map: any = {
      'allow': 'Modo',
      'name': 'Nombre',
      'description': 'Descripción',
      'email': 'Correo',
      'firstName': 'Nombre',
      'lastName': 'Apellido'
    };
    return map[f] || f;
  }

  private parseAuditData(data: any): any {
    if (!data) return null;
    if (typeof data === 'object') return data;
    try { return JSON.parse(data); } catch (e) { return null; }
  }
  isPerfilPermissionChecked(permissionId: number): boolean {
    const pp = this.editingPerfil?.perfilPermissions || [];
    return pp.some((x: any) => x.permission_id === permissionId && x.allow === 'ALLOW');
  }

  togglePerfilPermission(permission: any, event: any) {
    if (!this.editingPerfil || !this.editingPerfil.id) return;
    const isChecked = event.target.checked;

    // Inicializar el array si no existe
    if (!this.editingPerfil.perfilPermissions) {
      this.editingPerfil.perfilPermissions = [];
    }

    if (isChecked) {
      // Agregar localmente para feedback inmediato
      this.editingPerfil.perfilPermissions.push({ permission_id: permission.id, allow: 'ALLOW' });

      this.permissionService.assignToPerfil(this.editingPerfil.id, permission.id, 'ALLOW')
        .subscribe({
          next: () => {
            this.facade.loadInitialData().subscribe(res => {
              this.profiles = res.profiles ?? [];
            });
          },
          error: () => {
            // Revertir si falla
            this.editingPerfil.perfilPermissions = this.editingPerfil.perfilPermissions.filter((x: any) => x.permission_id !== permission.id);
            Swal.fire('Error', 'No se pudo asignar el permiso', 'error');
          }
        });
    } else {
      // Quitar localmente para feedback inmediato
      this.editingPerfil.perfilPermissions = this.editingPerfil.perfilPermissions.filter((x: any) => x.permission_id !== permission.id);

      this.permissionService.removeFromPerfil(this.editingPerfil.id, permission.id)
        .subscribe({
          next: () => {
            this.facade.loadInitialData().subscribe(res => {
              this.profiles = res.profiles ?? [];
            });
          },
          error: () => {
            // Revertir si falla
            this.editingPerfil.perfilPermissions.push({ permission_id: permission.id, allow: 'ALLOW' });
            Swal.fire('Error', 'No se pudo retirar el permiso', 'error');
          }
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
