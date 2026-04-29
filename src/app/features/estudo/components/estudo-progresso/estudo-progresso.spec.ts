import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EstudoProgresso } from './estudo-progresso';

describe('EstudoProgresso', () => {
  let component: EstudoProgresso;
  let fixture: ComponentFixture<EstudoProgresso>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstudoProgresso]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EstudoProgresso);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ciclo', {
      nome: 'Teste',
      itens: [],
      tempoRestante: 0,
    });
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
