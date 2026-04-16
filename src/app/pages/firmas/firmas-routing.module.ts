import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FirmasComponent } from './firmas/firmas.component';

const routes: Routes = [
  { path: '', component: FirmasComponent, title: 'Firmas Digitales' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FirmasRoutingModule { }
