import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export type RecentSession = {
  sessaoId: number;
  /** Ordem da matéria no ciclo (#N), quando a API envia ordemNoCiclo. */
  numero?: number;
  label: string;
  disciplina: string;

  studiedLabel: string;
  remainingLabel?: string;

  status: 'EM_ANDAMENTO' | 'PAUSADA' | 'CONCLUIDA';
};

type DateKind = 'RELATIVE' | 'CALENDAR' | 'TEXT';

type DateView = {
  kind: DateKind;
  text: string;
  day: string;
  month: string;
  raw: string;
};

type RecentSessionVm = RecentSession & { dateView: DateView };

@Component({
  selector: 'app-ultimas-sessoes-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ultimas-sessoes-card.html',
  styleUrl: './ultimas-sessoes-card.css',
})
export class UltimasSessoesCard implements OnChanges {
  @Input({ required: true }) sessions: RecentSession[] = [];
  @Input() title: string = 'Últimas Sessões';

  vm: RecentSessionVm[] = [];

  ngOnChanges(): void {
    this.vm = (this.sessions ?? []).map((s) => ({
      ...s,
      dateView: this.buildDateView(s.label),
    }));
  }

  trackByKey(_: number, s: RecentSessionVm): string {
    return `${s.sessaoId}-${s.label}-${s.disciplina}-${s.status}`;
  }

  getStatusText(s: RecentSession): string {
    if (s.status === 'PAUSADA') return 'Pausada';
    if (s.status === 'EM_ANDAMENTO') return 'Em andamento';
    if (s.status === 'CONCLUIDA') return 'Concluída';
    return 'Concluída';
  }

  canResume(s: RecentSession): boolean {
    return s.status === 'EM_ANDAMENTO' || s.status === 'PAUSADA';
  }

  private buildDateView(label: string): DateView {
    const raw = (label ?? '').trim();

    if (raw === 'Hoje' || raw === 'Ontem') {
      return { kind: 'RELATIVE', text: raw, day: '', month: '', raw };
    }

    const m = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m) {
      const day = m[1].padStart(2, '0');
      const month = m[2].padStart(2, '0');
      return { kind: 'CALENDAR', text: raw, day, month, raw };
    }

    return { kind: 'TEXT', text: raw || '-', day: '', month: '', raw: raw || '-' };
  }
}
