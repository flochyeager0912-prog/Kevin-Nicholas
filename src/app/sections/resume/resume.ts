import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IDENTITY, LANGUAGES, RESUME_COPY } from '../../core/data/profile.data';
import { Icon } from '../../shared/icon';
import { RevealDirective } from '../../shared/reveal.directive';
import { SectionHeading } from '../../shared/section-heading';

@Component({
  selector: 'app-resume',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RevealDirective, SectionHeading],
  template: `
    <section id="resume" class="section" aria-labelledby="resume-title">
      <div class="container">
        <div class="card card-pad layout" appReveal>
          <div>
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
          </div>

          <div class="doc" aria-hidden="true">
            <div class="sheet">
              <span class="line w-60 strong"></span>
              <span class="line w-40"></span>
              <span class="gap"></span>
              @for (w of sheetLines; track $index) {
                <span class="line" [style.width.%]="w"></span>
              }
            </div>
            <span class="badge">PDF</span>
          </div>

          <div class="langs">
            <p class="mono-label">Languages</p>
            <ul class="tag-list">
              @for (lang of languages; track lang) {
                <li class="tag">{{ lang }}</li>
              }
            </ul>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 220px;
      gap: var(--space-6) var(--space-7);
      align-items: center;
    }
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-6); }
    .langs {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3) var(--space-4);
      padding-top: var(--space-5);
      border-top: 1px solid var(--line);
    }
    .doc { position: relative; justify-self: center; }
    .sheet {
      display: flex;
      flex-direction: column;
      gap: 9px;
      width: 180px;
      padding: 26px 22px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-md);
      background: linear-gradient(160deg, rgba(52, 33, 92, 0.75), rgba(20, 12, 38, 0.9));
      transform: rotate(-4deg);
      box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.7);
      transition: transform 500ms var(--ease-out);
    }
    .layout:hover .sheet { transform: rotate(0deg) translateY(-4px); }
    .line { display: block; height: 6px; border-radius: 3px; background: rgba(196, 170, 255, 0.22); }
    .line.strong { height: 9px; background: var(--accent); }
    .w-60 { width: 60%; }
    .w-40 { width: 40%; }
    .gap { height: 6px; }
    .badge {
      position: absolute;
      right: -12px;
      bottom: 18px;
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-pill);
      background: var(--grad-button);
      color: var(--on-accent);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 600;
    }
    @media (max-width: 760px) {
      .layout { grid-template-columns: minmax(0, 1fr); }
      .doc { display: none; }
    }
  `,
})
export class Resume {
  protected readonly copy = RESUME_COPY;
  protected readonly cv = IDENTITY.cv;
  protected readonly languages = LANGUAGES;
  /** Decorative line widths for the miniature document illustration. */
  protected readonly sheetLines = [92, 84, 96, 70, 0, 88, 94, 62, 80];
}
