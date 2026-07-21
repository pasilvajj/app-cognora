import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';
import { HTTP_SUPRIMIR_TOAST_ERRO } from '../../../shared/erro/http-suprimir-toast.context';
import {
  AtualizarObservacoesRequest,
  ComecarSessaoRequest,
  DisciplinaHistoricoResumoDto,
  DisciplinaHistoricoSessaoDto,
  FinalizarSessaoRequest,
  IniciarSessaoRequest,
  EstudarAgoraCargaDto,
  ProgressoDisciplinaDto,
  SegmentoEstudoRegistroDto,
  SessaoCargaDto,
  SessaoDetalheDto,
  SessaoMetaEstudoRequest,
  SessaoReservaDto,
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
    const url = `${this.base}/v1/sessoes/${id}/pausa`;
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


  /** Carga única: matérias + próxima + progresso + recentes (com observações). */
  getEstudarAgoraCarga(cicloId: number): Observable<EstudarAgoraCargaDto> {
    const params = new HttpParams().set('cicloId', String(cicloId));
    return this.http.get<EstudarAgoraCargaDto>(`${this.base}/v1/estudos/estudar-agora`, { params });
  }

  iniciarSessao(cicloId: number, payload?: IniciarSessaoRequest | null): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(
      `${this.base}/v1/ciclos/${cicloId}/sessoes`,
      payload ?? {},
    );
  }

  iniciarSessaoDisciplina(cicloId: number, disciplinaId: number): Observable<SessaoReservaDto> {
    return this.http.post<SessaoReservaDto>(
      `${this.base}/v1/ciclos/${cicloId}/disciplinas/${disciplinaId}/sessoes`,
      {},
    );
  }

  comecarSessao(
    id: number,
    pomodoroAtivo: boolean,
    meta?: SessaoMetaEstudoRequest | null,
  ): Observable<SessaoDetalheDto> {
    const payload: ComecarSessaoRequest = { pomodoroAtivo, ...(meta ?? {}) };
    return this.http.post<SessaoDetalheDto>(
      `${this.base}/v1/sessoes/${id}/inicio`,
      payload,
    );
  }

  getSessao(id: number): Observable<SessaoDetalheDto> {
    return this.http.get<SessaoDetalheDto>(`${this.base}/v1/sessoes/${id}`);
  }

  getSessao1(id: number): Promise<SessaoDetalheDto> {
    const context = new HttpContext().set(HTTP_SUPRIMIR_TOAST_ERRO, true);
    return firstValueFrom(
      this.http.get<SessaoDetalheDto>(`${this.base}/v1/sessoes/${id}`, { context }),
    );
  }

  /** Carga única: detalhe da sessão + tópicos do edital. */
  getSessaoCarga1(id: number): Promise<SessaoCargaDto> {
    const context = new HttpContext().set(HTTP_SUPRIMIR_TOAST_ERRO, true);
    return firstValueFrom(
      this.http.get<SessaoCargaDto>(`${this.base}/v1/sessoes/${id}/carga`, { context }),
    );
  }

  getTopicosSessao1(id: number): Promise<SessaoTopicoOpcaoDto[]> {
    const context = new HttpContext().set(HTTP_SUPRIMIR_TOAST_ERRO, true);
    return firstValueFrom(
      this.http.get<SessaoTopicoOpcaoDto[]>(`${this.base}/v1/sessoes/${id}/topicos`, { context }),
    );
  }

  getSegmentoEstudo1(eventoId: number): Promise<SegmentoEstudoRegistroDto> {
    const context = new HttpContext().set(HTTP_SUPRIMIR_TOAST_ERRO, true);
    return firstValueFrom(
      this.http.get<SegmentoEstudoRegistroDto>(`${this.base}/v1/segmentos/${eventoId}`, { context }),
    );
  }

  atualizarSegmentoEstudo1(
    eventoId: number,
    body: {
      topicoId: number | null;
      categoriaEstudo: string | null;
      duracaoSegundos: number;
      observacoes: string;
    },
  ): Promise<void> {
    const context = new HttpContext().set(HTTP_SUPRIMIR_TOAST_ERRO, true);
    return firstValueFrom(
      this.http.patch<void>(`${this.base}/v1/segmentos/${eventoId}`, body, { context }),
    );
  }

  definirTopicoSessao(id: number, topicoId: number | null): Observable<SessaoDetalheDto> {
    return this.http.put<SessaoDetalheDto>(`${this.base}/v1/sessoes/${id}/topico`, { topicoId });
  }

  definirCategoriaSessao(id: number, categoriaEstudo: string | null): Observable<SessaoDetalheDto> {
    return this.http.put<SessaoDetalheDto>(`${this.base}/v1/sessoes/${id}/categoria`, { categoriaEstudo });
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
    return this.http.post<SessaoDetalheDto>(`${this.base}/v1/sessoes/${id}/pausa`, payload);
  }

  retomarSessao(id: number, meta?: SessaoMetaEstudoRequest | null): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/v1/sessoes/${id}/retomada`, meta ?? {});
  }

  /** Persiste modo / restante / ciclo após transições locais (ex.: Pular etapa). */
  sincronizarPomodoroEstado(
    id: number,
    payload: { pomodoroModo: string; pomodoroRestanteSeg: number; pomodoroCiclo: number },
  ): Observable<SessaoDetalheDto> {
    return this.http.put<SessaoDetalheDto>(`${this.base}/v1/sessoes/${id}/pomodoro`, payload);
  }

  // NOVO: salvar observações (autosave)
  atualizarObservacoes(id: number, observacoes: string): Observable<SessaoDetalheDto> {
    const payload: AtualizarObservacoesRequest = { observacoes };
    return this.http.patch<SessaoDetalheDto>(`${this.base}/v1/sessoes/${id}/observacoes`, payload);
  }

  finalizarSessao(payload: FinalizarSessaoRequest): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/v1/sessoes/${payload.id}/fim`, payload);
  }
  getProgressoCiclo(cicloId: number): Observable<ProgressoDisciplinaDto[]> {
    return this.http.get<ProgressoDisciplinaDto[]>(
      `${this.base}/v1/estudos/ciclos/${cicloId}/progresso`,
    );
  }

  /** Tempo total e n.º de sessões da disciplina em todos os ciclos do mesmo cargo que o `cicloId`. */
  getDisciplinaHistoricoResumo(disciplinaId: number, cicloId: number): Observable<DisciplinaHistoricoResumoDto> {
    const params = new HttpParams().set('cicloId', String(cicloId));
    return this.http.get<DisciplinaHistoricoResumoDto>(
      `${this.base}/v1/me/estudos/disciplinas/${disciplinaId}/resumo`,
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
      `${this.base}/v1/me/estudos/disciplinas/${disciplinaId}/sessoes`,
      { params },
    );
  }

}
