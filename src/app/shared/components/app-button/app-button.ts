import { Component, Input,EventEmitter ,Output} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule,RouterModule],
  templateUrl: './app-button.html',
  styleUrl: './app-button.css',
})
export class AppButtonComponent {
  @Input() label = 'Button';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() variant: ButtonVariant = 'primary';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() fullWidth = false;
  @Input() extraClass = '';
  @Input() routerLink?: string | any[];
  @Input() size: ButtonSize = 'md';
  
  @Output() clicked = new EventEmitter<MouseEvent>();

  handleClick(event: MouseEvent): void {
    if (this.disabled || this.loading) {
      event.preventDefault();
      return;
    }
    this.clicked.emit(event);
  }
  onClick(): void {
    if (this.disabled || this.loading || this.routerLink) return;
    this.clicked.emit();
  }
}


