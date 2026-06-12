import { BrowserModule } from '@angular/platform-browser';
import { DEFAULT_CURRENCY_CODE, LOCALE_ID, NgModule } from '@angular/core';
import { SignaturePadComponent } from '../app/pages/technical-report-bigbag/create-report-bigbag/signature-pad/signature-pad.component';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { MetricCardComponent } from './pages/dashboard/components/metric-card/metric-card.component';
import { PagesComponent } from './pages/pages.component';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/authInterceptor';
import { LoadingInterceptor } from './interceptors/loading.interceptor';
import { registerLocaleData } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';
import localeEs from '@angular/common/locales/es-CO';
import { NgxPanZoomModule } from 'ngx-panzoom'; // Import the PanzoomModule
import { GenerarComponent } from './pages/inconsistencias/generar/generar.component';
import { MisInconsistenciasModule } from './pages/inconsistencias/mis-inconsistencias/mis-inconsistencias.module';

import { TaskPanelComponent } from './shared/task-panel/task-panel.component';

// Technical data sheet
import { TechnicalDataSheetsReportComponent } from './pages/technical-data-sheets-report/technical-data-sheets-report.component';
import { CreateTechnicalSheetComponent } from './pages/technicalsheet/create/create-technical-sheet.component';
import { ListTechnicalSheetComponent } from './pages/technicalsheet/list/list-technical-sheet.component';
import { ViewTechnicalSheetComponent } from './pages/technicalsheet/view/view-technical-sheet.component';
import { ReportCreateComponent } from './pages/report/report-create/report-create.component';
import { ReportListComponent } from './pages/report/report-list/report-list.component';
import { MiReportListComponent } from './pages/report/mi-report-list/mi-report-list.component';
import { ReportDashboardComponent } from './pages/report/report-dashboard/report-dashboard.component';
import { AngularEditorModule } from '@kolkov/angular-editor';

// Users
import { ListUserComponent } from './pages/user/list-user/list-user.component';
import { CreateUserComponent } from './pages/user/create-user/create-user.component';
import { AuthorizationManagerComponent } from './pages/authorization-manager/authorization-manager.component';
import { WorkflowManagerComponent } from './pages/authorization-manager/workflow-manager/workflow-manager.component';
import { CarteraInconsistenciasComponent } from './pages/inconsistencias/cartera-inconsistencias/cartera-inconsistencias.component';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { NopagefoundComponent } from './nopagefound/nopagefound.component';
import { AuthModule } from './auth/auth.module';
import { SharedModule } from './shared/shared.module';
import { AprobacionModule } from './pages/inconsistencias/aprobacion/aprobacion.module';
import { HistoricoModule } from './pages/inconsistencias/historico/historico.module';
import { RevisionConsumoModule } from './pages/inconsistencias/revision-consumo/revision-consumo.module';
import { ReporteInconsistenciasModule } from './pages/inconsistencias/reporte-inconsistencias/reporte-inconsistencias.module';
import { DashboardFinancieroModule } from './pages/inconsistencias/dashboard-financiero/dashboard-financiero.module';
import { RecepcionOpModule } from './pages/terminacion-empaque/recepcion-op/recepcion-op.module';
import { GestionEmpacadoresModule } from './pages/terminacion-empaque/gestion-empacadores/gestion-empacadores.module';
import { RegistrarEmpaqueModule } from './pages/terminacion-empaque/registrar-empaque/registrar-empaque.module';
import { DashboardEmpaqueModule } from './pages/terminacion-empaque/dashboard-empaque/dashboard-empaque.module';
import { DistribucionPvModule } from './pages/terminacion-empaque/distribucion-pv/distribucion-pv.module';
import { BodegasModule } from './pages/old-inventario/bodegas/bodegas.module';
import { ZonasModule } from './pages/old-inventario/zonas/zonas.module';
import { ContadoresModule } from './pages/old-inventario/contadores/contadores.module';
import { GenerarHojaConteoModule } from './pages/old-inventario/generar-hoja-conteo/generar-hoja-conteo.module';
import { HojasConteoListModule } from './pages/old-inventario/hojas-conteo-list/hojas-conteo-list.module';
import { HojasConteoDetalleModule } from './pages/old-inventario/hojas-conteo-detalle/hojas-conteo-detalle.module';
import { ContadorItemsModule } from './pages/old-inventario/contador-items/contador-items.module';
import { InventariosModule } from './pages/old-inventario/inventarios/inventarios.module';

import { TechnicalReportBigbagComponent } from './pages/technical-report-bigbag/create-report-bigbag/technical-report-bigbag.component';
import { ViewReportBigbagComponent } from './pages/technical-report-bigbag/view-report-bigbag/view-report-bigbag.component';
import { DashboardBigbagComponent } from './pages/technical-report-bigbag/dashboard-bigbag/dashboard-bigbag.component';

import { OrdenCompraModule } from './pages/comerciales/orden-compra/orden-compra.module';
import { TiemposItemsModule } from './pages/tiempos/tiempos-items/tiempos-items.module';
import { PlaneacionModule } from './pages/planeacion/planeacion/planeacion.module';

import { CentrosCostosModule } from './pages/financiero/centros-costos/centros-costos.module';
import { SeguimientoModule } from './pages/seguimiento/seguimiento.module';

// import { ProyectosModule } from './pages/proyectos/proyectos.module';

// Modulo comerciales
import { SolicitudComponent } from './pages/comerciales/solicitud/solicitud.component';

registerLocaleData(localeEs, 'es-CO');

@NgModule({
    declarations: [
        AppComponent,
        TaskPanelComponent,
        DashboardComponent,
        MetricCardComponent,
        PagesComponent,
        CreateTechnicalSheetComponent,
        ListTechnicalSheetComponent,
        TechnicalDataSheetsReportComponent,
        GenerarComponent,
        ViewTechnicalSheetComponent,
        NopagefoundComponent,
        ListUserComponent,
        CreateUserComponent,
        SignaturePadComponent,
        TechnicalReportBigbagComponent,
        ViewReportBigbagComponent,
        DashboardBigbagComponent,
        ReportCreateComponent,
        ReportListComponent,
        MiReportListComponent,
        ReportDashboardComponent,
        AuthorizationManagerComponent,
    ],
    bootstrap: [AppComponent],
    imports: [
        BrowserModule,
        AppRoutingModule,
        BrowserAnimationsModule,
        FormsModule,
        ReactiveFormsModule,
        NgChartsModule,
        AuthModule,
        SharedModule,
        DragDropModule,
        /*Editor*/
        AngularEditorModule,
        /* Zoom */
        NgxPanZoomModule,
        /* Inconsistencias */
        MisInconsistenciasModule,
        AprobacionModule,
        HistoricoModule,
        RevisionConsumoModule,
        ReporteInconsistenciasModule,
        DashboardFinancieroModule,
        /* Control de piso */
        RecepcionOpModule,
        GestionEmpacadoresModule,
        RegistrarEmpaqueModule,
        DashboardEmpaqueModule,
        DistribucionPvModule,
        /* Inventario */
        BodegasModule,
        ZonasModule,
        ContadoresModule,
        GenerarHojaConteoModule,
        HojasConteoListModule,
        HojasConteoDetalleModule,
        ContadorItemsModule,
        InventariosModule,
        /* Comerciales */
        OrdenCompraModule,
        TiemposItemsModule,
        /* Planeacion */
        PlaneacionModule,
        /* Financiero */
        CentrosCostosModule,
        /* Seguimiento */
        SeguimientoModule,
        /* Proyectos */
        // ProyectosModule,
        WorkflowManagerComponent
    ], 
    exports: [
        TaskPanelComponent
    ],
    providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        { provide: DEFAULT_CURRENCY_CODE, useValue: 'COP' },
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
        provideHttpClient(withInterceptorsFromDi())
    ]
})
export class AppModule { }
