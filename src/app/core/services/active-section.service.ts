import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SECTIONS } from '../data/profile.data';
import { SectionId } from '../models/profile.model';

/**
 * Tracks which page section currently occupies the middle of the viewport.
 * One IntersectionObserver for the whole page — no scroll handlers, no layout thrash.
 */
@Injectable({ providedIn: 'root' })
export class ActiveSectionService {
  private readonly current = signal<SectionId>('hero');
  readonly active = this.current.asReadonly();

  private observer?: IntersectionObserver;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  /** Call once after first render, when all section elements exist. */
  observe(): void {
    if (this.observer || typeof IntersectionObserver === 'undefined') return;

    // A thin horizontal band across the viewport centre decides the active section.
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) this.current.set(entry.target.id as SectionId);
        }
      },
      { rootMargin: '-48% 0px -48% 0px', threshold: 0 },
    );

    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) this.observer.observe(el);
    }
  }
}
