import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type WeekDayDto = {
  label: string;
  estudadoSeg: number;
};

export type ProximaSessaoDto = {
  cicloId: number;
  cicloItemId: number;
  ordem: number;
  disciplinaNome: string;
  tempoMinutos: number;
};

export type ProgressoDisciplinaDto = {
  disciplinaId?: number;
  disciplinaNome: string;
  percentual?: number;
};

export type SessaoCardDto = {
  id: number;
  disciplinaNome: string;

  // backend manda Instant -> no front vem como string ISO
  inicio?: string | null;
  fim?: string | null;
  pausadoEm?: string | null;

  pausadoTotalSeg?: number | null;

  // NOVO: valor oficial do "tempo estudado"
  estudadoTotalSeg?: number | null;

  // se você ainda mantém no backend por compatibilidade, pode deixar opcionais
  segundosEstudados?: number | null;
  segundosRestantes?: number | null;

  status: 'PAUSADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'ENCERRADA';

  /** Ordem da matéria no ciclo (CicloItem.ordem). */
  ordemNoCiclo?: number | null;
};

export type DashboardResumoDto = {
  cicloId: number;

  estudadoSemanaSeg: number;
  deltaSemanaSeg: number;

  streakDias: number;
  recordeStreakDias: number;

  proximaSessao: ProximaSessaoDto | null;

  semana: WeekDayDto[];
  progresso: ProgressoDisciplinaDto[];
  recentes: SessaoCardDto[];
  /** Incluído quando {@code chartWeekStart} é enviado no resumo (evita 2º GET na carga). */
  semanaSoDiario?: DashboardSemanaSoDiarioDto | null;
};

/** Resposta de `GET /dashboard/semana-so-diario` (gráfico de teste só com `estudo_diario_ciclo`). */
export type DashboardSemanaSoDiarioDto = {
  cicloId: number;
  segundaFeiraSemana: string;
  estudadoSemanaSeg: number;
  semana: WeekDayDto[];
};

/** Um dia da faixa de constância (data ISO `yyyy-MM-dd` + se houve estudo). */
export type DiaConstanciaDto = {
  data: string;
  estudou: boolean;
  /** Antes do cadastro ou do primeiro ciclo — exibir neutro (ponto cinza). */
  naoAplicavel?: boolean;
};

/** Resposta de `GET /dashboard/constancia` — constância global (todos os ciclos). */
export type DashboardConstanciaDto = {
  inicio: string;
  fim: string;
  totalDias: number;
  diasEstudados: number;
  streakAtual: number;
  dias: DiaConstanciaDto[];
};

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  /**
   * @param options.weekStart segunda-feira dos cards (yyyy-MM-dd); omitido = semana atual
   * @param options.chartWeekStart segunda-feira do gráfico “só diário” (incluída na resposta)
   */
  getResumo(
    cicloId: number,
    options?: { weekStart?: string | null; chartWeekStart?: string | null },
  ): Observable<DashboardResumoDto> {
    let params = new HttpParams().set('cicloId', String(cicloId));
    if (options?.weekStart) {
      params = params.set('weekStart', options.weekStart);
    }
    if (options?.chartWeekStart) {
      params = params.set('chartWeekStart', options.chartWeekStart);
    }

    return this.http.get<DashboardResumoDto>(`${this.baseUrl}/dashboard/resumo`, { params });
  }

  /**
   * Semana civil: 7 pontos só a partir de `estudo_diario_ciclo` (sem trechos / legado).
   * @param weekStartIso segunda-feira (yyyy-MM-dd), igual ao parâmetro de `getResumo`
   */
  getSemanaSoDiario(cicloId: number, weekStartIso?: string | null): Observable<DashboardSemanaSoDiarioDto> {
    let params = new HttpParams().set('cicloId', String(cicloId));
    if (weekStartIso) {
      params = params.set('weekStart', weekStartIso);
    }
    return this.http.get<DashboardSemanaSoDiarioDto>(`${this.baseUrl}/dashboard/semana-so-diario`, { params });
  }

  /** Faixa de constância nos estudos (global): mês atual até hoje. */
  getConstancia(): Observable<DashboardConstanciaDto> {
    return this.http.get<DashboardConstanciaDto>(`${this.baseUrl}/dashboard/constancia`);
  }
}