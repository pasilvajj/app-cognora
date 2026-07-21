import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EditalTopicoEstadoItemDto,
  EditalTopicoEstadoResponseDto,
  EditalTopicoEstadoUpdateRequest,
} from './edital-topico-estado.models';

@Injectable({ providedIn: 'root' })
export class EditalTopicoEstadoApiService {
  private readonly base = environment.apiBaseUrl;
  private readonly http = inject(HttpClient);

  listarPorCiclo(cicloId: number): Observable<EditalTopicoEstadoResponseDto> {
    const params = new HttpParams().set('cicloId', String(cicloId));
    return this.http.get<EditalTopicoEstadoResponseDto>(`${this.base}/v1/me/edital-topicos`, { params });
  }

  definirConcluido(cicloId: number, topicoId: number, body: EditalTopicoEstadoUpdateRequest): Observable<EditalTopicoEstadoItemDto> {
    const params = new HttpParams().set('cicloId', String(cicloId));
    return this.http.put<EditalTopicoEstadoItemDto>(
      `${this.base}/v1/me/edital-topicos/${topicoId}`,
      body,
      { params },
    );
  }
}
