import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ProyectosComponent } from './proyectos.component';
import { ListaProyectosComponent } from './gestion/proyectos/lista-proyectos.component';
import { DetalleProyectoComponent } from './gestion/proyectos/detalle-proyecto.component';
import { ModalProyectoComponent } from './gestion/proyectos/modal-proyecto.component';
import { ModalPermisosComponent } from './gestion/shared/modal-permisos.component';
import { ListaSeguimientosComponent } from './gestion/seguimientos/lista-seguimientos.component';
import { ListaInformesComponent } from './gestion/informes/lista-informes.component';
import { SharedModule } from 'src/app/shared/shared.module';

const routes: Routes = [
  { path: '', component: ProyectosComponent }
];

@NgModule({
  declarations: [
    ProyectosComponent,
    ListaProyectosComponent,
    DetalleProyectoComponent,
    ModalProyectoComponent,
    ModalPermisosComponent,
    ListaSeguimientosComponent,
    ListaInformesComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ReactiveFormsModule,
    FormsModule,
    SharedModule
  ]
})
export class ProyectosModule { }
