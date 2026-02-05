import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { OrdenCompraComponent } from './orden-compra.component';

@NgModule({
  declarations: [OrdenCompraComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [
    OrdenCompraComponent
  ]
})
export class OrdenCompraModule { }