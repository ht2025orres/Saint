import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MuestrasRoutingModule } from './muestras-routing.module';
import { MuestrasListComponent } from './muestras-list/muestras-list.component';
import { MuestrasDetailComponent } from './muestras-detail/muestras-detail.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    MuestrasListComponent,
    MuestrasDetailComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MuestrasRoutingModule,
    SharedModule
  ]
})
export class MuestrasModule { }
