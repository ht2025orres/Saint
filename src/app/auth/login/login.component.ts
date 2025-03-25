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
                this.authService.saveToken(response.access_token);
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
                if (err.status === 400) {
                    Swal.fire({
                        title: 'Error de autenticación',
                        html: 'Usuario o contraseña incorrecta',
                        icon: 'warning',
                        timer: 2000,
                        timerProgressBar: true
                    });
                    this.formGr.get('email').setValue('');
                    this.formGr.get('password').setValue('');
                }
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
