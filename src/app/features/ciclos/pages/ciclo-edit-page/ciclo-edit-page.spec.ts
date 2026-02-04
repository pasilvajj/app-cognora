import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CicloEditPage } from './ciclo-edit-page';

describe('CicloEditPage', () => {
  let component: CicloEditPage;
  let fixture: ComponentFixture<CicloEditPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CicloEditPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CicloEditPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
