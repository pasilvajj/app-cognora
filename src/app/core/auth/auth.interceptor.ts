import { HttpInterceptorFn } from '@angular/common/http';


export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const token = sessionStorage.getItem('auth_token');

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req);
};