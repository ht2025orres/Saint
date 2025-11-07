import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap } from 'rxjs/operators';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(public authServices: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authServices.token;
    let authReq = req;

    if (token != null) {
      authReq = req.clone({
        headers: req.headers.set('Authorization', 'Bearer ' + token)
      });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Si el token expiró, intentar refrescar
        if (error.status === 401 && this.authServices.refreshToken) {
          return this.authServices.refreshAccessToken().pipe(
            switchMap((newToken: string) => {
              const newAuthReq = req.clone({
                headers: req.headers.set('Authorization', 'Bearer ' + newToken)
              });
              return next.handle(newAuthReq);
            }),
            catchError(err => {
              this.authServices.logout();
              return throwError(() => err);
            })
          );
        }
        return throwError(() => error);
      })
    );
  }
}
