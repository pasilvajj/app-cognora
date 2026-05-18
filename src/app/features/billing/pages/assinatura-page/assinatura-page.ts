import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';
import { BillingApiService } from '../../data/billing-api.service';
import type { SubscriptionDto } from '../../models/billing.models';

@Component({
  selector: 'app-assinatura-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, AppButtonComponent],
  templateUrl: './assinatura-page.html',
  styleUrl: './assinatura-page.css',
})
export class AssinaturaPage implements OnInit {
  private readonly billing = inject(BillingApiService);
  private readonly toastr = inject(ToastrService);

  readonly loading = signal(true);
  readonly subscription = signal<SubscriptionDto | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.billing
      .getSubscription()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (s) => this.subscription.set(s),
        error: () => this.toastr.error('Não foi possível carregar a assinatura.'),
      });
  }

  statusLabel(s: SubscriptionDto): string {
    switch (s.status) {
      case 'none':
        return 'Sem assinatura ativa';
      case 'trialing':
        return 'Período de teste';
      case 'active':
        return 'Ativa';
      case 'past_due':
        return 'Pagamento em atraso';
      case 'canceled':
        return 'Cancelada';
      case 'unpaid':
        return 'Não paga';
      default:
        return s.status;
    }
  }

  openPortal(url: string | null): void {
    if (url) {
      window.location.href = url;
    }
  }
}
