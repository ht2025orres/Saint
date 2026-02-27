import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ProyectosComponent } from './proyectos.component';

const routes: Routes = [
  { path: '', component: ProyectosComponent }
];

@NgModule({
  declarations: [ProyectosComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ReactiveFormsModule,
    FormsModule
  ]
})
export class ProyectosModule { }
