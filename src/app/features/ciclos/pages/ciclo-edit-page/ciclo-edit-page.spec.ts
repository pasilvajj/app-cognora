import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { CicloEditPage } from './ciclo-edit-page';

describe('CicloEditPage', () => {
  let component: CicloEditPage;
  let fixture: ComponentFixture<CicloEditPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CicloEditPage],
      providers: [provideHttpClient(), provideRouter([])],
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
