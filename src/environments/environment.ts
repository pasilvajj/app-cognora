import { resolveCognoraApiUrls } from './api-host';

/**
 * Desenvolvimento (`ng serve`) — HTTP local usa EC2 direto; HTTPS usa `/api` (proxy).
 */
export const environment = {
  production: false,
  ...resolveCognoraApiUrls(),
  stripePublishableKey: '',
  mercadoPagoPublicKey: '',
  useBillingMock: false,
};
