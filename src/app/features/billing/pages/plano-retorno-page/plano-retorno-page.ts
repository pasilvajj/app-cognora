import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-plano-retorno-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  templateUrl: './plano-retorno-page.html',
  styleUrl: './plano-retorno-page.css',
})
export class PlanoRetornoPage {
  private readonly route = inject(ActivatedRoute);

  readonly query = toSignal(
    this.route.queryParamMap.pipe(
      map((q) => ({
        status: q.get('status'),
        mock: q.get('mock'),
        plan: q.get('plan'),
      })),
    ),
    { initialValue: { status: null, mock: null, plan: null } },
  );
}
