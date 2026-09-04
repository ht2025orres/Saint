import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SeguimientoProyectosRoutingModule } from './seguimiento-proyectos-routing.module';

import { ProyectosActivosComponent } from './proyectos-activos/proyectos-activos.component';
import { ModalDetalleProyectoComponent } from './modals/modal-detalle-proyecto/modal-detalle-proyecto.component';
import { ModalEditarPresupuestoComponent } from './modals/modal-editar-presupuesto/modal-editar-presupuesto.component';
import { ModalSincronizarSiesaComponent } from './modals/modal-sincronizar-siesa/modal-sincronizar-siesa.component';

@NgModule({
  declarations: [
    ProyectosActivosComponent,
    ModalDetalleProyectoComponent,
    ModalEditarPresupuestoComponent,
    ModalSincronizarSiesaComponent,
  ],
  imports: [
    CommonModule,
    SeguimientoProyectosRoutingModule,
    ReactiveFormsModule,
    FormsModule,
  ]
})
export class SeguimientoProyectosModule { }
