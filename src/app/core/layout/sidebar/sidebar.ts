import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {

  private readonly auth = inject(AuthService);

  @Input() open = true;
  @Input() mobile = false;

  @Output() navigate = new EventEmitter<void>();

  isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  onNavigate(): void {
    this.navigate.emit();
  }
}