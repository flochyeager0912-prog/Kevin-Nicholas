import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Eyebrow + serif heading + lead paragraph used at the top of every section. */
@Component({
  selector: 'app-section-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="eyebrow">{{ eyebrow() }}</p>
    <h2 class="section-title" [id]="headingId()">{{ heading() }}</h2>
    @if (lead()) {
      <p class="section-lead">{{ lead() }}</p>
    }
  `,
  styles: `
    :host { display: block; }
    .section-title { margin-top: var(--space-3); }
    .section-lead { margin-top: var(--space-3); max-width: 60ch; }
  `,
})
export class SectionHeading {
  readonly eyebrow = input.required<string>();
  readonly heading = input.required<string>();
  readonly lead = input<string>('');
  readonly headingId = input<string | null>(null);
}
