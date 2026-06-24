import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent implements OnInit {

  formGr: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.createForm();
  }

  ngOnInit(): void {}

  createForm() {
    this.formGr = this.fb.group({
      email: ['', [Validators.required, Validators.pattern('[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,3}$')]]
    });
  }

  get emailNoValid() {
    return this.formGr.get('email').invalid && this.formGr.get('email').touched;
  }

  sendRecoveryLink(): void {
    if (this.formGr.invalid) {
      return;
    }

    this.loading = true;
    const email = this.formGr.get('email').value;

    this.authService.forgotPassword(email).subscribe({
      next: (response) => {
        this.loading = false;
        Swal.fire({
          title: 'Enlace Enviado',
          text: response.message || 'Si el correo electrónico existe en nuestro sistema, recibirá un enlace para restablecer su contraseña.',
          icon: 'success',
          confirmButtonColor: '#002A3F'
        });
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 422 && err.error?.message) {
          Swal.fire({
            title: 'Límite Superado',
            text: err.error.message,
            icon: 'warning',
            confirmButtonColor: '#002A3F'
          });
        } else {
          Swal.fire({
            title: 'Error',
            text: 'Ocurrió un error al procesar tu solicitud. Por favor intenta más tarde.',
            icon: 'error',
            confirmButtonColor: '#002A3F'
          });
        }
      }
    });
  }

  validateCursor() {
    return this.formGr.invalid || this.loading ? 'unset' : 'pointer';
  }
}
