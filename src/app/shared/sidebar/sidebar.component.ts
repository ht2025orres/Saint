import { Component, HostListener, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
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
}

interface SubmenuItem {
  label: string;
  link: string;
  perfiles?: string[];
  permissions?: number[];
  modules?: number[];
  condition?: () => boolean;
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

  hoveredSubmenu: SubmenuItem[] | null = null;
  floatPanelTop = 0;
  floatCloseTimeout: any;

  private resizeListener?: () => void;
  private sidebarToggleSubscription?: Subscription;
  private userSubscription?: Subscription;

  constructor(
    public authService: AuthService,
    private router: Router,
    private sidebarService: SidebarService,
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
  }

  ngOnInit(): void {
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.currentUser = user;
      this.updateUserSummary(user);
      this.initMenuStructure();
      this.cdr.detectChanges(); // Trigger change detection
    });
    this.setupResizeListener();
    this.initMenuStructure();

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
      {
        label: 'Inicio',
        icon: 'bi bi-speedometer2',
        link: '/dashboard'
      },
      {
        label: 'Administración de Seguridad',
        icon: 'bi bi-shield-lock',
        link: '/security',
        permissions: [1]
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
        label: 'Reporte de Fichas',
        icon: 'bi bi-file-earmark-bar-graph',
        modules: [6],
        permissions: [1],
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
          }
        ]
      },
      {
        label: 'Inconsistencias',
        icon: 'bi bi-exclamation-triangle',
        modules: [2],
        permissions: [1],
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
            label: 'Histórico Inconsistencias',
            link: '/historico-inconsistencias',
            permissions: [1, 7, 8, 9, 10, 11, 12, 13, 28, 29, 30]
          },
          {
            label: 'Revisión de Consumo',
            link: '/revision-consumo',
            permissions: [1, 14]
          },
          {
            label: 'Reporte de Inconsistencias',
            link: '/reporte-inconsistencias',
            permissions: [1, 9, 35]
          }
        ]
      },
      {
        label: 'Terminación ',
        icon: 'bi bi-box-seam',
        modules: [3],
        permissions: [1],
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
        label: 'Inventario',
        icon: 'bi bi-boxes',
        modules: [5],
        permissions: [1],
        submenu: [
          { label: 'Gestión de Zonas', link: '/inventario/gestion-zonas' },
          { label: 'Gestión de Bodegas', link: '/inventario/gestion-bodegas' },
          { label: 'Ver Conteos Cíclicos', link: '/inventario/inventario-ciclico/ver' },
          { label: 'Gestión de Inventarios', link: '/inventario/gestion-inventarios' },
          { label: 'Realizar Conteo', link: '/inventario/conteo' },
          { label: 'Histórico de Movimientos', link: '/inventario/historico-movimientos', permissions: [1, 27] },
        ]
      },
      {
        label: 'Comerciales',
        icon: 'bi bi-briefcase',
        modules: [7],
        permissions: [1],
        submenu: [
          { label: 'Clientes & Ítems', link: '/comerciales' },
          { label: 'Mis Costeos', link: '/comerciales/costeos' },
        ]
      },
      {
        label: 'Tiempos Ítems',
        icon: 'bi bi-clock-history',
        link: '/tiempos-items',
        permissions: [1]
      },
      {
        label: 'Planeación',
        icon: 'bi bi-calendar-check',
        link: '/planeacion',
        permissions: [1]
      },
      {
        label: 'Centros de Costos',
        icon: 'bi bi-building',
        link: '/centros-costos',
        permissions: [1]
      },
      {
        label: 'Moldes y OPM',
        icon: 'bi bi-grid-3x3-gap',
        link: '/moldes',
        permissions: [1, 2]
      }
    ];
  }

  toggleSubmenu(item: MenuItem): void {
    if (this.isCollapsed && !this.isMobile) return;

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

    // Filtrar opciones según perfiles del usuario
    this.hoveredSubmenu = this.filterSubmenuByPerfiles(submenu);

    // Solo mostrar si hay al menos una opción visible
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

  /**
   * Filtra las opciones del submenú según los perfiles del usuario
   */
  private filterSubmenuByPerfiles(submenu: SubmenuItem[]): SubmenuItem[] {
    return submenu.filter(item => {
      // Si no tiene perfiles, permisos ni módulos definidos, es visible para todos
      if ((!item.perfiles || item.perfiles.length === 0) && (!item.permissions || item.permissions.length === 0) && (!item.modules || item.modules.length === 0)) {
        return true;
      }

      // Verificar si el usuario tiene alguno de los perfiles requeridos
      const perfilMatch = item.perfiles && item.perfiles.length > 0 && this.authService.hasAnyRole(item.perfiles);
      // Verificar si el usuario tiene alguno de los permisos requeridos
      const permissionMatch = item.permissions && item.permissions.length > 0 && this.authService.hasAnyPermission(item.permissions);
      // Verificar si el usuario tiene acceso a alguno de los módulos requeridos
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

  /**
   * Verifica si una opción debe mostrarse según roles y condición opcional
   */
  canShowMenuItem(item: MenuItem | SubmenuItem): boolean {
    const perfiles = item.perfiles || [];
    const permissions = item.permissions || [];
    const modules = item.modules || [];
    
    // 1. Si NO hay ninguna restricción técnica definida, el item es público para logueados
    if (perfiles.length === 0 && permissions.length === 0 && modules.length === 0) return true;

    // 2. Verificar cumplimiento de cada criterio (solo si el criterio está definido)
    const perfilMatch = perfiles.length > 0 && this.authService.hasAnyRole(perfiles);
    const permissionMatch = permissions.length > 0 && this.authService.hasAnyPermission(permissions);
    const moduleMatch = modules.length > 0 && this.authService.hasAnyModule(modules);

    // 3. Si cumple CUALQUIERA de las restricciones definidas, tiene acceso
    const hasAccess = perfilMatch || permissionMatch || moduleMatch;

    // 4. Se suma la condición lógica extra (si existe, como la de horario)
    const conditionMatch = !item.condition || item.condition();

    return hasAccess && conditionMatch;
  }

  private updateActiveParentStates(): void {
    const parentMenuItems = document.querySelectorAll('app-sidebar .sidebar-list > li');

    parentMenuItems.forEach((parentLi) => {
      const hasActiveSubmenu = parentLi.querySelector('.sidebar-sublink.active') !== null;

      if (hasActiveSubmenu) {
        parentLi.classList.add('active-parent');
      } else {
        parentLi.classList.remove('active-parent');
      }
    });
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



  private getPerfilAsString(perfil: any): string {
    if (!perfil) return '';
    if (typeof perfil === 'string') return perfil;
    if (typeof perfil === 'object' && perfil !== null && 'name' in perfil) {
      return perfil.name || '';
    }
    return String(perfil);
  }

  private getInitials(text: string): string {
    const initials = text
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return initials || 'US';
  }

  private formatPerfil(perfil: string): string {
    if (!perfil) return '';
    const cleaned = perfil
      .replace(/\(.*?\)/g, '')
      .replace(/[-_]/g, ' ')
      .toLowerCase();

    return cleaned
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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