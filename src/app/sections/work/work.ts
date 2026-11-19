import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PROJECTS, WORK_COPY } from '../../core/data/profile.data';
import { FlowStepper } from '../../shared/flow-stepper/flow-stepper';
import { Icon } from '../../shared/icon';
import { RevealDirective } from '../../shared/reveal.directive';
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
}
