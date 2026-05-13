import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MoldesRoutingModule } from './moldes-routing.module';
import { MoldesListComponent } from './moldes-list/moldes-list.component';
import { MoldesAdminComponent } from './moldes-admin/moldes-admin.component';
import { SpecGeneratorComponent } from './spec-generator/spec-generator.component';
import { InventorySearchModalComponent } from './modals/inventory-search-modal/inventory-search-modal.component';
import { ModalMoldPartComponent } from './modals/modal-mold-part/modal-mold-part.component';
import { ModalSpecEditorComponent } from './modals/modal-spec-editor/modal-spec-editor.component';
import { ModalManualAssignmentComponent } from './modals/modal-manual-assignment/modal-manual-assignment.component';
import { ModalAddPartComponent } from './modals/modal-add-part/modal-add-part.component';
import { ModalCategoryManagerComponent } from './modals/modal-category-manager/modal-category-manager.component';
import { DragDropModule } from '@angular/cdk/drag-drop';

@NgModule({
  declarations: [
    MoldesListComponent,
    MoldesAdminComponent,
    SpecGeneratorComponent,
    InventorySearchModalComponent,
    ModalMoldPartComponent,
    ModalSpecEditorComponent,
    ModalManualAssignmentComponent,
    ModalAddPartComponent,
    ModalCategoryManagerComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MoldesRoutingModule,
    DragDropModule
  ],
  exports: [
    SpecGeneratorComponent,
    InventorySearchModalComponent,
    ModalSpecEditorComponent,
    ModalManualAssignmentComponent,
    ModalAddPartComponent,
    ModalCategoryManagerComponent
  ]
})
export class MoldesModule { }
