import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirmasRoutingModule } from './firmas-routing.module';
import { SharedModule } from 'src/app/shared/shared.module';
import { FirmasComponent } from './firmas/firmas.component';
import { FirmasListaComponent } from './firmas-lista/firmas-lista.component';
import { FirmasSubirComponent } from './firmas-subir/firmas-subir.component';

@NgModule({
  declarations: [
    FirmasComponent,
    FirmasListaComponent,
    FirmasSubirComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    FirmasRoutingModule,
    SharedModule
  ]
})
export class FirmasModule { }
