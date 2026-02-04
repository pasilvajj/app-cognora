import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastrService } from 'ngx-toastr';
import { FormInputComponent } from '../../../../shared/components/form-input/form-input';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
            CommonModule,
            ReactiveFormsModule,
            FormInputComponent,
            AppButtonComponent
          ],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {

  loading = false;
  submitted = false;

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
    private router: Router,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  submit(): void {
   
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
      error: () => {
        setTimeout(()=>{
          this.loading = false;
        });
       
        this.toastr.error('Erro ao criar conta');
        
      }
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