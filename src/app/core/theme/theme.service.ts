import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, computed, signal } from '@angular/core';

type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly STORAGE_KEY = 'cognora-theme';
  private readonly currentTheme = signal<ThemeMode>('light');

  readonly isDark = computed(() => this.currentTheme() === 'dark');

  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    this.init();
  }

  toggleTheme(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  private init(): void {
    const stored = this.readStoredTheme();
    if (stored) {
      this.applyTheme(stored);
      return;
    }

    const prefersDark = typeof window !== 'undefined'
      && !!window.matchMedia
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.applyTheme(prefersDark ? 'dark' : 'light');
  }

  private setTheme(theme: ThemeMode): void {
    this.applyTheme(theme);
    try {
      localStorage.setItem(ThemeService.STORAGE_KEY, theme);
    } catch {
      // Ignora bloqueios de storage (ex.: modo privado restrito).
    }
  }

  private applyTheme(theme: ThemeMode): void {
    this.currentTheme.set(theme);
    this.document.documentElement.setAttribute('data-theme', theme);
  }

  private readStoredTheme(): ThemeMode | null {
    try {
      const raw = localStorage.getItem(ThemeService.STORAGE_KEY);
      return raw === 'dark' || raw === 'light' ? raw : null;
    } catch {
      return null;
    }
  }
}
