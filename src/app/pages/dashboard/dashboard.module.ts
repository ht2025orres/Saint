import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './dashboard.component';
import { MetricCardComponent } from './components/metric-card/metric-card.component';

@NgModule({
  declarations: [DashboardComponent, MetricCardComponent],
  imports: [CommonModule],
  exports: [DashboardComponent]
})
export class DashboardModule {}
