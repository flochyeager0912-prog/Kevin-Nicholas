import { Injectable, signal } from '@angular/core';
import { TIMELINE } from '../data/profile.data';

/**
 * Shared selection state between the HTML chapters and the 3D scene.
 * Either side can write; the other reacts. This keeps the 3D exhibits and the
 * accessible text content permanently in sync.
 */
@Injectable({ providedIn: 'root' })
export class SceneStateService {
  /** Journey station (index into TIMELINE). Defaults to the current role. */
  readonly station = signal(TIMELINE.length - 1);
  /** Data-stack layer (index into STACK_LAYERS). */
  readonly layer = signal(0);
  /** Project (index into PROJECTS) and the selected step of its pipeline. */
  readonly project = signal(0);
  readonly step = signal(0);
  /** Incremented to ask the scene to re-run its clustering animation. */
  readonly recluster = signal(0);

  selectProject(index: number): void {
    if (index === this.project()) return;
    this.project.set(index);
    this.step.set(0);
  }
}
