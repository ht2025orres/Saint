import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MuestrasListComponent } from './muestras-list/muestras-list.component';
import { MuestrasDetailComponent } from './muestras-detail/muestras-detail.component';

const routes: Routes = [
  { path: '', component: MuestrasListComponent },
  { path: 'detalle/:id', component: MuestrasDetailComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MuestrasRoutingModule { }
