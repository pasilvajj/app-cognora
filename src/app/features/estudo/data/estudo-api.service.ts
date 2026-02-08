import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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

  constructor() { }


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