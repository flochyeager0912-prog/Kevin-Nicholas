import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { STACK_COPY, STACK_LAYERS } from '../../core/data/profile.data';
import { SceneStateService } from '../../core/services/scene-state.service';
import { RevealDirective } from '../../shared/reveal.directive';
import { handleTablistKey } from '../../shared/roving';
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
  protected readonly index = inject(SceneStateService).layer;
  protected readonly active = computed(() => this.layers[this.index()]);

  protected num(i: number): string {
    return String(i + 1).padStart(2, '0');
  }

  protected onKeydown(event: KeyboardEvent): void {
    handleTablistKey(
      event,
      this.index(),
      this.layers.length,
      (i) => this.index.set(i),
      (i) => `layer-tab-${i}`,
    );
  }
}
