/**
 * URLs relativas ao host da página: funcionam com `ng serve` + `proxy.conf.json`
 * e evitam CORS (pedidos vão ao mesmo origin e o proxy encaminha ao Spring).
 * Para API noutro domínio, use build com replacement ou variável de ambiente.
 */
export const environment = {
  production: false,
  /** REST e auth sob o mesmo prefixo — um único proxy `/api` no `ng serve`. */
  apiBaseUrl: '/api',
  authBaseUrl: '/api/auth',
  /**
   * Billing: backend expõe sessão de checkout e estado da subscrição (Stripe ou outro PSP).
   * `stripePublishableKey` — só necessário para Checkout embutido (Elements); com redirect basta o backend.
   */
  billingApiPath: '/api/billing',
  stripePublishableKey: '',
  /**
   * Mercado Pago — chave pública para Checkout Bricks (Card Payment Brick).
   * Use a credencial de **teste** do painel (Brasil) em desenvolvimento.
   */
  mercadoPagoPublicKey: '',
  /** Quando true e a API não responde, o BillingApiService devolve dados fictícios para desenvolvimento local. */
  useBillingMock: true,
};
