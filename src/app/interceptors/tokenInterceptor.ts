import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap } from 'rxjs/operators';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(private authServices: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    const token = this.authServices.token;
    const email = this.authServices.user?.email ?? null;

    // Headers finales que enviaremos
    let finalHeaders: any = {};

    // Siempre enviamos Authorization si existe token
    if (token) {
      finalHeaders['Authorization'] = 'Bearer ' + token;
    }

    // Verificar si esta petición requiere el email
    const requiresEmail = req.headers.get('X-Requires-User-Email') === 'true';

    if (requiresEmail && email) {
      finalHeaders['X-User-Email'] = email;
    }

    // Eliminamos el flag antes de enviar la request real
    const cleanedReq = req.clone({
      headers: req.headers.delete('X-Requires-User-Email'),
      setHeaders: finalHeaders
    });

    return next.handle(cleanedReq).pipe(
      catchError((error: HttpErrorResponse) => {

        // Manejo de refresh token si expiró
        if (error.status === 401 && this.authServices.refreshToken) {
          return this.authServices.refreshAccessToken().pipe(
            switchMap((newToken: string) => {

              const newHeaders: any = { 'Authorization': 'Bearer ' + newToken };

              if (requiresEmail && email) {
                newHeaders['X-User-Email'] = email;
              }

              const retryReq = req.clone({
                headers: req.headers.delete('X-Requires-User-Email'),
                setHeaders: newHeaders
              });

              return next.handle(retryReq);
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
