import { CanDeactivateFn } from '@angular/router';
import { PauseSessionContract } from './pause-session.contract';

export const pauseSessionGuard: CanDeactivateFn<PauseSessionContract> = (
  component
) => {

  // não precisa pausar → pode sair direto
  if (!component.devePausarAntesDeSair()) return true;

  // precisa pausar → executa pausa assíncrona
  return component.pausarAntesDeSair();
};