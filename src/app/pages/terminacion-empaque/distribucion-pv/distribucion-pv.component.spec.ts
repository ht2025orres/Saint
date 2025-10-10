import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DistribucionPvComponent } from './distribucion-pv.component';

describe('DistribucionPvComponent', () => {
  let component: DistribucionPvComponent;
  let fixture: ComponentFixture<DistribucionPvComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DistribucionPvComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DistribucionPvComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
