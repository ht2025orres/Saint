import { Component, OnInit } from '@angular/core';
import { MetricsService } from 'src/app/services/metrics.service';
import { ProcessMetric } from 'src/app/models/process-metric.model';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  metrics: ProcessMetric[] = [];
  showAdminPanel: boolean = false;

  constructor(
    private metricsService: MetricsService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    // Si el usuario es administrador, mostrar el panel por defecto
    if (this.authService.hasRole('Administrador del sistema')) {
      this.showAdminPanel = true;
      this.loadMetrics();
    }
  }

  loadMetrics(): void {
    this.metricsService.getProcessMetrics().subscribe(data => {
      this.metrics = data;
    });
  }

  toggleAdminView(): void {
    this.showAdminPanel = !this.showAdminPanel;

    if (this.showAdminPanel && this.metrics.length === 0) {
      this.loadMetrics();
    }
  }
}
