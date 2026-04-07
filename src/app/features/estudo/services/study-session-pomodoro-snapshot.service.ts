import { Injectable } from '@angular/core';

import { PomodoroMode } from './pomodoro-engine-service';

export interface PomodoroSnapshot {
  modo: PomodoroMode;
  cicloIndex: number;
  restanteSeg: number;
  savedAtEpochMs: number;
}

@Injectable({ providedIn: 'root' })
export class StudySessionPomodoroSnapshotService {
  private static readonly STORAGE_KEY = 'study-pomodoro-snapshots';
  private static readonly MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
  private readonly snapshots = new Map<number, PomodoroSnapshot>();

  constructor() {
    this.loadFromStorage();
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
    this.saveToStorage();
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
}
