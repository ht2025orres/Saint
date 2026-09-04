import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';

import { AuthorizationManagerComponent } from './authorization-manager.component';
import { ModalManageUserComponent } from './modals/modal-manage-user/modal-manage-user.component';
import { ModalStructureComponent } from './modals/modal-structure/modal-structure.component';
import { ModalMaintenanceComponent } from './modals/modal-maintenance/modal-maintenance.component';
import { ModalAuditComponent } from './modals/modal-audit/modal-audit.component';
import { ModalBulkCargoComponent } from './modals/modal-bulk-cargo/modal-bulk-cargo.component';

@NgModule({
  declarations: [
    AuthorizationManagerComponent,
    ModalManageUserComponent,
    ModalStructureComponent,
    ModalMaintenanceComponent,
    ModalAuditComponent,
    ModalBulkCargoComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  exports: [
    AuthorizationManagerComponent
  ]
})
export class AuthorizationManagerModule { }
