import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError, timeout } from 'rxjs';

const API_TIMEOUT_MS = 25_000;

export const apiTimeoutInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api')) {
    return next(req);
  }

  return next(req).pipe(
    timeout(API_TIMEOUT_MS),
    catchError((err: unknown) => {
      const isTimeout =
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.message.includes('Timeout'));

      if (isTimeout) {
        return throwError(
          () =>
            new HttpErrorResponse({
              error: {
                message:
                  'A API demorou demais para responder. Verifique se o backend no EC2 está ativo (porta 8080).',
              },
              status: 0,
              statusText: 'Timeout',
              url: req.url,
            }),
        );
      }
      return throwError(() => err);
    }),
  );
};
