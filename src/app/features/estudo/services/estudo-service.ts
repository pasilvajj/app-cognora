import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class EstudoService {
  
private timerSub?: Subscription;

  private segundosSubject = new BehaviorSubject<number>(0);
  private rodandoSubject = new BehaviorSubject<boolean>(false);

  segundos$ = this.segundosSubject.asObservable();
  rodando$ = this.rodandoSubject.asObservable();

  iniciarOuContinuar() {
    if (this.timerSub) return;

    this.rodandoSubject.next(true);

    this.timerSub = interval(1000).subscribe(() => {
      this.segundosSubject.next(this.segundosSubject.value + 1);
    });
  }

  pausar() {
    this.timerSub?.unsubscribe();
    this.timerSub = undefined;
    this.rodandoSubject.next(false);
  }

  finalizar() {
    this.pausar();
    this.segundosSubject.next(0);
  }

  formatarTempo(segundos: number): string {
    const h = Math.floor(segundos / 3600).toString().padStart(2, '0');
    const m = Math.floor((segundos % 3600) / 60).toString().padStart(2, '0');
    const s = (segundos % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
}
