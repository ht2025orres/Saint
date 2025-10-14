import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardEmpaqueComponent } from './dashboard-empaque.component';
import { FormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';



@NgModule({
  declarations: [DashboardEmpaqueComponent],
  imports: [
    CommonModule,
    FormsModule,
    NgChartsModule
  ]
})
export class DashboardEmpaqueModule { }
