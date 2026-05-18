const MERCADOPAGO_SDK_SRC = 'https://sdk.mercadopago.com/js/v2';

let sdkLoadPromise: Promise<void> | null = null;

function mercadoPagoGlobalLoaded(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { MercadoPago?: unknown }).MercadoPago === 'function'
  );
}

/** Carrega `sdk.mercadopago.com/js/v2` uma vez e resolve quando `window.MercadoPago` está disponível. */
export function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (mercadoPagoGlobalLoaded()) {
    return Promise.resolve();
  }
  if (!sdkLoadPromise) {
    sdkLoadPromise = new Promise<void>((resolve, reject) => {
      const finishOk = (): void => {
        if (mercadoPagoGlobalLoaded()) {
          resolve();
        } else {
          reject(new Error('Mercado Pago SDK indisponível'));
        }
      };

      const existing = document.querySelector(`script[src="${MERCADOPAGO_SDK_SRC}"]`);
      if (existing) {
        if (mercadoPagoGlobalLoaded()) {
          resolve();
          return;
        }
        existing.addEventListener('load', finishOk, { once: true });
        existing.addEventListener('error', () => reject(new Error('Mercado Pago SDK')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = MERCADOPAGO_SDK_SRC;
      script.async = true;
      script.onload = finishOk;
      script.onerror = () => reject(new Error('Não foi possível carregar o SDK do Mercado Pago'));
      document.body.appendChild(script);
    });
  }
  return sdkLoadPromise;
}
