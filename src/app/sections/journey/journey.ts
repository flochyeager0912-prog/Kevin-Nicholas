import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ABOUT, TIMELINE } from '../../core/data/profile.data';
import { SceneStateService } from '../../core/services/scene-state.service';
import { RevealDirective } from '../../shared/reveal.directive';
import { handleTablistKey } from '../../shared/roving';
import { SectionHeading } from '../../shared/section-heading';

@Component({
  selector: 'app-journey',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective, SectionHeading],
  templateUrl: './journey.html',
  styleUrl: './journey.scss',
})
export class Journey {
  protected readonly about = ABOUT;
  protected readonly timeline = TIMELINE;
  protected readonly index = inject(SceneStateService).station;
  protected readonly entry = computed(() => this.timeline[this.index()]);

  protected onKeydown(event: KeyboardEvent): void {
    handleTablistKey(
      event,
      this.index(),
      this.timeline.length,
      (i) => this.index.set(i),
      (i) => `station-tab-${i}`,
    );
  }
}
