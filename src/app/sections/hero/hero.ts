import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IDENTITY } from '../../core/data/profile.data';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero {
  protected readonly identity = IDENTITY;
}
