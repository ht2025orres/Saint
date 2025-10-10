import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MisInconsistenciasComponent } from './mis-inconsistencias.component';

describe('MisInconsistenciasComponent', () => {
  let component: MisInconsistenciasComponent;
  let fixture: ComponentFixture<MisInconsistenciasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisInconsistenciasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MisInconsistenciasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
