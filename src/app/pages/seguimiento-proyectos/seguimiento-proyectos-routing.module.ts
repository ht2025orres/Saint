import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProyectosActivosComponent } from './proyectos-activos/proyectos-activos.component';

const routes: Routes = [
  { path: '', redirectTo: 'proyectos-activos', pathMatch: 'full' },
  { path: 'proyectos-activos', component: ProyectosActivosComponent, data: { titulo: 'Proyectos Activos' } }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SeguimientoProyectosRoutingModule { }
