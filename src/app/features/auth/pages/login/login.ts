import { Component,ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router ,RouterModule} from '@angular/router';
// import { LoginService } from '../../service/login.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { finalize } from 'rxjs/operators';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule,RouterModule,AppButtonComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {

  email = '';
  password = '';
  keepSignedIn = false;
  loading = false;
  error = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

submit(): void {
  this.loading = true;
  this.error = '';

  this.authService
    .login(this.email, this.password)
    .pipe(finalize(() => (this.loading = false)))
    .subscribe({
      next: () => {
         this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.loading = false;
        this.error = 'Email ou senha inválidos';
      },
    });
}
}