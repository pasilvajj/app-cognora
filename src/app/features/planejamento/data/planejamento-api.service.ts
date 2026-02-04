import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PlanejamentoSemanalDto } from './planejamento.models';

@Injectable({ providedIn: 'root' })
export class PlanejamentoApiService {
    
  private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  /**
   * GET /api/planejamento/ciclos/{cicloId}/semanal?usuarioId=1&weekStart=YYYY-MM-DD
   */
  getPlanejamentoSemanal(usuarioId: number, cicloId: number, weekStartIso?: string): Observable<PlanejamentoSemanalDto> {
    let params = new HttpParams().set('usuarioId', usuarioId);

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
  gerarPlanejamentoSemanal(usuarioId: number, cicloId: number, weekStartIso?: string): Observable<PlanejamentoSemanalDto> {
    // Opção A (recomendado): GET idempotente
    return this.getPlanejamentoSemanal(usuarioId, cicloId, weekStartIso);

    // Opção B (se você criar um POST real):
    // let params = new HttpParams().set('usuarioId', usuarioId);
    // if (weekStartIso) params = params.set('weekStart', weekStartIso);
    // return this.http.post<PlanejamentoSemanalDto>(
    //   `${this.base}/planejamento/ciclos/${cicloId}/semanal/gerar`,
    //   {},
    //   { params }
    // );
  }
}