import { Component, OnInit } from '@angular/core';
import { MetricsService } from 'src/app/services/metrics.service';
import { ProcessMetric } from 'src/app/models/process-metric.model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  metrics: ProcessMetric[] = [];

  constructor(private metricsService: MetricsService) {}

  ngOnInit(): void {
    this.metricsService.getProcessMetrics().subscribe(data => {
      // this.metrics = [
      //   { title: 'Nuevos', value: 120, icon: 'fas fa-inbox', color: '#4caf50', percentage: 30 },
      //   { title: 'En progreso', value: 80, icon: 'fas fa-spinner', color: '#ff9800', percentage: 20 },
      //   { title: 'Completados', value: 200, icon: 'fas fa-check-circle', color: '#2196f3', percentage: 50 }
      // ];
      this.metrics = data;

    });
  }
}
