import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileSettingsPage } from './profile-settings';

describe('ProfileSettingsPage', () => {
  let component: ProfileSettingsPage;
  let fixture: ComponentFixture<ProfileSettingsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileSettingsPage],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileSettingsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
