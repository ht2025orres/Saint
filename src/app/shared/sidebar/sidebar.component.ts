import { Component, OnInit } from '@angular/core';
import {AuthService} from '../../services/auth.service';
import {Router} from '@angular/router';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {

  constructor(public authService: AuthService,
              private router: Router) {
  }

  ngOnInit(): void {
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
// Método para validar si el botón debe mostrarse
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
