import { Routes } from '@angular/router';
import { CicloDetailPage } from '../ciclos/pages/ciclo-detail-page/ciclo-detail-page';

// ciclos.routes.ts
export const ciclosRoutes: Routes = [
  {
    path: 'ciclos/visualizar/:id',
    component: CicloDetailPage,
  },
  {
    path: 'ciclos/editar/:id',
    component: CicloDetailPage,
  },
];