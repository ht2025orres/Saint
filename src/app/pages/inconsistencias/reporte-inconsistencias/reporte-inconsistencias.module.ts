import { NgModule } from '@angular/core';
import { NgChartsModule } from 'ng2-charts';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../shared/shared.module';
import { ReporteInconsistenciasComponent } from './reporte-inconsistencias.component';

@NgModule({
  declarations: [ReporteInconsistenciasComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    NgChartsModule,
  ]
})
export class ReporteInconsistenciasModule { }
