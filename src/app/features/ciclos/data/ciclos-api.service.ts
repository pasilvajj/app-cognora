import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  CargoDto,
  CicloCreateRequest,
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
};

/** Resposta de GET /ciclo/materias/:id */
export type CicloMateriasComEstadoDto = {
  materias: CicloMateriaDto[];
  aguardandoNovaRodada: boolean;
  ultimaRodadaConcluidaNumero: number | null;
  rodadaAtualNumero: number | null;
};

export type NovaRodadaDto = {
  execucaoId: number;
  numeroRodada: number;
};

@Injectable({ providedIn: 'root' })
export class CiclosApiService {
  private readonly base = environment.apiBaseUrl;

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
    return this.http.get<ConcursoDto[]>(`${this.base}/concursos`, { params });
  }

  // escolha UM: por concursoId ou por editalId (ou ambos)
  listDisciplinasByConcurso(cargoId: number): Observable<DisciplinaDto[]> {
    return this.http.get<DisciplinaDto[]>(`${this.base}/ciclo/lista-disciplina-cargo/${cargoId}`);
  }

  detalharCicloParaEdicao(idCiclo: number): Observable<CicloEditResponseDto> {
    return this.http.get<CicloEditResponseDto>(`${this.base}/ciclo/detalhe-ciclo/${idCiclo}`);
  }

  listCargosByConcurso(concursoId: number): Observable<CargoDto[]> {
    return this.http.get<CargoDto[]>(`${this.base}/cargo/${concursoId}`);
  }

  saveCiclo(payload: CicloCreateRequest): Observable<CicloDto[]> {
    return this.http.post<CicloDto[]>(`${this.base}/ciclo/salvar`, payload);
  }

  /**
   * Backend responde 204 sem corpo; `responseType: 'text'` evita que o HttpClient
   * tente fazer parse de JSON vazio (falha comum que impedia o `next` do subscribe).
   */
  atualizarCiclo(cicloId: number, body: CicloUpdateRequest): Observable<void> {
    return this.http
      .put(`${this.base}/ciclo/${cicloId}`, body, { responseType: 'text' })
      .pipe(map(() => undefined));
  }
  listCiclos(): Promise<CicloDto[]> {
    return firstValueFrom(this.http.get<CicloDto[]>(`${this.base}/ciclo`));
  }

  getCiclo(id: number) {
    return this.http.get<CicloDto>(`${this.base}/ciclo/${id}`);
  }

  getMateriasCiclo(cicloId: number, usuarioId: number) {
    return this.http.get<CicloMateriasComEstadoDto>(`${this.base}/ciclo/materias/${cicloId}`, {
      params: { usuarioId: String(usuarioId) },
    });
  }

  /** Confirma início da próxima rodada após concluir o ciclo (requer JWT). */
  iniciarNovaRodada(cicloId: number) {
    return this.http.post<NovaRodadaDto>(`${this.base}/ciclo/${cicloId}/execucao/iniciar-nova`, {});
  }

  deletarCiclo(cicloId: number) {
    return this.http.delete(`${this.base}/ciclo/delete/${cicloId}`);
  }

}
