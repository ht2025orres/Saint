import {Component, OnInit, HostListener} from '@angular/core';
import {AuthService} from '../../services/auth.service';
import {Router} from '@angular/router';
import {SidebarService} from '../../services/sidebar.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  isMobile = false;

  constructor(public authService: AuthService,
              private router: Router,
              private sidebarService: SidebarService) {
    // Mobile-first: verificar tamaño de pantalla inmediatamente
    this.checkMobile();
  }

  ngOnInit(): void {
    // Verificar nuevamente después de que el componente esté inicializado
    this.checkMobile();
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.checkMobile();
  }

  private checkMobile(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < 768;
    
    // Forzar detección de cambio para Angular
    if (wasMobile !== this.isMobile) {
      // Trigger change detection
      setTimeout(() => {
        // Esto ayuda a que Angular detecte el cambio
      }, 0);
    }
  }

  toggleSidebar(): void {
    this.sidebarService.toggle();
  }

}
