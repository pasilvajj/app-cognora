import { Injectable } from '@angular/core';

export type AlertSoundProfile = 'SUAVE' | 'CAMPAINHA';

@Injectable({ providedIn: 'root' })
export class StudyAlertSoundService {
  private audioCtx: AudioContext | null = null;
  private profile: AlertSoundProfile = 'CAMPAINHA';

  setProfile(profile: AlertSoundProfile): void {
    this.profile = profile;
  }

  playBreakEnded(): void {
    if (this.profile === 'SUAVE') {
      void this.playSequenceAsync([
        { freq: 880, durationMs: 140, delayMs: 0, type: 'sine', gain: 0.12 },
        { freq: 1046, durationMs: 170, delayMs: 180, type: 'sine', gain: 0.12 },
      ]);
      return;
    }

    void this.playSequenceAsync([
      { freq: 1046, durationMs: 190, delayMs: 0, type: 'triangle', gain: 0.18 },
      { freq: 1318, durationMs: 230, delayMs: 210, type: 'triangle', gain: 0.2 },
      { freq: 1046, durationMs: 150, delayMs: 520, type: 'triangle', gain: 0.16 },
    ]);
  }

  playBreakStarted(): void {
    void this.playFocusEnded();
  }

  /** Alerta sonoro ao encerrar o tempo de foco (início da pausa). */
  playFocusEnded(): void {
    if (this.profile === 'SUAVE') {
      void this.playSequenceAsync([
        { freq: 784, durationMs: 130, delayMs: 0, type: 'sine', gain: 0.14 },
        { freq: 988, durationMs: 170, delayMs: 150, type: 'sine', gain: 0.15 },
      ]);
      return;
    }

    void this.playSequenceAsync([
      { freq: 880, durationMs: 140, delayMs: 0, type: 'triangle', gain: 0.21 },
      { freq: 1174, durationMs: 180, delayMs: 160, type: 'triangle', gain: 0.23 },
    ]);
  }

  playBackToStudy(): void {
    if (this.profile === 'SUAVE') {
      void this.playSequenceAsync([
        { freq: 740, durationMs: 110, delayMs: 0, type: 'sine', gain: 0.1 },
      ]);
      return;
    }

    void this.playSequenceAsync([
      { freq: 988, durationMs: 130, delayMs: 0, type: 'triangle', gain: 0.16 },
      { freq: 1174, durationMs: 140, delayMs: 140, type: 'triangle', gain: 0.16 },
    ]);
  }

  playSessionFinished(): void {
    if (this.profile === 'SUAVE') {
      void this.playSequenceAsync([
        { freq: 988, durationMs: 140, delayMs: 0, type: 'sine', gain: 0.11 },
        { freq: 1174, durationMs: 170, delayMs: 170, type: 'sine', gain: 0.12 },
        { freq: 1318, durationMs: 220, delayMs: 380, type: 'sine', gain: 0.12 },
      ]);
      return;
    }

    void this.playSequenceAsync([
      { freq: 1046, durationMs: 170, delayMs: 0, type: 'triangle', gain: 0.2 },
      { freq: 1318, durationMs: 200, delayMs: 190, type: 'triangle', gain: 0.22 },
      { freq: 1568, durationMs: 260, delayMs: 420, type: 'triangle', gain: 0.24 },
    ]);
  }

  /**
   * Desbloqueia o áudio após gesto do utilizador (iniciar/retomar sessão).
   * Sem isto, alertas automáticos (fim de foco) ficam mudos por política de autoplay.
   */
  primeAudioContext(): void {
    void this.ensureContextReady().then((ctx) => {
      if (!ctx) return;
      this.playTone(ctx, 440, 1, ctx.currentTime, 'sine', 0.0001);
    });
  }

  private async playSequenceAsync(notes: Array<{
    freq: number;
    durationMs: number;
    delayMs: number;
    type: OscillatorType;
    gain: number;
  }>): Promise<void> {
    const ctx = await this.ensureContextReady();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (const note of notes) {
      this.playTone(ctx, note.freq, note.durationMs, now + note.delayMs / 1000, note.type, note.gain);
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    durationMs: number,
    startAtSec: number,
    type: OscillatorType,
    gainPeak: number,
  ): void {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startAtSec);

      gain.gain.setValueAtTime(0.0001, startAtSec);
      gain.gain.linearRampToValueAtTime(gainPeak, startAtSec + 0.01);
      gain.gain.linearRampToValueAtTime(0.0001, startAtSec + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startAtSec);
      osc.stop(startAtSec + durationMs / 1000 + 0.02);
    } catch {
      // Falha silenciosa: não interrompe fluxo do cronômetro.
    }
  }

  private async ensureContextReady(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return null;
      this.audioCtx = new Ctx();
    }

    if (this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        return null;
      }
    }

    return this.audioCtx;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return null;
      this.audioCtx = new Ctx();
    }

    return this.audioCtx;
  }
}
