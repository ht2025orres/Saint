import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SeguimientoDocumentosComponent } from './seguimiento-documentos.component';
import { ModalDetalleComponent } from './modals/modal-detalle/modal-detalle.component';
import { SharedModule } from 'src/app/shared/shared.module';

const routes: Routes = [
  { path: '', component: SeguimientoDocumentosComponent }
];

@NgModule({
  declarations: [
    SeguimientoDocumentosComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    SharedModule,
    ModalDetalleComponent
  ]
})
export class SeguimientoDocumentosModule { }
