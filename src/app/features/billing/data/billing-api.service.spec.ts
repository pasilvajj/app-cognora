import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { BillingApiService } from './billing-api.service';
import { environment } from '../../../../environments/environment';

describe('BillingApiService', () => {
  let httpMock: HttpTestingController;
  const savedUseBillingMock = environment.useBillingMock;

  afterAll(() => {
    environment.useBillingMock = savedUseBillingMock;
  });

  describe('com useBillingMock', () => {
    beforeEach(() => {
      environment.useBillingMock = true;
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), BillingApiService],
      });
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      httpMock.verify();
    });

    it('deve criar o serviço', () => {
      expect(TestBed.inject(BillingApiService)).toBeTruthy();
    });

    it('prepareMercadoPagoPayment devolve chave e valores em mock', async () => {
      const res = await firstValueFrom(
        TestBed.inject(BillingApiService).prepareMercadoPagoPayment({ planCode: 'standard' }),
      );
      expect(res.amount).toBe(99);
      expect(res.maxInstallments).toBe(10);
      expect(typeof res.publicKey).toBe('string');
    });

    it('confirmMercadoPagoCardPayment devolve redirectUrl em mock', async () => {
      const res = await firstValueFrom(
        TestBed.inject(BillingApiService).confirmMercadoPagoCardPayment({
          planCode: 'standard',
          cardData: {},
        }),
      );
      expect(res.redirectUrl).toContain('/planos/retorno');
      expect(res.status).toBe('approved');
    });

    it('createCheckoutSession devolve URL de retorno local', async () => {
      const res = await firstValueFrom(
        TestBed.inject(BillingApiService).createCheckoutSession({
          planCode: 'standard',
          successUrl: 'http://localhost/success',
          cancelUrl: 'http://localhost/cancel',
        }),
      );
      expect(res.url).toContain('/planos/retorno');
      expect(res.sessionId).toContain('cs_mock_standard');
    });
  });

  describe('sem useBillingMock', () => {
    beforeEach(() => {
      environment.useBillingMock = false;
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), BillingApiService],
      });
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      httpMock.verify();
    });

    it('createCheckoutSession faz POST ao backend', async () => {
      const promise = firstValueFrom(
        TestBed.inject(BillingApiService).createCheckoutSession({
          planCode: 'standard',
          successUrl: 'http://localhost/s',
          cancelUrl: 'http://localhost/c',
        }),
      );

      const req = httpMock.expectOne('/api/billing/checkout-session');
      expect(req.request.method).toBe('POST');
      req.flush({ url: 'https://checkout.stripe.test/cs_test', sessionId: 'cs_test_1' });

      const res = await promise;
      expect(res.url).toBe('https://checkout.stripe.test/cs_test');
    });
  });
});
