import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { CentrosCostosComponent } from './centros-costos.component';

@NgModule({
  declarations: [CentrosCostosComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [
    CentrosCostosComponent
  ]
})
export class CentrosCostosModule { }
