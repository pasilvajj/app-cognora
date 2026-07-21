import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PlanejamentoPersonalizadoReq, PlanejamentoSemanalDto } from './planejamento.models';

@Injectable({ providedIn: 'root' })
export class PlanejamentoApiService {
    
  private readonly base = `${environment.apiBaseUrl}/v1/planejamentos`;

  constructor(private http: HttpClient) {}

  /**
   * GET /api/v1/planejamentos/ciclos/{cicloId}/semanal?weekStart=YYYY-MM-DD
   */
  getPlanejamentoSemanal(cicloId: number, weekStartIso?: string): Observable<PlanejamentoSemanalDto> {
    let params = new HttpParams();

    if (weekStartIso) {
      params = params.set('weekStart', weekStartIso);
    }

    return this.http.get<PlanejamentoSemanalDto>(
      `${this.base}/ciclos/${cicloId}/semanal`,
      { params }
    );
  }

  /**
   * A geração automática é idempotente e reutiliza a consulta semanal.
   * Por enquanto, pode só chamar o GET (idempotente).
   */
  gerarPlanejamentoSemanal(cicloId: number, weekStartIso?: string): Observable<PlanejamentoSemanalDto> {
    return this.getPlanejamentoSemanal(cicloId, weekStartIso);
  }

  aplicarPlanejamentoAoCiclo(cicloId: number, weekStartIso?: string): Observable<void> {
    let params = new HttpParams();
    if (weekStartIso) {
      params = params.set('weekStart', weekStartIso);
    }
    return this.http.post<void>(
      `${this.base}/ciclos/${cicloId}/semanal/aplicar-ao-ciclo`,
      null,
      { params },
    );
  }

  /**
   * Salva a organização feita pelo usuário (arrastar).
   * PUT /api/v1/planejamentos/ciclos/{cicloId}/semanal
   */
  salvarPlanejamentoSemanal(
    cicloId: number,
    payload: PlanejamentoPersonalizadoReq,
  ): Observable<PlanejamentoSemanalDto> {
    return this.http.put<PlanejamentoSemanalDto>(
      `${this.base}/ciclos/${cicloId}/semanal`,
      payload,
    );
  }

  /**
   * Remove a personalização e volta ao plano gerado.
   * DELETE /api/v1/planejamentos/ciclos/{cicloId}/semanal?weekStart=YYYY-MM-DD
   */
  resetarPlanejamentoSemanal(cicloId: number, weekStartIso?: string): Observable<PlanejamentoSemanalDto> {
    let params = new HttpParams();
    if (weekStartIso) {
      params = params.set('weekStart', weekStartIso);
    }
    return this.http.delete<PlanejamentoSemanalDto>(
      `${this.base}/ciclos/${cicloId}/semanal`,
      { params },
    );
  }
}
