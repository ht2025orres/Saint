import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * MenuAccessService — Piloto IAM local.
 * Replica exactamente la estructura del backend:
 * - Módulos, Permisos y Perfiles con los mismos IDs reales
 * - Perfiles del backend (Administrador, Matriz de remplazo, Analista de calidad)
 * - Perfiles de ejemplo pre-configurados para demostrar el sistema
 */

export interface MenuGroup {
  id: string;
  label: string;
  icon: string;
  description: string;
  requiredPermissions: number[];
  requiredModules: number[];
}

export interface MockModule {
  id: number;
  name: string;
  description: string;
}

export interface MockPermission {
  id: number;
  module_id: number;
  name: string;
}

export interface MenuProfile {
  id: string;
  name: string;
  description: string;
  grantedGroups: string[];
  /** perfil_permissions — misma estructura que el backend */
  perfilPermissions: { permission_id: number; allow: 'ALLOW' | 'DENY' }[];
  /** Módulos que se otorgan (derivados de los permisos) */
  grantedModules: number[];
  /** Indica si es un perfil real del backend o uno de ejemplo */
  isExample?: boolean;
}

export interface UserMenuAccess {
  assignedProfiles: string[];
  groupOverrides: string[];
  permissionOverrides: number[];
  moduleOverrides: number[];
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

  // ═══ MÓDULOS REALES (del backend) ═══
  readonly mockModules: MockModule[] = [
    { id: 1, name: 'Sistema', description: 'Módulo de acceso maestro del sistema' },
    { id: 2, name: 'Inconsistencias', description: 'Reporte y aprobación de inconsistencias' },
    { id: 3, name: 'Terminación de Empaque', description: 'Recepción, empaque y despacho' },
    { id: 4, name: 'Renueva', description: 'Gestión logística de Renueva' },
    { id: 5, name: 'Almacén', description: 'Gestión de ingreso e inventarios en Bodegas' },
    { id: 6, name: 'Ficha Técnicas', description: 'Gestión de fichas técnicas' },
    { id: 7, name: 'Gestión de OCs', description: 'Aprobación y carga de OCs' },
    { id: 8, name: 'Proyectos', description: 'Control de portafolio y proyectos' },
    { id: 9, name: 'Moldes', description: 'Gestión de moldes, categorías, OPM' },
    { id: 10, name: 'Seguimiento Documentos', description: 'Seguimiento de documentos' }
  ];

  // ═══ PERMISOS REALES (del backend, todos los 53) ═══
  readonly mockPermissions: MockPermission[] = [
    { id: 1, module_id: 1, name: 'Administrador del sistema' },
    { id: 35, module_id: 1, name: 'Consulta KPIs Facturación' },
    { id: 2, module_id: 6, name: 'Creacion de fichas tecnica' },
    { id: 3, module_id: 6, name: 'Aprobacion ficha tecnica (primera revision)' },
    { id: 4, module_id: 6, name: 'Aprobacion ficha tecnica (Segunda revision)' },
    { id: 5, module_id: 6, name: 'Calidad ficha tecnica' },
    { id: 6, module_id: 6, name: 'Consulta' },
    { id: 31, module_id: 6, name: 'Reporte ficha tecnica' },
    { id: 32, module_id: 6, name: 'Gestor reporte ficha tecnica' },
    { id: 52, module_id: 6, name: 'Anular fichas técnicas' },
    { id: 7, module_id: 2, name: 'Lider Aprobador (inconsistencias)' },
    { id: 8, module_id: 2, name: 'Matriz de remplazo (inconsistencias)' },
    { id: 9, module_id: 2, name: 'Calidad (inconsistencias)' },
    { id: 10, module_id: 2, name: 'Contabilidad (inconsistencias)' },
    { id: 11, module_id: 2, name: 'Logisitica (inconsistencias)' },
    { id: 12, module_id: 2, name: 'Trazo (inconsistencias)' },
    { id: 13, module_id: 2, name: 'Patronista (inconsistencias)' },
    { id: 14, module_id: 2, name: 'Revision Consumo (inconsistencias)' },
    { id: 15, module_id: 2, name: 'Solicitante (inconsistencias)' },
    { id: 28, module_id: 2, name: 'cartera (inconsistencias)' },
    { id: 29, module_id: 2, name: 'patronaje (inconsistencias)' },
    { id: 30, module_id: 2, name: 'trazo (inconsistencias)' },
    { id: 36, module_id: 2, name: 'Inconsistencias' },
    { id: 16, module_id: 3, name: 'Empacador (Terminación y Empaque)' },
    { id: 19, module_id: 3, name: 'Receptor OP (Terminación y Empaque)' },
    { id: 20, module_id: 3, name: 'Distribuidor PV (Terminación y Empaque)' },
    { id: 21, module_id: 3, name: 'Gestion empacadores (Terminación y Empaque)' },
    { id: 22, module_id: 3, name: 'Jefe (Terminación y Empaque)' },
    { id: 33, module_id: 3, name: 'Distribuidor PV Directo (Terminación y Empaque)' },
    { id: 17, module_id: 4, name: 'Auxiliar (renueva)' },
    { id: 18, module_id: 4, name: 'Operario (renueva)' },
    { id: 23, module_id: 4, name: 'Jefe Renueva' },
    { id: 24, module_id: 5, name: 'Gestor de bodega (MP001)' },
    { id: 25, module_id: 5, name: 'Gestor de bodega (MP003)' },
    { id: 26, module_id: 5, name: 'Gestor de bodega (BT001)' },
    { id: 27, module_id: 5, name: 'Admin (inventario)' },
    { id: 34, module_id: 5, name: 'Lider Contador (inventario)' },
    { id: 37, module_id: 7, name: 'Cargar OCs' },
    { id: 38, module_id: 7, name: 'Procesar OCs' },
    { id: 39, module_id: 8, name: 'Gestor de Proyectos' },
    { id: 53, module_id: 8, name: 'Miembro de proyectos' },
    { id: 40, module_id: 9, name: 'Ver moldes' },
    { id: 41, module_id: 9, name: 'Crear moldes' },
    { id: 42, module_id: 9, name: 'Editar moldes' },
    { id: 43, module_id: 9, name: 'Eliminar moldes' },
    { id: 44, module_id: 9, name: 'Subir imagen (Moldes)' },
    { id: 45, module_id: 9, name: 'Gestionar categorías (Moldes)' },
    { id: 46, module_id: 9, name: 'Crear OPM' },
    { id: 47, module_id: 9, name: 'Editar OPM' },
    { id: 48, module_id: 9, name: 'Crear ficha técnica (Moldes)' },
    { id: 49, module_id: 9, name: 'Editar ficha técnica (Moldes)' },
    { id: 50, module_id: 10, name: 'Ver todos los seguimientos (Logistica)' },
    { id: 51, module_id: 10, name: 'Ver seguimientos propios' }
  ];

  // ═══ PERFILES: Reales del backend + Ejemplos pre-configurados ═══
  private readonly menuProfiles: MenuProfile[] = [
    // --- REALES (del backend, mismos IDs) ---
    {
      id: 'backend-1',
      name: 'Administrador',
      description: 'Administrador del sistema y acceso (perfil real del backend)',
      grantedGroups: ['admin', 'protejer'],
      perfilPermissions: [{ permission_id: 1, allow: 'ALLOW' }],
      grantedModules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    },
    {
      id: 'backend-2',
      name: 'Matriz de remplazo',
      description: 'Reemplazo del líder para aprobaciones (perfil real - sin permisos configurados)',
      grantedGroups: [],
      perfilPermissions: [],
      grantedModules: []
    },
    {
      id: 'backend-3',
      name: 'Analista de calidad',
      description: 'Permisos privilegiados de calidad (perfil real - sin permisos configurados)',
      grantedGroups: [],
      perfilPermissions: [],
      grantedModules: []
    },
    // --- EJEMPLOS (demuestran cómo se configurarían nuevos perfiles) ---
    {
      id: 'ejemplo-fichas-creador',
      name: '[Ejemplo] Creador Fichas Técnicas',
      description: 'Crear fichas y ver en desarrollo',
      grantedGroups: ['protejer'],
      perfilPermissions: [{ permission_id: 2, allow: 'ALLOW' }],
      grantedModules: [6],
      isExample: true
    },
    {
      id: 'ejemplo-fichas-completo',
      name: '[Ejemplo] Fichas Técnicas Completo',
      description: 'Crear, revisar, aprobar y gestionar fichas + reportes',
      grantedGroups: ['protejer'],
      perfilPermissions: [
        { permission_id: 2, allow: 'ALLOW' },
        { permission_id: 3, allow: 'ALLOW' },
        { permission_id: 4, allow: 'ALLOW' },
        { permission_id: 5, allow: 'ALLOW' },
        { permission_id: 6, allow: 'ALLOW' },
        { permission_id: 31, allow: 'ALLOW' },
        { permission_id: 32, allow: 'ALLOW' },
        { permission_id: 52, allow: 'ALLOW' }
      ],
      grantedModules: [6],
      isExample: true
    },
    {
      id: 'ejemplo-inconsistencias-solicitante',
      name: '[Ejemplo] Solicitante Inconsistencias',
      description: 'Generar y ver mis inconsistencias',
      grantedGroups: ['protejer'],
      perfilPermissions: [{ permission_id: 15, allow: 'ALLOW' }],
      grantedModules: [2],
      isExample: true
    },
    {
      id: 'ejemplo-inconsistencias-completo',
      name: '[Ejemplo] Inconsistencias Completo',
      description: 'Todos los roles de inconsistencias',
      grantedGroups: ['protejer'],
      perfilPermissions: [
        { permission_id: 7, allow: 'ALLOW' }, { permission_id: 8, allow: 'ALLOW' },
        { permission_id: 9, allow: 'ALLOW' }, { permission_id: 10, allow: 'ALLOW' },
        { permission_id: 11, allow: 'ALLOW' }, { permission_id: 12, allow: 'ALLOW' },
        { permission_id: 13, allow: 'ALLOW' }, { permission_id: 14, allow: 'ALLOW' },
        { permission_id: 15, allow: 'ALLOW' }, { permission_id: 28, allow: 'ALLOW' },
        { permission_id: 29, allow: 'ALLOW' }, { permission_id: 30, allow: 'ALLOW' },
        { permission_id: 35, allow: 'ALLOW' }, { permission_id: 36, allow: 'ALLOW' }
      ],
      grantedModules: [2],
      isExample: true
    },
    {
      id: 'ejemplo-terminacion-completo',
      name: '[Ejemplo] Terminación Completo',
      description: 'Todos los permisos de terminación y empaque',
      grantedGroups: ['protejer'],
      perfilPermissions: [
        { permission_id: 16, allow: 'ALLOW' }, { permission_id: 19, allow: 'ALLOW' },
        { permission_id: 20, allow: 'ALLOW' }, { permission_id: 21, allow: 'ALLOW' },
        { permission_id: 22, allow: 'ALLOW' }, { permission_id: 33, allow: 'ALLOW' }
      ],
      grantedModules: [3],
      isExample: true
    },
    {
      id: 'ejemplo-renueva',
      name: '[Ejemplo] Renueva / BigBag',
      description: 'Acceso completo al módulo Renueva',
      grantedGroups: ['protejer'],
      perfilPermissions: [
        { permission_id: 17, allow: 'ALLOW' }, { permission_id: 18, allow: 'ALLOW' },
        { permission_id: 23, allow: 'ALLOW' }
      ],
      grantedModules: [4],
      isExample: true
    },
    {
      id: 'ejemplo-inventario',
      name: '[Ejemplo] Jefe de Bodega',
      description: 'Gestión completa de inventarios y bodegas',
      grantedGroups: [],
      perfilPermissions: [
        { permission_id: 24, allow: 'ALLOW' }, { permission_id: 25, allow: 'ALLOW' },
        { permission_id: 26, allow: 'ALLOW' }, { permission_id: 27, allow: 'ALLOW' },
        { permission_id: 34, allow: 'ALLOW' }
      ],
      grantedModules: [5],
      isExample: true
    },
    {
      id: 'ejemplo-moldes',
      name: '[Ejemplo] Moldes y OPM',
      description: 'Gestión de moldes y generación de OPM',
      grantedGroups: ['protejer'],
      perfilPermissions: [
        { permission_id: 40, allow: 'ALLOW' }, { permission_id: 41, allow: 'ALLOW' },
        { permission_id: 46, allow: 'ALLOW' }
      ],
      grantedModules: [9],
      isExample: true
    },
    {
      id: 'ejemplo-comerciales',
      name: '[Ejemplo] Comerciales',
      description: 'Hub comercial y costeos',
      grantedGroups: ['protejer'],
      perfilPermissions: [
        { permission_id: 37, allow: 'ALLOW' }, { permission_id: 38, allow: 'ALLOW' }
      ],
      grantedModules: [7],
      isExample: true
    }
  ];

  // ═══ ESTADO ═══
  private readonly STORAGE_KEY = 'saint_menu_access';
  private accessibleGroups$ = new BehaviorSubject<MenuGroup[]>([]);

  constructor(private authService: AuthService) {
    this.authService.user$.subscribe(() => this.recalculateAccess());
  }

  // ═══ API PÚBLICA ═══
  getAccessibleGroups$(): Observable<MenuGroup[]> { return this.accessibleGroups$.asObservable(); }
  getAccessibleGroups(): MenuGroup[] { return this.accessibleGroups$.value; }
  getAllGroups(): MenuGroup[] { return [...this.menuGroups]; }
  getAllProfiles(): MenuProfile[] { return [...this.menuProfiles]; }
  getModules(): MockModule[] { return [...this.mockModules]; }
  getPermissions(): MockPermission[] { return [...this.mockPermissions]; }

  getPermissionsByModule(moduleId: number): MockPermission[] {
    return this.mockPermissions.filter(p => p.module_id === moduleId);
  }

  getCurrentUserAccess(): UserMenuAccess {
    const userId = this.authService.user?.id;
    if (!userId) return this.defaultAccess();
    return this.loadUserAccess(userId);
  }

  assignProfile(userId: number, profileId: string): void {
    const access = this.loadUserAccess(userId);
    if (!access.assignedProfiles.includes(profileId)) {
      access.assignedProfiles.push(profileId);
      this.saveUserAccess(userId, access);
      this.applyEffectivePermissions(userId);
      this.recalculateAccess();
    }
  }

  removeProfile(userId: number, profileId: string): void {
    const access = this.loadUserAccess(userId);
    access.assignedProfiles = access.assignedProfiles.filter(p => p !== profileId);
    this.saveUserAccess(userId, access);
    this.applyEffectivePermissions(userId);
    this.recalculateAccess();
  }

  grantGroupOverride(userId: number, groupId: string): void {
    const access = this.loadUserAccess(userId);
    if (!access.groupOverrides.includes(groupId)) {
      access.groupOverrides.push(groupId);
      this.saveUserAccess(userId, access);
      this.recalculateAccess();
    }
  }

  revokeGroupOverride(userId: number, groupId: string): void {
    const access = this.loadUserAccess(userId);
    access.groupOverrides = access.groupOverrides.filter(g => g !== groupId);
    this.saveUserAccess(userId, access);
    this.recalculateAccess();
  }

  grantPermissionOverride(userId: number, permissionId: number): void {
    const access = this.loadUserAccess(userId);
    if (!access.permissionOverrides.includes(permissionId)) {
      access.permissionOverrides.push(permissionId);
      this.saveUserAccess(userId, access);
      this.applyEffectivePermissions(userId);
      this.recalculateAccess();
    }
  }

  revokePermissionOverride(userId: number, permissionId: number): void {
    const access = this.loadUserAccess(userId);
    access.permissionOverrides = access.permissionOverrides.filter(p => p !== permissionId);
    this.saveUserAccess(userId, access);
    this.applyEffectivePermissions(userId);
    this.recalculateAccess();
  }

  resetUserAccess(userId: number): void {
    this.saveUserAccess(userId, this.defaultAccess());
    this.applyEffectivePermissions(userId);
    this.recalculateAccess();
  }

  hasAccessToGroup(groupId: string): boolean {
    return this.accessibleGroups$.value.some(g => g.id === groupId);
  }

  recalculateAccess(): void {
    this.accessibleGroups$.next(this.calculateAccessibleGroups());
  }

  // ═══ LÓGICA: Aplica permisos efectivos al sessionStorage ═══
  private applyEffectivePermissions(userId: number): void {
    const access = this.loadUserAccess(userId);
    const hasLocalConfig = access.assignedProfiles.length > 0 ||
                           access.permissionOverrides.length > 0 ||
                           access.moduleOverrides.length > 0;

    const userStr = sessionStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    if (!hasLocalConfig) {
      // Sin config: restaurar mock original (usuario sin permisos para pruebas)
      user.permissions = [];
      user.modules = [];
    } else {
      // Con config: calcular desde perfiles + overrides
      const perms = new Set<number>();
      const mods = new Set<number>();

      for (const profileId of access.assignedProfiles) {
        const profile = this.menuProfiles.find(p => p.id === profileId);
        if (profile) {
          profile.perfilPermissions
            .filter(pp => pp.allow === 'ALLOW')
            .forEach(pp => perms.add(pp.permission_id));
          profile.grantedModules.forEach(m => mods.add(m));
        }
      }

      access.permissionOverrides.forEach(p => perms.add(p));
      access.moduleOverrides.forEach(m => mods.add(m));

      // Derivar módulos de los permisos asignados
      for (const permId of perms) {
        const perm = this.mockPermissions.find(p => p.id === permId);
        if (perm) mods.add(perm.module_id);
      }

      // REGLA CLAVE: Si tiene permiso 1 (admin), dar acceso TOTAL
      if (perms.has(1)) {
        this.mockPermissions.forEach(p => perms.add(p.id));
        this.mockModules.forEach(m => mods.add(m.id));
      }

      user.permissions = Array.from(perms);
      user.modules = Array.from(mods);
    }

    sessionStorage.setItem('user', JSON.stringify(user));
    (this.authService as any)._userSubject.next(user);
  }

  // ═══ CÁLCULO DE GRUPOS ACCESIBLES ═══
  private calculateAccessibleGroups(): MenuGroup[] {
    const user = this.authService.user;
    if (!user) return [];

    const access = this.loadUserAccess(user.id);
    const hasLocalConfig = access.assignedProfiles.length > 0 ||
                           access.groupOverrides.length > 0 ||
                           access.permissionOverrides.length > 0 ||
                           access.moduleOverrides.length > 0;

    if (hasLocalConfig) {
      const groupsFromProfiles = new Set<string>();
      const effectivePerms = new Set<number>();
      const effectiveMods = new Set<number>();

      for (const profileId of access.assignedProfiles) {
        const profile = this.menuProfiles.find(p => p.id === profileId);
        if (profile) {
          profile.grantedGroups.forEach(g => groupsFromProfiles.add(g));
          profile.perfilPermissions
            .filter(pp => pp.allow === 'ALLOW')
            .forEach(pp => effectivePerms.add(pp.permission_id));
          profile.grantedModules.forEach(m => effectiveMods.add(m));
        }
      }

      access.groupOverrides.forEach(g => groupsFromProfiles.add(g));
      access.permissionOverrides.forEach(p => effectivePerms.add(p));
      access.moduleOverrides.forEach(m => effectiveMods.add(m));

      return this.menuGroups.filter(group => {
        if (groupsFromProfiles.has(group.id)) return true;
        if (group.requiredPermissions.some(p => effectivePerms.has(p))) return true;
        if (group.requiredModules.some(m => effectiveMods.has(m))) return true;
        return false;
      });
    } else {
      const jwtPerms = new Set<number>(user.permissions || []);
      const jwtMods = new Set<number>(user.modules || []);
      return this.menuGroups.filter(group => {
        if (group.requiredPermissions.some(p => jwtPerms.has(p))) return true;
        if (group.requiredModules.some(m => jwtMods.has(m))) return true;
        return false;
      });
    }
  }

  // ═══ PERSISTENCIA LOCAL ═══
  private loadUserAccess(userId: number): UserMenuAccess {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const all = JSON.parse(stored);
        return all[userId] || this.defaultAccess();
      }
    } catch (e) { }
    return this.defaultAccess();
  }

  private saveUserAccess(userId: number, access: UserMenuAccess): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const all = stored ? JSON.parse(stored) : {};
      all[userId] = access;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
    } catch (e) { }
  }

  private defaultAccess(): UserMenuAccess {
    return { assignedProfiles: [], groupOverrides: [], permissionOverrides: [], moduleOverrides: [] };
  }
}
