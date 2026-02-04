import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppButtonComponent } from '../app-button/app-button';

export type MetricCardType = 'time' | 'streak' | 'next';
export type MetricIcon = 'time' | 'calendar' | 'book';
export type FooterTone = 'success' | 'muted' | 'warn' | 'primary';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule, AppButtonComponent],
  templateUrl: './metric-card.html',
  styleUrls: ['./metric-card.css'],
})
export class MetricCard {
  @Input({ required: true }) type!: MetricCardType;

  @Input({ required: true }) title!: string;
  @Input({ required: true }) value!: string;

  // opcional
  @Input() subtitle?: string;

  // ícone padronizado (não usar emoji como fonte de verdade)
  @Input() icon: MetricIcon = 'time';

  // rodapé padronizado (delta / recorde / etc)
  @Input() footerText?: string;
  @Input() footerTone: FooterTone = 'muted';

  // ação (somente "next" normalmente)
  @Input() actionText?: string;
  @Input() actionDisabled = false;
  @Input() actionLoading = false;
  @Output() action = new EventEmitter<void>();
  @Input() actionLabel?: string;

  onActionClick(): void {
    if (this.actionDisabled) return;
    this.action.emit();
  }
  onAction(): void {
    if (!this.actionDisabled && !this.actionLoading) {
      this.action.emit();
    }
  }

  get safeActionLabel(): string {
  return this.actionLabel ?? '';
}
  

}
