import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReporteInconsistenciasComponent } from './reporte-inconsistencias.component';

describe('ReporteInconsistenciasComponent', () => {
  let component: ReporteInconsistenciasComponent;
  let fixture: ComponentFixture<ReporteInconsistenciasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReporteInconsistenciasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReporteInconsistenciasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
