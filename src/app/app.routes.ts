import { Routes } from '@angular/router';
import { AdminGuard } from './core/auth/admin.guard';
import { AuthGuard } from './core/auth/auth.guard';
import { pauseSessionGuard } from './core/guards/pause-session.guard';
import { MainLayout } from './core/layout/main-layout/main-layout';

export const routes: Routes = [


  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login/login')
        .then(m => m.Login),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/pages/register/register')
        .then(m => m.Register),
  },

  {
    path: 'planos',
    loadComponent: () =>
      import('./features/billing/layout/public-billing-shell/public-billing-shell')
        .then(m => m.PublicBillingShell),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/billing/pages/planos-page/planos-page')
            .then(m => m.PlanosPage),
      },
      {
        path: 'retorno',
        loadComponent: () =>
          import('./features/billing/pages/plano-retorno-page/plano-retorno-page')
            .then(m => m.PlanoRetornoPage),
      },
      {
        path: 'pagar',
        loadComponent: () =>
          import('./features/billing/pages/pagamento-cartao-page/pagamento-cartao-page').then(
            m => m.PagamentoCartaoPage,
          ),
      },
    ],
  },

  {
    path: '',
    component: MainLayout,
    canActivate: [AuthGuard], // 🔐 BLOQUEIA TUDO SEM LOGIN
    canActivateChild: [AuthGuard],
    children: [

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard-page/dashboard-page')
            .then(m => m.DashboardPage),
      },

      {
        path: 'estudaAgora/:cicloId',
        loadComponent: () =>
          import('./features/estudo/pages/estudar-agora/estudar-agora')
            .then(m => m.EstudarAgora),
      },

      {
        path: 'ciclos/:cicloId/disciplina/:disciplinaId/historico',
        loadComponent: () =>
          import(
            './features/disciplina-historico/pages/disciplina-historico-page/disciplina-historico-page'
          ).then((m) => m.DisciplinaHistoricoPage),
      },

      {
        path: 'estudo/sessao/:id',
        loadComponent: () =>
          import('./features/estudo/pages/sessao-estudo-page/sessao-estudo-page')
            .then(m => m.SessaoEstudoPage),
        canDeactivate: [pauseSessionGuard],
      },

      {
        path: 'ciclos',
        loadComponent: () =>
          import('./features/ciclos/pages/ciclo-list-page/ciclo-list-page')
            .then(m => m.CicloListPage),
      },
      {
        path: 'ciclos/novo',
        loadComponent: () =>
          import('./features/ciclos/pages/ciclo-create-page/ciclo-create-page')
            .then(m => m.CicloCreatePage),
      },
      {
        path: 'ciclos/visualizar/:id',
        loadComponent: () =>
          import('./features/ciclos/pages/ciclo-detail-page/ciclo-detail-page')
            .then(m => m.CicloDetailPage),
      },

      {
        path: 'ciclos/editar/:id',
        loadComponent: () =>
          import('./features/ciclos/pages/ciclo-detail-page/ciclo-detail-page')
            .then(m => m.CicloDetailPage),
      },

      {
        path: 'assinatura',
        loadComponent: () =>
          import('./features/billing/pages/assinatura-page/assinatura-page')
            .then(m => m.AssinaturaPage),
      },

      // =========================
      // PLANEJAMENTO
      // =========================
      {
        path: 'planejamento',
        loadComponent: () =>
          import('./features/planejamento/planejamento-page/planejamento-page')
            .then(m => m.PlanejamentoPage),
      },

      {
        path: 'edital-vertical',
        loadComponent: () =>
          import('./features/edital-vertical/pages/edital-vertical-page/edital-vertical-page')
            .then(m => m.EditalVerticalPage),
      },

      {
        path: 'catalogo',
        canActivate: [AdminGuard],
        loadComponent: () =>
          import('./features/catalogo/pages/catalogo-page/catalogo-page')
            .then(m => m.CatalogoPage),
      },

      {
        path: 'configuracoes',
        loadComponent: () =>
          import('./features/profile/pages/profile-settings/profile-settings')
            .then(m => m.ProfileSettingsPage),
      },

      // =========================
      // DEFAULT DA ÁREA LOGADA
      // =========================
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },

  // =========================
  // FALLBACK GLOBAL
  // =========================
  {
    path: '**',
    redirectTo: 'login',
  },
];