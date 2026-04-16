import { Component, HostListener, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

interface MenuItem {
  label: string;
  icon?: string;
  link?: string;
  roles?: string[];
  submenu?: SubmenuItem[];
  isOpen?: boolean;
  condition?: () => boolean;
}

interface SubmenuItem {
  label: string;
  link: string;
  roles?: string[];
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
  userRole = '';
  userInitials = '';

  menuItems: MenuItem[] = [];

  hoveredSubmenu: SubmenuItem[] | null = null;
  floatPanelTop = 0;
  floatCloseTimeout: any;

  private resizeListener?: () => void;
  private sidebarToggleSubscription?: Subscription;

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
    this.buildUserSummary();
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

  private initMenuStructure(): void {
    this.menuItems = [
      {
        label: 'Inicio',
        icon: 'bi bi-speedometer2',
        link: '/dashboard'
      },
      {
        label: 'Seguimiento',
        icon: 'bi bi-kanban',
        link: '/seguimiento',
        roles: ['Administrador del sistema', 'Gestor de Proyectos']
      },
      {
        label: 'Firmas Digitales',
        icon: 'bi bi-pencil-square',
        link: '/firmas',
        roles: ['Administrador del sistema']
      },
      {
        label: 'Reporte de Fichas',
        icon: 'bi bi-file-earmark-bar-graph',
        roles: ['Administrador del sistema', 'Reporte ficha tecnica', 'Gestor reporte ficha tecnica'],
        submenu: [
          {
            label: 'Análisis por Mes',
            link: '/technical-data-sheets-report',
            roles: ['Administrador del sistema', 'Gestor reporte ficha tecnica']
          },
          {
            label: 'Dashboard',
            link: '/report-dashboard'
          },
          {
            label: 'Generar reporte',
            link: '/create-report',
            roles: ['Administrador del sistema', 'Reporte ficha tecnica'],
            condition: () => this.puedeMostrarBoton()
          },
          {
            label: 'Mis reportes',
            link: '/mi-lista-report',
            roles: ['Administrador del sistema', 'Reporte ficha tecnica']
          },
          {
            label: 'Gestión de reportes',
            link: '/list-report',
            roles: ['Administrador del sistema', 'Gestor reporte ficha tecnica']
          }
        ]
      },
      {
        label: 'Admin Usuarios',
        icon: 'bi bi-people',
        link: '/users/page/0',
        roles: ['Administrador del sistema']
      },
      {
        label: 'Fichas tecnicas',
        icon: 'bi bi-file-earmark-text',
        roles: [
          'Administrador del sistema',
          'Creacion de fichas tecnica',
          'Aprobacion ficha tecnica (primera revision)',
          'Aprobacion ficha tecnica (Segunda revision)',
          'Calidad ficha tecnica',
          'Gestor reporte ficha tecnica',
          'Reporte ficha tecnica',
          'Consulta'
        ],
        submenu: [
          {
            label: 'Crear ficha técnica',
            link: '/createTechnicalDataSheet/new/create',
            roles: ['Administrador del sistema', 'Creacion de fichas tecnica']
          },
          {
            label: 'Fichas técnicas terminadas',
            link: '/listTechnicalDataSheet/page/0/TERMINADO',
            roles: [
              'Administrador del sistema',
              'Creacion de fichas tecnica',
              'Aprobacion ficha tecnica (primera revision)',
              'Aprobacion ficha tecnica (Segunda revision)',
              'Calidad ficha tecnica',
              'Gestor reporte ficha tecnica',
              'Reporte ficha tecnica',
              'Consulta'
            ]
          },
          {
            label: 'Fichas técnicas primera revisión',
            link: '/listTechnicalDataSheet/page/0/PRIMERA REVISION',
            roles: ['Administrador del sistema', 'Aprobacion ficha tecnica (primera revision)']
          },
          {
            label: 'Fichas técnicas segunda revisión',
            link: '/listTechnicalDataSheet/page/0/SEGUNDA REVISION',
            roles: ['Administrador del sistema', 'Aprobacion ficha tecnica (Segunda revision)']
          },
          {
            label: 'Fichas técnicas en calidad',
            link: '/listTechnicalDataSheet/page/0/CALIDAD',
            roles: ['Administrador del sistema', 'Calidad ficha tecnica']
          },
          {
            label: 'Fichas técnicas en desarrollo',
            link: '/listTechnicalDataSheet/page/0/DESARROLLO',
            roles: ['Administrador del sistema', 'Creacion de fichas tecnica']
          }
        ]
      },
      {
        label: 'Inconsistencias',
        icon: 'bi bi-exclamation-triangle',
        roles: [
          'Administrador del sistema',
          'Lider Aprobador (inconsistencias)',
          'Matriz de Remplazo (inconsistencias)',
          'Calidad (inconsistencias)',
          'Contabilidad (inconsistencias)',
          'Logistica (inconsistencias)',
          'Trazo (inconsistencias)',
          'Patronista (inconsistencias)',
          'Solicitante (inconsistencias)',
          'Revision Consumo (inconsistencias)',
          'Cartera (inconsistencias)',
          'Patronaje (inconsistencias)'
        ],
        submenu: [
          {
            label: 'Mis Inconsistencias',
            link: '/mis-inconsistencias',
            roles: ['Administrador del sistema', 'Solicitante (inconsistencias)']
          },
          {
            label: 'Generar Inconsistencias',
            link: '/generar-inconsistencias',
            roles: ['Administrador del sistema', 'Solicitante (inconsistencias)']
          },
          {
            label: 'Aprobar Inconsistencias',
            link: '/aprobar-inconsistencias',
            roles: [
              'Administrador del sistema',
              'Lider Aprobador (inconsistencias)',
              'Matriz de Remplazo (inconsistencias)',
              'Calidad (inconsistencias)',
              'Contabilidad (inconsistencias)',
              'Logistica (inconsistencias)',
              'Trazo (inconsistencias)',
              'Patronista (inconsistencias)',
              'Cartera (inconsistencias)',
              'Patronaje (inconsistencias)'
            ]
          },
          {
            label: 'Histórico Inconsistencias',
            link: '/historico-inconsistencias',
            roles: [
              'Administrador del sistema',
              'Lider Aprobador (inconsistencias)',
              'Matriz de Remplazo (inconsistencias)',
              'Calidad (inconsistencias)',
              'Contabilidad (inconsistencias)',
              'Logistica (inconsistencias)',
              'Trazo (inconsistencias)',
              'Patronista (inconsistencias)',
              'Cartera (inconsistencias)',
              'Patronaje (inconsistencias)'
            ]
          },
          {
            label: 'Revisión de Consumo',
            link: '/revision-consumo',
            roles: ['Administrador del sistema', 'Revision Consumo (inconsistencias)']
          },
          {
            label: 'Reporte de Inconsistencias',
            link: '/reporte-inconsistencias',
            roles: ['Administrador del sistema', 'Calidad (inconsistencias)', 'Consulta KPIs Facturación']
          }
        ]
      },
      {
        label: 'Terminación ',
        icon: 'bi bi-box-seam',
        roles: [
          'Administrador del sistema',
          'Receptor OP (Terminación y Empaque)',
          'Distribuidor PV (Terminación y Empaque)',
          'Gestion empacadores (Terminación y Empaque)',
          'Empacador (Terminación y Empaque)',
          'Jefe (Terminación y Empaque)'
        ],
        submenu: [
          {
            label: 'Recepción de OP',
            link: '/recepcion-op',
            roles: ['Administrador del sistema', 'Receptor OP (Terminación y Empaque)']
          },
          {
            label: 'Distribución de PV',
            link: '/distribucion-pv',
            roles: ['Administrador del sistema', 'Distribuidor PV (Terminación y Empaque)', 'Distribuidor PV Directo (Terminación y Empaque)']
          },
          {
            label: 'Gestión de empacadores',
            link: '/gestion-empacadores',
            roles: ['Administrador del sistema', 'Gestion empacadores (Terminación y Empaque)']
          },
          {
            label: 'Registrar empaque',
            link: '/registrar-empaque',
            roles: ['Administrador del sistema', 'Empacador (Terminación y Empaque)']
          },
          {
            label: 'Dashboard',
            link: '/dashboard-empaque',
            roles: ['Administrador del sistema', 'Jefe (Terminación y Empaque)']
          }
        ]
      },
      {
        label: 'Renueva',
        icon: 'bi bi-truck',
        roles: ['Administrador del sistema', 'Auxiliar (renueva)', 'Operario (renueva)', 'Jefe Renueva'],
        submenu: [
          {
            label: 'Dashboard',
            link: '/dashboard-bigbag',
            roles: ['Administrador del sistema', 'Jefe Renueva', 'Auxiliar (renueva)']
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
            roles: ['Administrador del sistema', 'Operario (renueva)']
          }
        ]
      },
      {
        label: 'Inventario',
        icon: 'bi bi-boxes',
        roles: [
          'Administrador del sistema',
          'Gestor de bodega (MP001)',
          'Gestor de bodega (MP003)',
          'Gestor de bodega (BT001)',
          'Admin (inventario)'
        ],
        submenu: [
          { label: 'Gestión de Zonas', link: '/inventario/gestion-zonas' },
          { label: 'Gestión de Bodegas', link: '/inventario/gestion-bodegas' },
          { label: 'Gestión de Inventarios', link: '/inventario/gestion-inventarios' },
          { label: 'Conteo de Inventario', link: '/inventario/conteo' },
          { label: 'Histórico de Movimientos', link: '/inventario/historico-movimientos', roles: ['Administrador del sistema', 'Admin (inventario)'] },
        ]
      },
      {
        label: 'Inventario (Anterior)',
        icon: 'bi bi-archive',
        roles: [
          'Administrador del sistema',
          'Gestor de bodega (MP001)',
          'Gestor de bodega (MP003)',
          'Gestor de bodega (BT001)',
          'Admin (inventario)'
        ],
        submenu: [
          {
            label: 'Bodegas',
            link: '/inventario-old/bodegas',
            roles: ['Administrador del sistema', 'Admin (inventario)', 'Gestor de bodega (MP001)', 'Gestor de bodega (MP003)', 'Gestor de bodega (BT001)']
          },
          {
            label: 'Zonas',
            link: '/inventario-old/zonas',
            roles: ['Administrador del sistema', 'Admin (inventario)', 'Gestor de bodega (MP001)', 'Gestor de bodega (MP003)', 'Gestor de bodega (BT001)']
          },
          {
            label: 'Contadores',
            link: '/inventario-old/contadores',
            roles: ['Administrador del sistema', 'Admin (inventario)']
          },
          {
            label: 'Inventarios',
            link: '/inventario-old/inventarios',
            roles: ['Administrador del sistema', 'Admin (inventario)']
          },
          {
            label: 'Generar hoja de conteo',
            link: '/inventario-old/generar-hoja-conteo',
            roles: ['Administrador del sistema', 'Admin (inventario)']
          },
          {
            label: 'Listado de hojas de conteo',
            link: '/inventario-old/hojas-conteo-list',
            roles: ['Administrador del sistema', 'Admin (inventario)']
          },
          {
            label: 'Hojas de Conteo',
            link: '/inventario-old/contador-items',
            roles: ['Administrador del sistema', 'Admin (inventario)', 'Lider Contador (inventario)']
          }
        ]
      },
      {
        label: 'Órdenes',
        icon: 'bi bi-file-earmark-text',
        link: '/orden-compra',
        roles: ['Administrador del sistema']
      },
      {
        label: 'Tiempos Ítems',
        icon: 'bi bi-clock-history',
        link: '/tiempos-items',
        roles: ['Administrador del sistema']
      },
      {
        label: 'Planeación',
        icon: 'bi bi-calendar-check',
        link: '/planeacion',
        roles: ['Administrador del sistema']
      },
      {
        label: 'Centros de Costos',
        icon: 'bi bi-building',
        link: '/centros-costos',
        roles: ['Administrador del sistema']
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
    
    // Filtrar opciones según roles del usuario
    this.hoveredSubmenu = this.filterSubmenuByRoles(submenu);
    
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
   * Filtra las opciones del submenú según los roles del usuario
   */
  private filterSubmenuByRoles(submenu: SubmenuItem[]): SubmenuItem[] {
    return submenu.filter(item => {
      // Si no tiene roles definidos, es visible para todos
      if (!item.roles || item.roles.length === 0) {
        return true;
      }
      
      // Verificar si el usuario tiene alguno de los roles requeridos
      return this.authService.hasAnyRole(item.roles);
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
  canShowMenuItem(roles?: string[], condition?: () => boolean): boolean {
    const hasRole = !roles || roles.length === 0 || this.authService.hasAnyRole(roles);
    const hasCondition = !condition || condition();
    return hasRole && hasCondition;
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

  private buildUserSummary(): void {
    const user = this.authService.user;
    const firstName = user?.firstName ?? '';
    const lastName = user?.lastName ?? '';
    const displayName = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();
    this.userName = displayName || 'Usuario';

    const primaryRoleRaw = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles[0] : '';
    const primaryRole = this.getRoleAsString(primaryRoleRaw);
    const formattedRole = this.formatRole(primaryRole);
    this.userRole = formattedRole || 'Sin rol asignado';

    const initialsSource = displayName || formattedRole || 'Usuario';
    this.userInitials = this.getInitials(initialsSource);
  }

  private getRoleAsString(role: any): string {
    if (!role) return '';
    if (typeof role === 'string') return role;
    if (typeof role === 'object' && role !== null && 'name' in role) {
      return role.name || '';
    }
    return String(role);
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

  private formatRole(role: string): string {
    if (!role) return '';
    const cleaned = role
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