import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type LoginResponse = {
    userId: number,
    name: string,
    token: string
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';

  private readonly apiUrl = environment.authBaseUrl;

  constructor(private httpClient: HttpClient) {}

  // =========================
  // LOGIN
  // =========================
  login(email: string, password: string): Observable<LoginResponse> {
    return this.httpClient
      .post<LoginResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        tap((res) => {
          sessionStorage.setItem(this.TOKEN_KEY, res.token);
          sessionStorage.setItem(
            this.USER_KEY,
            JSON.stringify({
              id: res.userId,
              name: res.name,
            })
          );
        })
      );
  }

  signup(name: string, email: string, password: string){
    console.log(email);
    return this.httpClient.post<LoginResponse>(this.apiUrl + "/register", { name, email, password }).pipe(
      tap((value) => {
        sessionStorage.setItem(this.TOKEN_KEY, value.token);
        sessionStorage.setItem(
            this.USER_KEY,
            JSON.stringify({
              id: value.userId,
              name: value.name,
            })
          );
      })
    )
  }
 
  logout(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser();
  }

  getToken(): string | null {
    const token = sessionStorage.getItem(this.TOKEN_KEY);
    if (!token) return null;

    if (this.isTokenExpired(token)) {
      this.logout();
      return null;
    }

    return token;
  }

  getUser(): { id: number; name: string } | null {
    const raw = sessionStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeTokenPayload(token);
      const exp = Number(payload?.['exp']);
      if (!Number.isFinite(exp) || exp <= 0) return false;

      const nowInSec = Math.floor(Date.now() / 1000);
      return exp <= nowInSec;
    } catch {
      // Token inválido/ilegível: considera sessão inválida.
      return true;
    }
  }

  private decodeTokenPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const payloadBase64Url = parts[1];
    const payloadBase64 = payloadBase64Url
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payloadBase64Url.length / 4) * 4, '=');

    const json = atob(payloadBase64);
    return JSON.parse(json) as Record<string, unknown>;
  }
}