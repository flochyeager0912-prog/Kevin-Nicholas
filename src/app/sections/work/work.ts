import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PROJECTS, WORK_COPY } from '../../core/data/profile.data';
import { SceneStateService } from '../../core/services/scene-state.service';
import { FlowStepper } from '../../shared/flow-stepper/flow-stepper';
import { Icon } from '../../shared/icon';
import { RevealDirective } from '../../shared/reveal.directive';
import { handleTablistKey } from '../../shared/roving';
import { SectionHeading } from '../../shared/section-heading';

@Component({
  selector: 'app-work',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FlowStepper, Icon, RevealDirective, SectionHeading],
  templateUrl: './work.html',
  styleUrl: './work.scss',
})
export class Work {
  protected readonly copy = WORK_COPY;
  protected readonly projects = PROJECTS;
  protected readonly state = inject(SceneStateService);
  protected readonly project = computed(() => this.projects[this.state.project()]);

  protected onKeydown(event: KeyboardEvent): void {
    handleTablistKey(
      event,
      this.state.project(),
      this.projects.length,
      (i) => this.state.selectProject(i),
      (i) => `project-tab-${i}`,
    );
  }
}
