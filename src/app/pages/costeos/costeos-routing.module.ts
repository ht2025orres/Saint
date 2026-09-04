import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CosteosListComponent } from './costeos-list/costeos-list.component';
import { CosteosDetailComponent } from './costeos-detail/costeos-detail.component';

const routes: Routes = [
  { path: '', component: CosteosListComponent },
  { path: 'detalle/:id', component: CosteosDetailComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CosteosRoutingModule { }
