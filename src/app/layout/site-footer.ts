import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IDENTITY } from '../core/data/profile.data';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <footer class="footer">
      <div class="container row">
        <div>
          <p class="name">{{ identity.name }}</p>
          <p class="meta">{{ identity.role }} · {{ identity.location }}</p>
        </div>
        <nav class="links" aria-label="Footer">
          <a class="text-link" [href]="identity.github.href" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a class="text-link" [href]="identity.linkedin.href" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a class="text-link" href="#hero">Back to top <app-icon name="arrowUp" /></a>
        </nav>
      </div>
      <p class="container copy">© {{ year }} {{ identity.name }}</p>
    </footer>
  `,
  styles: `
    .footer {
      position: relative;
      padding-block: var(--space-7) var(--space-6);
      border-top: 1px solid var(--line);
      background: rgba(10, 6, 20, 0.86);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-5);
    }
    .name {
      color: var(--text-1);
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 600;
    }
    .meta { color: var(--text-3); font-size: 0.9375rem; }
    .links { display: flex; flex-wrap: wrap; gap: var(--space-5); }
    .copy {
      margin-top: var(--space-5);
      color: var(--text-3);
      font-family: var(--font-mono);
      font-size: 0.75rem;
    }
  `,
})
export class SiteFooter {
  protected readonly identity = IDENTITY;
  protected readonly year = new Date().getFullYear();
}
