import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';
import { ContadorItemsComponent } from './contador-items.component';

@NgModule({
  declarations: [ ContadorItemsComponent ],
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    SharedModule
  ],
  exports: [ 
    ContadorItemsComponent
  ]
})
export class ContadorItemsModule { }
