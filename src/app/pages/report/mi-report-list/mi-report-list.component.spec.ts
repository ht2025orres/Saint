import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MiReportListComponent } from './mi-report-list.component';

describe('MiReportListComponent', () => {
  let component: MiReportListComponent;
  let fixture: ComponentFixture<MiReportListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MiReportListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MiReportListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
