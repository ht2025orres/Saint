import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { RegistrarEmpaqueComponent } from './registrar-empaque.component';


@NgModule({
  declarations: [RegistrarEmpaqueComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [
    RegistrarEmpaqueComponent
  ]
})
export class RegistrarEmpaqueModule { }
