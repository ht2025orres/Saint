import { BrowserModule } from '@angular/platform-browser';
import { DEFAULT_CURRENCY_CODE, LOCALE_ID, NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { PagesComponent } from './pages/pages.component';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { TokenInterceptor } from './interceptors/tokenInterceptor';
import { AuthInterceptor } from './interceptors/authInterceptor';
import { registerLocaleData } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';
import localeEs from '@angular/common/locales/es-CO';
import { NgxPanZoomModule } from 'ngx-panzoom'; // Import the PanzoomModule

// Technical data sheet
import { TechnicalDataSheetsReportComponent } from './pages/technical-data-sheets-report/technical-data-sheets-report.component';
import { CreateTechnicalSheetComponent } from './pages/technicalsheet/create/create-technical-sheet.component';
import { ListTechnicalSheetComponent } from './pages/technicalsheet/list/list-technical-sheet.component';
import { ViewTechnicalSheetComponent } from './pages/technicalsheet/view/view-technical-sheet.component';
import { AngularEditorModule } from '@kolkov/angular-editor';

// Users
import { ListUserComponent } from './pages/user/list-user/list-user.component';
import { CreateUserComponent } from './pages/user/create-user/create-user.component';

import { NopagefoundComponent } from './nopagefound/nopagefound.component';
import { AuthModule } from './auth/auth.module';
import { SharedModule } from './shared/shared.module';

registerLocaleData(localeEs, 'es-CO');

@NgModule({ declarations: [
        AppComponent,
        DashboardComponent,
        PagesComponent,
        CreateTechnicalSheetComponent,
        ListTechnicalSheetComponent,
        TechnicalDataSheetsReportComponent,

        ViewTechnicalSheetComponent,
        NopagefoundComponent,
        ListUserComponent,
        CreateUserComponent,
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
        /*Editor*/
        AngularEditorModule,
        /* Zoom */
        NgxPanZoomModule
    ], 
    providers: [
        { provide: LOCALE_ID, useValue: 'es-CO' },
        { provide: DEFAULT_CURRENCY_CODE, useValue: 'COP' },
        { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        provideHttpClient(withInterceptorsFromDi())
    ] })
export class AppModule { }
