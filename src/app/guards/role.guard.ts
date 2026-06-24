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
    console.log('--- ROLE GUARD DEBUG ---');
    console.log('Backend URL:', (this.authService as any).apiLaravelUrl);
    console.log('JWT Token:', this.authService.token);
    console.log('Expected role:', role);
    console.log('User model:', this.authService.user);
    console.log('User roles (raw):', this.authService.user?.roles);
    console.log('Normalized user roles:', Array.from((this.authService as any).getNormalizedUserRoles()));
    console.log('Has role result:', this.authService.hasRole(role));
    console.log('------------------------');

    if (this.authService.hasRole(role)) {
      return true;
    }
    const firstName = this.authService.user?.firstName ?? '';
    const lastName = this.authService.user?.lastName ?? '';
    Swal.fire('Acceso denegado', `Hola ${firstName} ${lastName} no tienes permisos suficientes, para acceder al modulo requerido`, 'warning');
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
