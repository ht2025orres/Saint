import { Component, Input, Output, EventEmitter } from '@angular/core';
import { UserService } from '../../../../services/user.service';
import { PermissionsService } from '../../../../services/permissions.service';
import { AuthService } from '../../../../services/auth.service';
import { AuthorizationManagerFacade } from '../../../../services/authorization-manager.facade';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-modal-manage-user',
  templateUrl: './modal-manage-user.component.html'
})
export class ModalManageUserComponent {
  @Input() user: any = null;
  @Input() permissions: any[] = [];
  @Input() profiles: any[] = [];
  @Input() modules: any[] = [];
  @Input() procesos: any[] = [];

  @Output() onClose = new EventEmitter<void>();
  @Output() onSaved = new EventEmitter<void>();
  @Output() onImpersonate = new EventEmitter<any>();

  visible = false;
  editingUser: any = null;
  userPassword = '';
  userPasswordConfirm = '';
  isEditingSelf: boolean = false;
  userProfiles: any[] = [];
  userProcesoIds: number[] = [];

  // Dropdowns desplegables con barra de búsqueda para Perfiles y Procesos
  isProfileDropdownOpen = false;
  profileSearchTerm = '';
  isProcesoDropdownOpen = false;
  procesoSearchTerm = '';

  isModuleDropdownOpen = false;
  moduleSearchTerm = '';
  selectedModuleIds: number[] = [];
  permSearchTerm = '';
  pendingPermissions = new Map<number, 'ALLOW' | 'DENY' | 'REMOVE'>();
  effectivePermissions: { direct: any[]; inherited: any[] } | null = null;
  loading = false;

  // Estado Multi-Plataforma GLPI & Google Workspace
  platformStatusLoading = false;
  platformActionLoading = false;
  platformStatusData: any = null;

  constructor(
    private userService: UserService,
    private permissionService: PermissionsService,
    private authService: AuthService,
    private facade: AuthorizationManagerFacade,
    private router: Router,
    private http: HttpClient
  ) {}

  abrir(user: any = null) {
    this.user = user;
    if (user) {
      this.editingUser = {
        ...user,
        cedula: user.cedula || '',
        firstName: user.firstName || user.name || '',
        lastName: user.lastName || '',
        email: user.email || user.correo_corporativo || '',
        correo_personal: user.correo_personal || '',
        telefono: user.telefono || '',
        cargo: user.cargo || '',
        usuario_siesa_nube: user.usuario_siesa_nube || '',
        usuario_glpi: user.usuario_glpi || '',
        requiere_siesa_nube: user.requiere_siesa_nube ?? false,
        requiere_conecta: user.requiere_conecta ?? true,
        requiere_saint: user.requiere_saint ?? true,
        requiere_correo: user.requiere_correo ?? false,
        requiere_glpi: user.requiere_glpi ?? false,
        password_conecta: '',
      };
      this.isEditingSelf = this.authService.user?.id === user.id;
      this.userProfiles = Array.isArray(user.perfiles) ? [...user.perfiles] : [];
      this.userProcesoIds = Array.isArray(user.proceso_ids) ? [...user.proceso_ids] : [];
      this.loadUserEffectivePermissions(user.id);
      this.cargarEstadoPlataformas(user.id);
    } else {
      this.editingUser = {
        id: null,
        cedula: '',
        firstName: '',
        lastName: '',
        email: '',
        correo_personal: '',
        telefono: '',
        cargo: '',
        usuario_siesa_nube: '',
        usuario_glpi: '',
        requiere_siesa_nube: false,
        requiere_conecta: true,
        requiere_saint: true,
        requiere_correo: false,
        requiere_glpi: false,
        password_conecta: '',
        enabled: true
      };
      this.isEditingSelf = false;
      this.userProfiles = [];
      this.userProcesoIds = [];
      this.effectivePermissions = { direct: [], inherited: [] };
      this.platformStatusData = null;
    }
    
    this.userPassword = '';
    this.userPasswordConfirm = '';
    this.selectedModuleIds = Array.isArray(this.modules) ? this.modules.map(m => m.id) : [];
    this.isModuleDropdownOpen = false;
    this.moduleSearchTerm = '';
    this.isProfileDropdownOpen = false;
    this.profileSearchTerm = '';
    this.isProcesoDropdownOpen = false;
    this.procesoSearchTerm = '';
    this.permSearchTerm = '';
    this.pendingPermissions = new Map();
    this.visible = true;
  }

  cerrar() {
    this.visible = false;
    this.editingUser = null;
    this.effectivePermissions = null;
    this.pendingPermissions = new Map();
    this.userProcesoIds = [];
    this.onClose.emit();
  }

  hasProceso(procesoId: number): boolean {
    return this.userProcesoIds.includes(procesoId);
  }

  toggleProceso(procesoId: number, event: any) {
    const isChecked = event.target.checked;
    if (isChecked) {
      if (!this.userProcesoIds.includes(procesoId)) {
        this.userProcesoIds.push(procesoId);
      }
    } else {
      this.userProcesoIds = this.userProcesoIds.filter(id => id !== procesoId);
    }
  }

  saveMegaUser() {
    if (!this.editingUser.firstName || !this.editingUser.email) {
      Swal.fire('Error', 'Nombre y Correo Corporativo son campos obligatorios', 'error');
      return;
    }

    if (!this.editingUser.id && !this.userPassword) {
      Swal.fire('Error', 'La contraseña de Saint es obligatoria para nuevos usuarios', 'error');
      return;
    }

    if (this.userPassword && this.userPassword !== this.userPasswordConfirm) {
      Swal.fire('Error', 'Las contraseñas de Saint no coinciden', 'error');
      return;
    }

    const payload = {
      id: this.editingUser.id,
      cedula: this.editingUser.cedula,
      firstName: this.editingUser.firstName,
      lastName: this.editingUser.lastName,
      email: this.editingUser.email,
      correo_personal: this.editingUser.correo_personal,
      telefono: this.editingUser.telefono,
      cargo: this.editingUser.cargo,
      usuario_siesa_nube: this.editingUser.usuario_siesa_nube,
      usuario_glpi: this.editingUser.usuario_glpi,
      requiere_siesa_nube: this.editingUser.requiere_siesa_nube,
      requiere_conecta: this.editingUser.requiere_conecta,
      requiere_saint: this.editingUser.requiere_saint,
      requiere_correo: this.editingUser.requiere_correo,
      requiere_glpi: this.editingUser.requiere_glpi,
      password: this.userPassword || undefined,
      password_conecta: this.editingUser.password_conecta || undefined,
      perfiles: this.userProfiles
    };

    this.loading = true;

    this.userService.saveUser(payload as any).subscribe({
      next: (resp: any) => {
        // Si es un usuario nuevo, el backend nos devuelve el usuario creado con su ID
        const userId = this.editingUser.id || resp.id;
        
        // Sincronizar procesos del usuario
        this.facade.syncUserProcesos(userId, this.userProcesoIds).subscribe({
          next: () => {
            const permOps = Array.from(this.pendingPermissions.entries()).map(([permId, action]) => {
              const perm = this.permissions.find(p => p.id === permId);
              if (!perm) return null;
              return action === 'REMOVE'
                ? this.permissionService.removeFromUser(userId, permId)
                : this.permissionService.assignToUser(userId, permId, action as 'ALLOW' | 'DENY');
            }).filter(Boolean) as any[];

            if (permOps.length === 0) {
              this.loading = false;
              Swal.fire('Guardado', this.editingUser.id ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente', 'success');
              this.cerrar();
              this.onSaved.emit();
              return;
            }

            forkJoin(permOps).pipe(finalize(() => this.loading = false)).subscribe({
              next: () => {
                Swal.fire('Guardado', 'Usuario, procesos y permisos actualizados correctamente', 'success');
                this.cerrar();
                this.onSaved.emit();
              },
              error: (err) => {
                console.error(err);
                Swal.fire('Atención', 'Info guardada, pero hubo un error al aplicar algunos permisos', 'warning');
                this.cerrar();
                this.onSaved.emit();
              }
            });
          },
          error: (err) => {
            this.loading = false;
            console.error(err);
            Swal.fire('Error', 'No se pudieron sincronizar los procesos del usuario', 'error');
          }
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
          this.onSaved.emit();
        },
        error: (err) => {
          console.error(err);
          Swal.fire('Error', 'No se pudo cambiar el estado del usuario', 'error');
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

  hasProfile(perfilId: number): boolean {
    return this.userProfiles.some(p => p.id === perfilId);
  }

  getSortedProfiles(): any[] {
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

  toggleModuleDropdown() {
    this.isModuleDropdownOpen = !this.isModuleDropdownOpen;
  }

  isModuleSelected(moduleId: number): boolean {
    return this.selectedModuleIds.includes(moduleId);
  }

  toggleModuleSelection(moduleId: number) {
    const idx = this.selectedModuleIds.indexOf(moduleId);
    if (idx > -1) {
      this.selectedModuleIds.splice(idx, 1);
    } else {
      this.selectedModuleIds.push(moduleId);
    }
  }

  isAllModulesSelected(): boolean {
    return this.selectedModuleIds.length === this.modules.length;
  }

  toggleSelectAllModules() {
    if (this.isAllModulesSelected()) {
      this.selectedModuleIds = [];
    } else {
      this.selectedModuleIds = this.modules.map(m => m.id);
    }
  }

  getFilteredModulesForDropdown(): any[] {
    const term = this.moduleSearchTerm.trim().toLowerCase();
    if (!term) return this.modules;
    return this.modules.filter(m => m.name?.toLowerCase().includes(term));
  }

  getSelectedModulesText(): string {
    if (!this.selectedModuleIds || this.selectedModuleIds.length === 0) {
      return 'Ningún módulo';
    }
    if (this.selectedModuleIds.length === this.modules.length) {
      return 'Todos los módulos';
    }
    if (this.selectedModuleIds.length === 1) {
      const found = this.modules.find(m => m.id === this.selectedModuleIds[0]);
      return found ? found.name : '1 módulo';
    }
    return `${this.selectedModuleIds.length} módulos`;
  }

  getPermissionStatus(permissionId: number): string | null {
    if (this.pendingPermissions.has(permissionId)) {
      const pending = this.pendingPermissions.get(permissionId)!;
      return pending === 'REMOVE' ? null : pending;
    }
    const direct = this.effectivePermissions?.direct || [];
    const found = direct.find(p => p.id === permissionId);
    return found ? found.allow : null;
  }

  assignPermission(permission: any, allow: 'ALLOW' | 'DENY') {
    if (!this.editingUser) return;
    this.pendingPermissions.set(permission.id, allow);
  }

  removePermission(permission: any) {
    if (!this.editingUser) return;
    this.pendingPermissions.set(permission.id, 'REMOVE');
  }

  isInherited(permissionId: number): boolean {
    const inherited = this.effectivePermissions?.inherited || [];
    return inherited.some(p => p.id === permissionId);
  }

  getFilteredPermissions(): any[] {
    let list = this.permissions;
    const selectedIds = this.selectedModuleIds || [];
    list = list.filter(p => selectedIds.includes(p.module_id));

    const term = this.permSearchTerm?.trim().toLowerCase();

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

  // Dropdown helper methods for Perfiles
  toggleProfileDropdown(): void {
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
  }

  getFilteredProfilesForDropdown(): any[] {
    const term = this.profileSearchTerm.trim().toLowerCase();
    if (!term) return this.profiles;
    return this.profiles.filter(p => p.name?.toLowerCase().includes(term));
  }

  getSelectedProfilesText(): string {
    if (!this.userProfiles || this.userProfiles.length === 0) return 'Ningún perfil';
    if (this.userProfiles.length === 1) return '1 perfil asignado';
    return `${this.userProfiles.length} perfiles asignados`;
  }

  // Dropdown helper methods for Procesos
  toggleProcesoDropdown(): void {
    this.isProcesoDropdownOpen = !this.isProcesoDropdownOpen;
  }

  getFilteredProcesosForDropdown(): any[] {
    const term = this.procesoSearchTerm.trim().toLowerCase();
    if (!term) return this.procesos;
    return this.procesos.filter(pr => pr.nombre?.toLowerCase().includes(term));
  }

  getSelectedProcesosText(): string {
    if (!this.userProcesoIds || this.userProcesoIds.length === 0) return 'Ningún proceso';
    if (this.userProcesoIds.length === 1) return '1 proceso asignado';
    return `${this.userProcesoIds.length} procesos asignados`;
  }

  // Gestión Multi-Plataforma en Tiempo Real (GLPI DB & Google OAuth2)
  cargarEstadoPlataformas(userId: number): void {
    if (!userId) return;
    this.platformStatusLoading = true;
    this.http.get<any>(`${environment.URL_API_LARAVEL}/colaboradores/${userId}/platform-status`).subscribe({
      next: (res) => {
        this.platformStatusData = res;
        this.platformStatusLoading = false;

        // Auto-activar switches en SAINT solo si la cuenta pertenece a un dominio corporativo válido y está activa
        if (this.editingUser) {
          const email = (this.editingUser.email || '').toLowerCase().trim();
          const allowedDomains = [
            '@colegioprovidencia.edu.co', '@protejer.com', '@saint.com',
            '@renuevaprovidencia.com', '@formacionprovidencia.edu.co',
            '@providenciacfi.com', '@cfiprovidencia.com'
          ];
          const isValidDomain = allowedDomains.some(d => email.endsWith(d));

          if (isValidDomain && res.google?.exists && !res.google?.isSuspended) {
            this.editingUser.requiere_correo = true;
          } else if (!isValidDomain) {
            this.editingUser.requiere_correo = false;
          }

          if (res.glpi?.exists && res.glpi?.is_active) {
            this.editingUser.requiere_glpi = true;
          }
        }
      },
      error: (err) => {
        console.error('Error al cargar estado de plataformas:', err);
        this.platformStatusLoading = false;
      }
    });
  }

  ejecutarAccionGlpi(accion: 'create' | 'enable' | 'disable'): void {
    if (!this.editingUser?.id) return;
    this.platformActionLoading = true;

    this.http.post<any>(`${environment.URL_API_LARAVEL}/colaboradores/${this.editingUser.id}/manage-glpi`, { action: accion }).subscribe({
      next: (res) => {
        Swal.fire('Éxito', res.message || 'Acción en GLPI ejecutada con éxito', 'success');
        this.platformActionLoading = false;
        this.cargarEstadoPlataformas(this.editingUser.id);
        this.onSaved.emit();
      },
      error: (err) => {
        Swal.fire('Error GLPI', err.error?.message || err.message, 'error');
        this.platformActionLoading = false;
      }
    });
  }

  ejecutarAccionGoogle(accion: 'create' | 'suspend' | 'activate'): void {
    if (!this.editingUser?.id) return;
    this.platformActionLoading = true;

    this.http.post<any>(`${environment.URL_API_LARAVEL}/colaboradores/${this.editingUser.id}/manage-google`, { action: accion }).subscribe({
      next: (res) => {
        Swal.fire('Éxito', res.message || 'Acción en Google Workspace ejecutada con éxito', 'success');
        this.platformActionLoading = false;
        this.cargarEstadoPlataformas(this.editingUser.id);
        this.onSaved.emit();
      },
      error: (err) => {
        Swal.fire('Error Google Workspace', err.error?.message || err.message, 'error');
        this.platformActionLoading = false;
      }
    });
  }
}
