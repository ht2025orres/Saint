import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';
import { DashboardFinancieroInconsistenciasComponent } from './dashboard-financiero.component';

@NgModule({
  declarations: [DashboardFinancieroInconsistenciasComponent],
  imports: [CommonModule, FormsModule, NgChartsModule]
})
export class DashboardFinancieroModule { }
