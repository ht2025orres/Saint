import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthorizationManagerComponent } from './authorization-manager.component';

describe('AuthorizationManagerComponent', () => {
  let component: AuthorizationManagerComponent;
  let fixture: ComponentFixture<AuthorizationManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthorizationManagerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuthorizationManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
