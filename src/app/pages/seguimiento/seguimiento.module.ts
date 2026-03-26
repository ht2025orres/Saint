import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SeguimientoRoutingModule } from './seguimiento-routing.module';
import { SharedModule } from 'src/app/shared/shared.module';
 
// Componente principal
import { SeguimientoComponent } from './seguimiento/seguimiento.component';
 
// Sub-interfaces
import { ProyectosComponent } from './proyectos/proyectos.component';
import { SeguimientosComponent } from './seguimientos/seguimientos.component';
import { TareasComponent } from './tareas/tareas.component';
import { InformesComponent } from './informes/informes.component';

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
import { ModalCompromisoComponent } from './modals/modal-compromiso/modal-compromiso.component';
import { ModalFlujoComponent } from './modals/modal-flujo/modal-flujo.component';
import { ModalDiaDetalleComponent } from './modals/modal-dia-detalle/modal-dia-detalle.component';
import { ModalInformeComponent } from './modals/modal-informe/modal-informe.component';
import { ModalInformeTareaComponent } from './modals/modal-informe-tarea/modal-informe-tarea.component';
import { ModalPermisosProyectoComponent } from './modals/modal-permisos-proyecto/modal-permisos-proyecto.component';
import { ModalCalcularFechasComponent } from './modals/modal-calcular-fechas/modal-calcular-fechas.component';
import { ModalPlantillaProyectoComponent } from './modals/modal-plantilla-proyecto/modal-plantilla-proyecto.component';
 
// Servicio compartido (provideIn: 'root' — ya se registra solo)
// import { SeguimientoStateService } from './seguimiento-state.service';
 
// Componentes compartidos de la app
// import { SharedPaginatorModule } from 'src/app/shared/pagination/pagination.module';
 
@NgModule({
  declarations: [
    // ── Shell principal ───────────────────────────────────────────
    SeguimientoComponent,
 
    // ── Sub-interfaces ────────────────────────────────────────────
    ProyectosComponent,
    SeguimientosComponent,
    TareasComponent,
    InformesComponent,

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
    ModalCompromisoComponent,
    ModalFlujoComponent,
    ModalDiaDetalleComponent,
    ModalInformeComponent,
    ModalInformeTareaComponent,
    ModalPermisosProyectoComponent,
    ModalCalcularFechasComponent,
    ModalPlantillaProyectoComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SeguimientoRoutingModule,
    SharedModule
    // SharedPaginatorModule,   // descomenta si tienes el módulo del paginador
  ],
  exports: [
    SeguimientoComponent,
  ],
})
export class SeguimientoModule {}