import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';

import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

/** Pass untouched request through to the next request handler. */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(public authService: AuthService,
    private router: Router) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler):
    Observable<HttpEvent<any>> {
    let authReq = req;
    const token = this.authService.token;

    // Si ya existe un header de Authorization (ej. Basic para login/refresh), no lo sobreescribimos
    if (token != null && !req.headers.has('Authorization')) {
      authReq = this.addTokenHeader(req, token);
    }

    return next.handle(authReq).pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          // Si el error es en el endpoint de autenticación, cerramos sesión y no reintentamos
          if (req.url.includes('/oauth/token')) {
            this.authService.logout();
            this.router.navigate(['/login']);
            return throwError(() => error);
          }
          return this.handle401Error(authReq, next);
        }

        if (error.status === 403) {
          Swal.fire('Error de permiso', 'Acceso denegado', 'warning');
          this.router.navigate(['/dashboard']);
        }

        if (error.status === 429) {
          const retryAfter = error.error?.retry_after || 'unos segundos';
          Swal.fire({
            icon: 'error',
            title: 'Límite de peticiones excedido',
            text: `Has enviado demasiadas peticiones. Por favor, intenta de nuevo en ${retryAfter} segundos.`,
            confirmButtonText: 'Entendido'
          });
        }

        return throwError(() => error);
      })
    );
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler) {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const refreshToken = this.authService.refreshTokenValue;

      if (refreshToken) {
        return this.authService.refreshToken().pipe(
          switchMap((token: any) => {
            this.isRefreshing = false;
            this.refreshTokenSubject.next(token.access_token);
            return next.handle(this.addTokenHeader(request, token.access_token));
          }),
          catchError((err) => {
            this.isRefreshing = false;
            this.authService.logout();
            this.router.navigate(['/login']);
            // Notificar a las peticiones en cola que el refresco falló
            this.refreshTokenSubject.error(err);
            // Reiniciar el subject para futuros intentos
            this.refreshTokenSubject = new BehaviorSubject<any>(null);
            return throwError(() => err);
          })
        );
      } else {
        this.isRefreshing = false;
        this.authService.logout();
        this.router.navigate(['/login']);
        return throwError(() => new Error('No refresh token available'));
      }
    }

    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap((token) => next.handle(this.addTokenHeader(request, token)))
    );
  }

  private addTokenHeader(request: HttpRequest<any>, token: string) {
    return request.clone({
      headers: request.headers.set('Authorization', 'Bearer ' + token)
    });
  }
}
