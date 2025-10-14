import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ModalModule } from 'ngx-bootstrap/modal';
import { SharedModule } from '../../../shared/shared.module';
import { HistoricoInconsistenciasComponent } from './historico.component';

@NgModule({
  declarations: [HistoricoInconsistenciasComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    ModalModule.forRoot(),
  ]
})
export class HistoricoModule { }
