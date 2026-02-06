import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

export const erroInterceptor: HttpInterceptorFn = (req, next) => {
     const toastr = inject(ToastrService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let mensagem = 'Ocorreu um erro inesperado';

      if (error.status === 401) {
        mensagem = 'Sessão expirada. Faça login novamente.';
        // Aqui você poderia redirecionar para /login
      } else if (error.status === 403) {
        mensagem = 'Você não tem permissão para esta ação.';
      } else if (error.status === 0) {
        mensagem = 'Não foi possível conectar ao servidor.';
      }
      toastr.error(mensagem);
      return throwError(() => error);
    })
  );
};