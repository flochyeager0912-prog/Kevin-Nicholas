import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { CONTACT_CHANNELS, CONTACT_COPY, IDENTITY } from '../../core/data/profile.data';
import { ContactChannel } from '../../core/models/profile.model';
import { Icon, IconName } from '../../shared/icon';
import { RevealDirective } from '../../shared/reveal.directive';
import { SectionHeading } from '../../shared/section-heading';

const CHANNEL_ICONS: Record<string, IconName> = {
  Email: 'mail',
  Phone: 'phone',
  LinkedIn: 'linkedin',
  GitHub: 'github',
};

@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RevealDirective, SectionHeading],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class Contact {
  protected readonly copy = CONTACT_COPY;
  protected readonly channels = CONTACT_CHANNELS;
  protected readonly location = IDENTITY.location;
  protected readonly copied = signal<string | null>(null);

  private resetTimer?: number;

  constructor() {
    inject(DestroyRef).onDestroy(() => window.clearTimeout(this.resetTimer));
  }

  protected iconFor(channel: ContactChannel): IconName {
    return CHANNEL_ICONS[channel.label] ?? 'external';
  }

  protected async copyValue(channel: ContactChannel): Promise<void> {
    try {
      await navigator.clipboard.writeText(channel.value);
      this.copied.set(channel.label);
      window.clearTimeout(this.resetTimer);
      this.resetTimer = window.setTimeout(() => this.copied.set(null), 2000);
    } catch {
      // Clipboard unavailable (insecure context / permissions) — the mailto link still works.
    }
  }
}
