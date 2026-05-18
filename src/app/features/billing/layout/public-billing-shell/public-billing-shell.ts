import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

/**
 * Shell mínimo para páginas de billing públicas (sem sidebar nem AuthGuard).
 */
@Component({
  selector: 'app-public-billing-shell',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  templateUrl: './public-billing-shell.html',
  styleUrl: './public-billing-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicBillingShell {}
