import { Component, OnInit } from '@angular/core';
import { User } from '../../../models/User';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { TechnicalDataSheet } from '../../../models/TechnicalDataSheet';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-list-user',
    templateUrl: './list-user.component.html',
    styleUrls: ['./list-user.component.css']
})
export class ListUserComponent implements OnInit {

    title = 'Listado de usuarios';
    paginator: any;
    loading = false;
    listUser: User[] = [];

    constructor(private userService: UserService,
        public authService: AuthService,
        private router: Router,
        private activatedRoute: ActivatedRoute) {
    }


    ngOnInit(): void {
        this.activatedRoute.paramMap.subscribe(params => {
            let page: number = +params.get('page');
            if (!page) {
                page = 0;
            }

            this.reloadList(page);
        });
    }

    reloadList(page: number) {
        this.loading = true;
        this.userService.getAll()
        .subscribe(resp => this.listUser = resp, error => {
            Swal.fire('Error en el formulario', 'error al obtener la lista de usuarios', 'error');
        }
        );
    }

    searchUser(word: string) {
        if (word.trim().length > 3) {
            this.userService.searchUser(word)
                .subscribe(resp => {
                    this.listUser = resp as User[];
                });
        }
        else if (word.trim().length === 0) {
            this.reloadList(0);
        }
    }


    listBySize(size: number) {
        this.loading = true;
        this.userService.listUserSheetBySize(size)
            .pipe(
                tap((response: any) => {
                    (response.content as TechnicalDataSheet[]);
                })
            )
            .subscribe(response => {
                this.listUser = response.content as User[];
                this.paginator = response;
                this.loading = false;
            }, error => Swal.fire('Error al cargar datos', 'No se han podido cargar los usuarios', 'error'));
    }

    disableUser(user: User) {
        Swal.fire({
            title: '¿Esta seguro de eliminar el usuario?',
            text: 'Esta accion no puede ser revertida',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Si, eliminar!',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.value) {
                this.userService.disableUser(user).subscribe(
                    resp => {
                        this.listUser = this.listUser.filter(obj => obj !== user);
                        Swal.fire({
                            title: 'Eliminado',
                            html: 'Usuario eliminado correctamente',
                            icon: 'success',
                            timer: 1500,
                            timerProgressBar: true
                        });
                    }, error => {
                        Swal.fire({
                            title: 'Error',
                            html: 'Ha ocurrido un error al eliminar el usuario',
                            icon: 'error',
                            timer: 1500,
                            timerProgressBar: true
                        });
                    }
                );
            }
        });
    }
}
