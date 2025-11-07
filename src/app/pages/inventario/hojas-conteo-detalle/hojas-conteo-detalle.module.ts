import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';
import { HojasConteoDetalleComponent } from './hojas-conteo-detalle.component';

@NgModule({
  declarations: [ HojasConteoDetalleComponent ],
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    SharedModule
  ],
  exports: [ HojasConteoDetalleComponent ]
})
export class HojasConteoDetalleModule { }
