import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppButton } from './app-button';

describe('AppButton', () => {
  let component: AppButton;
  let fixture: ComponentFixture<AppButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppButton]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppButton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
