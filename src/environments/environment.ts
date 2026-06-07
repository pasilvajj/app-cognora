import { resolveCognoraApiUrls } from './api-host';

/**
 * Desenvolvimento (`ng serve`) — `/api` via proxy para EC2 AWS.
 */
export const environment = {
  production: false,
  ...resolveCognoraApiUrls(),
  stripePublishableKey: '',
  mercadoPagoPublicKey: '',
  useBillingMock: false,
};
