import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

import { ProfileService } from '../../service/profile.service';
import { FormInputComponent } from '../../../../shared/components/form-input/form-input';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormInputComponent,
    AppButtonComponent
  ],
  templateUrl: './profile-settings.html',
  styleUrl: './profile-settings.css'
})
export class ProfileSettingsPage implements OnInit {

  activeTab: 'profile' | 'security' = 'profile';

  form: FormGroup;

  loading = false;
  loadingPassword = false;

  constructor(
    private fb: FormBuilder,
    private profileService: ProfileService,
    private toast: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: [{ value: '', disabled: true }],
      password: [''],
      passwordConfirm: ['']
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  private loadProfile(): void {
    this.profileService.getProfile().subscribe({
      next: profile => {
        this.form.patchValue({
          name: profile.name,
          email: profile.email
        });
      },
      error: () => {
        this.toast.error('Erro ao carregar perfil');
      }
    });
  }

  saveProfile(): void { 
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    const { name, email } = this.form.getRawValue();

    this.profileService.updateProfile({ name, email }).subscribe({
      next: () => {
        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
          this.toast.success('Perfil atualizado com sucesso');
        });
      },
      error: () => {
        setTimeout(() => {

          this.loading = false;
          this.cdr.detectChanges();
          this.toast.error('Erro ao salvar perfil');
        });
      }
    });
  }

  savePassword(): void {
    const { password, passwordConfirm } = this.form.getRawValue();

    if (!password || !passwordConfirm) {
      this.toast.error('Preencha todos os campos');
      return;
    }

    if (password !== passwordConfirm) {
      this.toast.error('As senhas não conferem');
      return;
    }

    this.loadingPassword = true;

    this.profileService.updatePassword({
      currentPassword: '',
      newPassword: password
    }).subscribe({
      next: () => {
        this.toast.success('Senha atualizada com sucesso');
        this.form.patchValue({
          password: '',
          passwordConfirm: ''
        });
        this.loadingPassword = false;
      },
      error: () => {
        this.toast.error('Erro ao atualizar senha');
        this.loadingPassword = false;
      }
    });
  }

  cancel(): void {
    this.loadProfile();
    this.form.patchValue({
      password: '',
      passwordConfirm: ''
    });
  }
}