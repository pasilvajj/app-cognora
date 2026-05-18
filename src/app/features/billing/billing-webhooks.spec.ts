import { BILLING_SANDBOX_CHECKLIST, STRIPE_WEBHOOK_EVENTS_RELEVANT } from './billing-webhooks.contract';

describe('Billing webhook contract (trial / sandbox)', () => {
  it('lista eventos Stripe relevantes', () => {
    expect(STRIPE_WEBHOOK_EVENTS_RELEVANT.length).toBeGreaterThan(3);
    expect(STRIPE_WEBHOOK_EVENTS_RELEVANT).toContain('checkout.session.completed');
  });

  it('checklist sandbox não está vazia', () => {
    expect(BILLING_SANDBOX_CHECKLIST.length).toBeGreaterThan(80);
    expect(BILLING_SANDBOX_CHECKLIST).toContain('trial_period_days');
  });
});
