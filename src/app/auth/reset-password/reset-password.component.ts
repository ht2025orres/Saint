import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {

  formGr: FormGroup;
  token = '';
  email = '';
  loading = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      this.email = params['email'] || '';
      
      if (!this.token || !this.email) {
        Swal.fire({
          title: 'Enlace Inválido',
          text: 'Falta información requerida en el enlace de recuperación. Solicita uno nuevo.',
          icon: 'error',
          confirmButtonColor: '#002A3F'
        });
        this.router.navigate(['/login']);
      }
    });
  }

  createForm() {
    this.formGr = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]]
    }, {
      validators: this.passwordsMatchValidator
    });
  }

  passwordsMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirm = form.get('password_confirmation')?.value;
    return password === confirm ? null : { passwordMismatch: true };
  }

  get passwordNoValid() {
    return this.formGr.get('password').invalid && this.formGr.get('password').touched;
  }

  get confirmNoValid() {
    return (this.formGr.get('password_confirmation').invalid || this.formGr.hasError('passwordMismatch')) && 
           this.formGr.get('password_confirmation').touched;
  }

  resetPassword(): void {
    if (this.formGr.invalid) {
      return;
    }

    this.loading = true;
    const payload = {
      email: this.email,
      token: this.token,
      password: this.formGr.get('password').value,
      password_confirmation: this.formGr.get('password_confirmation').value
    };

    this.authService.resetPassword(payload).subscribe({
      next: (response) => {
        this.loading = false;
        Swal.fire({
          title: 'Contraseña Actualizada',
          text: response.message || 'Tu contraseña ha sido restablecida correctamente.',
          icon: 'success',
          confirmButtonColor: '#002A3F'
        });
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.message || 'Error al restablecer la contraseña. Solicita un nuevo enlace.';
        Swal.fire({
          title: 'Error',
          text: msg,
          icon: 'error',
          confirmButtonColor: '#002A3F'
        });
      }
    });
  }

  validateCursor() {
    return this.formGr.invalid || this.loading ? 'unset' : 'pointer';
  }
}
