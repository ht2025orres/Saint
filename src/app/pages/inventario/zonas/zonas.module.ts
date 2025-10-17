import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { ZonasComponent } from './zonas.component';


@NgModule({
  declarations: [ZonasComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [
    ZonasComponent
  ]
})
export class ZonasModule { }
