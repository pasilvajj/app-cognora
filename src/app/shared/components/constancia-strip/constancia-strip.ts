import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DiaConstanciaDto } from '../../../features/dashboard/data/dashboard-api.service';

/** Item já preparado para o template (rótulo de data calculado uma vez). */
interface DiaConstanciaVm {
  iso: string;
  estudou: boolean;
  naoAplicavel: boolean;
  diaNumero: number;
  /** Ex.: "quarta-feira, 17/jan." */
  rotuloData: string;
}

/**
 * Faixa horizontal de constância nos estudos: um quadrado por dia do mês
 * (✓ estudou / ✗ falhou / · neutro antes do cadastro ou ciclo).
 */
@Component({
  selector: 'app-constancia-strip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './constancia-strip.html',
  styleUrl: './constancia-strip.css',
})
export class ConstanciaStrip {
  private _dias: DiaConstanciaVm[] = [];

  @Input() loading = false;

  /** Dias consecutivos sem falhar (vindos do backend; cai para contagem local se ausente). */
  @Input() streakAtual: number | null = null;

  @Input()
  set dias(value: DiaConstanciaDto[] | null | undefined) {
    const lista = value ?? [];
    this._dias = lista.map((d) => ({
      iso: d.data,
      estudou: !!d.estudou,
      naoAplicavel: !!d.naoAplicavel,
      diaNumero: this.diaDoMes(d.data),
      rotuloData: this.formatarData(d.data),
    }));
  }

  get dias(): DiaConstanciaVm[] {
    return this._dias;
  }

  /** Streak para o título: usa o valor do backend ou conta os últimos dias estudados em sequência. */
  get streakLabel(): number {
    if (this.streakAtual != null && this.streakAtual >= 0) {
      return this.streakAtual;
    }
    let streak = 0;
    for (let i = this._dias.length - 1; i >= 0; i--) {
      const dia = this._dias[i];
      if (dia.naoAplicavel) {
        continue;
      }
      if (!dia.estudou) {
        break;
      }
      streak++;
    }
    return streak;
  }

  /** Quantidade de células no skeleton = dias do mês até hoje. */
  get skeletonCount(): number {
    return new Date().getDate();
  }

  rotuloAria(dia: DiaConstanciaVm): string {
    if (dia.naoAplicavel) {
      return `${dia.rotuloData} — antes do cadastro ou ciclo`;
    }
    return `${dia.rotuloData}${dia.estudou ? ' — estudou' : ' — sem estudo'}`;
  }

  get temDados(): boolean {
    return this._dias.length > 0;
  }

  trackByIso(_index: number, dia: DiaConstanciaVm): string {
    return dia.iso;
  }

  private parseIso(iso: string): Date {
    const [y, m, d] = (iso ?? '').split('-').map((x) => Number(x));
    if (!y || !m || !d) {
      return new Date();
    }
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }

  private diaDoMes(iso: string): number {
    return this.parseIso(iso).getDate();
  }

  private formatarData(iso: string): string {
    const d = this.parseIso(iso);
    const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    const diaMes = d
      .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      .replace('.', '');
    return `${semana}, ${diaMes}`;
  }
}
