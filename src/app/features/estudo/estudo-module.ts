import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EstudoRoutingModule } from './estudo-routing-module';

import { EstudoPage } from './pages/estudo-page/estudo-page';
import { EstudoTimer } from './components/estudo-timer/estudo-timer';


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    EstudoPage,
    EstudoTimer,

    EstudoRoutingModule
  ]
})
export class EstudoModule { }
