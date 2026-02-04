import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CicloForm } from './ciclo-form';

describe('CicloForm', () => {
  let component: CicloForm;
  let fixture: ComponentFixture<CicloForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CicloForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CicloForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
