import { resolveCognoraApiUrls } from './api-host';

/**
 * Desenvolvimento (`ng serve`) — `/api` via proxy para localhost:8080.
 */
export const environment = {
  production: false,
  ...resolveCognoraApiUrls(),
  stripePublishableKey: '',
  mercadoPagoPublicKey: '',
  useBillingMock: false,
};
