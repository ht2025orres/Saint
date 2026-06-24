import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ModulesService } from '../../../../services/modules.service';
import { ProfilesService } from '../../../../services/profiles.service';
import { PermissionsService } from '../../../../services/permissions.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-structure',
  templateUrl: './modal-structure.component.html'
})
export class ModalStructureComponent {
  @Input() modules: any[] = [];
  @Input() profiles: any[] = [];
  @Input() permissions: any[] = [];

  @Output() onClose = new EventEmitter<void>();
  @Output() onSaved = new EventEmitter<void>();

  visible = false;
  activeStructureTab: 'modules' | 'profiles' | 'permissions' = 'modules';
  structureSearch = '';
  isModuleDropdownOpen = false;
  moduleSearchTerm = '';
  selectedModuleIds: number[] = [];

  editingModule: any = null;
  editingPerfil: any = null;
  editingPermission: any = null;

  constructor(
    private moduleService: ModulesService,
    private profileService: ProfilesService,
    private permissionService: PermissionsService
  ) {}

  abrir() {
    this.activeStructureTab = 'modules';
    this.structureSearch = '';
    this.selectedModuleIds = Array.isArray(this.modules) ? this.modules.map(m => m.id) : [];
    this.isModuleDropdownOpen = false;
    this.moduleSearchTerm = '';
    this.visible = true;
  }

  cerrar() {
    this.visible = false;
    this.structureSearch = '';
    this.editingModule = null;
    this.editingPerfil = null;
    this.editingPermission = null;
    this.onClose.emit();
  }

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

  getPermissionsCountByModule(moduleId: number): number {
    return this.permissions.filter(p => p.module_id === moduleId).length;
  }

  getFilteredPermissions(): any[] {
    let list = this.permissions;
    const selectedIds = this.selectedModuleIds || [];
    list = list.filter(p => selectedIds.includes(p.module_id));
    const term = this.structureSearch.trim().toLowerCase();
    if (term) {
      list = list.filter(p => p.name?.toLowerCase().includes(term));
    }
    return list;
  }

  // --- MODULES ---
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
      this.onSaved.emit();
    });
  }
  deleteModule(m: any) {
    if (confirm(`¿Eliminar módulo "${m.name}"?`)) {
      this.moduleService.delete(m.id).subscribe(() => this.onSaved.emit());
    }
  }

  // --- PROFILES ---
  openCreatePerfil() {
    this.editingPerfil = { name: '', description: '' };
    this.selectedModuleIds = Array.isArray(this.modules) ? this.modules.map(m => m.id) : [];
    this.isModuleDropdownOpen = false;
    this.moduleSearchTerm = '';
  }
  openEditPerfil(p: any) {
    const perfilPermissions = p.perfilPermissions || p.perfil_permissions || [];
    this.editingPerfil = { ...p, perfilPermissions };
    this.selectedModuleIds = Array.isArray(this.modules) ? this.modules.map(m => m.id) : [];
    this.isModuleDropdownOpen = false;
    this.moduleSearchTerm = '';
  }
  cancelEditPerfil() { this.editingPerfil = null; }
  savePerfil() {
    if (!this.editingPerfil.name) return;
    const req = this.editingPerfil.id
      ? this.profileService.update(this.editingPerfil.id, this.editingPerfil)
      : this.profileService.create(this.editingPerfil);

    req.subscribe(() => {
      this.editingPerfil = null;
      this.onSaved.emit();
    });
  }
  deletePerfil(p: any) {
    if (confirm(`¿Eliminar perfil "${p.name}"?`)) {
      this.profileService.delete(p.id).subscribe(() => this.onSaved.emit());
    }
  }

  isPerfilPermissionChecked(permissionId: number): boolean {
    const pp = this.editingPerfil?.perfilPermissions || [];
    return pp.some((x: any) => x.permission_id === permissionId && x.allow === 'ALLOW');
  }

  togglePerfilPermission(permission: any, event: any) {
    if (!this.editingPerfil || !this.editingPerfil.id) return;
    const isChecked = event.target.checked;

    if (!this.editingPerfil.perfilPermissions) {
      this.editingPerfil.perfilPermissions = [];
    }

    if (isChecked) {
      this.editingPerfil.perfilPermissions.push({ permission_id: permission.id, allow: 'ALLOW' });
      this.permissionService.assignToPerfil(this.editingPerfil.id, permission.id, 'ALLOW')
        .subscribe({
          next: () => this.onSaved.emit(),
          error: () => {
            this.editingPerfil.perfilPermissions = this.editingPerfil.perfilPermissions.filter((x: any) => x.permission_id !== permission.id);
            Swal.fire('Error', 'No se pudo asignar el permiso', 'error');
          }
        });
    } else {
      this.editingPerfil.perfilPermissions = this.editingPerfil.perfilPermissions.filter((x: any) => x.permission_id !== permission.id);
      this.permissionService.removeFromPerfil(this.editingPerfil.id, permission.id)
        .subscribe({
          next: () => this.onSaved.emit(),
          error: () => {
            this.editingPerfil.perfilPermissions.push({ permission_id: permission.id, allow: 'ALLOW' });
            Swal.fire('Error', 'No se pudo retirar el permiso', 'error');
          }
        });
    }
  }

  // --- PERMISSIONS ---
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
      this.onSaved.emit();
    });
  }
  deletePermission(q: any) {
    if (confirm(`¿Eliminar permiso "${q.name}"?`)) {
      this.permissionService.delete(q.id).subscribe(() => this.onSaved.emit());
    }
  }
}
