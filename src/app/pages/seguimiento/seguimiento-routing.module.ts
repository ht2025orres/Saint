import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SeguimientoComponent } from './seguimiento/seguimiento.component';

const routes: Routes = [
  { path: '', component: SeguimientoComponent, title: 'Seguimiento' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SeguimientoRoutingModule { }
