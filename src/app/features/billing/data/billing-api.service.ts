import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TRIAL_DAYS_DEFAULT } from '../config/payment-provider.config';
import type {
  CheckoutSessionResponseDto,
  CreateCheckoutSessionRequestDto,
  MercadoPagoConfirmCardPaymentRequestDto,
  MercadoPagoConfirmCardPaymentResponseDto,
  MercadoPagoPreparePaymentRequestDto,
  MercadoPagoPreparePaymentResponseDto,
  SubscriptionDto,
} from '../models/billing.models';

@Injectable({ providedIn: 'root' })
export class BillingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.billingApiPath;

  /**
   * POST /billing/checkout-session — devolve URL do checkout hospedado (Stripe Checkout).
   */
  createCheckoutSession(body: CreateCheckoutSessionRequestDto): Observable<CheckoutSessionResponseDto> {
    if (environment.useBillingMock) {
      return of(this.mockCheckout(body));
    }
    return this.http.post<CheckoutSessionResponseDto>(`${this.base}/checkout-session`, body);
  }

  /** GET /billing/subscription — estado atual para a conta autenticada. */
  getSubscription(): Observable<SubscriptionDto> {
    if (environment.useBillingMock) {
      return of(this.mockSubscription());
    }
    return this.http.get<SubscriptionDto>(`${this.base}/subscription`);
  }

  /**
   * POST /billing/mercadopago/card-payment/prepare — dados para Card Payment Brick (chave pública, valor, parcelas).
   */
  prepareMercadoPagoPayment(
    body: MercadoPagoPreparePaymentRequestDto,
  ): Observable<MercadoPagoPreparePaymentResponseDto> {
    if (environment.useBillingMock) {
      return of(this.mockMercadoPagoPrepare(body));
    }
    return this.http.post<MercadoPagoPreparePaymentResponseDto>(
      `${this.base}/mercadopago/card-payment/prepare`,
      body,
    );
  }

  /**
   * POST /billing/mercadopago/card-payment/confirm — envia token + dados do Brick ao backend para criar o pagamento na API MP.
   */
  confirmMercadoPagoCardPayment(
    body: MercadoPagoConfirmCardPaymentRequestDto,
  ): Observable<MercadoPagoConfirmCardPaymentResponseDto> {
    if (environment.useBillingMock) {
      return of(this.mockMercadoPagoConfirm());
    }
    return this.http.post<MercadoPagoConfirmCardPaymentResponseDto>(
      `${this.base}/mercadopago/card-payment/confirm`,
      body,
    );
  }

  private mockCheckout(body: CreateCheckoutSessionRequestDto): CheckoutSessionResponseDto {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams({
      mock: '1',
      plan: body.planCode,
    });
    return {
      sessionId: `cs_mock_${body.planCode}_${Date.now()}`,
      url: `${origin}/planos/retorno?${params.toString()}`,
    };
  }

  private mockSubscription(): SubscriptionDto {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS_DEFAULT);
    return {
      status: 'trialing',
      planId: 'price_cognora_10x_9_90',
      trialEndsAt: trialEnd.toISOString(),
      currentPeriodEnd: trialEnd.toISOString(),
      cancelAtPeriodEnd: false,
      billingPortalUrl: null,
    };
  }

  private mockMercadoPagoPrepare(
    _body: MercadoPagoPreparePaymentRequestDto,
  ): MercadoPagoPreparePaymentResponseDto {
    return {
      publicKey: environment.mercadoPagoPublicKey.trim(),
      amount: 99,
      maxInstallments: 10,
    };
  }

  private mockMercadoPagoConfirm(): MercadoPagoConfirmCardPaymentResponseDto {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      status: 'approved',
      redirectUrl: `${origin}/planos/retorno?status=success&mock=1`,
    };
  }
}
