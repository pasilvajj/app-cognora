import { resolveCognoraApiUrls } from './api-host';

/**
 * Desenvolvimento (`ng serve`) — `/api` via proxy para EC2 (proxy.conf.json).
 */
export const environment = {
  production: false,
  ...resolveCognoraApiUrls(),
  stripePublishableKey: '',
  mercadoPagoPublicKey: '',
  useBillingMock: false,
};
