import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EstudoTimer } from './estudo-timer';

describe('EstudoTimer', () => {
  let component: EstudoTimer;
  let fixture: ComponentFixture<EstudoTimer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstudoTimer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EstudoTimer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
