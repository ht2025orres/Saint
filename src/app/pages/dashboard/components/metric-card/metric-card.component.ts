import { Component, Input } from '@angular/core';
import { ProcessMetric } from 'src/app/models/process-metric.model';

@Component({
  selector: 'app-metric-card',
  templateUrl: './metric-card.component.html',
  styleUrls: ['./metric-card.component.scss']
})
export class MetricCardComponent {
  @Input() metric!: ProcessMetric;
}
