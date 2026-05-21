import { Injectable } from '@angular/core';

import { PomodoroMode } from './pomodoro-engine-service';

export interface PomodoroSnapshot {
  modo: PomodoroMode;
  cicloIndex: number;
  restanteSeg: number;
  savedAtEpochMs: number;
}

/** Modal Pomodoro (fim de foco / fim de pausa) aguardando Ok — persiste em F5. */
export interface PomodoroOverlayPending {
  texto: string;
  focusFinished: boolean;
  savedAtEpochMs: number;
}

/** “Desativar agora” na sessão — não vem da API; persiste em F5. */
export interface PomodoroTempDesativadoRow {
  ativo: boolean;
  savedAtEpochMs: number;
}

@Injectable({ providedIn: 'root' })
export class StudySessionPomodoroSnapshotService {
  private static readonly STORAGE_KEY = 'study-pomodoro-snapshots';
  private static readonly OVERLAY_KEY = 'study-pomodoro-overlay-pending';
  private static readonly TEMP_DESAT_KEY = 'study-pomodoro-temp-desativado';
  private static readonly MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
  private readonly snapshots = new Map<number, PomodoroSnapshot>();
  private readonly overlayPending = new Map<number, PomodoroOverlayPending>();
  private readonly tempDesativado = new Map<number, PomodoroTempDesativadoRow>();

  constructor() {
    this.loadFromStorage();
    this.loadOverlayFromStorage();
    this.loadTempDesativadoFromStorage();
  }

  set(sessionId: number, snapshot: PomodoroSnapshot): void {
    if (!sessionId || snapshot.restanteSeg <= 0) return;
    this.snapshots.set(sessionId, {
      ...snapshot,
      savedAtEpochMs: Date.now(),
    });
    this.saveToStorage();
  }

  get(sessionId: number): PomodoroSnapshot | null {
    const snapshot = this.snapshots.get(sessionId) ?? null;
    if (!snapshot) return null;

    if (Date.now() - snapshot.savedAtEpochMs > StudySessionPomodoroSnapshotService.MAX_AGE_MS) {
      this.snapshots.delete(sessionId);
      this.saveToStorage();
      return null;
    }

    return snapshot;
  }

  clear(sessionId: number): void {
    this.snapshots.delete(sessionId);
    this.overlayPending.delete(sessionId);
    this.tempDesativado.delete(sessionId);
    this.saveToStorage();
    this.saveOverlayToStorage();
    this.saveTempDesativadoToStorage();
  }

  /** Utilizador escolheu “Desativar agora” (pausa o motor Pomodoro localmente). */
  setTemporariamenteDesativado(sessionId: number, value: boolean): void {
    if (!sessionId) return;
    if (!value) {
      this.tempDesativado.delete(sessionId);
    } else {
      this.tempDesativado.set(sessionId, { ativo: true, savedAtEpochMs: Date.now() });
    }
    this.saveTempDesativadoToStorage();
  }

  getTemporariamenteDesativado(sessionId: number): boolean {
    const row = this.tempDesativado.get(sessionId);
    if (!row?.ativo) return false;
    if (
      !row.savedAtEpochMs ||
      Date.now() - row.savedAtEpochMs > StudySessionPomodoroSnapshotService.MAX_AGE_MS
    ) {
      this.tempDesativado.delete(sessionId);
      this.saveTempDesativadoToStorage();
      return false;
    }
    return true;
  }

  setOverlayPending(sessionId: number, data: Omit<PomodoroOverlayPending, 'savedAtEpochMs'>): void {
    if (!sessionId || !data.texto) return;
    this.overlayPending.set(sessionId, {
      ...data,
      savedAtEpochMs: Date.now(),
    });
    this.saveOverlayToStorage();
  }

  getOverlayPending(sessionId: number): PomodoroOverlayPending | null {
    const row = this.overlayPending.get(sessionId) ?? null;
    if (!row) return null;
    if (Date.now() - row.savedAtEpochMs > StudySessionPomodoroSnapshotService.MAX_AGE_MS) {
      this.overlayPending.delete(sessionId);
      this.saveOverlayToStorage();
      return null;
    }
    return row;
  }

  clearOverlayPending(sessionId: number): void {
    if (!sessionId) return;
    this.overlayPending.delete(sessionId);
    this.saveOverlayToStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(StudySessionPomodoroSnapshotService.STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Record<string, PomodoroSnapshot>;
      for (const [id, snapshot] of Object.entries(parsed)) {
        const sessionId = Number(id);
        if (
          !sessionId ||
          !snapshot ||
          snapshot.restanteSeg <= 0 ||
          !snapshot.savedAtEpochMs ||
          Date.now() - snapshot.savedAtEpochMs > StudySessionPomodoroSnapshotService.MAX_AGE_MS
        ) {
          continue;
        }
        this.snapshots.set(sessionId, snapshot);
      }
    } catch {
      this.snapshots.clear();
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    const serializable: Record<number, PomodoroSnapshot> = {};
    for (const [sessionId, snapshot] of this.snapshots.entries()) {
      serializable[sessionId] = snapshot;
    }

    window.localStorage.setItem(
      StudySessionPomodoroSnapshotService.STORAGE_KEY,
      JSON.stringify(serializable),
    );
  }

  private loadOverlayFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(StudySessionPomodoroSnapshotService.OVERLAY_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Record<string, PomodoroOverlayPending>;
      for (const [id, row] of Object.entries(parsed)) {
        const sessionId = Number(id);
        if (
          !sessionId ||
          !row ||
          !row.texto ||
          !row.savedAtEpochMs ||
          Date.now() - row.savedAtEpochMs > StudySessionPomodoroSnapshotService.MAX_AGE_MS
        ) {
          continue;
        }
        this.overlayPending.set(sessionId, row);
      }
    } catch {
      this.overlayPending.clear();
    }
  }

  private saveOverlayToStorage(): void {
    if (typeof window === 'undefined') return;

    const serializable: Record<number, PomodoroOverlayPending> = {};
    for (const [sessionId, row] of this.overlayPending.entries()) {
      serializable[sessionId] = row;
    }

    window.localStorage.setItem(
      StudySessionPomodoroSnapshotService.OVERLAY_KEY,
      JSON.stringify(serializable),
    );
  }

  private loadTempDesativadoFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(StudySessionPomodoroSnapshotService.TEMP_DESAT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, PomodoroTempDesativadoRow>;
      for (const [id, row] of Object.entries(parsed)) {
        const sessionId = Number(id);
        if (
          !sessionId ||
          !row ||
          !row.ativo ||
          !row.savedAtEpochMs ||
          Date.now() - row.savedAtEpochMs > StudySessionPomodoroSnapshotService.MAX_AGE_MS
        ) {
          continue;
        }
        this.tempDesativado.set(sessionId, row);
      }
    } catch {
      this.tempDesativado.clear();
    }
  }

  private saveTempDesativadoToStorage(): void {
    if (typeof window === 'undefined') return;
    const serializable: Record<number, PomodoroTempDesativadoRow> = {};
    for (const [sessionId, row] of this.tempDesativado.entries()) {
      serializable[sessionId] = row;
    }
    window.localStorage.setItem(
      StudySessionPomodoroSnapshotService.TEMP_DESAT_KEY,
      JSON.stringify(serializable),
    );
  }
}
