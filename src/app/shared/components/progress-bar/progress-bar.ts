import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-bar',
  imports: [CommonModule],
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.css',
})
export class ProgressBar {
 disciplines = [
    { name: 'Direito Constitucional', progress: 75 },
    { name: 'Raciocínio Lógico', progress: 45 },
    { name: 'Informática', progress: 60 },
    { name: 'Português', progress: 30 },
    { name: 'Direito Penal', progress: 85 }
  ];

  getColor(progress: number): string {
    if (progress >= 75) return 'success';
    if (progress >= 50) return 'warning';
    return 'danger';
  }

}
