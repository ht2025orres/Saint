import { Component, HostListener, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

interface SubmenuItem {
  label: string;
  link: string;
  roles?: string[]; // Roles permitidos para esta opción
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
   * Verifica si una opción debe mostrarse según roles
   */
  canShowMenuItem(roles?: string[]): boolean {
    if (!roles || roles.length === 0) return true;
    return this.authService.hasAnyRole(roles);
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