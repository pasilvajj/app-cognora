import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EditalVerticalConcursoDto } from './edital-vertical.models';

@Injectable({ providedIn: 'root' })
export class EditalVerticalApiService {
  private readonly base = environment.apiBaseUrl;
  private readonly http = inject(HttpClient);

  getArvorePorConcurso(concursoId: number): Observable<EditalVerticalConcursoDto> {
    return this.http.get<EditalVerticalConcursoDto>(
      `${this.base}/concursos/${concursoId}/edital-vertical`,
    );
  }
}
