import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../shared/shared.module';
import { RevisionConsumoComponent } from './revision-consumo.component';

@NgModule({
  declarations: [RevisionConsumoComponent],
  imports: [
    CommonModule,
    SharedModule,
    FormsModule
  ]
})
export class RevisionConsumoModule { }
