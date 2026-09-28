import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MoldesRoutingModule } from './moldes-routing.module';
import { MoldesListComponent } from './moldes-list/moldes-list.component';
import { MoldesAdminComponent } from './moldes-admin/moldes-admin.component';
import { SpecGeneratorComponent } from './spec-generator/spec-generator.component';
import { PartesCatalogComponent } from './partes-catalog/partes-catalog.component';

import { InventorySearchModalComponent } from './modals/inventory-search-modal/inventory-search-modal.component';
import { ModalMoldPartComponent } from './modals/modal-mold-part/modal-mold-part.component';
import { ModalSpecEditorComponent } from './modals/modal-spec-editor/modal-spec-editor.component';
import { ModalManualAssignmentComponent } from './modals/modal-manual-assignment/modal-manual-assignment.component';
import { ModalAddPartComponent } from './modals/modal-add-part/modal-add-part.component';
import { ModalCategoryManagerComponent } from './modals/modal-category-manager/modal-category-manager.component';
import { ModalInsumosAgrupadosComponent } from './modals/modal-insumos-agrupados/modal-insumos-agrupados.component';
import { ModalVariantesMoldeComponent } from './modals/modal-variantes-molde/modal-variantes-molde.component';

// Subcomponentes y Modales de Moldes Admin
import { ModalZoneSelectorComponent } from './moldes-admin/modals/modal-zone-selector/modal-zone-selector.component';
import { ModalZonePartsDrawerComponent } from './moldes-admin/modals/modal-zone-parts-drawer/modal-zone-parts-drawer.component';
import { ModalGestionMaterialesComponent } from './moldes-admin/modals/modal-gestion-materiales/modal-gestion-materiales.component';
import { AdminTabDisenoComponent } from './moldes-admin/components/admin-tab-diseno/admin-tab-diseno.component';
import { AdminTabEstructuraComponent } from './moldes-admin/components/admin-tab-estructura/admin-tab-estructura.component';
import { AdminTabOperacionesComponent } from './moldes-admin/components/admin-tab-operaciones/admin-tab-operaciones.component';

import { ModalParteFormComponent } from './partes-catalog/modals/modal-parte-form/modal-parte-form.component';
import { ModalRegionFormComponent } from './partes-catalog/modals/modal-region-form/modal-region-form.component';
import { ModalMaquinaFormComponent } from './partes-catalog/modals/modal-maquina-form/modal-maquina-form.component';
import { ModalStandardOpFormComponent } from './partes-catalog/modals/modal-standard-op-form/modal-standard-op-form.component';
import { ModalRegionPartsComponent } from './partes-catalog/modals/modal-region-parts/modal-region-parts.component';
import { CatalogTabPartesComponent } from './partes-catalog/components/catalog-tab-partes/catalog-tab-partes.component';
import { CatalogTabRegionesComponent } from './partes-catalog/components/catalog-tab-regiones/catalog-tab-regiones.component';
import { CatalogTabOperacionesComponent } from './partes-catalog/components/catalog-tab-operaciones/catalog-tab-operaciones.component';

// Subcomponentes de Spec Generator
import { SpecTabDisenoComponent } from './spec-generator/components/spec-tab-diseno/spec-tab-diseno.component';
import { SpecTabEstructuraComponent } from './spec-generator/components/spec-tab-estructura/spec-tab-estructura.component';

import { DragDropModule } from '@angular/cdk/drag-drop';

@NgModule({
  declarations: [
    MoldesListComponent,
    MoldesAdminComponent,
    SpecGeneratorComponent,
    PartesCatalogComponent,
    InventorySearchModalComponent,
    ModalMoldPartComponent,
    ModalSpecEditorComponent,
    ModalManualAssignmentComponent,
    ModalAddPartComponent,
    ModalCategoryManagerComponent,
    ModalInsumosAgrupadosComponent,
    ModalVariantesMoldeComponent,
    ModalZoneSelectorComponent,
    ModalZonePartsDrawerComponent,
    ModalGestionMaterialesComponent,
    AdminTabDisenoComponent,
    AdminTabEstructuraComponent,
    AdminTabOperacionesComponent,
    ModalParteFormComponent,
    ModalRegionFormComponent,
    ModalMaquinaFormComponent,
    ModalStandardOpFormComponent,
    ModalRegionPartsComponent,
    CatalogTabPartesComponent,
    CatalogTabRegionesComponent,
    CatalogTabOperacionesComponent,
    SpecTabDisenoComponent,
    SpecTabEstructuraComponent
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
    PartesCatalogComponent,
    InventorySearchModalComponent,
    ModalSpecEditorComponent,
    ModalManualAssignmentComponent,
    ModalAddPartComponent,
    ModalCategoryManagerComponent,
    ModalInsumosAgrupadosComponent,
    ModalVariantesMoldeComponent
  ]
})
export class MoldesModule { }
