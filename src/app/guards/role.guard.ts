import { Role } from './../models/Role';
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard  {
  constructor(public authService: AuthService,
    private router: Router) {
  }

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> | Promise<boolean> | boolean {

    if (this.authService.isAuthenticated()) {
      if (this.isTokenExpired()) {
        this.authService.logout();
        this.router.navigate(['/login']);
        return false;
      }
    }

    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return false;
    }

    let role = next.data['role'];
    if (this.authService.hasRole(role)) {
      return true;
    }
    Swal.fire('Acceso denegado', `Hola ${this.authService.user.firstName} ${this.authService.user.lastName} no tienes permisos suficientes, para acceder al modulo requerido`, 'warning');
    this.router.navigate(['/dashboard']);
    return false;
  }

  isTokenExpired(): boolean {
    /* Obtiene el token de la sesion getToken */
    const token = this.authService.token;
    /* Obtiene los datos del token */
    const payload = this.authService.getTokenData(token);
    /* Obtiene la fecha actual en milisegundos y la convierte a segundos diviendo entre 1000 */
    const actualDate = new Date().getTime() / 1000;
    /* Valida el tiempo de expiracion de token contra la fecha ctual */
    return payload.exp < actualDate;
  }

}
