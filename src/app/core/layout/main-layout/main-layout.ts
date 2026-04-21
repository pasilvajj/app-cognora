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
  private readonly STORAGE_KEY = 'cognora.sidebar.expanded';

  ngOnInit(): void {
    this.detectMobile();
    if (this.isMobile) {
      this.isSidebarOpen = false;
    } else {
      this.isSidebarOpen = this.readStoredSidebarExpanded();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    const wasMobile = this.isMobile;
    this.detectMobile();
    if (this.isMobile) {
      this.isSidebarOpen = false;
    } else if (wasMobile && !this.isMobile) {
      this.isSidebarOpen = this.readStoredSidebarExpanded();
    }
  }

  private detectMobile(): void {
    this.isMobile = window.innerWidth <= this.MOBILE_BREAKPOINT;
  }

  private readStoredSidebarExpanded(): boolean {
    try {
      return localStorage.getItem(this.STORAGE_KEY) !== '0';
    } catch {
      return true;
    }
  }

  private persistDesktopSidebar(): void {
    if (this.isMobile) return;
    try {
      localStorage.setItem(this.STORAGE_KEY, this.isSidebarOpen ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    this.persistDesktopSidebar();
  }

  closeSidebarOnMobile(): void {
    if (this.isMobile) {
      this.isSidebarOpen = false;
    }
  }
}