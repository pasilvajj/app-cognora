import { Routes } from '@angular/router';
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
    path: '',
    component: MainLayout,
    canActivate: [AuthGuard], // 🔐 BLOQUEIA TUDO SEM LOGIN
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