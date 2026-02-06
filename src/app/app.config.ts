import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient,withInterceptors } from '@angular/common/http';
import { AuthInterceptor } from './core/auth/auth.interceptor';
import { provideToastr } from 'ngx-toastr';
import { erroInterceptor } from './shared/erro/erro.interceptor';
// import { provideAnimations } from '@angular/platform-browser/animations'

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // provideAnimations(),
    provideToastr(),
   provideHttpClient(
      withInterceptors([AuthInterceptor,erroInterceptor])
    ),
  ]
};



