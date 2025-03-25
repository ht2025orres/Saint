import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {SidebarComponent} from './sidebar/sidebar.component';
import {HeaderComponent} from './header/header.component';
import {RouterModule} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {FooterComponent} from './footer/footer.component';
import {PaginadorComponent} from './paginador/paginador.component';
import {LoadingComponent} from './loading/loading.component';


@NgModule({
    declarations: [
        FooterComponent,
        PaginadorComponent,
        SidebarComponent,
        HeaderComponent,
        LoadingComponent
    ],
    exports: [
        FooterComponent,
        PaginadorComponent,
        SidebarComponent,
        HeaderComponent,
        LoadingComponent
    ],
    imports: [
        CommonModule,
        RouterModule,
        FormsModule
    ]
})
export class SharedModule {
}
