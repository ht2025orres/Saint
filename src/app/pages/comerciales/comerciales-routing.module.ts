import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClienteListComponent } from './cliente-list/cliente-list.component';
import { ClienteItemsComponent } from './cliente-items/cliente-items.component';
import { CosteoFormComponent } from './costeo-form/costeo-form.component';
import { CosteoDetailComponent } from './costeo-detail/costeo-detail.component';
import { SolicitudCapturaComponent } from './solicitud-captura/solicitud-captura.component';
import { OrdenCompraComponent } from './ordenes-compra/orden-compra.component';

const routes: Routes = [
  { path: '', component: ClienteListComponent },
  { path: 'cliente/:id', component: ClienteItemsComponent },
  { path: 'solicitudes', component: ClienteListComponent, data: { mode: 'solicitudes' } },
  { path: 'solicitud/nuevo', component: CosteoFormComponent },
  { path: 'solicitud/nuevo/:clienteId', component: CosteoFormComponent },
  { path: 'solicitud/:id', component: CosteoDetailComponent },
  { path: 'solicitud/:id/editar', component: CosteoFormComponent },
  { path: 'captura', component: SolicitudCapturaComponent },
  { path: 'ordenes-compra', component: OrdenCompraComponent, title: 'Órdenes de Compra' },
  { path: 'recepcion-oc', component: OrdenCompraComponent, title: 'Recepción y Gestión de OC' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ComercialesRoutingModule { }
