import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';
import { GestionZonasComponent } from './gestion-zonas/gestion-zonas.component';
import { GestionInventariosComponent } from './gestion-inventarios/gestion-inventarios.component';
import { GestionBodegasComponent } from './gestion-bodegas/gestion-bodegas.component';
import { ConteoComponent } from './conteo/conteo.component';
import { ModalZonaComponent } from './modals/modal-zona/modal-zona.component';
import { ModalInventarioComponent } from './modals/modal-inventario/modal-inventario.component';
import { ModalAsignacionZonaComponent } from './modals/modal-asignacion-zona/modal-asignacion-zona.component';
import { ModalMigrarItemsComponent } from './modals/modal-migrar-items/modal-migrar-items.component';
import { ModalGestionZonasMasivaComponent } from './modals/modal-gestion-zonas-masiva/modal-gestion-zonas-masiva.component';
import { AsignacionInventarioComponent } from './gestion-inventarios/asignacion/asignacion.component';
import { ReconteoInventarioComponent } from './gestion-inventarios/reconteo/reconteo.component';
import { HistoricoMovimientosComponent } from './historico-movimientos/historico-movimientos.component';
import { InventarioCiclicoComponent } from './inventario-ciclico/inventario-ciclico.component';
import { CiclicoCalendarioComponent } from './ciclico-calendario/ciclico-calendario.component';
import { ModalConteoCiclicoComponent } from './modals/modal-conteo-ciclico/modal-conteo-ciclico.component';

const routes: Routes = [
  { path: 'gestion-zonas', component: GestionZonasComponent, data: { titulo: 'Gestión de Zonas' } },
  { path: 'gestion-bodegas', component: GestionBodegasComponent, data: { titulo: 'Gestión de Bodegas' } },
  { path: 'gestion-inventarios', component: GestionInventariosComponent, data: { titulo: 'Gestión de Inventarios' } },
  { path: 'conteo', component: ConteoComponent, data: { titulo: 'Conteo de Inventario' } },
  { path: 'historico-movimientos', component: HistoricoMovimientosComponent, data: { titulo: 'Histórico de Movimientos' } },
  { path: 'inventario-ciclico', component: InventarioCiclicoComponent, data: { titulo: 'Inventario Cíclico' } },
  { path: 'ciclico-calendario', component: CiclicoCalendarioComponent, data: { titulo: 'Calendario Cíclico' } },
];

@NgModule({
  declarations: [
    GestionZonasComponent,
    GestionInventariosComponent,
    GestionBodegasComponent,
    ConteoComponent,
    ModalZonaComponent,
    ModalInventarioComponent,
    ModalAsignacionZonaComponent,
    ModalMigrarItemsComponent,
    ModalGestionZonasMasivaComponent,
    AsignacionInventarioComponent,
    ReconteoInventarioComponent,
    HistoricoMovimientosComponent,
    InventarioCiclicoComponent,
    CiclicoCalendarioComponent,
    ModalConteoCiclicoComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ReactiveFormsModule,
    FormsModule,
    SharedModule
  ]
})
export class InventarioModule { }
