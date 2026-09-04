import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AuthorizationManagerFacade } from '../../../../services/authorization-manager.facade';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-bulk-cargo',
  templateUrl: './modal-bulk-cargo.component.html'
})
export class ModalBulkCargoComponent {
  @Input() users: any[] = [];
  @Input() procesos: any[] = [];
  @Input() profiles: any[] = [];
  @Input() permissions: any[] = [];
  @Input() modules: any[] = [];

  @Output() onSaved = new EventEmitter<void>();

  isOpen: boolean = false;
  submitting: boolean = false;
  activeTab: 'procesos' | 'perfiles' | 'permisos' | 'switches' = 'procesos';

  // Cargo seleccionado
  selectedCargo: string = '';
  busquedaCargo: string = '';

  // Filtros / Selección
  selectedProcesoIds: number[] = [];
  procesoAction: 'add' | 'replace' | 'remove' = 'add';

  selectedPerfilIds: number[] = [];
  perfilAction: 'add' | 'replace' | 'remove' = 'add';

  selectedPermissionIds: number[] = [];
  permissionAllow: 'ALLOW' | 'DENY' = 'ALLOW';
  permissionAction: 'add' | 'remove' = 'add';

  // Switches opcionales
  switchesConfig: any = {
    modificar_saint: false,
    requiere_saint: true,
    modificar_conecta: false,
    requiere_conecta: true,
    modificar_siesa: false,
    requiere_siesa_nube: false,
    modificar_correo: false,
    requiere_correo: false,
    modificar_glpi: false,
    requiere_glpi: false,
    modificar_estado: false,
    estado: 'activo'
  };

  // Buscadores internos de modal
  busquedaProcesos: string = '';
  busquedaPerfiles: string = '';
  busquedaPermisos: string = '';

  constructor(private facade: AuthorizationManagerFacade) {}

  abrir(cargoInicial: string = ''): void {
    this.isOpen = true;
    this.selectedCargo = cargoInicial;
    this.resetForm();
  }

  cerrar(): void {
    this.isOpen = false;
    this.submitting = false;
  }

  resetForm(): void {
    this.selectedProcesoIds = [];
    this.procesoAction = 'add';
    this.selectedPerfilIds = [];
    this.perfilAction = 'add';
    this.selectedPermissionIds = [];
    this.permissionAllow = 'ALLOW';
    this.permissionAction = 'add';
    this.busquedaCargo = '';
    this.busquedaProcesos = '';
    this.busquedaPerfiles = '';
    this.busquedaPermisos = '';
    this.switchesConfig = {
      modificar_saint: false,
      requiere_saint: true,
      modificar_conecta: false,
      requiere_conecta: true,
      modificar_siesa: false,
      requiere_siesa_nube: false,
      modificar_correo: false,
      requiere_correo: false,
      modificar_glpi: false,
      requiere_glpi: false,
      modificar_estado: false,
      estado: 'activo'
    };
  }

  // Obtener lista única de cargos con conteo de usuarios
  get cargosList(): Array<{ cargo: string, total: number }> {
    const map = new Map<string, number>();
    for (const u of this.users) {
      const c = (u.cargo || '').trim();
      if (c) {
        map.set(c, (map.get(c) || 0) + 1);
      }
    }

    const result: Array<{ cargo: string, total: number }> = [];
    map.forEach((total, cargo) => {
      result.push({ cargo, total });
    });

    result.sort((a, b) => a.cargo.localeCompare(b.cargo));

    if (!this.busquedaCargo.trim()) return result;
    const txt = this.busquedaCargo.toLowerCase().trim();
    return result.filter(item => item.cargo.toLowerCase().includes(txt));
  }

  // Lista de usuarios que pertenecen al cargo seleccionado
  get targetUsers(): any[] {
    if (!this.selectedCargo) return [];
    return this.users.filter(u => (u.cargo || '').trim() === this.selectedCargo);
  }

  // Filtrado de procesos
  get procesosFiltrados(): any[] {
    if (!this.busquedaProcesos.trim()) return this.procesos;
    const txt = this.busquedaProcesos.toLowerCase().trim();
    return this.procesos.filter(p => p.nombre.toLowerCase().includes(txt));
  }

  // Filtrado de perfiles
  get perfilesFiltrados(): any[] {
    if (!this.busquedaPerfiles.trim()) return this.profiles;
    const txt = this.busquedaPerfiles.toLowerCase().trim();
    return this.profiles.filter(p => p.name.toLowerCase().includes(txt));
  }

  // Filtrado de permisos
  get permisosFiltrados(): any[] {
    if (!this.busquedaPermisos.trim()) return this.permissions;
    const txt = this.busquedaPermisos.toLowerCase().trim();
    return this.permissions.filter(p => p.name.toLowerCase().includes(txt) || (p.module?.name || '').toLowerCase().includes(txt));
  }

  // Toggle de selección
  toggleProceso(id: number): void {
    const idx = this.selectedProcesoIds.indexOf(id);
    if (idx >= 0) {
      this.selectedProcesoIds.splice(idx, 1);
    } else {
      this.selectedProcesoIds.push(id);
    }
  }

  togglePerfil(id: number): void {
    const idx = this.selectedPerfilIds.indexOf(id);
    if (idx >= 0) {
      this.selectedPerfilIds.splice(idx, 1);
    } else {
      this.selectedPerfilIds.push(id);
    }
  }

  togglePermiso(id: number): void {
    const idx = this.selectedPermissionIds.indexOf(id);
    if (idx >= 0) {
      this.selectedPermissionIds.splice(idx, 1);
    } else {
      this.selectedPermissionIds.push(id);
    }
  }

  // Verifica si hay cambios configurados para enviar
  get hasPendingChanges(): boolean {
    if (!this.selectedCargo) return false;

    const hasProcesos = this.selectedProcesoIds.length > 0;
    const hasPerfiles = this.selectedPerfilIds.length > 0;
    const hasPermisos = this.selectedPermissionIds.length > 0;
    const hasSwitches = this.switchesConfig.modificar_saint ||
                        this.switchesConfig.modificar_conecta ||
                        this.switchesConfig.modificar_siesa ||
                        this.switchesConfig.modificar_correo ||
                        this.switchesConfig.modificar_glpi ||
                        this.switchesConfig.modificar_estado;

    return hasProcesos || hasPerfiles || hasPermisos || hasSwitches;
  }

  confirmarAsignacionMasiva(): void {
    if (!this.selectedCargo) {
      Swal.fire({
        title: 'Selecciona un Cargo',
        text: 'Por favor selecciona el cargo al cual le deseas aplicar las asignaciones.',
        icon: 'warning',
        customClass: { container: 'z-[99999]' }
      });
      return;
    }

    if (!this.hasPendingChanges) {
      Swal.fire({
        title: 'Sin Acciones Seleccionadas',
        text: 'Selecciona al menos un proceso, perfil, permiso o switch de plataforma para asignar.',
        icon: 'info',
        customClass: { container: 'z-[99999]' }
      });
      return;
    }

    const usersWithProcess = this.targetUsers.filter(u => u.proceso_ids && u.proceso_ids.length > 0);

    // Si se está asignando procesos y hay usuarios que YA pertenecen a un proceso:
    if (this.selectedProcesoIds.length > 0 && usersWithProcess.length > 0) {
      Swal.fire({
        title: '¿Cómo deseas gestionar los departamentos existentes?',
        html: `
          <div class="text-left text-xs text-slate-700 space-y-3">
            <p>Hay <strong>${usersWithProcess.length} colaborador(es)</strong> con el cargo <strong class="text-purple-700 font-bold">${this.selectedCargo}</strong> que ya pertenecen a uno o más departamentos.</p>
            <div class="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs">
              <p class="font-bold mb-1">Elige una opción:</p>
              <ul class="list-disc pl-4 space-y-1 text-[11px]">
                <li><strong>Añadir a ambos:</strong> El usuario conservará sus departamentos actuales y se le sumará el nuevo.</li>
                <li><strong>Reemplazar / Sobrescribir:</strong> Se le removerán sus departamentos actuales y quedará únicamente en el nuevo departamento.</li>
              </ul>
            </div>
          </div>
        `,
        icon: 'question',
        showConfirmButton: true,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Añadir a ambos (Conservar)',
        denyButtonText: 'Reemplazar / Sobrescribir',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#7c3aed',
        denyButtonColor: '#d97706',
        customClass: { container: 'z-[99999]' }
      }).then((result) => {
        if (result.isConfirmed) {
          this.procesoAction = 'add';
          this.ejecutarAsignacionMasiva();
        } else if (result.isDenied) {
          this.procesoAction = 'replace';
          this.ejecutarAsignacionMasiva();
        }
      });
      return;
    }

    // Confirmación estándar si no hay conflicto de procesos previos
    const totalTarget = this.targetUsers.length;

    Swal.fire({
      title: '¿Confirmar Asignación Masiva?',
      html: `
        <div class="text-left text-xs text-slate-700 space-y-2">
          <p>Vas a aplicar cambios masivos a <strong>${totalTarget} colaboradores</strong> con el cargo:</p>
          <div class="p-2.5 bg-blue-50 border border-blue-200 rounded-xl font-bold text-blue-900 text-center uppercase tracking-wider">
            ${this.selectedCargo}
          </div>
          <p class="text-[11px] text-slate-500 font-medium italic mt-2">Esta acción actualizará de forma simultánea los permisos y/o departamentos de todo el grupo.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, Aplicar Cambios',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#7c3aed',
      customClass: { container: 'z-[99999]' }
    }).then((result) => {
      if (result.isConfirmed) {
        this.ejecutarAsignacionMasiva();
      }
    });
  }

  private ejecutarAsignacionMasiva(): void {
    this.submitting = true;

    // Construir objeto de switches solo si fueron marcados para modificar
    const switchesPayload: any = {};
    if (this.switchesConfig.modificar_saint) switchesPayload.requiere_saint = this.switchesConfig.requiere_saint;
    if (this.switchesConfig.modificar_conecta) switchesPayload.requiere_conecta = this.switchesConfig.requiere_conecta;
    if (this.switchesConfig.modificar_siesa) switchesPayload.requiere_siesa_nube = this.switchesConfig.requiere_siesa_nube;
    if (this.switchesConfig.modificar_correo) switchesPayload.requiere_correo = this.switchesConfig.requiere_correo;
    if (this.switchesConfig.modificar_glpi) switchesPayload.requiere_glpi = this.switchesConfig.requiere_glpi;
    if (this.switchesConfig.modificar_estado) switchesPayload.estado = this.switchesConfig.estado;

    const payload: any = {
      cargo: this.selectedCargo
    };

    if (this.selectedProcesoIds.length > 0) {
      payload.proceso_ids = this.selectedProcesoIds;
      payload.proceso_action = this.procesoAction;
    }

    if (this.selectedPerfilIds.length > 0) {
      payload.perfil_ids = this.selectedPerfilIds;
      payload.perfil_action = this.perfilAction;
    }

    if (this.selectedPermissionIds.length > 0) {
      payload.permission_ids = this.selectedPermissionIds;
      payload.permission_allow = this.permissionAllow;
      payload.permission_action = this.permissionAction;
    }

    if (Object.keys(switchesPayload).length > 0) {
      payload.switches = switchesPayload;
    }

    this.facade.bulkAssignByCargo(payload)
      .pipe(finalize(() => this.submitting = false))
      .subscribe({
        next: (res: any) => {
          Swal.fire({
            title: '¡Asignación Completada! ✅',
            text: res.message || 'Se han actualizado correctamente los accesos masivos.',
            icon: 'success',
            confirmButtonColor: '#7c3aed',
            customClass: { container: 'z-[99999]' }
          });
          this.cerrar();
          this.onSaved.emit();
        },
        error: (err: any) => {
          console.error('Error en asignación masiva:', err);
          Swal.fire({
            title: 'Error al Procesar',
            text: err.error?.message || 'No fue posible completar la asignación masiva.',
            icon: 'error',
            customClass: { container: 'z-[99999]' }
          });
        }
      });
  }
}
