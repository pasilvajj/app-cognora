import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class AdminGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  canActivate(): boolean {
    if (!this.auth.isAuthenticated()) {
      this.auth.logout();
      void this.router.navigate(['/login']);
      return false;
    }

    if (!this.auth.isAdmin()) {
      void this.router.navigate(['/dashboard']);
      return false;
    }

    return true;
  }
}
