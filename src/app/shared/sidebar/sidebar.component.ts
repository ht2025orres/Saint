import { Component, HostListener, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { User } from '../../models/User';
import { AreaCategory, ModuleItem, SubInterface, getNavigationAreas } from '../navigation-data';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, AfterViewInit, OnDestroy {
  isCollapsed = false;
  isMobileOpen = false;
  isMobile = true;
  userName = '';
  userPerfil = '';
  userInitials = '';
  currentUser: User | null = null;

  areas: AreaCategory[] = [];

  private resizeListener?: () => void;
  private sidebarToggleSubscription?: Subscription;
  private userSubscription?: Subscription;
  private routerSubscription?: Subscription;

  constructor(
    public authService: AuthService,
    private router: Router,
    private sidebarService: SidebarService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2
  ) {
    this.checkMobile();
  }

  ngOnInit(): void {
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.currentUser = user;
      this.updateUserSummary(user);
      this.initAreas();
      this.cdr.detectChanges();
    });

    this.setupResizeListener();
    this.initAreas();

    this.sidebarToggleSubscription = this.sidebarService.toggle$.subscribe(() => {
      this.toggleSidebar();
    });

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.closeMobileSidebar();
      });
  }

  private updateUserSummary(user: User | null): void {
    if (user) {
      this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Usuario';
      this.userPerfil = user.roles && user.roles.length > 0 ? user.roles[0].name : '';
      this.userInitials = (
        (user.firstName ? user.firstName.charAt(0) : '') +
        (user.lastName ? user.lastName.charAt(0) : '')
      ).toUpperCase() || 'US';
    } else {
      this.userName = '';
      this.userPerfil = '';
      this.userInitials = 'US';
    }
  }

  private initAreas(): void {
    this.areas = getNavigationAreas();
    this.autoExpandActiveArea();
  }

  autoExpandActiveArea(): void {
    const currentUrl = this.router.url;
    for (const area of this.areas) {
      for (const mod of area.modules) {
        if (mod.link === currentUrl || mod.subInterfaces?.some(s => s.link === currentUrl)) {
          area.isOpen = true;
          mod.isOpen = true;
          return;
        }
      }
    }
  }

  toggleArea(area: AreaCategory): void {
    area.isOpen = !area.isOpen;
  }

  toggleModule(mod: ModuleItem): void {
    mod.isOpen = !mod.isOpen;
  }

  /* ─── Visibility helpers (consistentes con Headbar) ─── */
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

    if (!mod.subInterfaces || mod.subInterfaces.length === 0) {
      return !mod.condition || mod.condition();
    }

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

  ngAfterViewInit(): void {
    this.updateBodyClass();
    this.cdr.detectChanges();
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
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  private setupResizeListener(): void {
    this.resizeListener = () => {
      this.checkMobile();
    };
    window.addEventListener('resize', this.resizeListener);
  }

  private checkMobile(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < 992;

    if (wasMobile && !this.isMobile) {
      this.isMobileOpen = false;
      this.updateBodyClass();
    }
  }

  toggleSidebar(): void {
    this.isMobileOpen = !this.isMobileOpen;
    this.updateBodyClass();
  }

  closeMobileSidebar(): void {
    if (this.isMobileOpen) {
      this.isMobileOpen = false;
      this.updateBodyClass();
    }
  }

  private updateBodyClass(): void {
    const body = document.body;
    if (this.isMobileOpen) {
      this.renderer.addClass(body, 'sidebar-mobile-open');
    } else {
      this.renderer.removeClass(body, 'sidebar-mobile-open');
    }
  }

  logout(): void {
    this.closeMobileSidebar();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}