import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalTareaComponent } from './modal-tarea.component';

describe('ModalTareaComponent', () => {
  let component: ModalTareaComponent;
  let fixture: ComponentFixture<ModalTareaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalTareaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalTareaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
