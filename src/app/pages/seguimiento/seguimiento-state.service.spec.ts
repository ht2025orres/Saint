import { TestBed } from '@angular/core/testing';

import { SeguimientoStateService } from './seguimiento-state.service';

describe('SeguimientoStateService', () => {
  let service: SeguimientoStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SeguimientoStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
