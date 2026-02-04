import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

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

  private readonly apiUrl = 'http://localhost:8080/auth';

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
    sessionStorage.clear(); // 🔥 limpa tudo de uma vez
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  getUser(): { id: number; name: string } | null {
    const raw = sessionStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}