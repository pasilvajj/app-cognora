import { Component, OnInit, ChangeDetectorRef, HostListener,} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CiclosApiService } from '../../data/ciclos-api.service';
import { CicloDto } from '../../data/ciclos.models';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-ciclo-list-page',
  standalone: true,
  imports: [CommonModule, RouterModule, AppButtonComponent, ConfirmDialog],
  templateUrl: './ciclo-list-page.html',
  styleUrl: './ciclo-list-page.css',
})
export class CicloListPage implements OnInit {
  ciclos: CicloDto[] = [];
  loading = true;

  openMenuId: number | null = null;

  constructor(
    private api: CiclosApiService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.carregarCiclos();
  }

  carregarCiclos(): void {
    this.loading = true;
    this.api.listCiclos().subscribe({
      next: (data) => (this.ciclos = data ?? []),
      error: (err) => console.error('Erro ao listar ciclos', err),
      complete: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  abrirCiclo(id: number): void {
    this.router.navigate(['/estudaAgora', id]);
  }

  toggleMenu(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  visualizar(c: CicloDto): void {
    this.openMenuId = null;
    this.router.navigate(['/ciclos/visualizar', c.id]);
  }

  editar(c: CicloDto): void {
    this.openMenuId = null;
    this.router.navigate(['/ciclos/editar', c.id]);
  }

  excluir(c: CicloDto): void {
  this.openMenuId = null;
  this.cicloParaExcluir = c; // 👈 ISSO DISPARA O MODAL
  }

  /** 👇 FECHAR MENU AO CLICAR FORA */
  @HostListener('document:click')
  closeMenuOnOutsideClick(): void {
    this.openMenuId = null;
  }

  cicloParaExcluir: CicloDto | null = null;
  excluindo = false;

  // excluir(c: CicloDto): void {
  //   this.openMenuId = null;
  //   this.cicloParaExcluir = c;
  // }

  cancelarExclusao(): void {
    this.cicloParaExcluir = null;
    this.excluindo = false;
  }

  confirmarExclusao(): void {
    if (!this.cicloParaExcluir) return;

    this.excluindo = true;

    //   this.api.deleteCiclo(this.cicloParaExcluir.id).subscribe({
    //     next: () => {
    //       this.ciclos = this.ciclos.filter(
    //         c => c.id !== this.cicloParaExcluir!.id
    //       );
    //       this.cancelarExclusao();
    //     },
    //     error: () => {
    //       this.excluindo = false;
    //     }
    //   });
    }

}