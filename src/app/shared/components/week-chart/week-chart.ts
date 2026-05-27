import {
  Component,
  Input,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export type WeekDayView = {
  label: string;        // "Seg"..."Dom"
  estudadoSeg: number;  // segundos estudados no dia
};

/** Ordem exibida: segunda → domingo (padrão BR). */
const CANONICAL_WEEK: readonly string[] = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

type CanonDay = (typeof CANONICAL_WEEK)[number];

@Component({
  selector: 'app-week-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './week-chart.html',
  styleUrls: ['./week-chart.css'],
})
export class WeekChart implements AfterViewInit, OnChanges, OnDestroy {
  @Input() days: WeekDayView[] = [];

  /** Título do cartão (ex.: gráfico de teste “só diário”). */
  @Input() chartTitle = 'Estudos da semana';

  @ViewChild('weekCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private themeObserver?: MutationObserver;
  /** Evita falha ao passar de semana vazia (sem canvas) para semana com dados antes do ViewChild atualizar. */
  private canvasWaitFrames = 0;

  ngAfterViewInit(): void {
    this.observeTheme();
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
   if (changes['days']) {
    // agenda para garantir que ViewChild já exista e layout já tenha altura
    queueMicrotask(() => this.render());
  }
  }

  ngOnDestroy(): void {
    this.destroyChart();
    this.themeObserver?.disconnect();
  }

  /** Semana com pelo menos um dia com tempo de estudo registado. */
  hasStudyDataInWeek(): boolean {
    const labels = this.getLabels();
    const { seconds } = this.buildSeries(labels);
    return seconds.some((s) => s > 0);
  }

  private render(): void {
    const labels = this.getLabels();
    const { minutes, seconds } = this.buildSeries(labels);

    // recria para evitar bugs de resize/update
    this.destroyChart();

    const hasData = seconds.some((s) => s > 0);
    if (!hasData) {
      this.canvasWaitFrames = 0;
      return;
    }

    if (!this.canvasRef?.nativeElement) {
      if (typeof requestAnimationFrame !== 'undefined' && this.canvasWaitFrames < 12) {
        this.canvasWaitFrames++;
        requestAnimationFrame(() => this.render());
      } else {
        this.canvasWaitFrames = 0;
      }
      return;
    }
    this.canvasWaitFrames = 0;

    const ctx = this.canvasRef.nativeElement;
    const secondsPerPoint = [...seconds];

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Minutos estudados',
            data: minutes,
            borderColor: this.isDarkTheme() ? '#38bdf8' : '#2ea7f0',
            backgroundColor: this.isDarkTheme()
              ? 'rgba(56, 189, 248, 0.28)'
              : 'rgba(46, 167, 240, 0.26)',
            tension: 0.38,
            fill: true,
            borderWidth: 2,
            pointRadius: (ctx) => {
              const sec = secondsPerPoint[ctx.dataIndex] ?? 0;
              // Estudo curto (<10 min): ponto maior para não “sumir” no eixo
              return sec > 0 && sec < 600 ? 8 : 4;
            },
            pointHoverRadius: 6,
            pointBorderColor: this.isDarkTheme() ? '#38bdf8' : '#2ea7f0',
            pointBackgroundColor: this.isDarkTheme() ? '#121a2a' : '#ffffff',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 8,
            right: 6,
            bottom: 30,
            left: 8,
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const sec = secondsPerPoint[item.dataIndex] ?? 0;
                return this.formatTooltipEstudo(sec);
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
              color: this.isDarkTheme() ? 'rgba(148,163,184,.14)' : 'rgba(15,23,42,.08)',
            },
            ticks: {
              color: this.isDarkTheme() ? '#9fb0c5' : '#64748b',
              font: { size: 12, weight: 600 },
              padding: 8,
            },
          },
          y: {
            type: 'linear',
            beginAtZero: true,
            grid: {
              color: this.isDarkTheme() ? 'rgba(148,163,184,.14)' : 'rgba(15,23,42,.08)',
            },
            ticks: {
              stepSize: 50,
              autoSkip: false,
              color: this.isDarkTheme() ? '#9fb0c5' : '#64748b',
              callback: (value) => this.formatYAxisMinutos(Number(value)),
              font: { size: 12, weight: 600 },
            },
          },
        },
      },
    });
  }

  /** Tooltip a partir dos segundos reais (API). */
  private formatTooltipEstudo(seg: number): string {
    const s = Math.max(0, Math.floor(seg));
    if (s <= 0) return '0';

    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rs = s % 60;

    if (h > 0) {
      return `${h}h ${m}min${rs ? ` ${rs}s` : ''}`;
    }
    if (m > 0) {
      return `${m}min ${rs}s`;
    }
    return `${rs}s`;
  }

  private formatYAxisMinutos(min: number): string {
    if (!Number.isFinite(min)) return '';
    if (min >= 120 && min % 60 < 0.01) {
      return `${Math.round(min / 60)}h`;
    }
    if (min >= 60) {
      const h = Math.floor(min / 60);
      const m = Math.round(min % 60);
      return m > 0 ? `${h}h${m}m` : `${h}h`;
    }
    return `${Math.round(min)}m`;
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }

  private getLabels(): string[] {
    return [...CANONICAL_WEEK];
  }

  /**
   * Agrega segundos por dia canônico (Seg…Dom).
   * O backend costuma variar rótulos ("Segunda-feira", "SEG", ISO date) ou nomes de campo;
   * o match exato `map.set(d.label, …)` fazia Seg/Ter sumirem quando o texto não batia 100%.
   */
  /**
   * Eixo Y em minutos: estudos curtos (ex. 115s ≈ 2m) ficam visíveis; em “horas” no eixo 0–3h sumiam.
   */
  private buildSeries(labels: string[]): { minutes: number[]; seconds: number[] } {
    const byDay = new Map<string, number>();
    const days = this.days ?? [];

    const useIndexFallback = days.length === 7;

    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      let key = this.normalizeDayKey(this.sanitizeLabel(d.label));
      if (!key && useIndexFallback && i < CANONICAL_WEEK.length) {
        key = CANONICAL_WEEK[i] as CanonDay;
      }
      if (!key) continue;

      const sec = this.readEstudadoSegundos(d);
      byDay.set(key, (byDay.get(key) ?? 0) + sec);
    }

    const seconds = labels.map((lb) => byDay.get(lb) ?? 0);
    const minutes = seconds.map((sec) => Math.round((sec / 60) * 100) / 100);

    return { minutes, seconds };
  }

  private sanitizeLabel(label: string): string {
    return String(label ?? '')
      .replace(/\u00a0/g, ' ')
      .trim();
  }

  private stripAccents(s: string): string {
    return s.normalize('NFD').replace(/\p{M}/gu, '');
  }

  /**
   * Converte label da API para chave canônica Seg|Ter|…|Dom.
   */
  private normalizeDayKey(label: string): CanonDay | null {
    const raw = String(label ?? '').trim();
    if (!raw) return null;

    const t = this.stripAccents(raw).toLowerCase().replace(/\./g, '');

    // Data ISO (ex.: 2026-04-07 ou 2026-04-07T00:00:00Z)
    const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const y = Number(iso[1]);
      const m = Number(iso[2]);
      const day = Number(iso[3]);
      const dt = new Date(y, m - 1, day, 12, 0, 0);
      if (!Number.isNaN(dt.getTime())) {
        const jsDow = dt.getDay();
        const mapJs: CanonDay[] = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return mapJs[jsDow];
      }
    }

    // Dia da semana por número (1=Seg … 7=Dom), se a API mandar assim
    if (/^[1-7]$/.test(t)) {
      const idx = Number(t) - 1;
      return (CANONICAL_WEEK[idx] as CanonDay) ?? null;
    }

    if (t.startsWith('segunda') || t === 'seg' || t === '2' || t === '2a' || t === 'mon' || t === 'monday') {
      return 'Seg';
    }
    if (
      t.startsWith('terca')
      || t === 'ter'
      || t === '3'
      || t === '3a'
      || t === 'tue'
      || t === 'tues'
      || t === 'tuesday'
    ) {
      return 'Ter';
    }
    if (t.startsWith('quarta') || t === 'qua' || t === '4' || t === '4a' || t === 'wed' || t === 'wednesday') {
      return 'Qua';
    }
    if (t.startsWith('quinta') || t === 'qui' || t === '5' || t === '5a' || t === 'thu' || t === 'thursday') {
      return 'Qui';
    }
    if (t.startsWith('sexta') || t === 'sex' || t === '6' || t === '6a' || t === 'fri' || t === 'friday') {
      return 'Sex';
    }
    if (t.startsWith('sabado') || t === 'sab' || t === '7' || t === '7a' || t === 'sat' || t === 'saturday') {
      return 'Sáb';
    }
    if (t.startsWith('domingo') || t === 'dom' || t === 'sun' || t === 'sunday') {
      return 'Dom';
    }

    // Já veio no formato esperado pelo gráfico
    if ((CANONICAL_WEEK as readonly string[]).includes(raw)) {
      return raw as CanonDay;
    }

    return null;
  }

  private readEstudadoSegundos(d: WeekDayView): number {
    const rec = d as unknown as Record<string, unknown>;
    const keys = [
      'estudadoSeg',
      'estudado_seg',
      'segundos',
      'segundosEstudados',
      'tempoEstudadoSeg',
      'totalSegundos',
      'seconds',
      'tempoEmSegundos',
      'tempoSegundos',
      'valorSegundos',
    ];
    for (const k of keys) {
      const v = rec[k];
      if (v == null) continue;
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return 0;
  }

  private isDarkTheme(): boolean {
    return typeof document !== 'undefined'
      && document.documentElement.getAttribute('data-theme') === 'dark';
  }

  private observeTheme(): void {
    if (typeof document === 'undefined') return;
    this.themeObserver?.disconnect();
    this.themeObserver = new MutationObserver((changes) => {
      const changedTheme = changes.some((m) => m.type === 'attributes' && m.attributeName === 'data-theme');
      if (changedTheme) this.render();
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
}
