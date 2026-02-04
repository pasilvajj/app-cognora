import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * DTO retornado pelo backend
 * Ajuste os campos se necessário
 */
export interface UserProfileDto {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

/**
 * Payload para atualizar dados do perfil
 */
export interface UpdateProfilePayload {
  name: string;
  email?: string;
}

/**
 * Payload para troca de senha
 */
export interface UpdatePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {

  private readonly apiUrl = 'http://localhost:8080/api/profile';

  constructor(private http: HttpClient) {}

  /**
   * 🔹 Buscar dados do perfil do usuário logado
   * Backend identifica o usuário pelo JWT
   */
  getProfile(): Observable<UserProfileDto> {
    return this.http.get<UserProfileDto>(this.apiUrl+ '/me');
  }

  /**
   * 🔹 Atualizar dados básicos do perfil
   */
  updateProfile(payload: UpdateProfilePayload): Observable<void> {
    return this.http.put<void>(this.apiUrl+'/me', payload);
  }

  /**
   * 🔹 Atualizar senha
   */
  updatePassword(payload: UpdatePasswordPayload): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/me/password`, payload);
  }

  /**
   * 🔹 (Futuro) Upload de avatar
   */
  uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{ avatarUrl: string }>(
      `${this.apiUrl}/avatar`,
      formData
    );
  }
}