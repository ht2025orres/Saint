import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { BodegasComponent } from './bodegas.component';


@NgModule({
  declarations: [BodegasComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [
    BodegasComponent
  ]
})
export class BodegasModule { }
