import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportCreateComponent } from './report-create.component';

describe('ReportCreateComponent', () => {
  let component: ReportCreateComponent;
  let fixture: ComponentFixture<ReportCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportCreateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
