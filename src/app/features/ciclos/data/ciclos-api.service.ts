import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ConcursoDto, DisciplinaDto,CargoDto, CicloCreateRequest, CicloDto,CicloEditResponseDto } from './ciclos.models';

export type CicloMateriaDto = {
  cicloItemId: number;
  ordem: number;
  disciplinaNome: string;
  tempoMinutos: number;

  visto: boolean;
  sessaoAbertaId: number | null;
  concluida: boolean;
};

@Injectable({ providedIn: 'root' })
export class CiclosApiService {
  private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  listConcursos(): Observable<ConcursoDto[]> {
    return this.http.get<ConcursoDto[]>(`${this.base}/concursos`);
  }

  // escolha UM: por concursoId ou por editalId (ou ambos)
  listDisciplinasByConcurso(cargoId: number): Observable<DisciplinaDto[]> {
      return this.http.get<DisciplinaDto[]>(`${this.base}/ciclo/lista-disciplina-cargo/${cargoId}`);
  }

  detalharCicloParaEdicao(idCiclo: number): Observable<CicloEditResponseDto> {
    return this.http.get<CicloEditResponseDto>( `${this.base}/ciclo/detalhe-ciclo/${idCiclo}`);
  }

  listCargosByConcurso(concursoId: number): Observable<CargoDto[]> {
    return this.http.get<CargoDto[]>(`${this.base}/cargo/${concursoId}`);
  }

  saveCiclo(payload: CicloCreateRequest): Observable<CicloDto[]> {
    return this.http.post<CicloDto[]>(`${this.base}/cicloGerador`, payload );
  }
  listCiclos() {
    return this.http.get<CicloDto[]>(`${this.base}/ciclo`);
  }

 getCiclo(id: number) {
    return this.http.get<CicloDto>(`${this.base}/ciclo/${id}`);
 }

  getMateriasCiclo(cicloId: number, usuarioId: number) {
    return this.http.get<CicloMateriaDto[]>(`${this.base}/ciclo/materias/${cicloId}`, {
      params: { usuarioId },
    });
  }
 
}
