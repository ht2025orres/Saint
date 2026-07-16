import { Component, OnInit } from '@angular/core';
import { User } from '../../models/User';
import { AuthService } from '../../services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MaintenanceService } from '../../services/maintenance.service';

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

  maintenanceActive = false;
  maintenanceData: any = null;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private extMaintenanceService: MaintenanceService
  ) {
    this.user = new User();
    this.createForm();
  }

  ngOnInit(): void {
    // Check if kicked out by maintenance
    this.route.queryParams.subscribe(params => {
      if (params['maintenance']) {
        this.checkMaintenanceStatus();
      }
    });

    this.checkMaintenanceStatus();
    
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

  checkMaintenanceStatus(): void {
    this.extMaintenanceService.getStatus().subscribe({
      next: (res) => {
        if (res.active) {
          this.maintenanceActive = true;
          this.maintenanceData = res.data;
        } else {
          this.maintenanceActive = false;
          this.maintenanceData = null;
        }
      },
      error: (err) => console.error('Error checking maintenance', err)
    });
  }

  get emailNoValid() {
    return this.formGr.get('email').invalid && this.formGr.get('email').touched;
  }

  get passwordNoValid() {
    return this.formGr.get('password').invalid && this.formGr.get('password').touched;
  }

  createForm() {
    this.formGr = this.fb.group({
      email: ['', [Validators.required, Validators.pattern('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,3}$')]],
      password: ['', Validators.required]
    });
  }

    login(): void {
        if (this.formGr.valid) {
            this.user.email = this.formGr.get('email').value.trim().toLowerCase();
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

                // 🟥 4. Error Genérico (sólo si no es un error de mantenimiento, ya que el interceptor lo maneja)
                if (!(err.status === 503 && err.error?.error === 'MAINTENANCE_ACTIVE')) {
                    Swal.fire({
                        title: 'Error inesperado',
                        html: 'Ha ocurrido un error al procesar la solicitud',
                        icon: 'error'
                    });
                }

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
