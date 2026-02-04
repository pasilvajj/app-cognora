import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimerRing } from './timer-ring';

describe('TimerRing', () => {
  let component: TimerRing;
  let fixture: ComponentFixture<TimerRing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimerRing]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TimerRing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
