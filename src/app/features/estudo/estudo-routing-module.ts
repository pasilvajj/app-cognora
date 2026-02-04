import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EstudoPage } from './pages/estudo-page/estudo-page';


const routes: Routes = [
  {
    path: '',
    component: EstudoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EstudoRoutingModule { }
