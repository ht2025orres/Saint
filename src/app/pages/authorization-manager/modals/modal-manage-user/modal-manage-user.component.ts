import { Component, Input, Output, EventEmitter } from '@angular/core';
import { UserService } from '../../../../services/user.service';
import { PermissionsService } from '../../../../services/permissions.service';
import { AuthService } from '../../../../services/auth.service';
import { AuthorizationManagerFacade } from '../../../../services/authorization-manager.facade';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-modal-manage-user',
  templateUrl: './modal-manage-user.component.html'
})
export class ModalManageUserComponent {
  @Input() user: any = null;
  @Input() permissions: any[] = [];
  @Input() profiles: any[] = [];
  @Input() modules: any[] = [];

  @Output() onClose = new EventEmitter<void>();
  @Output() onSaved = new EventEmitter<void>();
  @Output() onImpersonate = new EventEmitter<any>();

  visible = false;
  editingUser: any = null;
  userPassword = '';
  userPasswordConfirm = '';
  isEditingSelf: boolean = false;
  userProfiles: any[] = [];
  selectedModuleFilter: string | number = 'all';
  permSearchTerm = '';
  pendingPermissions = new Map<number, 'ALLOW' | 'DENY' | 'REMOVE'>();
  effectivePermissions: { direct: any[]; inherited: any[] } | null = null;
  loading = false;

  constructor(
    private userService: UserService,
    private permissionService: PermissionsService,
    private authService: AuthService,
    private facade: AuthorizationManagerFacade,
    private router: Router
  ) {}

  abrir(user: any = null) {
    this.user = user;
    if (user) {
      this.editingUser = { ...user, firstName: user.firstName || user.name, lastName: user.lastName || '' };
      this.isEditingSelf = this.authService.user?.id === user.id;
      this.userProfiles = Array.isArray(user.perfiles) ? [...user.perfiles] : [];
      this.loadUserEffectivePermissions(user.id);
    } else {
      this.editingUser = { id: null, firstName: '', lastName: '', email: '', enabled: true };
      this.isEditingSelf = false;
      this.userProfiles = [];
      this.effectivePermissions = { direct: [], inherited: [] };
    }
    
    this.userPassword = '';
    this.userPasswordConfirm = '';
    this.selectedModuleFilter = 'all';
    this.permSearchTerm = '';
    this.pendingPermissions = new Map();
    this.visible = true;
  }

  cerrar() {
    this.visible = false;
    this.editingUser = null;
    this.effectivePermissions = null;
    this.pendingPermissions = new Map();
    this.onClose.emit();
  }

  saveMegaUser() {
    if (!this.editingUser.firstName || !this.editingUser.email) {
      Swal.fire('Error', 'Nombre y Correo son campos obligatorios', 'error');
      return;
    }

    if (!this.editingUser.id && !this.userPassword) {
      Swal.fire('Error', 'La contraseña es obligatoria para nuevos usuarios', 'error');
      return;
    }

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

    this.userService.saveUser(payload as any).subscribe({
      next: (resp: any) => {
        // Si es un usuario nuevo, el backend nos devuelve el usuario creado con su ID
        const userId = this.editingUser.id || resp.id;
        
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
            Swal.fire('Guardado', 'Usuario y permisos actualizados correctamente', 'success');
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

    if (this.selectedModuleFilter !== 'all') {
      list = list.filter(p => p.module_id === this.selectedModuleFilter);
    }

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
}
