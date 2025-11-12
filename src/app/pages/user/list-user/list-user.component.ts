import { Component, OnInit, OnDestroy } from '@angular/core';
import { User } from '../../../models/User';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaginationService, PaginationState } from '../../../shared/pagination/pagination.service';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-list-user',
    templateUrl: './list-user.component.html',
    styleUrls: ['./list-user.component.css']
})
export class ListUserComponent implements OnInit, OnDestroy {

    title = 'Listado de usuarios';
    loading = false;
    listUser: User[] = []; // Esta será la lista paginada (datos actuales de la página)
    allUsers: User[] = []; // Todos los usuarios sin paginar
    paginatorId = 'users-paginator';
    private paginationSubscription: Subscription;

    constructor(
        private userService: UserService,
        public authService: AuthService,
        private router: Router,
        public paginationService: PaginationService,
        private activatedRoute: ActivatedRoute
    ) {}

    ngOnInit(): void {
        this.loadAllUsers();
    }

    loadAllUsers() {
        this.loading = true;
        this.userService.getAll().subscribe(
            resp => {
                this.allUsers = resp;
                
                // Inicializar el paginador con todos los datos
                this.paginationSubscription = this.paginationService
                    .initializePaginator(this.paginatorId, this.allUsers, 10)
                    .subscribe((state: PaginationState) => {
                        // Actualizar la lista mostrada con los datos de la página actual
                        this.listUser = state.currentData;
                    });
                
                this.loading = false;
            },
            error => {
                Swal.fire('Error en el formulario', 'Error al obtener la lista de usuarios', 'error');
                this.loading = false;
            }
        );
    }

    searchUser(word: string) {
        if (word.trim().length > 3) {
            // Filtrar usuarios localmente
            const filteredUsers = this.allUsers.filter(user => 
                user.firstName?.toLowerCase().includes(word.toLowerCase()) ||
                user.lastName?.toLowerCase().includes(word.toLowerCase()) ||
                user.email?.toLowerCase().includes(word.toLowerCase()) ||
                user.roles?.some(role => {
                    const roleText = typeof role === 'string' ? role : (role as any).name || '';
                    return roleText.toLowerCase().includes(word.toLowerCase());
                })
            );
            
            // Actualizar paginador con usuarios filtrados
            this.paginationService.updatePaginator(this.paginatorId, filteredUsers, 10);
        } else if (word.trim().length === 0) {
            // Restaurar todos los usuarios
            this.paginationService.updatePaginator(this.paginatorId, this.allUsers, 10);
        }
    }

    listBySize(size: number) {
        // Cambiar el tamaño de página
        this.paginationService.changePageSize(this.paginatorId, size);
    }

    disableUser(user: User) {
    Swal.fire({
        title: '¿Está seguro de deshabilitar este usuario?',
        text: `Se deshabilitará el usuario: ${user.firstName} ${user.lastName}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, deshabilitar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            this.loading = true;
            
            this.userService.disableUser(user).subscribe(
                resp => {
                    // Eliminar usuario de la lista completa
                    this.allUsers = this.allUsers.filter(obj => obj.id !== user.id);
                    
                    // Actualizar paginador con la nueva lista
                    const currentPageSize = this.paginationService.getPaginatorState(this.paginatorId)?.paginator.size || 10;
                    this.paginationService.updatePaginator(
                        this.paginatorId, 
                        this.allUsers, 
                        currentPageSize
                    );
                    
                    this.loading = false;
                    
                    Swal.fire({
                        title: '¡Usuario deshabilitado!',
                        text: 'El usuario ha sido deshabilitado correctamente',
                        icon: 'success',
                        timer: 2000,
                        timerProgressBar: true,
                        showConfirmButton: false
                    });
                },
                error => {
                    this.loading = false;
                    
                    Swal.fire({
                        title: 'Error',
                        text: 'Ha ocurrido un error al deshabilitar el usuario',
                        icon: 'error',
                        confirmButtonText: 'Aceptar'
                    });
                    
                    console.error('Error al deshabilitar usuario:', error);
                }
            );
        }
    });
}

    ngOnDestroy(): void {
        // Limpiar suscripción y paginador
        if (this.paginationSubscription) {
            this.paginationSubscription.unsubscribe();
        }
        this.paginationService.destroyPaginator(this.paginatorId);
    }
}