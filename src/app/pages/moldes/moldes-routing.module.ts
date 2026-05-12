import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MoldesListComponent } from './moldes-list/moldes-list.component';
import { MoldesAdminComponent } from './moldes-admin/moldes-admin.component';
import { SpecGeneratorComponent } from './spec-generator/spec-generator.component';

const routes: Routes = [
  { path: '', component: MoldesListComponent },
  { path: 'admin', component: MoldesAdminComponent },
  { path: 'admin/:id', component: MoldesAdminComponent },
  { path: 'opm-generator/:id', component: SpecGeneratorComponent, data: { mode: 'opm' } },
  { path: 'ficha-generator/:id', component: SpecGeneratorComponent, data: { mode: 'ficha' } },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MoldesRoutingModule { }
