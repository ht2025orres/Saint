import { Component, OnInit } from '@angular/core';
import { User } from '../../../models/User';
import { Role } from '../../../models/Role';
import { UserService } from '../../../services/user.service';
import { RoleService } from '../../../services/role.service';
import { AuthService } from '../../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
    selector: 'app-create-user',
    templateUrl: './create-user.component.html',
    styleUrls: ['./create-user.component.css']
})
export class CreateUserComponent implements OnInit {

    title = 'Datos de usuario';
    loading = false;
    userCurrent: User;
    formGr: FormGroup;
    modifyPassword = 'unset';
    roles: Role[] = [];

    constructor(private userService: UserService,
        public authService: AuthService,
        private roleService: RoleService,
        private router: Router,
        private fb: FormBuilder,
        private activatedRoute: ActivatedRoute) {
    }

    ngOnInit(): void {
        this.userCurrent = new User();
        this.loadData();
        this.createForm();
    }


    loadData() {
        let idRoute;
        this.activatedRoute.params
            .subscribe(({ id }) => {
                this.validateForbiddenDataByRole(id)
                if (id === 'nuevo') {
                    return;
                }
                this.userService.getById(id)
                    .subscribe(resp => {
                        this.userCurrent = resp;
                        this.setFormValues();
                    }, () => {
                        Swal.fire({
                            title: 'Error de carga',
                            html: 'La informacion del usuario no se ha cargado correctamente',
                            icon: 'error',
                            timer: 1500,
                            timerProgressBar: true
                        });
                        this.setFormValues();
                        console.log(this.userCurrent);
                    });
            });



        this.roleService.getAll()
            .subscribe(response => {
                this.roles = response;
            }, () => {
                Swal.fire({
                    title: 'Error de carga',
                    html: 'La informacion de los roles no se ha cargado correctamente',
                    icon: 'error',
                    timer: 1500,
                    timerProgressBar: true
                });
            });
    }

    get nombreNoValid() {
        return this.formGr.get('nombre').invalid && this.formGr.get('nombre').touched;
    }

    get apellidoNoValid() {
        return this.formGr.get('apellido').invalid && this.formGr.get('apellido').touched;
    }

    get emailNoValid() {
        return this.formGr.get('email').invalid && this.formGr.get('email').touched;
    }

    get pass1NoValid() {
        return this.formGr.get('password').invalid && this.formGr.get('password').touched;
    }

    get pass2NoValid() {
        const pass1 = this.formGr.get('password').value;
        const pass2 = this.formGr.get('repassword').value;

        return (pass1 !== pass2);
    }

    get roleNovalid() {
        return this.formGr.get('role').invalid && this.formGr.get('role').touched;
    }

    createForm() {
        this.formGr = this.fb.group({
            nombre: ['', Validators.required],
            apellido: ['', Validators.required],
            email: ['', [Validators.required, Validators.pattern('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,3}$')]],
            password: ['', Validators.required],
            repassword: ['', Validators.required],
            role: ['', Validators.required]
        });
    }

    saveInfo() {
        if (this.formGr.valid) {
            this.userCurrent.firstName = this.formGr.get('nombre').value;
            this.userCurrent.lastName = this.formGr.get('apellido').value;
            this.userCurrent.email = this.formGr.get('email').value;

            if (this.formGr.get('password').enabled) {
                this.userCurrent.password = this.formGr.get('password').value;
            } else {
                this.userCurrent.password = "";
            }

            this.userCurrent.roles = this.formGr.get('role').value;

            this.loading = true;
            this.userService.saveUser(this.userCurrent)
                .subscribe(() => {
                    this.loading = false;
                    Swal.fire({
                        title: 'Correcto',
                        html: `El usuario fue guardado correctamente `,
                        icon: 'success',
                        timer: 1500,
                        timerProgressBar: true
                    });
                    this.routerUserAdmin();
                }, error => {
                    Swal.fire({
                        title: 'Error guardar usuario',
                        html: `El usuario no se ha podido guardar`,
                        icon: 'error',
                        timer: 1500,
                        timerProgressBar: true
                    });
                    this.loading = false;
                    this.routerUserAdmin();
                });
        }
    }

    cursorValidationItem() {
        if (this.formGr.invalid) {
            return 'unset';
        } else {
            return 'pointer';
        }
    }

    setFormValues() {
        this.formGr.setValue({
            nombre: this.userCurrent.firstName || '',
            apellido: this.userCurrent.lastName || '',
            email: this.userCurrent.email || '',
            password: '*****',
            repassword: '*****',
            role: this.userCurrent.roles || '',
        });

        this.formGr.get('password').disable();
        this.formGr.get('repassword').disable();
        this.modifyPassword = 'pointer';
    }

    enablePasswordFields() {
        if (this.modifyPassword === 'pointer') {
            if (this.formGr.get('password').enabled) {
                this.formGr.get('password').disable();
                this.formGr.get('repassword').disable();

                this.formGr.get('password').markAsUntouched();
                this.formGr.get('repassword').markAsUntouched();

                this.formGr.patchValue({
                    password: '*****',
                    repassword: '*****'
                });
            } else {
                this.formGr.get('password').enable();
                this.formGr.get('repassword').enable();
                this.formGr.get('password').markAsUntouched();
                this.formGr.get('repassword').markAsUntouched();
                this.formGr.patchValue({
                    password: '',
                    repassword: ''
                });
            }
        }
    }

    routerUserAdmin() {
        if (this.authService.hasRole('Administrador del sistema')) {
            this.router.navigate(['/users/page/0']);
        } else {
            this.router.navigate(['dashboard']);
        }
    }

    validateForbiddenDataByRole(id: any) {
        if ((id != this.authService.user.id) && !this.authService.hasRole('Administrador del sistema')) {
            Swal.fire('Acceso denegado', `Hola ${this.authService.user.firstName} ${this.authService.user.lastName} no tienes permisos suficientes, para acceder al modulo requerido`, 'warning');
            this.router.navigate(['dashboard']);
        }
    }
}
