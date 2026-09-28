import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SeguimientoAbastecimientoComponent } from './seguimiento-abastecimiento/seguimiento-abastecimiento.component';

const routes: Routes = [
  { path: '', component: SeguimientoAbastecimientoComponent },
  { path: 'seguimiento', component: SeguimientoAbastecimientoComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AbastecimientoRoutingModule { }
