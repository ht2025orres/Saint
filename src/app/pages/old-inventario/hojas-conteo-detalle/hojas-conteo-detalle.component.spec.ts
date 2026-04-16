import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HojasConteoDetalleComponent } from './hojas-conteo-detalle.component';

describe('HojasConteoDetalleComponent', () => {
  let component: HojasConteoDetalleComponent;
  let fixture: ComponentFixture<HojasConteoDetalleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HojasConteoDetalleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HojasConteoDetalleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
