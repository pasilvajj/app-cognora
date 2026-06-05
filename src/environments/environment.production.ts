import { cognoraApiUrlsRelative } from './api-host';

/**
 * Build de produção (Vercel) — API via proxy same-origin em vercel.json.
 */
export const environment = {
  production: true,
  ...cognoraApiUrlsRelative(),
  stripePublishableKey: '',
  mercadoPagoPublicKey: '',
  useBillingMock: false,
};
