import { Injectable } from '@angular/core';

const CHAVE = 'cognora:ultimoCicloId';

@Injectable({ providedIn: 'root' })
export class CicloPreferenciaService {
  obter(): number | null {
    const raw = localStorage.getItem(CHAVE);
    const id = raw ? Number(raw) : NaN;
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  salvar(cicloId: number): void {
    if (!Number.isFinite(cicloId) || cicloId <= 0) return;
    localStorage.setItem(CHAVE, String(cicloId));
  }

  limpar(): void {
    localStorage.removeItem(CHAVE);
  }
}