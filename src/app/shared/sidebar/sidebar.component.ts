import { Component, HostListener } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  isCollapsed = false;

  constructor(
    public authService: AuthService,
    private router: Router
  ) {
    // Cargar estado guardado
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved) {
      this.isCollapsed = JSON.parse(saved);
      this.updateBodyClass();
    }
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    this.updateBodyClass();
    localStorage.setItem('sidebarCollapsed', JSON.stringify(this.isCollapsed));
  }

  private updateBodyClass(): void {
    const body = document.body;
    if (this.isCollapsed) {
      body.classList.add('mini-sidebar');
    } else {
      body.classList.remove('mini-sidebar');
    }
  }

  // Opcional: Cerrar sidebar en móvil al hacer clic en un link
  @HostListener('click', ['$event'])
  onMobileClick(event: Event): void {
    if (window.innerWidth < 768) {
      const target = event.target as HTMLElement;
      if (target.closest('a') && target.closest('a').getAttribute('routerLink')) {
        this.toggleSidebar();
      }
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  puedeMostrarBoton(): boolean {
    const ahora = new Date();
    const diaSemana = ahora.getDay(); // 0: domingo, 1: lunes, ..., 6: sábado
    const hora = ahora.getHours();
    const minutos = ahora.getMinutes();

    // Lunes a Viernes (1-5)
    if (diaSemana >= 1 && diaSemana <= 5) {
      return (hora > 7 || (hora === 7 && minutos >= 0)) && (hora < 16); // 7 AM a 4 PM
    }

    // Sábado (6)
    if (diaSemana === 6) {
      return (hora > 7 || (hora === 7 && minutos >= 0)) && (hora < 12); // 7 AM a 12 PM
    }

    // Fuera de horario laboral (domingo o fuera de horas)
    return false;
  }
}