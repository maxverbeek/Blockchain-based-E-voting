import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScanCredentialsComponent } from './scan-credentials.component';

describe('ScanCredentialsComponent', () => {
  let component: ScanCredentialsComponent;
  let fixture: ComponentFixture<ScanCredentialsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ScanCredentialsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ScanCredentialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
