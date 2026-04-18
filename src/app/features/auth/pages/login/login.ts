import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { finalize } from 'rxjs/operators';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';
import { FormInputComponent } from '../../../../shared/components/form-input/form-input';

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
        error: () => {
          this.error = 'Email ou senha inválidos';
          this.cdr.markForCheck();
        },
      });
  }
}
