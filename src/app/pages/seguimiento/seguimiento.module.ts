import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SeguimientoRoutingModule } from './seguimiento-routing.module';
import { SharedModule } from 'src/app/shared/shared.module';
import { AngularEditorModule } from '@kolkov/angular-editor';
 
// Componente principal
import { SeguimientoComponent } from './seguimiento/seguimiento.component';
 
// Sub-interfaces
import { ProyectosComponent } from './proyectos/proyectos.component';

import { TareasComponent } from './tareas/tareas.component';
import { InformesComponent } from './informes/informes.component';
import { EstadisticasComponent } from './estadisticas/estadisticas.component';

// Componentes de Proyectos
import { TareaItemComponent } from './proyectos/components/tarea-item.component';
import { TareaInlineCrearComponent } from './proyectos/components/tarea-inline-crear.component';
import { ProyectoTareasViewComponent } from './proyectos/components/proyecto-tareas-view.component';
import { ProyectoActividadesViewComponent } from './proyectos/components/proyecto-actividades-view.component';
import { ProyectoDetalleComponent } from './proyectos/components/proyecto-detalle.component';

// Modales
import { ModalProyectoComponent } from './modals/modal-proyecto/modal-proyecto.component';
import { ModalActividadComponent } from './modals/modal-actividad/modal-actividad.component';
import { ModalTareaComponent } from './modals/modal-tarea/modal-tarea.component';
import { ModalReunionComponent } from './modals/modal-reunion/modal-reunion.component';

import { ModalDiaDetalleComponent } from './modals/modal-dia-detalle/modal-dia-detalle.component';
import { ModalInformeComponent } from './modals/modal-informe/modal-informe.component';
import { ModalInformeTareaComponent } from './modals/modal-informe-tarea/modal-informe-tarea.component';
import { ModalPermisosProyectoComponent } from './modals/modal-permisos-proyecto/modal-permisos-proyecto.component';
import { ModalCalcularFechasComponent } from './modals/modal-calcular-fechas/modal-calcular-fechas.component';
import { ModalPlantillaProyectoComponent } from './modals/modal-plantilla-proyecto/modal-plantilla-proyecto.component';
import { ModalDetalleTareasEstadisticasComponent } from './estadisticas/modals/modal-detalle-tareas/modal-detalle-tareas.component';

@NgModule({
  declarations: [
    // ── Shell principal ───────────────────────────────────────────
    SeguimientoComponent,

    // ── Sub-interfaces ────────────────────────────────────────────
    ProyectosComponent,

    TareasComponent,
    InformesComponent,
    EstadisticasComponent,

    // ── Componentes de Proyectos ──────────────────────────────────
    TareaItemComponent,
    TareaInlineCrearComponent,
    ProyectoTareasViewComponent,
    ProyectoActividadesViewComponent,
    ProyectoDetalleComponent,

    // ── Modales compartidos ───────────────────────────────────────
    ModalProyectoComponent,
    ModalActividadComponent,
    ModalTareaComponent,
    ModalReunionComponent,

    ModalDiaDetalleComponent,
    ModalInformeComponent,
    ModalInformeTareaComponent,
    ModalPermisosProyectoComponent,
    ModalCalcularFechasComponent,
    ModalPlantillaProyectoComponent,
    ModalDetalleTareasEstadisticasComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SeguimientoRoutingModule,
    SharedModule,
    AngularEditorModule
    // SharedPaginatorModule,   // descomenta si tienes el módulo del paginador
  ],
  exports: [
    SeguimientoComponent,
  ],
})
export class SeguimientoModule {}