import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { SECTIONS } from '../core/data/profile.data';
import { MotionService } from '../core/services/motion.service';
import type { DataSceneEngine } from './data-scene.engine';

/**
 * Fixed full-viewport WebGL backdrop.
 * three.js is code-split via dynamic import and loaded after first render,
 * so the page content is interactive before any 3D work begins.
 * Falls back silently to the CSS gradient background when WebGL is unavailable.
 */
@Component({
  selector: 'app-data-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <canvas #canvas class="canvas" [class.is-ready]="ready()"></canvas>
    <div class="veil"></div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }
    .canvas {
      width: 100%;
      height: 100%;
      opacity: 0;
      transition: opacity 1.4s ease;
    }
    .canvas.is-ready { opacity: 1; }
    /* Darkens the left side, where most text sits, for extra legibility. */
    .veil {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(90deg, rgba(10, 6, 20, 0.55) 0%, rgba(10, 6, 20, 0.1) 55%, rgba(10, 6, 20, 0.25) 100%),
        linear-gradient(180deg, transparent 70%, rgba(10, 6, 20, 0.6) 100%);
    }
  `,
})
export class DataScene {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly motion = inject(MotionService);
  protected readonly ready = signal(false);

  private engine?: DataSceneEngine;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.engine?.dispose();
    });
    afterNextRender(() => void this.init());
  }

  private async init(): Promise<void> {
    if (!this.supportsWebGL()) return;
    try {
      const { DataSceneEngine } = await import('./data-scene.engine');
      if (this.destroyed) return;
      this.engine = new DataSceneEngine(this.canvas().nativeElement, {
        sectionIds: SECTIONS.map((s) => s.id),
        reducedMotion: this.motion.reducedMotion(),
      });
      this.engine.start();
      requestAnimationFrame(() => this.ready.set(true));
    } catch (err) {
      // The site is fully usable without the 3D backdrop.
      console.warn('3D scene unavailable:', err);
    }
  }

  private supportsWebGL(): boolean {
    try {
      const probe = document.createElement('canvas');
      return !!(probe.getContext('webgl2') ?? probe.getContext('webgl'));
    } catch {
      return false;
    }
  }
}
