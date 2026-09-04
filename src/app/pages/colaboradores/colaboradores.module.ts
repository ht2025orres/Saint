import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';

import { ColaboradoresGestionComponent } from './colaboradores-gestion.component';

@NgModule({
  declarations: [
    ColaboradoresGestionComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [
    ColaboradoresGestionComponent
  ]
})
export class ColaboradoresModule { }
