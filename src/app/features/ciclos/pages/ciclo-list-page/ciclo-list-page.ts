import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, inject, resource, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AppButtonComponent } from '../../../../shared/components/app-button/app-button';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { CiclosApiService } from '../../data/ciclos-api.service';
import { CicloDto } from '../../data/ciclos.models';

@Component({
  selector: 'app-ciclo-list-page',
  standalone: true,
  imports: [CommonModule, RouterModule, AppButtonComponent, ConfirmDialog],
  templateUrl: './ciclo-list-page.html',
  styleUrl: './ciclo-list-page.css',
})
export class CicloListPage {
  loading = signal(true);

  api = inject(CiclosApiService);
  cdr = inject(ChangeDetectorRef);
  router = inject(Router);

  openMenuId = signal<number | null>(null);
  cicloParaExcluir = signal<CicloDto | null>(null);
  excluindo = signal(false);

  ciclosResource = resource({
    loader: () => this.api.listCiclos()
  });

  toggleMenu(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuId.update(prev => prev === id ? null : id);
  }

  ciclos = resource({
    loader: () => this.api.listCiclos()
  })

  constructor() { }

  abrirCiclo(id: number): void {
    this.router.navigate(['/estudaAgora', id]);
  }

  labelVoltas(n: number): string {
    return n === 1 ? '1 volta concluída neste ciclo' : `${n} voltas concluídas neste ciclo`;
  }

  // toggleMenu(id: number, event: MouseEvent): void {
  //   event.stopPropagation();
  //   this.openMenuId = this.openMenuId === id ? null : id;
  // }

  visualizar(c: CicloDto): void {
    this.openMenuId.set(null);
    this.router.navigate(['/ciclos/visualizar', c.id]);
  }

  editar(c: CicloDto): void {
    this.openMenuId.set(null);
    this.router.navigate(['/ciclos/editar', c.id]);
  }

  excluir(c: CicloDto): void {
    this.openMenuId.set(null);
    this.cicloParaExcluir.set(c);

  }

  /** 👇 FECHAR MENU AO CLICAR FORA */
  @HostListener('document:click')
  closeMenuOnOutsideClick(): void {
    this.openMenuId.set(null);
  }

  // cicloParaExcluir: CicloDto | null = null;
  // excluindo = false;

  cancelarExclusao(): void {
    this.cicloParaExcluir.set(null);
    this.excluindo.set(false);
  }

  confirmarExclusao(): void {
    const ciclo = this.cicloParaExcluir();
    if (!ciclo) return;

    this.excluindo.set(true);
    this.api.deletarCiclo(ciclo.id).subscribe({
      next: () => {
        // Atualiza a lista local do resource sem precisar de um novo GET
        this.ciclosResource.value.update(list => list?.filter(c => c.id !== ciclo.id));
        this.cancelarExclusao();
      },
      error: () => this.excluindo.set(false),
      complete: () => this.excluindo.set(false)
    });
  }


}