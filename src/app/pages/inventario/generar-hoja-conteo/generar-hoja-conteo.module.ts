import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { GenerarHojaConteoComponent } from './generar-hoja-conteo.component';


@NgModule({
  declarations: [ GenerarHojaConteoComponent ],
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule
  ],
  exports: [ GenerarHojaConteoComponent
  ]
})
export class GenerarHojaConteoModule { }
