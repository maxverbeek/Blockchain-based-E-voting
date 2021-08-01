import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DisplayCredentialsComponent } from './display-credentials.component';

describe('DisplayCredentialsComponent', () => {
  let component: DisplayCredentialsComponent;
  let fixture: ComponentFixture<DisplayCredentialsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DisplayCredentialsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DisplayCredentialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
