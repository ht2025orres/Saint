import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { CosteosRoutingModule } from './costeos-routing.module';
import { CosteosListComponent } from './costeos-list/costeos-list.component';
import { CosteosDetailComponent } from './costeos-detail/costeos-detail.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    CosteosListComponent,
    CosteosDetailComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CosteosRoutingModule,
    SharedModule
  ]
})
export class CosteosModule { }
