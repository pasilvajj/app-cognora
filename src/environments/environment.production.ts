import { cognoraApiUrls } from './api-host';

/**
 * Build de produção — mesma API no EC2.
 */
export const environment = {
  production: true,
  ...cognoraApiUrls(),
  stripePublishableKey: '',
  mercadoPagoPublicKey: '',
  useBillingMock: false,
};
