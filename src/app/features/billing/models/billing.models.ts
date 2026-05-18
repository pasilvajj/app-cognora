/**
 * Contratos HTTP entre o front (`BillingApiService`) e a API Cognora.
 * O backend integra com **Mercado Pago** (Card Payment Brick + Payments API) ou Stripe e persiste o estado por utilizador.
 */

/** Estado da subscrição alinhado a Stripe (`subscription.status`) com valor local `none`. */
export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid';

export interface SubscriptionDto {
  status: SubscriptionStatus;
  /** Identificador do produto/preço no PSP (ex.: price_xxx). */
  planId: string | null;
  /** ISO 8601 — fim do período de teste; null se não aplicável. */
  trialEndsAt: string | null;
  /** ISO 8601 — fim do período de faturação atual. */
  currentPeriodEnd: string | null;
  /** Se true, a subscrição não renova após currentPeriodEnd. */
  cancelAtPeriodEnd: boolean;
  /** URL do portal do cliente (Stripe Customer Portal), quando disponível. */
  billingPortalUrl: string | null;
}

/** Código do único plano disponível nesta fase (10 × R$ 9,90). */
export type BillingPlanCode = 'standard';

export interface CreateCheckoutSessionRequestDto {
  planCode: BillingPlanCode;
  /** URLs absolutas para onde o PSP redireciona após pagamento. */
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResponseDto {
  /** URL do checkout hospedado (Stripe Checkout Session). */
  url: string;
  sessionId: string;
}

// --- Mercado Pago — Card Payment Brick + backend -----------------------------

/** Pedido de dados para montar o Brick (chave pública, valor, parcelas). */
export interface MercadoPagoPreparePaymentRequestDto {
  planCode: BillingPlanCode;
}

export interface MercadoPagoPreparePaymentResponseDto {
  /** Chave pública (TEST ou APP_USR) para `new MercadoPago(publicKey)`. */
  publicKey: string;
  /** Valor total em BRL exibido no Brick (ex.: 99 para o plano 10 × 9,90). */
  amount: number;
  /** Parcelas máximas no seletor do Brick. */
  maxInstallments: number;
}

/** Payload enviado ao backend após o Brick gerar token e dados do cartão. */
export interface MercadoPagoConfirmCardPaymentRequestDto {
  planCode: BillingPlanCode;
  /** Objeto `CardData` devolvido pelo callback `onSubmit` do Card Payment Brick. */
  cardData: unknown;
  /** Objeto `AdditionalData` (opcional), segundo parâmetro do `onSubmit`. */
  additionalData?: unknown;
}

export type MercadoPagoPaymentResultStatus = 'approved' | 'pending' | 'rejected';

export interface MercadoPagoConfirmCardPaymentResponseDto {
  status: MercadoPagoPaymentResultStatus;
  /** Quando definido, o front navega para esta URL (path absoluto ou relativo ao origin). */
  redirectUrl: string | null;
}
