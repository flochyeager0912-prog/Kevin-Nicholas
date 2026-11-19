import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { STACK_COPY, STACK_LAYERS } from '../../core/data/profile.data';
import { RevealDirective } from '../../shared/reveal.directive';
import { SectionHeading } from '../../shared/section-heading';

@Component({
  selector: 'app-stack',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective, SectionHeading],
  templateUrl: './stack.html',
  styleUrl: './stack.scss',
})
export class Stack {
  protected readonly copy = STACK_COPY;
  protected readonly layers = STACK_LAYERS;
  protected readonly index = signal(0);
  protected readonly active = computed(() => this.layers[this.index()]);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected select(i: number): void {
    this.index.set(i);
  }

  /** Arrow-key navigation across the layer tabs (WAI-ARIA tabs pattern). */
  protected onKeydown(event: KeyboardEvent): void {
    const n = this.layers.length;
    const i = this.index();
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? (i + 1) % n
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? (i - 1 + n) % n
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? n - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    this.index.set(next);
    this.host.querySelector<HTMLButtonElement>(`#layer-tab-${next}`)?.focus();
  }
}
