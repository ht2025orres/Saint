import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionEmpacadoresComponent } from './gestion-empacadores.component';

describe('GestionEmpacadoresComponent', () => {
  let component: GestionEmpacadoresComponent;
  let fixture: ComponentFixture<GestionEmpacadoresComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionEmpacadoresComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GestionEmpacadoresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
