import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrarEmpaqueComponent } from './registrar-empaque.component';

describe('RegistrarEmpaqueComponent', () => {
  let component: RegistrarEmpaqueComponent;
  let fixture: ComponentFixture<RegistrarEmpaqueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrarEmpaqueComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistrarEmpaqueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
