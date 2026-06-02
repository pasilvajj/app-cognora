import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { finalize } from 'rxjs/operators';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';
import { FormInputComponent } from '../../../../shared/components/form-input/form-input';
import { mensagemErroLogin } from '../../../../shared/erro/mensagem-erro-login';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    AppButtonComponent,
    FormInputComponent,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  loading = false;
  error = '';
  /** Código HTTP ou detalhe técnico (ex.: erro 500), para o usuário distinguir de credencial errada. */
  errorDetalhe = '';

  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
    keepSignedIn: new FormControl(false),
  });

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  submit(): void {
    this.error = '';
    this.errorDetalhe = '';
    this.loginForm.markAllAsTouched();

    if (this.loginForm.invalid) {
      return;
    }

    const { email, password } = this.loginForm.getRawValue();

    this.loading = true;
    this.authService
      .login(email!, password!)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse) {
            this.error = mensagemErroLogin(err);
            if (err.status === 0 || err.status >= 500) {
              this.errorDetalhe = `Código HTTP: ${err.status || 'sem resposta'}`;
            } else if (err.status && err.status !== 401 && err.status !== 400) {
              this.errorDetalhe = `Código HTTP: ${err.status}`;
            }
          } else {
            this.error = 'Erro inesperado ao tentar entrar. Tente novamente.';
          }
          this.cdr.markForCheck();
        },
      });
  }
}
