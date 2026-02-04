import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-observacoes-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './observacoes-editor.html',
  styleUrl: './observacoes-editor.css',
})
export class ObservacoesEditor implements OnInit, OnDestroy {
  @Input() observacoes = '';
  @Input() sessaoFinalizada = false;
  
  @Output() observacoesChange = new EventEmitter<string>();
  @Output() saveRequest = new EventEmitter<string>();

  observacoesAlteradas = false;
  salvandoObservacoes = false;
  statusObservacoesLabel = '';
  
  private observacoesChange$ = new Subject<string>();
  private observacoesSub?: Subscription;
  private ultimasObservacoesSalvas = '';

  ngOnInit(): void {
    this.ultimasObservacoesSalvas = this.observacoes;
    
    this.observacoesSub = this.observacoesChange$
      .pipe(debounceTime(800), distinctUntilChanged())
      .subscribe((text) => {
        this.saveRequest.emit(text);
      });
  }

  ngOnDestroy(): void {
    this.observacoesSub?.unsubscribe();
  }

  onObservacoesChange(value: string): void {
    this.observacoes = value;
    this.observacoesAlteradas = (this.observacoes ?? '') !== (this.ultimasObservacoesSalvas ?? '');
    this.statusObservacoesLabel = this.observacoesAlteradas ? 'Salvo' : 'Não Salvo';
    
    this.observacoesChange.emit(this.observacoes);
    this.observacoesChange$.next(this.observacoes ?? '');
  }

  // Métodos públicos para o componente pai notificar sobre o status do salvamento
  notifySaving(): void {
    this.salvandoObservacoes = true;
    this.statusObservacoesLabel = 'Salvando...';
  }

  notifySaveSuccess(observacoesSalvas: string): void {
    this.ultimasObservacoesSalvas = observacoesSalvas;
    this.observacoesAlteradas = false;
    this.salvandoObservacoes = false;
    this.statusObservacoesLabel = 'Salvo';
  }

  notifySaveError(): void {
    this.salvandoObservacoes = false;
    this.statusObservacoesLabel = 'Falha ao salvar';
  }
}
