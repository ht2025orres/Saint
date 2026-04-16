import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HojasConteoListComponent } from './hojas-conteo-list.component';

describe('HojasConteoListComponent', () => {
  let component: HojasConteoListComponent;
  let fixture: ComponentFixture<HojasConteoListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HojasConteoListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HojasConteoListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
