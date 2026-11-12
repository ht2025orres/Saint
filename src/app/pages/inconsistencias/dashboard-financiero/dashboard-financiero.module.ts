import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';
import { DashboardFinancieroInconsistenciasComponent } from './dashboard-financiero.component';
import { DetalleInconsistenciasModalComponent } from './modals/detalle-inconsistencias-modal/detalle-inconsistencias-modal.component';

@NgModule({
  declarations: [
    DashboardFinancieroInconsistenciasComponent,
    DetalleInconsistenciasModalComponent
  ],
  imports: [CommonModule, FormsModule, NgChartsModule],
  exports: [DashboardFinancieroInconsistenciasComponent]
})
export class DashboardFinancieroModule { }
