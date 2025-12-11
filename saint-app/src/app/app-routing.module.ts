import { NgModule } from '@angular/core';
import { Routes, RouterModule, provideRouter, withRouterConfig  } from '@angular/router';
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

const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full', title: 'Redirección' },
  {
    path: '', component: PagesComponent, canActivate: [AuthGuard], title: 'Páginas',
    children: [
      { path: 'dashboard', component: DashboardComponent, title: 'Inicio' },
      { path: 'createTechnicalDataSheet/:id/:operation', component: CreateTechnicalSheetComponent, title: 'Crear ficha técnica' },
      { path: 'viewTechnicalDataSheet/:id', component: ViewTechnicalSheetComponent, title: 'Ver ficha técnica' },
      { path: 'technical-data-sheets-report', component: TechnicalDataSheetsReportComponent, title: 'Reporte de fichas'},
      { path: 'listTechnicalDataSheet/page/:page/:status', component: ListTechnicalSheetComponent, title: 'Listar fichas técnicas' },
      { path: 'users/page/:page', component: ListUserComponent, canActivate: [RoleGuard], data: { role: 'Administrador del sistema' }, title: 'Listar usuarios' },
      { path: 'createUser/:id', component: CreateUserComponent, title: 'Crear usuario' }
    ]
  },
  { path: '**', component: NopagefoundComponent, title: 'Página no encontrada' }
];

@NgModule({
  imports: [AuthRoutingModule],
  exports: [RouterModule],
  providers: [
    provideRouter(routes, withRouterConfig({
      // Aquí puedes agregar configuraciones adicionales si las necesitas
      // Por ejemplo:
      // canceledNavigationResolution: 'computed',
      // paramsInheritanceStrategy: 'always',
      // titleStrategy: CustomTitleStrategy,
      // urlUpdateStrategy: 'eager',
      // urlHandlingStrategy: CustomUrlHandlingStrategy,
      // malformedUriErrorHandler: handleMalformedUriError
    }))
  ]
})
export class AppRoutingModule {}
