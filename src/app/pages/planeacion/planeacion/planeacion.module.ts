import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';
import { PlaneacionComponent } from './planeacion.component';

@NgModule({
  declarations: [PlaneacionComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [PlaneacionComponent]
})
export class PlaneacionModule { }