import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { Subscription } from 'rxjs';
import { User } from '../../models/User';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMobile = false;
  userName = '';
  userInitials = '';
  userPerfil = '';

  private userSubscription?: Subscription;

  constructor(
    public authService: AuthService,
    private router: Router,
    private sidebarService: SidebarService
  ) {
    this.checkMobile();
  }

  ngOnInit(): void {
    this.checkMobile();
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.updateUserInfo(user);
    });
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkMobile();
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth < 768;
  }

  private updateUserInfo(user: User | null): void {
    if (user) {
      this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      this.userInitials = (
        (user.firstName ? user.firstName.charAt(0) : '') +
        (user.lastName ? user.lastName.charAt(0) : '')
      ).toUpperCase();
      this.userPerfil = user.roles && user.roles.length > 0 ? user.roles[0].name : '';
    } else {
      this.userName = '';
      this.userInitials = '';
      this.userPerfil = '';
    }
  }

  toggleSidebar(): void {
    this.sidebarService.toggle();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
