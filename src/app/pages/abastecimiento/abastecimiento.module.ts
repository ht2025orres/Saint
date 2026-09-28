import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AbastecimientoRoutingModule } from './abastecimiento-routing.module';
import { SeguimientoAbastecimientoComponent } from './seguimiento-abastecimiento/seguimiento-abastecimiento.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    SeguimientoAbastecimientoComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AbastecimientoRoutingModule,
    SharedModule
  ]
})
export class AbastecimientoModule { }
