import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * MenuAccessService — Controla qué grupos de menú ve el usuario
 * basándose en los permisos y módulos que vienen en su JWT.
 *
 * Flujo en producción:
 * 1. Usuario hace login → backend genera JWT con permissions[] y modules[]
 * 2. Este servicio lee esos datos del AuthService
 * 3. Calcula qué grupos de menú son accesibles
 * 4. El sidebar muestra solo los grupos disponibles
 */

export interface MenuGroup {
  id: string;
  label: string;
  icon: string;
  description: string;
  requiredPermissions: number[];
  requiredModules: number[];
}

@Injectable({ providedIn: 'root' })
export class MenuAccessService {

  // ═══ GRUPOS DE MENÚ ═══
  private readonly menuGroups: MenuGroup[] = [
    {
      id: 'admin',
      label: 'Admin',
      icon: 'bi bi-gear-wide-connected',
      description: 'Administración del sistema, usuarios, workflows',
      requiredPermissions: [1],
      requiredModules: [1]
    },
    {
      id: 'protejer',
      label: 'Protejer',
      icon: 'bi bi-shield-check',
      description: 'Producción, fichas, inconsistencias, terminación',
      requiredPermissions: [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,28,29,30,31,32,33,36,37,38,40,41,46,52],
      requiredModules: [2, 3, 4, 6, 7, 9]
    }
  ];

  private accessibleGroups$ = new BehaviorSubject<MenuGroup[]>([]);

  constructor(private authService: AuthService) {
    this.authService.user$.subscribe(() => this.recalculateAccess());
  }

  /** Observable reactivo de grupos accesibles */
  getAccessibleGroups$(): Observable<MenuGroup[]> {
    return this.accessibleGroups$.asObservable();
  }

  /** Snapshot sincrónico */
  getAccessibleGroups(): MenuGroup[] {
    return this.accessibleGroups$.value;
  }

  /** Todos los grupos definidos */
  getAllGroups(): MenuGroup[] {
    return [...this.menuGroups];
  }

  /** Verifica acceso a un grupo específico */
  hasAccessToGroup(groupId: string): boolean {
    return this.accessibleGroups$.value.some(g => g.id === groupId);
  }

  /** Fuerza recálculo (útil después de impersonación) */
  recalculateAccess(): void {
    this.accessibleGroups$.next(this.calculateAccessibleGroups());
  }

  /**
   * Calcula qué grupos puede ver el usuario actual.
   * Lee permissions[] y modules[] directamente del JWT (vía AuthService).
   * Si tiene al menos UN permiso o módulo requerido por un grupo → acceso.
   */
  private calculateAccessibleGroups(): MenuGroup[] {
    const user = this.authService.user;
    if (!user) return [];

    const userPermissions = new Set<number>(user.permissions || []);
    const userModules = new Set<number>(user.modules || []);

    return this.menuGroups.filter(group => {
      // Permiso 1 (admin) da acceso a todo
      if (userPermissions.has(1)) return true;

      if (group.requiredPermissions.length > 0) {
        if (group.requiredPermissions.some(p => userPermissions.has(p))) return true;
      }
      if (group.requiredModules.length > 0) {
        if (group.requiredModules.some(m => userModules.has(m))) return true;
      }
      return false;
    });
  }
}
