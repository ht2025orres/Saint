import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { RecepcionOpComponent } from './recepcion-op.component';

@NgModule({
  declarations: [
    RecepcionOpComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [
    RecepcionOpComponent
  ]
})
export class RecepcionOpModule { }
