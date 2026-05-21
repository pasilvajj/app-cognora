import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';
import { HTTP_SUPRIMIR_TOAST_ERRO } from '../../../shared/erro/http-suprimir-toast.context';
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
  pausarSessaoKeepAlive(
    id: number,
    estudadoTotalSeg: number,
    pomodoro?: { modo: string; restanteSeg: number; cicloIndex: number },
  ): void {
    const url = `${this.base}/estudo/sessoes/${id}/pausar`;
    const token = this.auth.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const body = JSON.stringify({
      estudadoTotalSeg,
      pomodoroModo: pomodoro?.modo ?? null,
      pomodoroRestanteSeg: pomodoro?.restanteSeg ?? null,
      pomodoroCiclo: pomodoro?.cicloIndex ?? null,
    });
    try {
      void fetch(url, {
        method: 'POST',
        keepalive: true,
        headers,
        body,
      });
    } catch {
      /* noop: página já está a descarregar */
    }
  }


  getProximaSessao(cicloId: number): Observable<ProximaSessaoDto> {
    return this.http.get<ProximaSessaoDto>(`${this.base}/estudo/sessoes/ciclos/${cicloId}/proxima`);
  }

  iniciarSessao(cicloId: number, payload?: IniciarSessaoRequest | null): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(
      `${this.base}/estudo/sessoes/ciclos/${cicloId}/sessoes/iniciar`,
      payload ?? {},
    );
  }

  comecarSessao(id: number, pomodoroAtivo: boolean): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}/${pomodoroAtivo}/comecar`, {});
  }

  getSessao(id: number): Observable<SessaoDetalheDto> {
    return this.http.get<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}`);
  }

  getSessao1(id: number): Promise<SessaoDetalheDto> {
    const context = new HttpContext().set(HTTP_SUPRIMIR_TOAST_ERRO, true);
    return firstValueFrom(
      this.http.get<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}`, { context }),
    );
  }

  pausarSessao(
    id: number,
    estudadoTotalSeg: number,
    pomodoro?: { modo: string; restanteSeg: number; cicloIndex: number },
  ): Observable<SessaoDetalheDto> {
    const payload: Record<string, unknown> = { estudadoTotalSeg };
    if (pomodoro) {
      payload['pomodoroModo'] = pomodoro.modo;
      payload['pomodoroRestanteSeg'] = pomodoro.restanteSeg;
      payload['pomodoroCiclo'] = pomodoro.cicloIndex;
    }
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}/pausar`, payload);
  }

  retomarSessao(id: number): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}/retomar`, {});
  }

  /** Persiste modo / restante / ciclo após transições locais (ex.: Pular etapa). */
  sincronizarPomodoroEstado(
    id: number,
    payload: { pomodoroModo: string; pomodoroRestanteSeg: number; pomodoroCiclo: number },
  ): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}/pomodoro`, payload);
  }

  // NOVO: salvar observações (autosave)
  atualizarObservacoes(id: number, observacoes: string): Observable<SessaoDetalheDto> {
    const payload: AtualizarObservacoesRequest = { observacoes };
    return this.http.patch<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}/observacoes`, payload);
  }

  finalizarSessao(payload: FinalizarSessaoRequest): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${payload.id}/finalizar`, payload);
  }
  getProgressoCiclo(cicloId: number): Observable<ProgressoDisciplinaDto[]> {
    return this.http.get<ProgressoDisciplinaDto[]>(
      `${this.base}/estudo/ciclos/${cicloId}/progresso`,
    );
  }
  getSessoesRecentes(cicloId: number, limit = 10): Observable<SessaoCardDto[]> {
    return this.http.get<SessaoCardDto[]>(
      `${this.base}/estudo/sessoes/recentes`,
      { params: { cicloId: String(cicloId), limit: String(limit) } },
    );
  }

}