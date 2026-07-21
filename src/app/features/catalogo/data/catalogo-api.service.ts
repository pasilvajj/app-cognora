import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CargoCatalogoDto,
  CargoUpsertRequest,
  ConcursoCatalogoDto,
  ConcursoUpsertRequest,
  DisciplinaCatalogoDto,
  DisciplinaUpsertRequest,
  TopicoNodeDto,
  TopicoUpsertRequest,
} from './catalogo.models';

@Injectable({ providedIn: 'root' })
export class CatalogoApiService {
  private readonly base = `${environment.apiBaseUrl}/v1/catalogo`;
  private readonly http = inject(HttpClient);

  listConcursos(): Observable<ConcursoCatalogoDto[]> {
    return this.http.get<ConcursoCatalogoDto[]>(`${this.base}/concursos`);
  }

  createConcurso(body: ConcursoUpsertRequest): Observable<ConcursoCatalogoDto> {
    return this.http.post<ConcursoCatalogoDto>(`${this.base}/concursos`, body);
  }

  updateConcurso(id: number, body: ConcursoUpsertRequest): Observable<ConcursoCatalogoDto> {
    return this.http.put<ConcursoCatalogoDto>(`${this.base}/concursos/${id}`, body);
  }

  deleteConcurso(id: number): Observable<void> {
    return this.http.delete(`${this.base}/concursos/${id}`, { responseType: 'text' }).pipe(map(() => undefined));
  }

  listCargos(concursoId: number): Observable<CargoCatalogoDto[]> {
    return this.http.get<CargoCatalogoDto[]>(`${this.base}/concursos/${concursoId}/cargos`);
  }

  createCargo(concursoId: number, body: CargoUpsertRequest): Observable<CargoCatalogoDto> {
    return this.http.post<CargoCatalogoDto>(`${this.base}/concursos/${concursoId}/cargos`, body);
  }

  updateCargo(id: number, body: CargoUpsertRequest): Observable<CargoCatalogoDto> {
    return this.http.put<CargoCatalogoDto>(`${this.base}/cargos/${id}`, body);
  }

  deleteCargo(id: number): Observable<void> {
    return this.http.delete(`${this.base}/cargos/${id}`, { responseType: 'text' }).pipe(map(() => undefined));
  }

  listDisciplinas(cargoId: number): Observable<DisciplinaCatalogoDto[]> {
    return this.http.get<DisciplinaCatalogoDto[]>(`${this.base}/cargos/${cargoId}/disciplinas`);
  }

  createDisciplina(cargoId: number, body: DisciplinaUpsertRequest): Observable<DisciplinaCatalogoDto> {
    return this.http.post<DisciplinaCatalogoDto>(`${this.base}/cargos/${cargoId}/disciplinas`, body);
  }

  updateDisciplina(id: number, body: DisciplinaUpsertRequest): Observable<DisciplinaCatalogoDto> {
    return this.http.put<DisciplinaCatalogoDto>(`${this.base}/disciplinas/${id}`, body);
  }

  deleteDisciplina(id: number): Observable<void> {
    return this.http.delete(`${this.base}/disciplinas/${id}`, { responseType: 'text' }).pipe(map(() => undefined));
  }

  listTopicos(disciplinaId: number): Observable<TopicoNodeDto[]> {
    return this.http.get<TopicoNodeDto[]>(`${this.base}/disciplinas/${disciplinaId}/topicos`);
  }

  createTopico(disciplinaId: number, body: TopicoUpsertRequest): Observable<number> {
    return this.http.post<number>(`${environment.apiBaseUrl}/v1/topicos/disciplina/${disciplinaId}`, body);
  }

  updateTopico(id: number, body: TopicoUpsertRequest): Observable<number> {
    return this.http.put<number>(`${environment.apiBaseUrl}/v1/topicos/${id}`, body);
  }

  deleteTopico(id: number): Observable<void> {
    return this.http.delete(`${environment.apiBaseUrl}/v1/topicos/${id}`, { responseType: 'text' }).pipe(map(() => undefined));
  }
}
