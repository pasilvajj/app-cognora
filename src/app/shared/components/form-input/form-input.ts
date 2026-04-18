import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl,AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-form-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './form-input.html',
  styleUrl: './form-input.css',
})
export class FormInputComponent {
  @Input() label = '';
  @Input() type: 'text' | 'email' | 'password' = 'text';
  @Input() placeholder = '';
  /** Em telas de login, oculta checklist/força da senha. */
  @Input() passwordHints = true;

  @Input({ required: true }) control!: AbstractControl;

   @Input() errorText = 'Campo inválido';

  hidePassword = true;

  togglePassword(): void {
    this.hidePassword = !this.hidePassword;
  }
  
  get passwordStrength(): number {
    if (!this.control?.value) return 0;

    const value: string = this.control.value;
    let score = 0;

    if (value.length >= 6) score++;
    if (value.length >= 10) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;

    return score;
  }

  get strengthLabel(): string {
    if (this.passwordStrength <= 1) return 'Senha fraca';
    if (this.passwordStrength <= 3) return 'Senha média';
    return 'Senha forte';
  }

  get value(): string {
    return this.control?.value || '';
  }

  // ===== REGRAS =====
  get hasMinLength(): boolean {
    return this.value.length >= 8;
  }

  get hasNumber(): boolean {
    return /\d/.test(this.value);
  }

  get hasUppercase(): boolean {
    return /[A-Z]/.test(this.value);
  }

  get hasSpecialChar(): boolean {
    return /[!@#$%^&*(),.?":{}|<>]/.test(this.value);
  }

  get showChecklist(): boolean {
    return this.passwordHints && this.type === 'password' && this.value.length > 0;
  }

  get showError(): boolean {
    return !!(
      this.control &&
      this.control.invalid &&
      (this.control.dirty || this.control.touched)
    );
  }

}