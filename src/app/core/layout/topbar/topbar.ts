import { Component, OnInit,Input, Output, EventEmitter} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-topbar',
  imports: [CommonModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class Topbar implements OnInit {

  @Input() mobile = false;
  @Output() menuClick = new EventEmitter<void>();

   menuOpen = false;
   userName?: string;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
  const user = this.auth.getUser();
  this.userName = user?.name ?? '';
}

  get user() {
    return this.auth.getUser();
  }

  get initials(): string {
    if (!this.user?.name) return '';
    return this.user.name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  onMenuClick(): void {
    this.menuClick.emit();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);{

}
  }
}