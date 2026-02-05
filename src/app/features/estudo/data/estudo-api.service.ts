import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ProximaSessaoDto {
  cicloId: number;
  cicloNome: string;
  cicloItemId: number;
  ordem: number;
  disciplinaId: number;
  disciplinaNome: string;
  tempoMinutos: number;
}

export interface IniciarSessaoRequest {
  usuarioId: number;
  cicloId: number;
  cicloItemId: number;
}

export interface FinalizarSessaoRequest {
  id: number,
  concluido: boolean;
  observacoes?: string;
}

export interface SessaoDetalheDto {
  id: number;
  cicloId: number;
  cicloNome: string;
  cicloItemId: number;
  ordem: number;
  disciplinaId: number;
  disciplinaNome: string;
  tempoMinutos: number;

  inicio: string;
  fim: string | null;
  pausadoEm: string | null;
  pausadoTotalSeg: number;

  concluido: boolean | null;
  observacoes: string | null;

  // total estudado persistido (segundos)
  estudadoTotalSeg: number;

  // === Pomodoro (vem do ciclo) ===
  pomodoroAtivo: boolean;
  pomodoroFocoMin: number;
  pomodoroPausaCurtaMin: number;
  pomodoroPausaLongaMin: number;
  pomodoroLongaACada: number;
}

export interface ProgressoDisciplinaDto {
  disciplinaId: number;
  disciplinaNome: string;
  minutosFeitos: number;
  minutosMeta: number;
  percentual: number;
}

export interface SessaoResumoDto {
  id: number;
  disciplinaNome: string;
  inicio: string;
  fim: string;
  concluido: boolean;
  minutosEfetivos: number;
}

export interface SessaoCardDto {
  id: number;
  disciplinaNome: string;
  metaMinutos: number;
  inicio: string;
  fim: string | null;
  pausadoEm: string | null;
  pausadoTotalSeg: number;
  segundosEstudados: number;
  segundosRestantes: number;
  status: 'EM_ANDAMENTO' | 'PAUSADA' | 'CONCLUIDA';
  estudadoTotalSeg: number;
}

// PATCH observações
export interface AtualizarObservacoesRequest {
  observacoes: string;
}

@Injectable({ providedIn: 'root' })
export class EstudoApiService {

   private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // =========================
  // PRÓXIMA SESSÃO (ciclo)
  // GET /api/estudo/ciclos/{cicloId}/proxima
  // =========================

  getProximaSessao(cicloId: number): Observable<ProximaSessaoDto> {
    return this.http.get<ProximaSessaoDto>(`${this.base}/estudo/sessoes/ciclos/${cicloId}/proxima`);
  }

  iniciarSessao(payload: IniciarSessaoRequest): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/iniciar`, payload);
  }

  comecarSessao(id: number): Observable<SessaoDetalheDto> {
    return this.http.post<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}/comecar`, {});
  }
  
  getSessao(id: number): Observable<SessaoDetalheDto> {
    return this.http.get<SessaoDetalheDto>(`${this.base}/estudo/sessoes/${id}`);
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