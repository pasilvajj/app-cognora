/**
 * Contrato de webhooks para implementação no backend (Stripe ou outro PSP).
 * O front não recebe webhooks — isto documenta o que a API deve processar com idempotência.
 *
 * Idempotência: guardar `event.id` (Stripe) ou equivalente; ignorar duplicados.
 */

/** Eventos Stripe frequentemente usados para subscrição + trial (nomes ilustrativos). */
export const STRIPE_WEBHOOK_EVENTS_RELEVANT = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const;

/** Checklist manual — executar em Stripe Dashboard > Developers > Webhooks (modo teste). */
export const BILLING_SANDBOX_CHECKLIST = `
Checklist trial 7 dias (Stripe test mode):
1. Criar Products/Prices (mensal e anual) e guardar price_ ids no backend.
2. Implementar POST /api/billing/checkout-session com trial_period_days=7 na Subscription/Checkout.
3. Configurar webhook endpoint HTTPS com STRIPE_WEBHOOK_SECRET; responder 200 rápido.
4. Testar: Checkout completo com cartão 4242... → estado trialing + trialEndsAt no utilizador.
5. Simular customer.subscription.updated (cancel_at_period_end) e invoice.paid após trial.
6. Verificar idempotência reenviando o mesmo event.id.
` as const;
