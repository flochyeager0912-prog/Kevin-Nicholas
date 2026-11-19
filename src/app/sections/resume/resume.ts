import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IDENTITY, LANGUAGES, RESUME_COPY } from '../../core/data/profile.data';
import { SceneStateService } from '../../core/services/scene-state.service';
import { Icon } from '../../shared/icon';
import { RevealDirective } from '../../shared/reveal.directive';
import { SectionHeading } from '../../shared/section-heading';

@Component({
  selector: 'app-resume',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RevealDirective, SectionHeading],
  template: `
    <section id="resume" class="chapter" aria-labelledby="resume-title">
      <div class="container">
        <div class="chapter-content" appReveal>
          <app-section-heading
            [eyebrow]="copy.eyebrow"
            [heading]="copy.heading"
            [lead]="copy.lead"
            headingId="resume-title"
          />
          <div class="actions">
            <a class="btn btn-primary" [href]="cv.href" [attr.download]="cv.fileName">
              <app-icon name="download" /> Download CV
            </a>
            <a class="btn" [href]="cv.href" target="_blank" rel="noopener">
              <app-icon name="external" /> Open in browser
            </a>
          </div>

          <div class="langs">
            <p class="mono-label">Languages</p>
            <ul class="tag-list">
              @for (lang of languages; track lang) {
                <li class="tag">{{ lang }}</li>
              }
            </ul>
          </div>

          <p class="play">
            <span>The scatter plot is live — re-run its k-means clustering.</span>
            <button type="button" class="text-link play-btn" (click)="recluster()">Re-cluster</button>
          </p>
        </div>
      </div>
    </section>
  `,
  styles: `
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-6); }
    .langs {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3) var(--space-4);
      margin-top: var(--space-6);
      padding-top: var(--space-5);
      border-top: 1px solid var(--line);
    }
    .play {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-1) var(--space-3);
      margin-top: var(--space-5);
      color: var(--text-3);
      font-size: 0.875rem;
    }
    .play-btn {
      padding: 0;
      border: 0;
      border-bottom: 1px solid var(--accent-strong);
      background: none;
      color: var(--accent);
      cursor: pointer;
    }
    @media (max-width: 420px) {
      .actions .btn { flex: 1 1 100%; }
    }
  `,
})
export class Resume {
  protected readonly copy = RESUME_COPY;
  protected readonly cv = IDENTITY.cv;
  protected readonly languages = LANGUAGES;
  private readonly state = inject(SceneStateService);

  protected recluster(): void {
    this.state.recluster.update((n) => n + 1);
  }
}
