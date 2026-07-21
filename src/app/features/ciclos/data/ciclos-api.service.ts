import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  CargoDto,
  CicloCreateRequest,
  CicloCriadoDto,
  CicloDto,
  CicloEditResponseDto,
  CicloUpdateRequest,
  ConcursoDto,
  DisciplinaDto,
} from './ciclos.models';

export type CicloMateriaDto = {
  cicloItemId: number;
  disciplinaId?: number;
  ordem: number;
  disciplinaNome: string;
  tempoMinutos: number;
  visto: boolean;
  sessaoAbertaId: number | null;
  concluida: boolean;
  /** true após comecar() na sessão (cronómetro); só iniciar() reserva sessão sem isto. */
  cronometroIniciado: boolean;
  estudoLivre?: boolean;
};

/** Resposta de GET /v1/ciclos/:id/materias */
export type CicloMateriasComEstadoDto = {
  materias: CicloMateriaDto[];
  aguardandoNovaRodada: boolean;
  ultimaRodadaConcluidaNumero: number | null;
  rodadaAtualNumero: number | null;
  /**
   * Sessões finalizadas com meta cumprida na rodada considerada (pode ser maior que
   * o número de posições verdes quando há várias sessões para a mesma posição).
   */
  sessoesConcluidasNaRodada?: number | null;
};

export type NovaRodadaDto = {
  execucaoId: number;
  numeroRodada: number;
};

@Injectable({ providedIn: 'root' })
export class CiclosApiService {
  private readonly base = environment.apiBaseUrl;
  private readonly ciclosV1Base = `${environment.apiBaseUrl}/v1/ciclos`;

  constructor(private http: HttpClient) { }

  /**
   * @param escopo `NACIONAL` | `ESTADUAL` — filtra concursos por região (backend).
   * @param uf Sigla de 2 letras, obrigatória quando escopo é estadual.
   */
  listConcursos(escopo?: 'NACIONAL' | 'ESTADUAL', uf?: string): Observable<ConcursoDto[]> {
    let params = new HttpParams();
    if (escopo) {
      params = params.set('escopo', escopo);
    }
    if (uf) {
      params = params.set('uf', uf);
    }
    return this.http.get<ConcursoDto[]>(`${this.base}/v1/concursos`, { params });
  }

  // escolha UM: por concursoId ou por editalId (ou ambos)
  listDisciplinasByCargo(cargoId: number): Observable<DisciplinaDto[]> {
    return this.http.get<DisciplinaDto[]>(`${this.base}/v1/cargos/${cargoId}/disciplinas`);
  }

  detalharCicloParaEdicao(idCiclo: number): Observable<CicloEditResponseDto> {
    return this.http.get<CicloEditResponseDto>(`${this.ciclosV1Base}/${idCiclo}/configuracao`);
  }

  listCargosByConcurso(concursoId: number): Observable<CargoDto[]> {
    return this.http.get<CargoDto[]>(`${this.base}/v1/concursos/${concursoId}/cargos`);
  }

  saveCiclo(payload: CicloCreateRequest): Observable<CicloCriadoDto> {
    return this.http.post<CicloCriadoDto>(this.ciclosV1Base, payload);
  }

  /**
   * Backend responde 204 sem corpo; `responseType: 'text'` evita que o HttpClient
   * tente fazer parse de JSON vazio (falha comum que impedia o `next` do subscribe).
   */
  atualizarCiclo(cicloId: number, body: CicloUpdateRequest): Observable<void> {
    return this.http
      .put(`${this.ciclosV1Base}/${cicloId}`, body, { responseType: 'text' })
      .pipe(map(() => undefined));
  }
  listCiclos(): Promise<CicloDto[]> {
    return firstValueFrom(this.http.get<CicloDto[]>(this.ciclosV1Base));
  }

  getCiclo(id: number) {
    return this.http.get<CicloDto>(`${this.ciclosV1Base}/${id}`);
  }

  getMateriasCiclo(cicloId: number) {
    return this.http.get<CicloMateriasComEstadoDto>(`${this.ciclosV1Base}/${cicloId}/materias`);
  }

  /** Confirma início da próxima rodada após concluir o ciclo (requer JWT). */
  iniciarNovaRodada(cicloId: number) {
    return this.http.post<NovaRodadaDto>(`${this.ciclosV1Base}/${cicloId}/execucoes`, {});
  }

  deletarCiclo(cicloId: number) {
    return this.http.delete(`${this.ciclosV1Base}/${cicloId}`);
  }

}
