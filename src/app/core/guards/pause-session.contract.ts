import { Observable } from 'rxjs';

export interface PauseSessionContract {
  devePausarAntesDeSair(): boolean;
  pausarAntesDeSair(): Observable<boolean>;
}