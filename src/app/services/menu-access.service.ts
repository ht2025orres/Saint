import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * MenuAccessService — Servicio tipo IAM para control de acceso a grupos de menú.
 *
 * Concepto:
 * - MenuGroup: Agrupación de menú (Admin, Protejer, etc.)
 * - MenuProfile: Plantilla predefinida que otorga acceso a uno o más grupos + permisos
 * - Override: Permiso individual otorgado a un usuario sin cambiar su perfil
 *
 * En producción, esto vendría del backend (perfiles asignados al usuario + overrides directos).
 * Esta versión usa localStorage para simular asignaciones locales durante el piloto.
 *
 * Estructura preparada para migrar a backend:
 * - POST /api/menu-profiles/assign → asignar perfil a usuario
 * - POST /api/menu-overrides/grant → dar acceso individual a grupo
 * - GET  /api/users/:id/menu-access → obtener grupos accesibles
 */

export interface MenuGroup {
  id: string;
  label: string;
  icon: string;
  description: string;
  /** IDs de permisos que dan acceso a este grupo (OR) */
  requiredPermissions: number[];
  /** IDs de módulos que dan acceso a este grupo (OR) */
  requiredModules: number[];
}

export interface MenuProfile {
  id: string;
  name: string;
  description: string;
  /** Grupos a los que este perfil da acceso */
  grantedGroups: string[];
  /** Permisos que este perfil otorga (IDs) */
  grantedPermissions: number[];
  /** Módulos que este perfil otorga (IDs) */
  grantedModules: number[];
}

export interface UserMenuAccess {
  /** Perfiles asignados al usuario */
  assignedProfiles: string[];
  /** Grupos extra otorgados individualmente (override) */
  groupOverrides: string[];
  /** Permisos extra individuales (override) */
  permissionOverrides: number[];
  /** Módulos extra individuales (override) */
  moduleOverrides: number[];
}

@Injectable({
  providedIn: 'root'
})
export class MenuAccessService {

  // ═══════════════════════════════════════════════════════════
  // DEFINICIÓN DE GRUPOS DE MENÚ
  // En producción: tabla `menu_groups` en BD
  // ═══════════════════════════════════════════════════════════
  private readonly menuGroups: MenuGroup[] = [
    {
      id: 'admin',
      label: 'Admin',
      icon: 'bi bi-gear-wide-connected',
      description: 'Administración del sistema, usuarios, workflows y configuraciones',
      requiredPermissions: [1], // Permiso 1 = admin del sistema
      requiredModules: []
    },
    {
      id: 'protejer',
      label: 'Protejer',
      icon: 'bi bi-shield-check',
      description: 'Fichas técnicas, inconsistencias, terminación, comerciales y producción',
      requiredPermissions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 28, 29, 30, 31, 32, 33, 40, 41, 46, 48, 49, 50, 52],
      requiredModules: [2, 3, 4, 6, 7, 9]
    }
  ];

  // ═══════════════════════════════════════════════════════════
  // PERFILES PREDEFINIDOS (plantillas)
  // En producción: tabla `menu_profiles` + `menu_profile_groups`
  // ═══════════════════════════════════════════════════════════
  private readonly menuProfiles: MenuProfile[] = [
    {
      id: 'profile-admin',
      name: 'Administrador',
      description: 'Acceso total al sistema, incluyendo gestión de usuarios y configuraciones',
      grantedGroups: ['admin', 'protejer'],
      grantedPermissions: [1],
      grantedModules: [2, 3, 4, 5, 6, 7, 8, 9, 10]
    },
    {
      id: 'profile-protejer-full',
      name: 'Operador Protejer (Completo)',
      description: 'Acceso a todos los módulos de producción y calidad',
      grantedGroups: ['protejer'],
      grantedPermissions: [2, 3, 4, 5, 6, 15, 16, 19, 20, 21, 22, 31, 32, 40],
      grantedModules: [2, 3, 4, 6, 7, 9]
    },
    {
      id: 'profile-protejer-fichas',
      name: 'Operador Fichas Técnicas',
      description: 'Solo acceso a fichas técnicas y reportes',
      grantedGroups: ['protejer'],
      grantedPermissions: [2, 3, 4, 5, 6, 31, 32],
      grantedModules: [6]
    },
    {
      id: 'profile-protejer-inconsistencias',
      name: 'Operador Inconsistencias',
      description: 'Solo acceso a módulo de inconsistencias',
      grantedGroups: ['protejer'],
      grantedPermissions: [7, 8, 9, 10, 11, 12, 13, 15, 28, 29, 30, 48, 49, 50],
      grantedModules: [2]
    },
    {
      id: 'profile-inventario',
      name: 'Operador Inventario',
      description: 'Acceso a gestión de bodegas e inventarios',
      grantedGroups: [],
      grantedPermissions: [25, 26, 27, 34],
      grantedModules: [5]
    }
  ];

  // ═══════════════════════════════════════════════════════════
  // ESTADO LOCAL (simulación de BD)
  // En producción: tablas `user_menu_profiles`, `user_menu_overrides`
  // ═══════════════════════════════════════════════════════════
  private readonly STORAGE_KEY = 'saint_menu_access';

  private accessibleGroups$ = new BehaviorSubject<MenuGroup[]>([]);

  constructor(private authService: AuthService) {
    // Reaccionar a cambios de usuario
    this.authService.user$.subscribe(user => {
      this.recalculateAccess();
    });
  }

  // ═══════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════

  /** Obtiene los grupos accesibles para el usuario actual (observable reactivo) */
  getAccessibleGroups$(): Observable<MenuGroup[]> {
    return this.accessibleGroups$.asObservable();
  }

  /** Obtiene los grupos accesibles (snapshot sincrónico) */
  getAccessibleGroups(): MenuGroup[] {
    return this.accessibleGroups$.value;
  }

  /** Obtiene todos los grupos definidos en el sistema */
  getAllGroups(): MenuGroup[] {
    return [...this.menuGroups];
  }

  /** Obtiene todos los perfiles disponibles */
  getAllProfiles(): MenuProfile[] {
    return [...this.menuProfiles];
  }

  /** Obtiene el acceso configurado para el usuario actual */
  getCurrentUserAccess(): UserMenuAccess {
    const userId = this.authService.user?.id;
    if (!userId) {
      return { assignedProfiles: [], groupOverrides: [], permissionOverrides: [], moduleOverrides: [] };
    }
    return this.loadUserAccess(userId);
  }

  /**
   * Asigna un perfil de menú al usuario.
   * En producción: POST /api/menu-profiles/assign
   */
  assignProfile(userId: number, profileId: string): void {
    const access = this.loadUserAccess(userId);
    if (!access.assignedProfiles.includes(profileId)) {
      access.assignedProfiles.push(profileId);
      this.saveUserAccess(userId, access);
      this.recalculateAccess();
    }
  }

  /**
   * Quita un perfil de menú del usuario.
   * En producción: DELETE /api/menu-profiles/remove
   */
  removeProfile(userId: number, profileId: string): void {
    const access = this.loadUserAccess(userId);
    access.assignedProfiles = access.assignedProfiles.filter(p => p !== profileId);
    this.saveUserAccess(userId, access);
    this.recalculateAccess();
  }

  /**
   * Otorga acceso individual a un grupo (override).
   * En producción: POST /api/menu-overrides/grant-group
   */
  grantGroupOverride(userId: number, groupId: string): void {
    const access = this.loadUserAccess(userId);
    if (!access.groupOverrides.includes(groupId)) {
      access.groupOverrides.push(groupId);
      this.saveUserAccess(userId, access);
      this.recalculateAccess();
    }
  }

  /**
   * Quita un override de grupo.
   * En producción: DELETE /api/menu-overrides/revoke-group
   */
  revokeGroupOverride(userId: number, groupId: string): void {
    const access = this.loadUserAccess(userId);
    access.groupOverrides = access.groupOverrides.filter(g => g !== groupId);
    this.saveUserAccess(userId, access);
    this.recalculateAccess();
  }

  /**
   * Otorga un permiso individual extra (override).
   * En producción: POST /api/menu-overrides/grant-permission
   */
  grantPermissionOverride(userId: number, permissionId: number): void {
    const access = this.loadUserAccess(userId);
    if (!access.permissionOverrides.includes(permissionId)) {
      access.permissionOverrides.push(permissionId);
      this.saveUserAccess(userId, access);
      this.recalculateAccess();
    }
  }

  /**
   * Quita un override de permiso.
   * En producción: DELETE /api/menu-overrides/revoke-permission
   */
  revokePermissionOverride(userId: number, permissionId: number): void {
    const access = this.loadUserAccess(userId);
    access.permissionOverrides = access.permissionOverrides.filter(p => p !== permissionId);
    this.saveUserAccess(userId, access);
    this.recalculateAccess();
  }

  /**
   * Resetea todo el acceso de un usuario (para testing).
   */
  resetUserAccess(userId: number): void {
    this.saveUserAccess(userId, {
      assignedProfiles: [],
      groupOverrides: [],
      permissionOverrides: [],
      moduleOverrides: []
    });
    this.recalculateAccess();
  }

  /**
   * Verifica si el usuario actual tiene acceso a un grupo específico.
   */
  hasAccessToGroup(groupId: string): boolean {
    return this.accessibleGroups$.value.some(g => g.id === groupId);
  }

  /**
   * Fuerza recalcular el acceso (útil después de login o impersonación).
   */
  recalculateAccess(): void {
    const groups = this.calculateAccessibleGroups();
    this.accessibleGroups$.next(groups);
  }

  // ═══════════════════════════════════════════════════════════
  // LÓGICA INTERNA
  // ═══════════════════════════════════════════════════════════

  /**
   * Calcula qué grupos puede ver el usuario actual.
   * Lógica (OR):
   * 1. Tiene un perfil que otorga el grupo → acceso
   * 2. Tiene un override directo al grupo → acceso
   * 3. Tiene algún permiso/módulo requerido por el grupo (del JWT) → acceso
   */
  private calculateAccessibleGroups(): MenuGroup[] {
    const user = this.authService.user;
    if (!user) return [];

    const userId = user.id;
    const access = this.loadUserAccess(userId);

    // Recopilar todos los grupos otorgados por perfiles
    const groupsFromProfiles = new Set<string>();
    for (const profileId of access.assignedProfiles) {
      const profile = this.menuProfiles.find(p => p.id === profileId);
      if (profile) {
        profile.grantedGroups.forEach(g => groupsFromProfiles.add(g));
      }
    }

    // Grupos por override directo
    const groupsFromOverrides = new Set(access.groupOverrides);

    // Permisos efectivos del usuario (JWT + overrides de perfil + overrides individuales)
    const effectivePermissions = new Set<number>(user.permissions || []);
    const effectiveModules = new Set<number>(user.modules || []);

    // Agregar permisos otorgados por perfiles de menú
    for (const profileId of access.assignedProfiles) {
      const profile = this.menuProfiles.find(p => p.id === profileId);
      if (profile) {
        profile.grantedPermissions.forEach(p => effectivePermissions.add(p));
        profile.grantedModules.forEach(m => effectiveModules.add(m));
      }
    }

    // Agregar overrides individuales
    access.permissionOverrides.forEach(p => effectivePermissions.add(p));
    access.moduleOverrides.forEach(m => effectiveModules.add(m));

    // Evaluar cada grupo
    return this.menuGroups.filter(group => {
      // 1. Otorgado por perfil
      if (groupsFromProfiles.has(group.id)) return true;

      // 2. Override directo al grupo
      if (groupsFromOverrides.has(group.id)) return true;

      // 3. Tiene algún permiso requerido
      if (group.requiredPermissions.length > 0) {
        const hasPermission = group.requiredPermissions.some(p => effectivePermissions.has(p));
        if (hasPermission) return true;
      }

      // 4. Tiene algún módulo requerido
      if (group.requiredModules.length > 0) {
        const hasModule = group.requiredModules.some(m => effectiveModules.has(m));
        if (hasModule) return true;
      }

      return false;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PERSISTENCIA LOCAL (simulación)
  // En producción: reemplazar por llamadas HTTP al backend
  // ═══════════════════════════════════════════════════════════

  private loadUserAccess(userId: number): UserMenuAccess {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const allAccess = JSON.parse(stored);
        return allAccess[userId] || this.defaultAccess();
      }
    } catch (e) {
      console.error('Error loading menu access:', e);
    }
    return this.defaultAccess();
  }

  private saveUserAccess(userId: number, access: UserMenuAccess): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const allAccess = stored ? JSON.parse(stored) : {};
      allAccess[userId] = access;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allAccess));
    } catch (e) {
      console.error('Error saving menu access:', e);
    }
  }

  private defaultAccess(): UserMenuAccess {
    return {
      assignedProfiles: [],
      groupOverrides: [],
      permissionOverrides: [],
      moduleOverrides: []
    };
  }
}
