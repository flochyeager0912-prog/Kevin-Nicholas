import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { PROJECTS, SECTIONS, STACK_LAYERS, TIMELINE } from '../core/data/profile.data';
import { MotionService } from '../core/services/motion.service';
import { SceneStateService } from '../core/services/scene-state.service';
import type { DataSceneEngine, SceneContent, SceneEvent } from './data-scene.engine';

/** Content the 3D exhibits need — derived from the single profile data source. */
const SCENE_CONTENT: SceneContent = {
  stations: TIMELINE.map((t) => ({ title: t.station, sub: t.period })),
  layers: STACK_LAYERS.map((l) => l.name),
  projects: PROJECTS.map((p) => ({ steps: p.flow.map((s) => s.label) })),
};

/**
 * Full-viewport interactive WebGL stage.
 * three.js is code-split and loaded after first render; selection state is shared
 * with the HTML chapters through SceneStateService in both directions.
 * Without WebGL the page still works completely — every exhibit has an HTML equivalent.
 */
@Component({
  selector: 'app-data-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <canvas #canvas class="canvas" [class.is-ready]="ready()" aria-hidden="true"></canvas>
    <div class="veil" aria-hidden="true"></div>
    <div #labels class="scene-labels" aria-hidden="true"></div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 0;
    }
    .canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      transition: opacity 1.4s ease;
      touch-action: pan-y;
      -webkit-tap-highlight-color: transparent;
    }
    .canvas.is-ready { opacity: 1; }
    /* Darkens the text column for legibility; never intercepts the pointer. */
    .veil {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(90deg, rgba(10, 6, 20, 0.92) 0%, rgba(10, 6, 20, 0.82) 36%, rgba(10, 6, 20, 0.35) 49%, rgba(10, 6, 20, 0) 60%),
        linear-gradient(180deg, rgba(10, 6, 20, 0.35) 0%, transparent 18%, transparent 80%, rgba(10, 6, 20, 0.6) 100%);
    }
    @media (max-width: 1099px) {
      .veil { background: rgba(10, 6, 20, 0.74); }
    }
  `,
})
export class DataScene {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly labels = viewChild.required<ElementRef<HTMLElement>>('labels');
  private readonly motion = inject(MotionService);
  private readonly state = inject(SceneStateService);
  protected readonly ready = signal(false);

  private readonly engine = signal<DataSceneEngine | null>(null);
  private destroyed = false;
  private reclusterSeen = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.engine()?.dispose();
    });

    // HTML → 3D: push selection changes into the scene.
    effect(() => {
      const engine = this.engine();
      const selection = {
        station: this.state.station(),
        layer: this.state.layer(),
        project: this.state.project(),
        step: this.state.step(),
      };
      engine?.setSelection(selection);
    });

    effect(() => {
      const count = this.state.recluster();
      const engine = this.engine();
      if (engine && count > this.reclusterSeen) engine.recluster();
      this.reclusterSeen = count;
    });

    afterNextRender(() => void this.init());
  }

  private async init(): Promise<void> {
    if (!this.supportsWebGL()) return;
    try {
      const { DataSceneEngine } = await import('./data-scene.engine');
      if (this.destroyed) return;
      const engine = new DataSceneEngine(this.canvas().nativeElement, {
        sectionIds: SECTIONS.map((s) => s.id),
        reducedMotion: this.motion.reducedMotion(),
        content: SCENE_CONTENT,
        selection: untracked(() => ({
          station: this.state.station(),
          layer: this.state.layer(),
          project: this.state.project(),
          step: this.state.step(),
        })),
        labelLayer: this.labels().nativeElement,
        onSelect: (e) => this.onSceneSelect(e),
      });
      engine.start();
      this.engine.set(engine);
      requestAnimationFrame(() => this.ready.set(true));
    } catch (err) {
      console.warn('3D scene unavailable:', err);
    }
  }

  /** 3D → HTML: a click on an exhibit updates the shared state. */
  private onSceneSelect(e: SceneEvent): void {
    switch (e.kind) {
      case 'station':
        this.state.station.set(e.index);
        break;
      case 'layer':
        this.state.layer.set(e.index);
        break;
      case 'step':
        this.state.step.set(e.index);
        break;
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
