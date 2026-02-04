import { TestBed } from '@angular/core/testing';

import { EstudoService } from './estudo-service';

describe('EstudoService', () => {
  let service: EstudoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EstudoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
