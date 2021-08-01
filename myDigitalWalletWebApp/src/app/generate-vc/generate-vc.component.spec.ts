import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerateVcComponent } from './generate-vc.component';

describe('GenerateVcComponent', () => {
  let component: GenerateVcComponent;
  let fixture: ComponentFixture<GenerateVcComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GenerateVcComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GenerateVcComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
