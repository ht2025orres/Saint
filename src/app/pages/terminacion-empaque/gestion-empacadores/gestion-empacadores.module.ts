import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { GestionEmpacadoresComponent } from './gestion-empacadores.component';
import { AsignarPvModalComponent } from './modals/asignar-pv-modal/asignar-pv-modal.component';
import { DesasignarPvModalComponent } from './modals/desasignar-pv-modal/desasignar-pv-modal.component';


@NgModule({
  declarations: [
    GestionEmpacadoresComponent,
    AsignarPvModalComponent,
    DesasignarPvModalComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ]
})
export class GestionEmpacadoresModule { }
