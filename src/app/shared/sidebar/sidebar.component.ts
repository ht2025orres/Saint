import { Component, HostListener, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { MenuAccessService } from '../../services/menu-access.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { User } from '../../models/User';

interface MenuItem {
  label: string;
  icon?: string;
  link?: string;
  perfiles?: string[];
  permissions?: number[];
  modules?: number[];
  submenu?: SubmenuItem[];
  isOpen?: boolean;
  condition?: () => boolean;
  group?: string; // Grupo al que pertenece
}

interface SubmenuItem {
  label: string;
  link: string;
  perfiles?: string[];
  permissions?: number[];
  modules?: number[];
  condition?: () => boolean;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, AfterViewInit, OnDestroy {
  isCollapsed = true;
  isMobileOpen = false;
  isMobile = false;
  userName = '';
  userPerfil = '';
  userInitials = '';
  currentUser: User | null = null;

  menuItems: MenuItem[] = [];
  activeGroup: string = '';
  isGroupMenuOpen: boolean = false;

  /** Grupos accesibles para el usuario actual (dinámico desde MenuAccessService) */
  menuGroups: MenuGroup[] = [];

  hoveredSubmenu: SubmenuItem[] | null = null;
  floatPanelTop = 0;
  floatCloseTimeout: any;

  private resizeListener?: () => void;
  private sidebarToggleSubscription?: Subscription;
  private userSubscription?: Subscription;
  private menuAccessSubscription?: Subscription;

  constructor(
    public authService: AuthService,
    private router: Router,
    private sidebarService: SidebarService,
    private menuAccessService: MenuAccessService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2
  ) {
    this.checkMobile();

    if (!this.isMobile) {
      const saved = localStorage.getItem('sidebarCollapsed');
      this.isCollapsed = saved ? JSON.parse(saved) : true;

      if (this.isCollapsed) {
        this.renderer.addClass(document.body, 'mini-sidebar');
      } else {
        this.renderer.removeClass(document.body, 'mini-sidebar');
      }
    } else {
      this.isMobileOpen = false;
      this.isCollapsed = false;
      this.renderer.removeClass(document.body, 'mini-sidebar');
    }

    // Recuperar grupo activo de localStorage
    const savedGroup = localStorage.getItem('activeMenuGroup');
    if (savedGroup) {
      this.activeGroup = savedGroup;
    }
  }

  ngOnInit(): void {
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.currentUser = user;
      this.updateUserSummary(user);
      this.initMenuStructure();
      this.updateAccessibleGroups();
      this.cdr.detectChanges();
    });

    // Suscribirse a los grupos accesibles
    this.menuAccessSubscription = this.menuAccessService.getAccessibleGroups$().subscribe(groups => {
      this.menuGroups = groups.map(g => ({ id: g.id, label: g.label, icon: g.icon }));

      // Si el grupo activo ya no es accesible, seleccionar el primero disponible
      if (this.menuGroups.length > 0 && !this.menuGroups.some(g => g.id === this.activeGroup)) {
        this.activeGroup = this.menuGroups[0].id;
        localStorage.setItem('activeMenuGroup', this.activeGroup);
      }

      this.cdr.detectChanges();
    });

    this.setupResizeListener();
    this.initMenuStructure();
    this.updateAccessibleGroups();

    this.sidebarToggleSubscription = this.sidebarService.toggle$.subscribe(() => {
      this.toggleSidebar();
    });

    this.updateActiveParentStates();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        setTimeout(() => this.updateActiveParentStates(), 100);
      });
  }

  private updateUserSummary(user: User | null): void {
    if (user) {
      this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      this.userPerfil = user.roles && user.roles.length > 0 ? user.roles[0].name : '';
      this.userInitials = (
        (user.firstName ? user.firstName.charAt(0) : '') +
        (user.lastName ? user.lastName.charAt(0) : '')
      ).toUpperCase();
    } else {
      this.userName = '';
      this.userPerfil = '';
      this.userInitials = '';
    }
  }

  private initMenuStructure(): void {
    this.menuItems = [
      // ─── Sin grupo (siempre visibles) ───
      {
        label: 'Inicio',
        icon: 'bi bi-speedometer2',
        link: '/dashboard'
      },
      {
        label: 'Seguimiento',
        icon: 'bi bi-kanban',
        link: '/seguimiento',
        modules: [8],
        permissions: [1]
      },
      {
        label: 'Firmas Digitales',
        icon: 'bi bi-pencil-square',
        link: '/firmas',
        permissions: [1]
      },
      {
        label: 'Seguimiento Documentos',
        icon: 'bi bi-clipboard2-data',
        link: '/seguimiento-documentos',
        modules: [10],
        permissions: [1, 50, 51]
      },
      {
        label: 'Inventario',
        icon: 'bi bi-boxes',
        modules: [5],
        permissions: [1, 25, 26, 27, 34],
        submenu: [
          { label: 'Gestión de Zonas', link: '/inventario/gestion-zonas', permissions: [1, 27] },
          { label: 'Gestión de Bodegas', link: '/inventario/gestion-bodegas', permissions: [1, 25, 26, 27] },
          { label: 'Ver Conteos Cíclicos', link: '/inventario/inventario-ciclico/ver', permissions: [1, 25, 26, 27] },
          { label: 'Gestión de Inventarios', link: '/inventario/gestion-inventarios', permissions: [1, 27] },
          { label: 'Realizar Conteo', link: '/inventario/conteo', permissions: [1, 25, 26, 34] },
          { label: 'Histórico de Movimientos', link: '/inventario/historico-movimientos', permissions: [1, 27] },
        ]
      },
      {
        label: 'Centros de Costos',
        icon: 'bi bi-building',
        link: '/centros-costos',
        permissions: [1]
      },

      // ─── Grupo: Admin ───
      {
        label: 'Administración de Seguridad',
        icon: 'bi bi-shield-lock',
        link: '/security',
        permissions: [1],
        group: 'admin'
      },
      {
        label: 'Workflows',
        icon: 'bi bi-diagram-3',
        link: '/workflows',
        permissions: [1],
        group: 'admin'
      },
      {
        label: 'Admin Usuarios',
        icon: 'bi bi-people',
        link: '/users/page/0',
        permissions: [1],
        group: 'admin'
      },
      {
        label: 'Registro de Correos',
        icon: 'bi bi-envelope-paper',
        link: '/email-logs',
        permissions: [1],
        group: 'admin'
      },

      // ─── Grupo: Protejer ───
      {
        label: 'Reporte de Fichas',
        icon: 'bi bi-file-earmark-bar-graph',
        modules: [6],
        permissions: [1],
        group: 'protejer',
        submenu: [
          {
            label: 'Análisis por Mes',
            link: '/technical-data-sheets-report',
            permissions: [1, 32]
          },
          {
            label: 'Dashboard',
            link: '/report-dashboard'
          },
          {
            label: 'Generar reporte',
            link: '/create-report',
            permissions: [1, 31],
            condition: () => this.puedeMostrarBoton()
          },
          {
            label: 'Mis reportes',
            link: '/mi-lista-report',
            permissions: [1, 31]
          },
          {
            label: 'Gestión de reportes',
            link: '/list-report',
            permissions: [1, 32]
          }
        ]
      },
      {
        label: 'Fichas tecnicas',
        icon: 'bi bi-file-earmark-text',
        modules: [6],
        permissions: [1],
        group: 'protejer',
        submenu: [
          {
            label: 'Crear ficha técnica',
            link: '/createTechnicalDataSheet/new/create',
            permissions: [1, 2]
          },
          {
            label: 'Fichas técnicas terminadas',
            link: '/listTechnicalDataSheet/page/0/TERMINADO',
            permissions: [1, 2, 3, 4, 5, 31, 32, 6]
          },
          {
            label: 'Fichas técnicas primera revisión',
            link: '/listTechnicalDataSheet/page/0/PRIMERA REVISION',
            permissions: [1, 3]
          },
          {
            label: 'Fichas técnicas segunda revisión',
            link: '/listTechnicalDataSheet/page/0/SEGUNDA REVISION',
            permissions: [1, 4]
          },
          {
            label: 'Fichas técnicas en calidad',
            link: '/listTechnicalDataSheet/page/0/CALIDAD',
            permissions: [1, 5]
          },
          {
            label: 'Fichas técnicas en desarrollo',
            link: '/listTechnicalDataSheet/page/0/DESARROLLO',
            permissions: [1, 2]
          },
          {
            label: 'Gestión de Anulaciones',
            link: '/gestion-anulaciones-fichas',
            permissions: [1, 52]
          }
        ]
      },
      {
        label: 'Inconsistencias',
        icon: 'bi bi-exclamation-triangle',
        modules: [2],
        permissions: [1],
        group: 'protejer',
        submenu: [
          {
            label: 'Mis Inconsistencias',
            link: '/mis-inconsistencias',
            permissions: [1, 15]
          },
          {
            label: 'Generar Inconsistencias',
            link: '/generar-inconsistencias',
            permissions: [1, 15]
          },
          {
            label: 'Aprobar Inconsistencias',
            link: '/aprobar-inconsistencias',
            permissions: [1, 7, 8, 9, 10, 11, 12, 13, 28, 29, 30]
          },
          {
            label: 'Inconsistencias Cartera',
            link: '/cartera-inconsistencias',
            permissions: [1, 28]
          },
          {
            label: 'Histórico Inconsistencias',
            link: '/historico-inconsistencias',
            permissions: [1, 48]
          },
          {
            label: 'Revisión de Consumo',
            link: '/revision-consumo',
            permissions: [1, 49, 50]
          },
          {
            label: 'Dashboard de Inconsistencias',
            link: '/dashboard-financiero-inconsistencias',
            permissions: [1, 9, 35]
          }
        ]
      },
      {
        label: 'Terminación',
        icon: 'bi bi-box-seam',
        modules: [3],
        permissions: [1],
        group: 'protejer',
        submenu: [
          {
            label: 'Recepción de OP',
            link: '/recepcion-op',
            permissions: [1, 19]
          },
          {
            label: 'Distribución de PV',
            link: '/distribucion-pv',
            permissions: [1, 20, 33]
          },
          {
            label: 'Gestión de empacadores',
            link: '/gestion-empacadores',
            permissions: [1, 21]
          },
          {
            label: 'Registrar empaque',
            link: '/registrar-empaque',
            permissions: [1, 16]
          },
          {
            label: 'Dashboard',
            link: '/dashboard-empaque',
            permissions: [1, 22]
          }
        ]
      },
      {
        label: 'Renueva',
        icon: 'bi bi-truck',
        modules: [4],
        permissions: [1],
        group: 'protejer',
        submenu: [
          {
            label: 'Dashboard',
            link: '/dashboard-bigbag',
            permissions: [1, 23, 17]
          },
          {
            label: 'Ingreso Renueva',
            link: '/technical-report-bigbag'
          },
          {
            label: 'Ver llegada empaques',
            link: '/view-report-bigbag'
          },
          {
            label: 'Precintos',
            link: '/view-precinto-bigbag',
            permissions: [1, 18]
          }
        ]
      },
      {
        label: 'Comerciales',
        icon: 'bi bi-briefcase',
        modules: [7],
        permissions: [1],
        group: 'protejer',
        submenu: [
          { label: 'Hub Comercial', link: '/comerciales' },
          { label: 'Mis Costeos', link: '/comerciales/costeos' },
        ]
      },
      {
        label: 'Tiempos Ítems',
        icon: 'bi bi-clock-history',
        link: '/tiempos-items',
        permissions: [1],
        group: 'protejer'
      },
      {
        label: 'Planeación',
        icon: 'bi bi-calendar-check',
        link: '/planeacion',
        permissions: [1],
        group: 'protejer'
      },
      {
        label: 'Moldes y OPM',
        icon: 'bi bi-grid-3x3-gap',
        modules: [9],
        permissions: [1, 40],
        group: 'protejer',
        submenu: [
          { label: 'Ver Moldes', link: '/moldes', permissions: [1, 40] },
          { label: 'Crear Molde', link: '/moldes/admin', permissions: [1, 41] },
          { label: 'Generar OPM', link: '/moldes/opm-generator', permissions: [1, 46] },
        ]
      }
    ];
  }

  /** Obtiene los items visibles según el grupo activo */
  get visibleMenuItems(): MenuItem[] {
    return this.menuItems.filter(item => {
      // Items sin grupo siempre se muestran
      if (!item.group) return true;
      // Items del grupo activo se muestran
      return item.group === this.activeGroup;
    });
  }

  /**
   * Determina qué grupos mostrar en el selector.
   * Un grupo se muestra solo si el usuario tiene al menos UN item visible en ese grupo.
   */
  private updateAccessibleGroups(): void {
    const visibleGroupIds = new Set<string>();

    for (const item of this.menuItems) {
      if (item.group && this.canShowMenuItem(item)) {
        visibleGroupIds.add(item.group);
      }
    }

    this.menuAccessService.setAccessibleGroups(Array.from(visibleGroupIds));
  }

  /** Obtiene el grupo activo actual */
  get currentGroup(): MenuGroup | null {
    if (this.menuGroups.length === 0) return null;
    return this.menuGroups.find(g => g.id === this.activeGroup) || this.menuGroups[0];
  }

  /** Cambia el grupo activo */
  selectGroup(groupId: string): void {
    this.activeGroup = groupId;
    this.isGroupMenuOpen = false;
    localStorage.setItem('activeMenuGroup', groupId);
    // Cerrar submenús abiertos
    this.menuItems.forEach(m => m.isOpen = false);
  }

  /** Toggle del menú de grupos */
  toggleGroupMenu(): void {
    this.isGroupMenuOpen = !this.isGroupMenuOpen;
  }

  /** Cierra el menú de grupos */
  closeGroupMenu(): void {
    this.isGroupMenuOpen = false;
  }

  toggleSubmenu(item: MenuItem): void {
    // Close other menus
    this.menuItems.forEach(m => {
      if (m !== item) m.isOpen = false;
    });

    item.isOpen = !item.isOpen;
  }

  ngAfterViewInit(): void {
    this.updateBodyClass();
    this.cdr.detectChanges();
  }

  /**
   * Abre el panel flotante filtrando por roles
   */
  openFloatPanel(submenu: SubmenuItem[], event: MouseEvent) {
    if (!this.isCollapsed || this.isMobile) return;

    clearTimeout(this.floatCloseTimeout);

    this.hoveredSubmenu = this.filterSubmenuByPerfiles(submenu);

    if (this.hoveredSubmenu.length === 0) {
      this.hoveredSubmenu = null;
      return;
    }

    const target = event.target as HTMLElement;
    const rect = target.closest('.sidebar-link')?.getBoundingClientRect();
    if (rect) {
      this.floatPanelTop = rect.top;
    }
  }

  private filterSubmenuByPerfiles(submenu: SubmenuItem[]): SubmenuItem[] {
    return submenu.filter(item => {
      if ((!item.perfiles || item.perfiles.length === 0) && (!item.permissions || item.permissions.length === 0) && (!item.modules || item.modules.length === 0)) {
        return true;
      }

      const perfilMatch = item.perfiles && item.perfiles.length > 0 && this.authService.hasAnyRole(item.perfiles);
      const permissionMatch = item.permissions && item.permissions.length > 0 && this.authService.hasAnyPermission(item.permissions);
      const moduleMatch = item.modules && item.modules.length > 0 && this.authService.hasAnyModule(item.modules);

      return perfilMatch || permissionMatch || moduleMatch;
    });
  }

  closeFloatPanel() {
    this.floatCloseTimeout = setTimeout(() => {
      this.hoveredSubmenu = null;
    }, 300);
  }

  keepFloatPanelOpen() {
    clearTimeout(this.floatCloseTimeout);
  }

  canShowMenuItem(item: MenuItem | SubmenuItem): boolean {
    const perfiles = item.perfiles || [];
    const permissions = item.permissions || [];
    const modules = item.modules || [];

    if (perfiles.length === 0 && permissions.length === 0 && modules.length === 0) return true;

    const perfilMatch = perfiles.length > 0 && this.authService.hasAnyRole(perfiles);
    const permissionMatch = permissions.length > 0 && this.authService.hasAnyPermission(permissions);
    const moduleMatch = modules.length > 0 && this.authService.hasAnyModule(modules);

    const hasAccess = perfilMatch || permissionMatch || moduleMatch;
    const conditionMatch = !item.condition || item.condition();

    return hasAccess && conditionMatch;
  }

  private updateActiveParentStates(): void {
    // No longer needed for horizontal nav but kept for compatibility
  }

  ngOnDestroy(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
    if (this.sidebarToggleSubscription) {
      this.sidebarToggleSubscription.unsubscribe();
    }
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.menuAccessSubscription) {
      this.menuAccessSubscription.unsubscribe();
    }
    clearTimeout(this.floatCloseTimeout);
  }

  private setupResizeListener(): void {
    this.resizeListener = () => {
      const wasMobile = this.isMobile;
      this.checkMobile();

      if (wasMobile && !this.isMobile) {
        this.isMobileOpen = false;
        this.updateBodyClass();
      }
    };
    window.addEventListener('resize', this.resizeListener);
  }

  private checkMobile(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < 768;

    if (!wasMobile && this.isMobile) {
      this.isMobileOpen = false;
      this.isCollapsed = false;
      this.updateBodyClass();
    }

    if (wasMobile && !this.isMobile) {
      this.isMobileOpen = false;
      this.updateBodyClass();
    }
  }

  toggleSidebar(): void {
    if (this.isMobile) {
      this.isMobileOpen = !this.isMobileOpen;
      this.updateBodyClass();
    } else {
      this.isCollapsed = !this.isCollapsed;
      this.updateBodyClass();
      localStorage.setItem('sidebarCollapsed', JSON.stringify(this.isCollapsed));
    }
  }

  closeMobileSidebar(): void {
    if (this.isMobile) {
      this.isMobileOpen = false;
      this.updateBodyClass();
    }
  }

  private updateBodyClass(): void {
    const body = document.body;

    if (this.isMobile) {
      if (this.isMobileOpen) {
        this.renderer.addClass(body, 'sidebar-mobile-open');
      } else {
        this.renderer.removeClass(body, 'sidebar-mobile-open');
      }
      this.renderer.removeClass(body, 'mini-sidebar');
    } else {
      this.renderer.removeClass(body, 'sidebar-mobile-open');
      if (this.isCollapsed) {
        this.renderer.addClass(body, 'mini-sidebar');
      } else {
        this.renderer.removeClass(body, 'mini-sidebar');
      }
    }
  }

  @HostListener('click', ['$event'])
  onMobileClick(event: Event): void {
    if (this.isMobile) {
      const target = event.target as HTMLElement;
      const link = target.closest('a');
      if (link && link.getAttribute('routerLink')) {
        this.closeMobileSidebar();
      }
    }
  }

  /** Cierra el dropdown de grupos y submenús si se hace click fuera */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.group-selector')) {
      this.isGroupMenuOpen = false;
    }
    // Cerrar submenús si click fuera del topnav-item
    if (!target.closest('.topnav-item')) {
      this.menuItems.forEach(m => m.isOpen = false);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  puedeMostrarBoton(): boolean {
    const ahora = new Date();
    const diaSemana = ahora.getDay();
    const hora = ahora.getHours();
    const minutos = ahora.getMinutes();

    if (diaSemana >= 1 && diaSemana <= 5) {
      return (hora > 7 || (hora === 7 && minutos >= 0)) && (hora < 16);
    }

    if (diaSemana === 6) {
      return (hora > 7 || (hora === 7 && minutos >= 0)) && (hora < 12);
    }

    return false;
  }
}
