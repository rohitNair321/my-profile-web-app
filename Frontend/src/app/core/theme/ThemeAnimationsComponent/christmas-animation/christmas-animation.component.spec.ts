import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChristmasAnimationComponent } from './christmas-animation.component';

describe('ChristmasAnimationComponent', () => {
  let component: ChristmasAnimationComponent;
  let fixture: ComponentFixture<ChristmasAnimationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChristmasAnimationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ChristmasAnimationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
