import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard  {
  constructor(public authService: AuthService,
    private router: Router) {

  }

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    /* Validamos que el pages este autenticado */
    if (this.authService.isAuthenticated()) {
      if (this.isTokenExpired()) {
        this.authService.logout();
        this.router.navigate(['/login']);
        return false;
      }
      return true;
    }
    this.router.navigate(['/login']);
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
