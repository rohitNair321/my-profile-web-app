import {
  AfterViewInit,
  Directive,
  ElementRef,
  NgZone,
  OnDestroy,
} from '@angular/core';

@Directive({
  selector: '[appInView]',
  standalone: true
})
export class InViewDirective implements AfterViewInit, OnDestroy {
  private observer!: IntersectionObserver;

  constructor(
    private el: ElementRef<HTMLElement>,
    private zone: NgZone
  ) {}

  ngAfterViewInit(): void {
    // Run outside Angular for performance
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            this.el.nativeElement.classList.add('in-view');

            // Animate only once (professional UX)
            this.observer.disconnect();
          }
        },
        {
          root: null,
          threshold: 0.15, // Good for hero + sections
        }
      );

      // Delay to ensure async data is rendered
      setTimeout(() => {
        this.observer.observe(this.el.nativeElement);
      });
    });
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
