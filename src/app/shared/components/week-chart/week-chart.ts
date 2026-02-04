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

@Component({
  selector: 'app-week-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './week-chart.html',
  styleUrls: ['./week-chart.css'],
})
export class WeekChart implements AfterViewInit, OnChanges, OnDestroy {
  @Input() days: WeekDayView[] = [];

  @ViewChild('weekCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  ngAfterViewInit(): void {
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
  }

  private render(): void {
    // ainda não montou o canvas
    if (!this.canvasRef?.nativeElement) return;

    const labels = this.getLabels();
    const data = this.getHoursData(labels);

    // recria para evitar bugs de resize/update
    this.destroyChart();

    const ctx = this.canvasRef.nativeElement;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Horas estudadas',
            data,
            tension: 0.38,
            fill: true,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const v = Number(item.raw ?? 0);
                return `${v.toFixed(1)}h`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 12, weight: 600 },
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `${value}h`,
              font: { size: 12, weight: 600 },
            },
          },
        },
      },
    });
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }

  private getLabels(): string[] {
    // se vier vazio, usa padrão fixo
    if (!this.days || this.days.length === 0) {
      return ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    }

    // se vier parcial, mantém a ordem recebida
    return this.days.map((d) => d.label);
  }

  private getHoursData(labels: string[]): number[] {
    // mapeia por label para garantir estabilidade
    const map = new Map<string, number>();
    for (const d of this.days ?? []) {
      map.set(d.label, this.secondsToHours(d.estudadoSeg ?? 0));
    }

    // garante 1 valor por label (mesmo que não tenha vindo no backend)
    return labels.map((lb) => map.get(lb) ?? 0);
  }

  private secondsToHours(sec: number): number {
    const s = Math.max(0, Number(sec || 0));
    // 1 casa decimal para ficar bonito no gráfico e no tooltip
    return Math.round((s / 3600) * 10) / 10;
  }
}
