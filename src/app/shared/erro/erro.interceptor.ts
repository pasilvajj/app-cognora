import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { HTTP_SUPRIMIR_TOAST_ERRO } from './http-suprimir-toast.context';
import { extrairMensagemErroHttp } from './extrair-mensagem-erro-http';

function isAuthPublicEndpoint(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/register');
}

export const erroInterceptor: HttpInterceptorFn = (req, next) => {
  const toastr = inject(ToastrService);
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const suprimirToast = req.context.get(HTTP_SUPRIMIR_TOAST_ERRO);
      const authPublico = isAuthPublicEndpoint(req.url);

      if (error.status === 401 && !authPublico) {
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

      if (suprimirToast) {
        return throwError(() => error);
      }

      const mensagemApi = extrairMensagemErroHttp(error);
      let mensagem = mensagemApi ?? 'Ocorreu um erro inesperado';

      if (error.status === 403) {
        mensagem = mensagemApi ?? 'Você não tem permissão para esta ação.';
      } else if (error.status === 0) {
        console.error('[HTTP 0]', error.message, error.url ?? '(sem URL)');
        mensagem =
          mensagemApi ??
          'Sem resposta da API. Confirme que o backend está rodando (porta 8080) e o proxy do Angular.';
      } else if (error.status >= 500) {
        mensagem =
          mensagemApi ??
          'Erro no servidor. Tente novamente em instantes ou contate o suporte.';
      }

      toastr.error(mensagem);
      return throwError(() => error);
    })
  );
};
