import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IDENTITY, SECTIONS } from '../../core/data/profile.data';
import { SectionId } from '../../core/models/profile.model';
import { ActiveSectionService } from '../../core/services/active-section.service';
import { SectionNavService } from '../../core/services/section-nav.service';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-site-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
  host: { '(document:keydown.escape)': 'menuOpen.set(false)' },
})
export class SiteHeader {
  protected readonly identity = IDENTITY;
  protected readonly links = SECTIONS.filter((s) => s.nav);
  protected readonly active = inject(ActiveSectionService).active;
  protected readonly menuOpen = signal(false);

  private readonly sectionNav = inject(SectionNavService);

  protected navigate(event: MouseEvent, id: SectionId): void {
    this.menuOpen.set(false);
    this.sectionNav.navigate(event, id);
  }
}
