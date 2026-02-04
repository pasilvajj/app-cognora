import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    Sidebar,
    Topbar,
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout implements OnInit {

  isSidebarOpen = true;
  isMobile = false;

  private readonly MOBILE_BREAKPOINT = 768;

  ngOnInit(): void {
    this.updateLayout();
  }
  @HostListener('window:resize')
  onResize(): void {
    this.updateLayout();
  }

  private updateLayout(): void {
    this.isMobile = window.innerWidth <= this.MOBILE_BREAKPOINT;

    // mobile começa fechado
    if (this.isMobile) {
      this.isSidebarOpen = false;
    } else {
      this.isSidebarOpen = true;
    }
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebarOnMobile(): void {
    if (this.isMobile) {
      this.isSidebarOpen = false;
    }
  }
}