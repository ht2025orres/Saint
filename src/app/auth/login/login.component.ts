import { Component, OnInit } from '@angular/core';
import { User } from '../../models/User';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

    user: User;
    errorMessage = '';
    formGr: FormGroup;
    stylesObj;

    constructor(private authService: AuthService, private router: Router,
        private fb: FormBuilder) {
        this.user = new User();
        this.createForm();
    }

    ngOnInit(): void {
        if (this.authService.isAuthenticated()) { /* Cada vez que llega a la pagina de login valida si el pages esta autenticado */
            Swal.fire({
                title: 'Login',
                html: `Hola ${this.authService.user.firstName}, ya estás autenticado en el sistema`,
                icon: 'info',
                timer: 2000,
                timerProgressBar: true
            });
            this.router.navigate(['/dashboard']);
        }
    }

    get emailNoValid() {
        return this.formGr.get('email').invalid && this.formGr.get('email').touched;
    }

    get passwordNoValid() {
        return this.formGr.get('password').invalid && this.formGr.get('password').touched;
    }

    createForm() {
        this.formGr = this.fb.group({
            email: ['', [Validators.required, Validators.pattern('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,3}$')]],
            password: ['', Validators.required]
        });
    }

    login(): void {
        if (this.formGr.valid) {
            this.user.email = this.formGr.get('email').value;
            this.user.password = this.formGr.get('password').value;
            this.authService.login(this.user).subscribe(response => {
                this.authService.saveUser(response.access_token);
                this.authService.saveToken(response.access_token, response.refresh_token);
                const user = this.authService.user;
                Swal.fire({
                    title: 'Inicio de sesión',
                    html: `Hola <strong>${user.firstName}</strong> , iniciaste sesión correctamente`,
                    icon: 'success',
                    timer: 2000,
                    timerProgressBar: true
                });
                this.router.navigate(['/dashboard']);
            }, err => {

                // 🟥 1. Usuario deshabilitado por tu API Laravel
                if (err.error?.message === 'Usuario deshabilitado') {
                Swal.fire({
                    title: 'Acceso denegado',
                    html: 'El usuario está <b>deshabilitado</b>.<br>Contacte con el administrador.',
                    icon: 'error',
                    timer: 2500,
                    timerProgressBar: true
                });

                this.formGr.get('password')?.setValue('');
                return;
                }

                // 🟥 2. Usuario no existe
                if (err.error?.message === 'Usuario no encontrado') {
                Swal.fire({
                    title: 'Usuario no encontrado',
                    html: 'Verifique el correo ingresado.',
                    icon: 'warning',
                    timer: 2500,
                    timerProgressBar: true
                });

                this.formGr.get('email')?.setValue('');
                this.formGr.get('password')?.setValue('');
                return;
                }

                // 🟥 3. Error 400 del servidor OAuth externo (usuario / contraseña incorrecta)
                if (err.status === 400) {
                Swal.fire({
                    title: 'Error de autenticación',
                    html: 'Usuario o contraseña incorrecta',
                    icon: 'warning',
                    timer: 2000,
                    timerProgressBar: true
                });

                this.formGr.get('password')?.setValue('');
                return;
                }

                // 🟥 4. Error Genérico
                Swal.fire({
                title: 'Error inesperado',
                html: 'Ha ocurrido un error al procesar la solicitud',
                icon: 'error'
                });

                console.error('Login error:', err);
            });
        }
    }

    validateCursor() {
        if (this.formGr.invalid) {
            return 'unset';
        } else {
            return 'pointer';
        }
    }
}
