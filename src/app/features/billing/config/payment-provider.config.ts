/**
 * PSP escolhido para assinatura / período de teste.
 *
 * **Mercado Pago** — Checkout Bricks no front (`cardPayment`) + backend com Access Token para criar pagamentos / planos.
 *
 * **Stripe** — alternativa com Checkout Session hospedado e trial nativo em subscrições.
 *
 * O backend deve persistir o estado por `userId`; o front apenas prepara o Brick e envia o token/dados ao confirmar.
 */
export const SELECTED_PAYMENT_PROVIDER = 'mercado_pago' as const;

export type PaymentProviderId = typeof SELECTED_PAYMENT_PROVIDER | 'stripe';

/** Dias de teste grátis antes da primeira cobrança (produto). */
export const TRIAL_DAYS_DEFAULT = 7;
