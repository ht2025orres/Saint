import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-admin-tab-operaciones',
  templateUrl: './admin-tab-operaciones.component.html',
  styleUrls: ['./admin-tab-operaciones.component.css']
})
export class AdminTabOperacionesComponent {
  @Input() isReadOnly = false;
  @Input() structuralParts: any[] = [];
  @Input() globalOperations: any[] = [];
  @Input() machinesList: any[] = [];
  @Input() totalGarmentStandardTime = 0;

  @Output() addGlobalOp = new EventEmitter<void>();
  @Output() removeGlobalOp = new EventEmitter<number>();
  @Output() addType = new EventEmitter<any>();
  @Output() removeType = new EventEmitter<{ part: any; index: number }>();
  @Output() setDefault = new EventEmitter<{ part: any; type: any }>();
  @Output() addOpToType = new EventEmitter<any>();
  @Output() removeOpFromType = new EventEmitter<{ type: any; index: number }>();
  @Output() recalculateTime = new EventEmitter<any>();

  recalculateTypeTotalTime(type: any): number {
    if (!type.operations || type.operations.length === 0) {
      type.total_time = 0;
      return 0;
    }
    const sum = type.operations.reduce((acc: number, op: any) => acc + (parseFloat(op.execution_time) || 0), 0);
    type.total_time = parseFloat(sum.toFixed(2));
    return type.total_time;
  }
}
