import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { Routes, RouterModule } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { PagesComponent } from './pages/pages.component';
import { TechnicalDataSheetsReportComponent } from './pages/technical-data-sheets-report/technical-data-sheets-report.component';
import { CreateTechnicalSheetComponent } from './pages/technicalsheet/create/create-technical-sheet.component';
import { ListTechnicalSheetComponent } from './pages/technicalsheet/list/list-technical-sheet.component';
import { ViewTechnicalSheetComponent } from './pages/technicalsheet/view/view-technical-sheet.component';
import { NopagefoundComponent } from './nopagefound/nopagefound.component';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { AuthRoutingModule } from './auth/auth.routing';
import { ListUserComponent } from './pages/user/list-user/list-user.component';
import { CreateUserComponent } from './pages/user/create-user/create-user.component';
import { GenerarComponent } from './pages/inconsistencias/generar/generar.component';
import { MisInconsistenciasComponent } from './pages/inconsistencias/mis-inconsistencias/mis-inconsistencias.component';
import { AprobacionComponent } from './pages/inconsistencias/aprobacion/aprobacion.component';
import { HistoricoInconsistenciasComponent } from './pages/inconsistencias/historico/historico.component';
import { RevisionConsumoComponent } from './pages/inconsistencias/revision-consumo/revision-consumo.component';
import { ReporteInconsistenciasComponent } from './pages/inconsistencias/reporte-inconsistencias/reporte-inconsistencias.component';
import { RecepcionOpComponent } from './pages/terminacion-empaque/recepcion-op/recepcion-op.component';
import { GestionEmpacadoresComponent } from './pages/terminacion-empaque/gestion-empacadores/gestion-empacadores.component';
import { RegistrarEmpaqueComponent } from './pages/terminacion-empaque/registrar-empaque/registrar-empaque.component';
import { DashboardEmpaqueComponent } from './pages/terminacion-empaque/dashboard-empaque/dashboard-empaque.component';
import { DistribucionPvComponent } from './pages/terminacion-empaque/distribucion-pv/distribucion-pv.component';
import { BodegasComponent } from './pages/inventario/bodegas/bodegas.component';
import { ZonasComponent } from './pages/inventario/zonas/zonas.component';
import { DashboardBigbagComponent } from './pages/technical-report-bigbag/dashboard-bigbag/dashboard-bigbag.component';
import { TechnicalPrecintosBigbagComponent } from './pages/technical-report-bigbag/technical-precintos-bigbag/technical-precintos-bigbag.component';
import { TechnicalReportBigbagComponent } from './pages/technical-report-bigbag/create-report-bigbag/technical-report-bigbag.component';
import { ViewReportBigbagComponent } from './pages/technical-report-bigbag/view-report-bigbag/view-report-bigbag.component';
import { ViewPrecintoBigbagComponent } from './pages/technical-report-bigbag/view-precinto-bigbag/view-precinto-bigbag.component';

const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full', title: 'Redirección' },
  {
    path: '', component: PagesComponent, canActivate: [AuthGuard], title: 'Páginas',
    children: [
      { path: 'dashboard', component: DashboardComponent, title: 'Inicio' },
      { path: 'createTechnicalDataSheet/:id/:operation', component: CreateTechnicalSheetComponent, title: 'Crear ficha técnica' },
      { path: 'viewTechnicalDataSheet/:id', component: ViewTechnicalSheetComponent, title: 'Ver ficha técnica' },
      { path: 'technical-data-sheets-report', component: TechnicalDataSheetsReportComponent, title: 'Reporte de fichas' },
      { path: 'listTechnicalDataSheet/page/:page/:status', component: ListTechnicalSheetComponent, title: 'Listar fichas técnicas' },
      { path: 'users/page/:page', component: ListUserComponent, canActivate: [RoleGuard], data: { role: 'Administrador del sistema' }, title: 'Listar usuarios' },
      { path: 'createUser/:id', component: CreateUserComponent, title: 'Crear usuario' },
      { path: 'generar-inconsistencias', component: GenerarComponent, title: 'Generar inconsistencias' },
      { path: 'mis-inconsistencias', component: MisInconsistenciasComponent, title: 'Mis inconsistencias' },
      { path: 'aprobar-inconsistencias', component: AprobacionComponent, title: 'Aprobar inconsistencias' },
      { path: 'historico-inconsistencias', component: HistoricoInconsistenciasComponent, title: 'Histórico de inconsistencias' },
      { path: 'revision-consumo', component: RevisionConsumoComponent, title: 'Revisión de consumo' },
      { path: 'reporte-inconsistencias', component: ReporteInconsistenciasComponent, title: 'Reporte de inconsistencias' },
      { path: 'recepcion-op', component: RecepcionOpComponent, title: 'Recepción de OP' },
      { path: 'gestion-empacadores', component: GestionEmpacadoresComponent, title: 'Gestión de empacadores' },
      { path: 'registrar-empaque', component: RegistrarEmpaqueComponent, title: 'Registrar empaque' },
      { path: 'dashboard-empaque', component: DashboardEmpaqueComponent, title: 'Dashboard de empaque' },
      { path: 'distribucion-pv', component: DistribucionPvComponent, title: 'Distribución de PV' },
      { path: 'bodegas', component: BodegasComponent, title: 'Bodegas' },
      { path: 'zonas', component: ZonasComponent, title: 'Zonas' },
      { path: 'dashboard-bigbag', component: DashboardBigbagComponent, title: 'Dashboard BigBag' },
      { path: 'technical-precintos-bigbag', component: TechnicalPrecintosBigbagComponent, title: 'Precintos BigBag' },
      { path: 'technical-report-bigbag', component: TechnicalReportBigbagComponent, title: 'Crear reporte BigBag' },
      { path: 'view-report-bigbag', component: ViewReportBigbagComponent, title: 'Ver reporte BigBag' },
      { path: 'view-precinto-bigbag', component: ViewPrecintoBigbagComponent, title: 'Ver precinto BigBag' }
    ]
  },
  { path: '**', component: NopagefoundComponent, title: 'Página no encontrada' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes), AuthRoutingModule, BrowserModule],
  exports: [RouterModule]
})
export class AppRoutingModule { }
