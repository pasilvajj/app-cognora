import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';
import {
  AtualizarObservacoesRequest,
  FinalizarSessaoRequest,
  IniciarSessaoRequest,
  ProgressoDisciplinaDto,
  ProximaSessaoDto,
  SessaoCardDto,
  SessaoDetalheDto
} from './estudo.models';

@Injectable({ providedIn: 'root' })
export class EstudoApiService {

  private readonly base = environment.apiBaseUrl;
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  constructor() { }

  /**
   * Pausa via {@link fetch} com {@code keepalive: true} para o pedido ter mais chance de completar
   * ao fechar a aba/navegador (o HttpClient costuma ser cancelado antes de enviar).
   */
  pausarSessaoKeepAlive(id: number, estudadoTotalSeg: number): void {
    const url = `${this.base}/estudo/sessoes/${id}/${estudadoTotalSeg}/pausar`;
    const token = this.auth.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    try {
      void fetch(url, {
        method: 'POST',
        keepalive: true,
        headers,
        body: '{}',
      });
    } catch {
      /* noop: página já está a descarregar */
    }
  }


  getProximaSessao(cicloId: number): Observable<ProximaSessaoDto> {
    return this.http.get<ProximaSessaoDto>(`${this.base}/estudo/sessoes/ciclos/${cicloId}/proxima`);
  }
  iniciarSessao(payload: IniciarSessaoRequest): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/iniciar`, payload);
  }

  comecarSessao(id: number, pomodoroAtivo: boolean): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}/${pomodoroAtivo}/comecar`, {});
  }

  getSessao(id: number): Observable<SessaoDetalheDto> {
    return this.http.get<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}`);
  }

  getSessao1(id: number): Promise<SessaoDetalheDto> {
    return firstValueFrom(this.http.get<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}`));
  }

  pausarSessao(id: number, decorridoMs: number): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}/${decorridoMs}/pausar`, {});
  }

  retomarSessao(id: number): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}/retomar`, {});
  }

  // NOVO: salvar observações (autosave)
  atualizarObservacoes(id: number, observacoes: string): Observable<SessaoDetalheDto> {
    const payload: AtualizarObservacoesRequest = { observacoes };
    return this.http.patch<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}/observacoes`, payload);
  }

  finalizarSessao(payload: FinalizarSessaoRequest): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${payload.id}/finalizar`, payload);
  }
  getProgressoCiclo(cicloId: number, usuarioId: number): Observable<ProgressoDisciplinaDto[]> {
    return this.http.get<ProgressoDisciplinaDto[]>(
      `${this.base}/estudo/ciclos/${cicloId}/progresso?usuarioId=${usuarioId}`
    );
  }
  getSessoesRecentes(usuarioId: number, cicloId: number, limit = 10): Observable<SessaoCardDto[]> {
    return this.http.get<SessaoCardDto[]>(
      `${this.base}/estudo/sessoes/recentes?usuarioId=${usuarioId}&cicloId=${cicloId}&limit=${limit}`
    );
  }

}