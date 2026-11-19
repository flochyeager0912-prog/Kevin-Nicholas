import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** Exposes the user's `prefers-reduced-motion` setting as a live signal. */
@Injectable({ providedIn: 'root' })
export class MotionService {
  private readonly query =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  private readonly reduced = signal(this.query?.matches ?? false);
  readonly reducedMotion = this.reduced.asReadonly();

  constructor() {
    if (!this.query) return;
    const onChange = (e: MediaQueryListEvent) => this.reduced.set(e.matches);
    this.query.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => this.query?.removeEventListener('change', onChange));
  }
}
