import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EditalVerticalConcursoDto } from './edital-vertical.models';

@Injectable({ providedIn: 'root' })
export class EditalVerticalApiService {
  private readonly base = environment.apiBaseUrl;
  private readonly http = inject(HttpClient);

  /**
   * @param cicloId quando informado, a resposta inclui {@code estadoTopico} (progresso dos tópicos).
   */
  getArvorePorConcurso(concursoId: number, cicloId?: number | null): Observable<EditalVerticalConcursoDto> {
    let params = new HttpParams();
    if (cicloId != null && Number.isFinite(cicloId) && cicloId > 0) {
      params = params.set('cicloId', String(cicloId));
    }
    return this.http.get<EditalVerticalConcursoDto>(
      `${this.base}/concursos/${concursoId}/edital-vertical`,
      { params },
    );
  }
}
