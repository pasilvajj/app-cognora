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
      this.playSequence([
        { freq: 880, durationMs: 140, delayMs: 0, type: 'sine', gain: 0.12 },
        { freq: 1046, durationMs: 170, delayMs: 180, type: 'sine', gain: 0.12 },
      ]);
      return;
    }

    // CAMPAINHA: mais perceptível (duplo ding com ataque curto).
    this.playSequence([
      { freq: 1046, durationMs: 190, delayMs: 0,   type: 'triangle', gain: 0.18 },
      { freq: 1318, durationMs: 230, delayMs: 210, type: 'triangle', gain: 0.2 },
      { freq: 1046, durationMs: 150, delayMs: 520, type: 'triangle', gain: 0.16 },
    ]);
  }

  playBreakStarted(): void {
    if (this.profile === 'SUAVE') {
      this.playSequence([
        { freq: 784, durationMs: 130, delayMs: 0, type: 'sine', gain: 0.14 },
        { freq: 988, durationMs: 170, delayMs: 150, type: 'sine', gain: 0.15 },
      ]);
      return;
    }

    // CAMPAINHA curta para sinalizar início da pausa.
    this.playSequence([
      { freq: 880, durationMs: 140, delayMs: 0,   type: 'triangle', gain: 0.21 },
      { freq: 1174, durationMs: 180, delayMs: 160, type: 'triangle', gain: 0.23 },
    ]);
  }

  playBackToStudy(): void {
    if (this.profile === 'SUAVE') {
      this.playSequence([
        { freq: 740, durationMs: 110, delayMs: 0, type: 'sine', gain: 0.1 },
      ]);
      return;
    }

    // CAMPAINHA curta para "voltar ao foco".
    this.playSequence([
      { freq: 988, durationMs: 130, delayMs: 0,   type: 'triangle', gain: 0.16 },
      { freq: 1174, durationMs: 140, delayMs: 140, type: 'triangle', gain: 0.16 },
    ]);
  }

  private playSequence(notes: Array<{
    freq: number;
    durationMs: number;
    delayMs: number;
    type: OscillatorType;
    gain: number;
  }>): void {
    const ctx = this.ensureContext();
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

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return null;
      this.audioCtx = new Ctx();
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => void 0);
    }

    return this.audioCtx;
  }
}
