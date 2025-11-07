import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';
import { HojasConteoListComponent } from './hojas-conteo-list.component';

@NgModule({
  declarations: [ HojasConteoListComponent ],
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    SharedModule
  ],
  exports: [ HojasConteoListComponent
  ]
})
export class HojasConteoListModule { }
