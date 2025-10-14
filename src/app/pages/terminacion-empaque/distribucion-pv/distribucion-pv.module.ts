import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { DistribucionPvComponent } from './distribucion-pv.component';

@NgModule({
  declarations: [
    DistribucionPvComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [
    DistribucionPvComponent
  ]
})
export class DistribucionPvModule { }
