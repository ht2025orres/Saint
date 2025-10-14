import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { GestionEmpacadoresComponent } from './gestion-empacadores.component';



@NgModule({
  declarations: [GestionEmpacadoresComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ]
})
export class GestionEmpacadoresModule { }
