import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EstudoRoutingModule } from './estudo-routing-module';

import { EstudoTimer } from './components/estudo-timer/estudo-timer';


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    EstudoTimer,
    EstudoRoutingModule
  ]
})
export class EstudoModule { }
