import { Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/**
 * Fades an element up into place the first time it enters the viewport.
 * Pure CSS transition (see `styles/_base.scss` → `.reveal`); the directive only toggles a class.
 * Elements are visible by default if JS or IntersectionObserver is unavailable.
 */
@Directive({
  selector: '[appReveal]',
  host: { class: 'reveal' },
})
export class RevealDirective {
  /** Stagger delay in milliseconds. */
  readonly appReveal = input<number | ''>(0);

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

    afterNextRender(() => {
      const delay = Number(this.appReveal()) || 0;
      if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`);

      if (typeof IntersectionObserver === 'undefined') {
        el.classList.add('is-visible');
        return;
      }
      el.classList.add('reveal-armed');
      const io = new IntersectionObserver(
        ([entry], observer) => {
          if (entry?.isIntersecting) {
            el.classList.add('is-visible');
            observer.disconnect();
          }
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
      );
      io.observe(el);
    });
  }
}
