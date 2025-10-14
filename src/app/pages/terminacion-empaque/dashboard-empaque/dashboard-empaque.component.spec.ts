import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardEmpaqueComponent } from './dashboard-empaque.component';

describe('DashboardEmpaqueComponent', () => {
  let component: DashboardEmpaqueComponent;
  let fixture: ComponentFixture<DashboardEmpaqueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardEmpaqueComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardEmpaqueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
