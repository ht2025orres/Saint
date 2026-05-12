import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ComercialesRoutingModule } from './comerciales-routing.module';
import { ClienteListComponent } from './cliente-list/cliente-list.component';
import { ClienteItemsComponent } from './cliente-items/cliente-items.component';
import { CosteoFormComponent } from './costeo-form/costeo-form.component';
import { CosteoDetailComponent } from './costeo-detail/costeo-detail.component';
import { ItemSearchModalComponent } from './modals/item-search-modal/item-search-modal.component';
import { MoldSelectModalComponent } from './modals/mold-select-modal/mold-select-modal.component';
import { SharedModule } from '../../shared/shared.module';
import { MoldesModule } from '../moldes/moldes.module';

@NgModule({
  declarations: [
    ClienteListComponent,
    ClienteItemsComponent,
    CosteoFormComponent,
    CosteoDetailComponent,
    ItemSearchModalComponent,
    MoldSelectModalComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ComercialesRoutingModule,
    SharedModule,
    MoldesModule,
  ]
})
export class ComercialesModule { }
