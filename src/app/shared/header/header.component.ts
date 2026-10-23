import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { User } from '../../models/User';
import { AreaCategory, ModuleItem, SubInterface, getNavigationAreas } from '../navigation-data';

export { AreaCategory, ModuleItem, SubInterface };

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
    this.areas = getNavigationAreas();
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
