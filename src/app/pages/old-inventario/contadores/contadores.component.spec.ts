import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContadoresComponent } from './contadores.component';

describe('ContadoresComponent', () => {
  let component: ContadoresComponent;
  let fixture: ComponentFixture<ContadoresComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContadoresComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContadoresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
