import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs';
import { TRIAL_DAYS_DEFAULT } from '../../config/payment-provider.config';
import { BillingApiService } from '../../data/billing-api.service';
import { loadMercadoPagoSdk } from '../../data/mercadopago-sdk.loader';
import type { MercadoPagoPreparePaymentResponseDto } from '../../models/billing.models';

const CARD_BRICK_CONTAINER_ID = 'cardPaymentBrick_container';

/** Card Payment Brick — apenas cartão de crédito (`debit_card` e `prepaid-card` excluídos). */
@Component({
  selector: 'app-pagamento-cartao-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  templateUrl: './pagamento-cartao-page.html',
  styleUrl: './pagamento-cartao-page.css',
})
export class PagamentoCartaoPage implements OnDestroy {
  private readonly billing = inject(BillingApiService);
  private readonly router = inject(Router);
  private readonly toastr = inject(ToastrService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly trialDays = TRIAL_DAYS_DEFAULT;

  readonly prepareLoading = signal(true);
  readonly prepareError = signal(false);
  readonly prepare = signal<MercadoPagoPreparePaymentResponseDto | null>(null);
  readonly brickMountError = signal(false);

  private brickController: { unmount: () => void } | null = null;

  constructor() {
    this.billing
      .prepareMercadoPagoPayment({ planCode: 'standard' })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.prepareLoading.set(false)),
      )
      .subscribe({
        next: (cfg) => {
          this.prepare.set(cfg);
          if (!cfg.publicKey.trim()) {
            return;
          }
          setTimeout(() => void this.mountBrick(cfg), 0);
        },
        error: () => {
          this.prepareError.set(true);
          this.toastr.error('Não foi possível preparar o pagamento. Tente mais tarde.');
        },
      });
  }

  ngOnDestroy(): void {
    this.brickController?.unmount();
    this.brickController = null;
  }

  private async mountBrick(cfg: MercadoPagoPreparePaymentResponseDto): Promise<void> {
    this.brickMountError.set(false);
    try {
      await loadMercadoPagoSdk();
    } catch {
      this.brickMountError.set(true);
      this.toastr.error('Não foi possível carregar o formulário seguro do Mercado Pago.');
      return;
    }

    const MercadoPagoCtor = (
      window as unknown as {
        MercadoPago: new (pk: string, opts?: { locale?: string }) => {
          bricks: () => {
            create: (
              brick: string,
              containerId: string,
              settings: Record<string, unknown>,
            ) => Promise<{ unmount: () => void }>;
          };
        };
      }
    ).MercadoPago;

    if (typeof MercadoPagoCtor !== 'function') {
      this.brickMountError.set(true);
      return;
    }

    const mp = new MercadoPagoCtor(cfg.publicKey.trim(), { locale: 'pt-BR' });
    const bricksBuilder = mp.bricks();

    const settings: Record<string, unknown> = {
      locale: 'pt-BR',
      initialization: {
        amount: cfg.amount,
      },
      customization: {
        paymentMethods: {
          maxInstallments: cfg.maxInstallments,
          minInstallments: 1,
          types: {
            excluded: ['debit_card', 'prepaid-card'],
          },
        },
        visual: {
          style: {
            theme: 'default',
          },
        },
      },
      callbacks: {
        onReady: () =>
          this.zone.run(() => {
            /* Brick visível */
          }),
        onError: (error: unknown) =>
          this.zone.run(() => {
            console.error(error);
            this.toastr.error('Erro no formulário de pagamento.');
          }),
        onSubmit: (cardData: unknown, additionalData?: unknown) =>
          new Promise<void>((resolve, reject) => {
            this.zone.run(() => {
              this.billing
                .confirmMercadoPagoCardPayment({
                  planCode: 'standard',
                  cardData,
                  additionalData,
                })
                .subscribe({
                  next: (res) => {
                    const url = res.redirectUrl?.trim();
                    if (url) {
                      try {
                        const parsed = new URL(url, window.location.origin);
                        void this.router.navigateByUrl(parsed.pathname + parsed.search + parsed.hash);
                      } catch {
                        void this.router.navigate(['/planos', 'retorno'], {
                          queryParams: { status: 'success' },
                        });
                      }
                    } else {
                      void this.router.navigate(['/planos', 'retorno'], {
                        queryParams: { status: 'success' },
                      });
                    }
                    resolve();
                  },
                  error: () => {
                    this.toastr.error(
                      'Não foi possível concluir o pagamento. Verifique os dados do cartão.',
                    );
                    reject(new Error('confirm'));
                  },
                });
            });
          }),
      },
    };

    try {
      const container = document.getElementById(CARD_BRICK_CONTAINER_ID);
      if (!container) {
        this.brickMountError.set(true);
        return;
      }
      container.innerHTML = '';
      this.brickController?.unmount();
      this.brickController = await bricksBuilder.create(
        'cardPayment',
        CARD_BRICK_CONTAINER_ID,
        settings,
      );
    } catch (e) {
      console.error(e);
      this.brickMountError.set(true);
      this.toastr.error('Não foi possível iniciar o formulário de cartão.');
    }
  }
}
