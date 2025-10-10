import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AprobacionComponent } from './aprobacion.component';

describe('AprobacionComponent', () => {
  let component: AprobacionComponent;
  let fixture: ComponentFixture<AprobacionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AprobacionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AprobacionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
