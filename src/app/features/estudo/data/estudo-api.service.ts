import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';
import { HTTP_SUPRIMIR_TOAST_ERRO } from '../../../shared/erro/http-suprimir-toast.context';
import {
  AtualizarObservacoesRequest,
  DisciplinaHistoricoResumoDto,
  DisciplinaHistoricoSessaoDto,
  FinalizarSessaoRequest,
  IniciarSessaoRequest,
  ProgressoDisciplinaDto,
  ProgressoRecentesRodadaDto,
  ProximaSessaoDto,
  SegmentoEstudoRegistroDto,
  SessaoCardDto,
  SessaoDetalheDto,
  SessaoTopicoOpcaoDto,
  SpringDataPageDto,
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

  getTopicosSessao1(id: number): Promise<SessaoTopicoOpcaoDto[]> {
    const context = new HttpContext().set(HTTP_SUPRIMIR_TOAST_ERRO, true);
    return firstValueFrom(
      this.http.get<SessaoTopicoOpcaoDto[]>(`${this.base}/estudo/sessoes/${id}/topicos`, { context }),
    );
  }

  getSegmentoEstudo1(eventoId: number): Promise<SegmentoEstudoRegistroDto> {
    const context = new HttpContext().set(HTTP_SUPRIMIR_TOAST_ERRO, true);
    return firstValueFrom(
      this.http.get<SegmentoEstudoRegistroDto>(`${this.base}/estudo/segmentos/${eventoId}`, { context }),
    );
  }

  atualizarSegmentoEstudo1(
    eventoId: number,
    body: {
      topicoId: number;
      categoriaEstudo: string | null;
      duracaoSegundos: number;
      observacoes: string;
    },
  ): Promise<void> {
    const context = new HttpContext().set(HTTP_SUPRIMIR_TOAST_ERRO, true);
    return firstValueFrom(
      this.http.patch<void>(`${this.base}/estudo/segmentos/${eventoId}`, body, { context }),
    );
  }

  definirTopicoSessao(id: number, topicoId: number | null): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}/topico`, { topicoId });
  }

  definirCategoriaSessao(id: number, categoriaEstudo: string | null): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}/categoria`, { categoriaEstudo });
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

  /**
   * Mesmo critério que {@link getProgressoCiclo} + {@link getSessoesRecentes}, num único pedido
   * (evita duplicar cabeça da execução no servidor).
   * Usa {@code GET .../ciclos-rodada?cicloId=&limit=} para o {@code cicloId} ir sempre na query
   * (menos erros de path do que interpolar segmentos no URL).
   */
  getProgressoERecentesRodada(cicloId: number, limit = 10): Observable<ProgressoRecentesRodadaDto> {
    const id = Number(cicloId);
    if (!Number.isFinite(id) || id <= 0) {
      return throwError(() => new Error('cicloId inválido para progresso e recentes da rodada'));
    }
    const params = new HttpParams().set('cicloId', String(id)).set('limit', String(limit));
    return this.http.get<ProgressoRecentesRodadaDto>(
      `${this.base}/estudo/ciclos-rodada`,
      { params },
    );
  }

  getSessoesRecentes(cicloId: number, limit = 10): Observable<SessaoCardDto[]> {
    return this.http.get<SessaoCardDto[]>(
      `${this.base}/estudo/sessoes/recentes`,
      { params: { cicloId: String(cicloId), limit: String(limit) } },
    );
  }

  /** Tempo total e n.º de sessões da disciplina em todos os ciclos do mesmo cargo que o `cicloId`. */
  getDisciplinaHistoricoResumo(disciplinaId: number, cicloId: number): Observable<DisciplinaHistoricoResumoDto> {
    const params = new HttpParams().set('cicloId', String(cicloId));
    return this.http.get<DisciplinaHistoricoResumoDto>(
      `${this.base}/me/estudo/disciplinas/${disciplinaId}/resumo`,
      { params },
    );
  }

  getDisciplinaHistoricoSessoes(
    disciplinaId: number,
    cicloId: number,
    page = 0,
    size = 25,
  ): Observable<SpringDataPageDto<DisciplinaHistoricoSessaoDto>> {
    const params = new HttpParams()
      .set('cicloId', String(cicloId))
      .set('page', String(page))
      .set('size', String(size));
    return this.http.get<SpringDataPageDto<DisciplinaHistoricoSessaoDto>>(
      `${this.base}/me/estudo/disciplinas/${disciplinaId}/sessoes`,
      { params },
    );
  }

}