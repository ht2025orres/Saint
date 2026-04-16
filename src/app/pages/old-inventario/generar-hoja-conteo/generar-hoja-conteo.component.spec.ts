import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerarHojaConteoComponent } from './generar-hoja-conteo.component';

describe('GenerarHojaConteoComponent', () => {
  let component: GenerarHojaConteoComponent;
  let fixture: ComponentFixture<GenerarHojaConteoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerarHojaConteoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenerarHojaConteoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
