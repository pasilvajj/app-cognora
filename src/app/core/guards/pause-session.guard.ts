import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SessaoEstudoPage } from '../../features/estudo/pages/sessao-estudo-page/sessao-estudo-page';

@Injectable({ providedIn: 'root' })
export class PauseSessionGuard implements CanDeactivate<SessaoEstudoPage> {
  canDeactivate(component: SessaoEstudoPage): boolean | Observable<boolean> {
    if (!component) return true;

    // se não precisa pausar, libera navegação
    if (!component.devePausarAntesDeSair()) return true;

    // pausa e libera navegação ao concluir
    return component.pausarAntesDeSair().pipe(
      catchError((e) => {
        console.error('Erro ao pausar antes de sair', e);
        // decide liberar mesmo com erro
        return of(true);
      })
    );
  }
}