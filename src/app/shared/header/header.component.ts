import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { User } from '../../models/User';

/* ─── Estructura jerárquica: Área → Módulo → Sub-interfaz ─── */
export interface SubInterface {
  label: string;
  link: string;
  icon?: string;
  perfiles?: string[];
  permissions?: number[];
  modules?: number[];
  condition?: () => boolean;
}

export interface ModuleItem {
  label: string;
  icon?: string;
  link?: string;
  subInterfaces?: SubInterface[];
  perfiles?: string[];
  permissions?: number[];
  modules?: number[];
  condition?: () => boolean;
}

export interface AreaCategory {
  label: string;
  icon: string;
  color: string;
  modules: ModuleItem[];
}

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMobile = false;
  userName = '';
  userRole = '';
  userInitials = '';
  currentUser: User | null = null;

  areas: AreaCategory[] = [];
  openArea: AreaCategory | null = null;
  isUserMenuOpen = false;

  private userSubscription?: Subscription;
  private routerSubscription?: Subscription;

  constructor(
    public authService: AuthService,
    private router: Router,
    private sidebarService: SidebarService,
    private cdr: ChangeDetectorRef
  ) {
    this.checkMobile();
  }

  ngOnInit(): void {
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.currentUser = user;
      this.updateUserSummary(user);
      this.initAreaStructure();
      this.cdr.detectChanges();
    });

    this.initAreaStructure();

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.closeAll();
      });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkMobile();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.area-wrapper') && !target.closest('.user-dropdown')) {
      this.closeAll();
    }
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth < 992;
  }

  private updateUserSummary(user: User | null): void {
    if (user) {
      this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Usuario';
      this.userRole = user.roles && user.roles.length > 0 ? user.roles[0].name : '';
      this.userInitials = (
        (user.firstName ? user.firstName.charAt(0) : '') +
        (user.lastName ? user.lastName.charAt(0) : '')
      ).toUpperCase() || 'US';
    } else {
      this.userName = '';
      this.userRole = '';
      this.userInitials = 'US';
    }
  }

  /* ─── Estructura de navegación jerárquica con parity 100% de permisos ─── */
  private initAreaStructure(): void {
    this.areas = [
      /* ═══════════════════════════════════════════════════════
         ÁREA 1: PRODUCCIÓN
         ═══════════════════════════════════════════════════════ */
      {
        label: 'Producción',
        icon: 'bi bi-gear-wide-connected',
        color: '#2563EB',
        modules: [
          {
            label: 'Fichas Técnicas',
            icon: 'bi bi-file-earmark-ruled',
            modules: [6],
            permissions: [1],
            subInterfaces: [
              { label: 'Crear Ficha Técnica', link: '/createTechnicalDataSheet/new/create', permissions: [1, 2] },
              { label: 'Fichas Terminadas', link: '/listTechnicalDataSheet/page/0/TERMINADO', permissions: [1, 2, 3, 4, 5, 31, 32, 6] },
              { label: 'Primera Revisión', link: '/listTechnicalDataSheet/page/0/PRIMERA REVISION', permissions: [1, 3] },
              { label: 'Segunda Revisión', link: '/listTechnicalDataSheet/page/0/SEGUNDA REVISION', permissions: [1, 4] },
              { label: 'En Calidad', link: '/listTechnicalDataSheet/page/0/CALIDAD', permissions: [1, 5] },
              { label: 'En Desarrollo', link: '/listTechnicalDataSheet/page/0/DESARROLLO', permissions: [1, 2] },
              { label: 'Gestión Anulaciones', link: '/gestion-anulaciones-fichas', permissions: [1, 52] },
            ]
          },
          {
            label: 'Reporte de Fichas',
            icon: 'bi bi-file-earmark-bar-graph',
            modules: [6],
            permissions: [1],
            subInterfaces: [
              { label: 'Análisis por Mes', link: '/technical-data-sheets-report', permissions: [1, 32] },
              { label: 'Dashboard Fichas', link: '/report-dashboard', permissions: [1, 32] },
              { label: 'Generar Reporte', link: '/create-report', permissions: [1, 31] },
              { label: 'Mis Reportes', link: '/mi-lista-report', permissions: [1, 31] },
              { label: 'Gestión de Reportes', link: '/list-report', permissions: [1, 32] },
            ]
          },
          {
            label: 'Moldes y OPM',
            icon: 'bi bi-diagram-2',
            modules: [9],
            permissions: [1, 40],
            subInterfaces: [
              { label: 'Librería de Moldes', link: '/moldes', permissions: [1, 40] },
              { label: 'Crear / Editar Molde', link: '/moldes/admin', permissions: [1, 41] },
            ]
          },
          {
            label: 'Planeación y Tiempos',
            icon: 'bi bi-stopwatch',
            permissions: [1],
            subInterfaces: [
              { label: 'Planeación de Producción', link: '/planeacion', permissions: [1] },
              { label: 'Tiempos por Ítem', link: '/tiempos-items', permissions: [1] },
            ]
          },
          {
            label: 'Terminación y Empaque',
            icon: 'bi bi-box-seam',
            modules: [3],
            permissions: [1],
            subInterfaces: [
              { label: 'Recepción de OP', link: '/recepcion-op', permissions: [1, 19] },
              { label: 'Distribución de PV', link: '/distribucion-pv', permissions: [1, 20, 33] },
              { label: 'Gestión Empacadores', link: '/gestion-empacadores', permissions: [1, 21] },
              { label: 'Registrar Empaque', link: '/registrar-empaque', permissions: [1, 16] },
              { label: 'Dashboard Empaque', link: '/dashboard-empaque', permissions: [1, 22] },
            ]
          },
          {
            label: 'Inconsistencias',
            icon: 'bi bi-exclamation-triangle',
            modules: [2],
            permissions: [1],
            subInterfaces: [
              { label: 'Mis Inconsistencias', link: '/mis-inconsistencias', permissions: [1, 15] },
              { label: 'Generar Inconsistencias', link: '/generar-inconsistencias', permissions: [1, 15] },
              { label: 'Aprobar Inconsistencias', link: '/aprobar-inconsistencias', permissions: [1, 7, 8, 9, 10, 11, 12, 13, 29, 30] },
              { label: 'Inconsistencias Cartera', link: '/cartera-inconsistencias', permissions: [1, 28] },
              { label: 'Histórico Inconsistencias', link: '/historico-inconsistencias', permissions: [1, 9, 55] },
              { label: 'Revisión de Consumo', link: '/revision-consumo', permissions: [1, 11] },
              { label: 'Dashboard Financiero', link: '/dashboard-financiero-inconsistencias', permissions: [1, 9] },
            ]
          },
          {
            label: 'Gestión de Costeos',
            icon: 'bi bi-calculator',
            permissions: [1],
            subInterfaces: [
              { label: 'Módulo de Costeos y Cotizaciones', link: '/costeos', permissions: [1] },
            ]
          },
          {
            label: 'Gestión de Muestras',
            icon: 'bi bi-scissors',
            permissions: [1],
            subInterfaces: [
              { label: 'Módulo de Muestras y Confección', link: '/muestras', permissions: [1] },
            ]
          },
        ]
      },

      /* ═══════════════════════════════════════════════════════
         ÁREA 2: COMERCIAL
         ═══════════════════════════════════════════════════════ */
      {
        label: 'Comercial',
        icon: 'bi bi-briefcase',
        color: '#059669',
        modules: [
          {
            label: 'Gestión Comercial',
            icon: 'bi bi-people',
            modules: [7],
            permissions: [1],
            subInterfaces: [
              { label: 'Clientes con Pendientes', link: '/comerciales', permissions: [1] },
              { label: 'Listado de Solicitudes', link: '/comerciales/solicitudes', permissions: [1] },
              { label: 'Captura de OC (OCR)', link: '/comerciales/captura', permissions: [1] },
            ]
          },
          {
            label: 'Financiero',
            icon: 'bi bi-pie-chart',
            permissions: [1],
            subInterfaces: [
              { label: 'Centros de Costos', link: '/centros-costos', permissions: [1] },
            ]
          },
        ]
      },

      /* ═══════════════════════════════════════════════════════
         ÁREA 3: ABASTECIMIENTO
         ═══════════════════════════════════════════════════════ */
      {
        label: 'Abastecimiento',
        icon: 'bi bi-boxes',
        color: '#D97706',
        modules: [
          {
            label: 'Gestión de Inventario',
            icon: 'bi bi-building',
            modules: [5],
            permissions: [1, 25, 26, 27, 34, 54],
            subInterfaces: [
              { label: 'Gestión de Zonas', link: '/inventario/gestion-zonas', permissions: [1, 27, 54] },
              { label: 'Gestión de Bodegas', link: '/inventario/gestion-bodegas', permissions: [1, 25, 26, 27, 54] },
              { label: 'Conteos Cíclicos', link: '/inventario/inventario-ciclico/ver', permissions: [1, 25, 26, 27, 54] },
              { label: 'Gestión Inventarios', link: '/inventario/gestion-inventarios', permissions: [1, 27, 54] },
              { label: 'Realizar Conteo', link: '/inventario/conteo', permissions: [1, 25, 26, 34] },
              { label: 'Histórico Movimientos', link: '/inventario/historico-movimientos', permissions: [1, 27, 54] },
            ]
          },
        ]
      },

      /* ═══════════════════════════════════════════════════════
         ÁREA 4: RENUEVA (BigBag)
         ═══════════════════════════════════════════════════════ */
      {
        label: 'Renueva',
        icon: 'bi bi-recycle',
        color: '#7C3AED',
        modules: [
          {
            label: 'Renueva BigBag',
            icon: 'bi bi-bag-check',
            modules: [4],
            permissions: [1],
            subInterfaces: [
              { label: 'Dashboard BigBag', link: '/dashboard-bigbag', permissions: [1, 23, 17] },
              { label: 'Ingreso Renueva', link: '/technical-report-bigbag', permissions: [1], modules: [4] },
              { label: 'Ver Llegada Empaques', link: '/view-report-bigbag', permissions: [1], modules: [4] },
              { label: 'Precintos BigBag', link: '/view-precinto-bigbag', permissions: [1, 18] },
            ]
          },
        ]
      },

      /* ═══════════════════════════════════════════════════════
         ÁREA 5: CONTROL
         ═══════════════════════════════════════════════════════ */
      {
        label: 'Control',
        icon: 'bi bi-graph-up-arrow',
        color: '#0284C7',
        modules: [
          {
            label: 'Seguimientos',
            icon: 'bi bi-kanban',
            subInterfaces: [
              { label: 'Seguimiento Financiero', link: '/seguimiento-proyectos/proyectos-activos', permissions: [1, 56, 57] },
              { label: 'Seguimiento de Proyectos', link: '/seguimiento', modules: [8], permissions: [1] },
              { label: 'Seguimiento Documentos', link: '/seguimiento-documentos', modules: [10], permissions: [1, 50, 51] },
            ]
          },
          {
            label: 'Firmas Digitales',
            icon: 'bi bi-pen',
            modules: [13],
            permissions: [1, 58],
            subInterfaces: [
              { label: 'Panel de Firmas', link: '/firmas', modules: [13], permissions: [1, 58] },
            ]
          },
        ]
      },

      /* ═══════════════════════════════════════════════════════
         ÁREA 6: ADMINISTRACIÓN
         ═══════════════════════════════════════════════════════ */
      {
        label: 'Administración',
        icon: 'bi bi-shield-lock',
        color: '#DC2626',
        modules: [
          {
            label: 'Seguridad y Sistema',
            icon: 'bi bi-gear',
            permissions: [1],
            subInterfaces: [
              { label: 'Administración Seguridad', link: '/security', permissions: [1] },
              { label: 'Workflows Engine', link: '/workflows', permissions: [1] },
              { label: 'Logs de Correos', link: '/email-logs', permissions: [1] },
            ]
          },
        ]
      },
    ];
  }

  /* ─── Visibility helpers ─── */
  canShowSubInterface(sub: SubInterface): boolean {
    const permissions = sub.permissions || [];
    const modules = sub.modules || [];
    const perfiles = sub.perfiles || [];

    if (permissions.length === 0 && modules.length === 0 && perfiles.length === 0) return true;

    const perfilMatch = perfiles.length > 0 && this.authService.hasAnyRole(perfiles);
    const permissionMatch = permissions.length > 0 && this.authService.hasAnyPermission(permissions);
    const moduleMatch = modules.length > 0 && this.authService.hasAnyModule(modules);

    const hasAccess = perfilMatch || permissionMatch || moduleMatch;
    const conditionMatch = !sub.condition || sub.condition();

    return hasAccess && conditionMatch;
  }

  canShowModule(mod: ModuleItem): boolean {
    const permissions = mod.permissions || [];
    const modules = mod.modules || [];
    const perfiles = mod.perfiles || [];

    const hasAccess =
      (permissions.length === 0 && modules.length === 0 && perfiles.length === 0) ||
      (perfiles.length > 0 && this.authService.hasAnyRole(perfiles)) ||
      (permissions.length > 0 && this.authService.hasAnyPermission(permissions)) ||
      (modules.length > 0 && this.authService.hasAnyModule(modules));

    if (!hasAccess) return false;

    // Direct link module
    if (!mod.subInterfaces || mod.subInterfaces.length === 0) {
      return !mod.condition || mod.condition();
    }

    // Module with sub-interfaces: must have at least one visible sub-interface
    return mod.subInterfaces.some(sub => this.canShowSubInterface(sub));
  }

  canShowArea(area: AreaCategory): boolean {
    return area.modules.some(mod => this.canShowModule(mod));
  }

  getVisibleModules(area: AreaCategory): ModuleItem[] {
    return area.modules.filter(mod => this.canShowModule(mod));
  }

  getVisibleSubInterfaces(mod: ModuleItem): SubInterface[] {
    return (mod.subInterfaces || []).filter(sub => this.canShowSubInterface(sub));
  }

  shouldAlignRight(area: AreaCategory): boolean {
    const visibleAreas = this.areas.filter(a => this.canShowArea(a));
    const idx = visibleAreas.indexOf(area);
    if (idx <= 0) return false;
    return idx >= visibleAreas.length - 2 && idx >= 2;
  }

  /* ─── UI Interaction ─── */
  toggleArea(area: AreaCategory, event: Event): void {
    event.stopPropagation();
    if (this.openArea === area) {
      this.openArea = null;
    } else {
      this.openArea = area;
      this.isUserMenuOpen = false;
    }
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
    if (this.isUserMenuOpen) {
      this.openArea = null;
    }
  }

  closeAll(): void {
    this.openArea = null;
    this.isUserMenuOpen = false;
  }

  toggleSidebar(): void {
    this.sidebarService.toggle();
  }

  stopImpersonating(): void {
    this.authService.stopImpersonating();
  }

  logout(): void {
    this.closeAll();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }
}
