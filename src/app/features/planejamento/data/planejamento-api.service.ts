import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PlanejamentoPersonalizadoReq, PlanejamentoSemanalDto } from './planejamento.models';

@Injectable({ providedIn: 'root' })
export class PlanejamentoApiService {
    
  private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  /**
   * GET /api/planejamento/ciclos/{cicloId}/semanal?weekStart=YYYY-MM-DD
   */
  getPlanejamentoSemanal(cicloId: number, weekStartIso?: string): Observable<PlanejamentoSemanalDto> {
    let params = new HttpParams();

    if (weekStartIso) {
      params = params.set('weekStart', weekStartIso);
    }

    return this.http.get<PlanejamentoSemanalDto>(
      `${this.base}/planejamento/ciclos/${cicloId}/semanal`,
      { params }
    );
  }

  /**
   * Se você decidir criar POST /api/planejamento/ciclos/{cicloId}/semanal/gerar...
   * Por enquanto, pode só chamar o GET (idempotente).
   */
  gerarPlanejamentoSemanal(cicloId: number, weekStartIso?: string): Observable<PlanejamentoSemanalDto> {
    return this.getPlanejamentoSemanal(cicloId, weekStartIso);
  }

  /**
   * Salva a organização feita pelo usuário (arrastar).
   * PUT /api/planejamento/ciclos/{cicloId}/semanal
   */
  salvarPlanejamentoSemanal(
    cicloId: number,
    payload: PlanejamentoPersonalizadoReq,
  ): Observable<PlanejamentoSemanalDto> {
    return this.http.put<PlanejamentoSemanalDto>(
      `${this.base}/planejamento/ciclos/${cicloId}/semanal`,
      payload,
    );
  }

  /**
   * Remove a personalização e volta ao plano gerado.
   * DELETE /api/planejamento/ciclos/{cicloId}/semanal?weekStart=YYYY-MM-DD
   */
  resetarPlanejamentoSemanal(cicloId: number, weekStartIso?: string): Observable<PlanejamentoSemanalDto> {
    let params = new HttpParams();
    if (weekStartIso) {
      params = params.set('weekStart', weekStartIso);
    }
    return this.http.delete<PlanejamentoSemanalDto>(
      `${this.base}/planejamento/ciclos/${cicloId}/semanal`,
      { params },
    );
  }
}