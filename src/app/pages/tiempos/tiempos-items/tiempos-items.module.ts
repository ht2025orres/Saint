import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { TiemposItemsComponent } from './tiempos-items.component';

@NgModule({
  declarations: [TiemposItemsComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [
    TiemposItemsComponent
  ]
})
export class TiemposItemsModule { }