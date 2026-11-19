import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  model,
} from '@angular/core';
import { FlowStep } from '../../core/models/profile.model';
import { MotionService } from '../../core/services/motion.service';
import { handleTablistKey } from '../roving';

const AUTO_ADVANCE_MS = 3600;

/**
 * Horizontal pipeline of numbered steps, two-way bound through `index`
 * (the same index drives the 3D pipeline nodes).
 * Auto-advances while visible until anything else changes the selection.
 */
@Component({
  selector: 'app-flow-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flow-stepper.html',
  styleUrl: './flow-stepper.scss',
})
export class FlowStepper {
  readonly steps = input.required<readonly FlowStep[]>();
  readonly title = input.required<string>();
  readonly uid = input.required<string>();
  readonly index = model(0);

  protected readonly active = computed(() => this.steps()[this.index()]);
  protected readonly progress = computed(() => {
    const n = this.steps().length;
    return n > 1 ? this.index() / (n - 1) : 1;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly motion = inject(MotionService);
  private autoplay = true;
  private lastAuto = -1;
  private inView = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.lastAuto = this.index();
      const io = new IntersectionObserver(([e]) => (this.inView = !!e?.isIntersecting), { threshold: 0.35 });
      io.observe(this.host);
      const timer = window.setInterval(() => this.advance(), AUTO_ADVANCE_MS);
      destroyRef.onDestroy(() => {
        io.disconnect();
        window.clearInterval(timer);
      });
    });
  }

  private advance(): void {
    // Any change not made by autoplay (click, keyboard, 3D scene) hands control to the user.
    if (this.index() !== this.lastAuto) this.autoplay = false;
    if (!this.autoplay || !this.inView || document.hidden || this.motion.reducedMotion()) return;
    this.lastAuto = (this.index() + 1) % this.steps().length;
    this.index.set(this.lastAuto);
  }

  protected select(i: number): void {
    this.autoplay = false;
    this.index.set(i);
  }

  protected onKeydown(event: KeyboardEvent): void {
    handleTablistKey(
      event,
      this.index(),
      this.steps().length,
      (i) => this.select(i),
      (i) => `${this.uid()}-tab-${i}`,
    );
  }
}
