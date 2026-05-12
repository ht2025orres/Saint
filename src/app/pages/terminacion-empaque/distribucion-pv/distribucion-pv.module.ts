import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { DistribucionPvComponent } from './distribucion-pv.component';
import { ModalItemsComponent } from './modals/modal-items/modal-items.component';
import { ModalVerificacionComponent } from './modals/modal-verificacion/modal-verificacion.component';
import { ModalUbicacionesComponent } from './modals/modal-ubicaciones/modal-ubicaciones.component';

@NgModule({
  declarations: [
    DistribucionPvComponent,
    ModalItemsComponent,
    ModalVerificacionComponent,
    ModalUbicacionesComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [
    DistribucionPvComponent
  ]
})
export class DistribucionPvModule { }
