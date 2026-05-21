import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { HTTP_SUPRIMIR_TOAST_ERRO } from './http-suprimir-toast.context';

export const erroInterceptor: HttpInterceptorFn = (req, next) => {
  const toastr = inject(ToastrService);
  const router = inject(Router);
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const suprimirToast = req.context.get(HTTP_SUPRIMIR_TOAST_ERRO);

      if (error.status === 401) {
        const mensagem = 'Sessão expirada. Faça login novamente.';
        auth.logout();
        if (!router.url.startsWith('/login')) {
          router.navigate(['/login']);
        }
        if (!suprimirToast) {
          toastr.error(mensagem);
        }
        return throwError(() => error);
      }

      const ignorarToastGenerico =
        suprimirToast && (error.status === 404 || error.status === 403);

      if (ignorarToastGenerico) {
        return throwError(() => error);
      }

      let mensagem = 'Ocorreu um erro inesperado';

      if (error.status === 403) {
        mensagem = 'Você não tem permissão para esta ação.';
      } else if (error.status === 0) {
        console.error('[HTTP 0]', error.message, error.url ?? '(sem URL)');
        mensagem =
          'Sem resposta da API. Se usa `ng serve`, confirme o proxy (proxy.conf.json) e que o Spring está em :8080. Veja o URL no console.';
      }
      toastr.error(mensagem);
      return throwError(() => error);
    })
  );
};