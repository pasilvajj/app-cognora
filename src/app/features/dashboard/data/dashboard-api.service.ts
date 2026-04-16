import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
};

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getResumo(usuarioId: number, cicloId: number): Observable<DashboardResumoDto> {
    return this.http.get<DashboardResumoDto>(`${this.baseUrl}/dashboard/resumo`, {
      params: {
        usuarioId: String(usuarioId),
        cicloId: String(cicloId),
      },
    });
  }
}