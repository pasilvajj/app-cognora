import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeekChart } from './week-chart';

describe('WeekChart', () => {
  let component: WeekChart;
  let fixture: ComponentFixture<WeekChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeekChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeekChart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
