import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RevisionConsumoComponent } from './revision-consumo.component';

describe('RevisionConsumoComponent', () => {
  let component: RevisionConsumoComponent;
  let fixture: ComponentFixture<RevisionConsumoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RevisionConsumoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RevisionConsumoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
