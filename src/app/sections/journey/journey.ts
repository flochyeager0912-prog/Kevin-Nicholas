import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ABOUT, TIMELINE } from '../../core/data/profile.data';
import { RevealDirective } from '../../shared/reveal.directive';
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
}
