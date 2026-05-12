import { Component, Input, Output, EventEmitter } from '@angular/core';
import { UserService } from '../../../../services/user.service';

@Component({
  selector: 'app-modal-audit',
  templateUrl: './modal-audit.component.html'
})
export class ModalAuditComponent {
  @Input() users: any[] = [];
  @Input() profiles: any[] = [];
  @Input() permissions: any[] = [];
  @Input() modules: any[] = [];

  @Output() onClose = new EventEmitter<void>();

  visible = false;
  auditLogs: any[] = [];
  auditPage = 1;
  auditTotalPages = 1;
  auditTargetUserId: number | null = null;
  auditTargetUser: any = null;
  loading = false;

  constructor(private userService: UserService) {}

  abrir(user?: any) {
    if (user && typeof user === 'object') {
      this.auditTargetUserId = user.id;
      this.auditTargetUser = user;
    } else if (user) {
      this.auditTargetUserId = user;
      this.auditTargetUser = this.users.find(u => u.id === user) || null;
    } else {
      this.auditTargetUserId = null;
      this.auditTargetUser = null;
    }

    this.auditPage = 1;
    this.auditLogs = [];
    this.visible = true;
    this.loadAuditLogs();
  }

  cerrar() {
    this.visible = false;
    this.auditTargetUser = null;
    this.onClose.emit();
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

    const permsArray = data.perfil_permissions || data.permissions;
    if (permsArray && Array.isArray(permsArray)) {
      if (permsArray.length === 0) return 'Lista vacía';
      return permsArray.map((p: any) => {
        const pId = p.permission_id || p.id;
        const permObj = this.permissions.find(x => x.id === pId);
        return permObj ? permObj.name : `Permiso #${pId}`;
      }).join(', ');
    }

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

  getAuditDetailedChanges(log: any): { name: string, status: 'added' | 'removed' | 'neutral' | 'warning' }[] {
    const before = this.parseAuditData(log.before_data);
    const after = this.parseAuditData(log.after_data);

    const bPerms = before?.perfil_permissions || before?.permissions || [];
    const aPerms = after?.perfil_permissions || after?.permissions || [];

    const result: { name: string, status: 'added' | 'removed' | 'neutral' | 'warning' }[] = [];

    if (Array.isArray(bPerms) && Array.isArray(aPerms)) {
      const bMap = new Map(bPerms.map((p: any) => [p.permission_id || p.id, p]));
      const aMap = new Map(aPerms.map((p: any) => [p.permission_id || p.id, p]));

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
}
