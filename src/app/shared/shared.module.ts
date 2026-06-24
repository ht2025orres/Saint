import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import { AutoExpandDirective } from './auto-expand.directive';
import {SidebarComponent} from './sidebar/sidebar.component';
import {HeaderComponent} from './header/header.component';
import {RouterModule} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {FooterComponent} from './footer/footer.component';
import {PaginadorComponent} from './paginador/paginador.component';
import { SharedPaginatorComponent } from '../shared/pagination/shared-paginator/shared-paginator.component';
import { LoadingComponent } from './loading/loading.component';
import { PaginationService } from './pagination/pagination.service';
import { LoadingButtonDirective } from './loading/loading-button.directive';
import { SafePipe } from './pipes/safe.pipe';


@NgModule({
    declarations: [
        FooterComponent,
        PaginadorComponent,
        SidebarComponent,
        HeaderComponent,
        LoadingComponent,
        AutoExpandDirective,
        SharedPaginatorComponent,
        LoadingButtonDirective,
        SafePipe,
    ],
    exports: [
        FooterComponent,
        PaginadorComponent,
        SidebarComponent,
        HeaderComponent,
        LoadingComponent,
        AutoExpandDirective,
        SharedPaginatorComponent,
        LoadingButtonDirective,
        SafePipe,
    ],
    imports: [
        CommonModule,
        RouterModule,
        FormsModule
    ],
    providers: [
        PaginationService
    ]
})
export class SharedModule {
}
