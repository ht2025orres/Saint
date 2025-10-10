import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../shared/shared.module';
import { AprobacionComponent } from './aprobacion.component';

@NgModule({
  declarations: [AprobacionComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ]
})
export class AprobacionModule { }
