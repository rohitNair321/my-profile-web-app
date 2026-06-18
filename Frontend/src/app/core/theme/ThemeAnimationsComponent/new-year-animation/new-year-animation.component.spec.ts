import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewYearAnimationComponent } from './new-year-animation.component';

describe('NewYearAnimationComponent', () => {
  let component: NewYearAnimationComponent;
  let fixture: ComponentFixture<NewYearAnimationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewYearAnimationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NewYearAnimationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
