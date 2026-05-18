import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';
import { TRIAL_DAYS_DEFAULT } from '../../config/payment-provider.config';

@Component({
  selector: 'app-planos-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, AppButtonComponent],
  templateUrl: './planos-page.html',
  styleUrl: './planos-page.css',
})
export class PlanosPage {
  readonly trialDays = TRIAL_DAYS_DEFAULT;

  readonly benefits = [
    'Ciclos e sessões de estudo ilimitados na app',
    'Progresso visual por disciplina e ciclo',
    'Planejamento integrado ao seu ritmo',
    'Modo foco e Pomodoro na sessão de estudo',
    'Sincronização segura dos seus dados',
    'Estude na web, quando e onde quiser',
  ] as const;

  readonly faqItems = [
    {
      q: 'Posso cancelar a qualquer momento?',
      a: `Sim. Durante os ${TRIAL_DAYS_DEFAULT} dias de teste não há cobrança; depois pode gerir ou cancelar a renovação conforme os termos do Mercado Pago.`,
    },
    {
      q: 'Como funciona o período de teste grátis?',
      a: `Tem ${TRIAL_DAYS_DEFAULT} dias para usar o Cognora sem custo. Após esse período inicia-se o plano (10 × R$ 9,90), salvo cancelamento atempo.`,
    },
    {
      q: 'Quais formas de pagamento são aceites?',
      a: 'Cartão de crédito através do checkout seguro do Mercado Pago (formulário na página seguinte).',
    },
  ] as const;
}
