import { resolveCognoraApiUrls } from './api-host';

/**
 * Build de produção (Vercel) — API via proxy same-origin em vercel.json.
 */
export const environment = {
  production: true,
  ...resolveCognoraApiUrls(),
  stripePublishableKey: '',
  mercadoPagoPublicKey: '',
  useBillingMock: false,
};
