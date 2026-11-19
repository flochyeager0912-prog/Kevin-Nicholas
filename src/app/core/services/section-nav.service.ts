import { Injectable, inject } from '@angular/core';
import { SectionId } from '../models/profile.model';
import { MotionService } from './motion.service';

/**
 * Space between the bottom of the fixed header and the section's eyebrow label
 * (e.g. "DATA STACK") after in-page navigation — matches the reference screenshot.
 */
const NAV_LANDING_GAP = 16;

/** In-page navigation shared by the header menu and in-content links. */
@Injectable({ providedIn: 'root' })
export class SectionNavService {
  private readonly motion = inject(MotionService);

  /**
   * Smooth-scrolls so the section's eyebrow label sits just below the header
   * (instead of the section box, whose top padding pushed the heading down).
   * Modified clicks (new tab, etc.) keep the browser's default behaviour.
   */
  navigate(event: MouseEvent, id: SectionId): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const section = document.getElementById(id);
    const target = section?.querySelector<HTMLElement>('.eyebrow') ?? section;
    if (!target) return;

    event.preventDefault();
    const headerHeight = document.querySelector<HTMLElement>('app-site-header .header')?.offsetHeight ?? 0;
    const top = Math.max(0, this.documentTop(target) - headerHeight - NAV_LANDING_GAP);
    window.scrollTo({ top, behavior: this.motion.reducedMotion() ? 'auto' : 'smooth' });
    history.replaceState(null, '', `#${id}`);
  }

  /** Layout position in the document — unaffected by the reveal animation's transform. */
  private documentTop(el: HTMLElement): number {
    let y = 0;
    for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) {
      y += node.offsetTop;
    }
    return y;
  }
}
