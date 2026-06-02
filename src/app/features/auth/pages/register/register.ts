import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastrService } from 'ngx-toastr';
import { FormInputComponent } from '../../../../shared/components/form-input/form-input';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';
import { mensagemErroCadastro } from '../../../../shared/erro/mensagem-erro-cadastro';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    FormInputComponent,
    AppButtonComponent,
  ],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {

  loading = false;
  submitted = false;
  error = '';

  signupForm = new FormGroup({
    name: new FormControl('', [
      Validators.required,
      Validators.minLength(3),
    ]),
    email: new FormControl('', [
      Validators.required,
      Validators.email,
    ]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
    ]),
    passwordConfirm: new FormControl('', [
      Validators.required,
    ]),
  });

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly toastr: ToastrService
  ) {}

  submit(): void {
    this.error = '';
    this.submitted = true;

    if (this.signupForm.invalid || this.passwordsDoNotMatch()) {
      return;
    }

    const { name, email, password } = this.signupForm.value;
     this.loading = true;
    this.authService.signup(name!, email!, password!).subscribe({
      next: () => {
        setTimeout(()=>{
          this.loading = false;
        });
        this.toastr.success('Conta criada com sucesso!');
        this.router.navigate(['/login']);
      },
      error: (err: unknown) => {
        setTimeout(() => {
          this.loading = false;
        });
        const mensagem =
          err instanceof HttpErrorResponse
            ? mensagemErroCadastro(err)
            : 'Erro ao criar conta. Tente novamente.';
        this.error = mensagem;
        this.toastr.error(mensagem);
      },
    });
  }

isInvalid(field: string): boolean {
  const control = this.signupForm.get(field);

  return !!(
    control &&
    control.invalid &&
    (control.touched || this.submitted)
  );
}

  passwordsDoNotMatch(): boolean {
  const p1 = this.signupForm.get('password')?.value ?? '';
  const p2 = this.signupForm.get('passwordConfirm')?.value ?? '';

  if (!this.submitted && !this.signupForm.get('passwordConfirm')?.touched) {
    return false;
  }

  return p1 !== p2;
}
}