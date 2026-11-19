import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FlowStep } from '../../core/models/profile.model';
import { MotionService } from '../../core/services/motion.service';

const AUTO_ADVANCE_MS = 3600;

/**
 * Horizontal pipeline of numbered steps. Auto-advances while visible
 * (unless reduced motion is requested) and hands control to the user on first interaction.
 * Implements the WAI-ARIA tabs pattern, including arrow-key navigation.
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

  protected readonly index = signal(0);
  protected readonly active = computed(() => this.steps()[this.index()]);
  protected readonly progress = computed(() => {
    const n = this.steps().length;
    return n > 1 ? this.index() / (n - 1) : 1;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly motion = inject(MotionService);
  private userTookControl = false;
  private inView = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const io = new IntersectionObserver(([e]) => (this.inView = !!e?.isIntersecting), { threshold: 0.35 });
      io.observe(this.host);

      const timer = window.setInterval(() => {
        if (this.userTookControl || !this.inView || document.hidden || this.motion.reducedMotion()) return;
        this.index.update((i) => (i + 1) % this.steps().length);
      }, AUTO_ADVANCE_MS);

      destroyRef.onDestroy(() => {
        io.disconnect();
        window.clearInterval(timer);
      });
    });
  }

  protected select(i: number, focus = false): void {
    this.userTookControl = true;
    this.index.set(i);
    if (focus) {
      this.host.querySelector<HTMLButtonElement>(`#${this.uid()}-tab-${i}`)?.focus();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const n = this.steps().length;
    const moves: Record<string, number> = {
      ArrowRight: (this.index() + 1) % n,
      ArrowDown: (this.index() + 1) % n,
      ArrowLeft: (this.index() - 1 + n) % n,
      ArrowUp: (this.index() - 1 + n) % n,
      Home: 0,
      End: n - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    this.select(next, true);
  }
}
