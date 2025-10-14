import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecepcionOpComponent } from './recepcion-op.component';

describe('RecepcionOpComponent', () => {
  let component: RecepcionOpComponent;
  let fixture: ComponentFixture<RecepcionOpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecepcionOpComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecepcionOpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
