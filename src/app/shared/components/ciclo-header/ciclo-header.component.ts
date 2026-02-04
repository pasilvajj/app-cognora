import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-ciclo-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ciclo-header.component.html',
  styleUrl: './ciclo-header.component.css',
})
export class CicloHeaderComponent {
  @Input() nome!: string;
  @Input() cargoNome!: string;
  @Input() cargaHorariaSemanal!: number;
  @Input() editable = false;
  @Input() modo: 'view' | 'edit' = 'view';
}