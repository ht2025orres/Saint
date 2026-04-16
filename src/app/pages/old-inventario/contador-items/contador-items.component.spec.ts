import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContadorItemsComponent } from './contador-items.component';

describe('ContadorItemsComponent', () => {
  let component: ContadorItemsComponent;
  let fixture: ComponentFixture<ContadorItemsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContadorItemsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContadorItemsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
