import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CurrentUserService {

  constructor(private auth: AuthService) {}

  get id(): number | null {
    return this.auth.getUser()?.id ?? null;
  }

  get name(): string | null {
    return this.auth.getUser()?.name ?? null;
  }

  get isLogged(): boolean {
    return this.auth.isAuthenticated();
  }
}