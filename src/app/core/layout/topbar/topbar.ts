import { Component, OnInit, Input, Output, EventEmitter, ElementRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
import { ThemeService } from '../../theme/theme.service';

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
    private router: Router,
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly themeService: ThemeService
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.menuOpen = false;
    }
  }

  onMenuClick(): void {
    this.menuClick.emit();
  }

  isDarkTheme(): boolean {
    return this.themeService.isDark();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  logout(): void {
    this.menuOpen = false;
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}