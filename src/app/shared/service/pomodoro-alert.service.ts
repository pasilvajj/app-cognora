import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PomodoroAlertService {
  private audioCtx?: AudioContext;

  play(): void {
    try {
      const Ctx =
        (window as any).AudioContext ||
        (window as any).webkitAudioContext;

      if (!Ctx) return;

      // 🔒 cria contexto LOCAL garantido
      let ctx: AudioContext;

      if (this.audioCtx) {
        ctx = this.audioCtx;
      } else {
        ctx = new Ctx();
        this.audioCtx = ctx;
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;

      gain.gain.value = 0.0001;

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      oscillator.start(now);
      oscillator.stop(now + 0.26);
    } catch {
      // navegador bloqueou autoplay ou erro de contexto
    }
  }
}