import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

import { ProfileSettingsPage } from './profile-settings';
import { ProfileService } from '../../service/profile.service';

describe('ProfileSettingsPage', () => {
  let component: ProfileSettingsPage;
  let fixture: ComponentFixture<ProfileSettingsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileSettingsPage],
      providers: [
        {
          provide: ProfileService,
          useValue: {
            getProfile: () => of({ id: 1, name: 'Usuário de teste', email: 'teste@cognora.local' }),
            updateProfile: () => of(void 0),
            updatePassword: () => of(void 0),
          },
        },
        {
          provide: ToastrService,
          useValue: { success: () => undefined, error: () => undefined },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileSettingsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
