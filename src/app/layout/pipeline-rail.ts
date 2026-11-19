import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SECTIONS } from '../core/data/profile.data';
import { ActiveSectionService } from '../core/services/active-section.service';

/**
 * Fixed vertical rail on the left edge: shows which data-pipeline stage
 * the current chapter maps to. Only rendered on wide screens where the left
 * margin gives it dedicated space, so it never overlaps text or 3D labels.
 */
@Component({
  selector: 'app-pipeline-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="rail">
      <span class="caption">Pipeline</span>
      <ol class="stages">
        @for (s of sections; track s.id; let i = $index) {
          <li [class.is-active]="i === index()" [class.is-done]="i < index()">
            <span class="dot"></span>
          </li>
        }
      </ol>
      <span class="stage">{{ stage() }}</span>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      left: 14px;
      top: 50%;
      z-index: 20;
      transform: translateY(-50%);
      pointer-events: none;
    }
    .rail {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4) 0;
      width: 34px;
    }
    .caption, .stage {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-family: var(--font-mono);
      font-size: 0.6875rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    .caption { color: var(--text-3); }
    .stage { color: var(--accent); font-weight: 600; min-height: 8ch; }
    .stages {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 0;
      list-style: none;
    }
    .dot {
      display: block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1px solid var(--line-strong);
      transition: background 300ms ease, border-color 300ms ease, transform 300ms var(--ease-out);
    }
    .is-done .dot { background: var(--accent-deep); border-color: var(--accent-deep); }
    .is-active .dot {
      background: var(--accent);
      border-color: var(--accent);
      transform: scale(1.35);
      box-shadow: 0 0 12px var(--accent-strong);
    }
    /* Only where the left margin is wide enough to hold the rail beside the text. */
    @media (max-width: 1239px) { :host { display: none; } }
  `,
})
export class PipelineRail {
  protected readonly sections = SECTIONS;
  private readonly active = inject(ActiveSectionService).active;
  protected readonly index = computed(() => SECTIONS.findIndex((s) => s.id === this.active()));
  protected readonly stage = computed(() => SECTIONS[this.index()]?.stage ?? '');
}
