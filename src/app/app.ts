import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { ActiveSectionService } from './core/services/active-section.service';
import { PipelineRail } from './layout/pipeline-rail';
import { SiteFooter } from './layout/site-footer';
import { SiteHeader } from './layout/site-header/site-header';
import { DataScene } from './scene/data-scene';
import { Contact } from './sections/contact/contact';
import { Hero } from './sections/hero/hero';
import { Journey } from './sections/journey/journey';
import { Resume } from './sections/resume/resume';
import { Stack } from './sections/stack/stack';
import { Work } from './sections/work/work';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataScene, SiteHeader, SiteFooter, PipelineRail, Hero, Journey, Stack, Work, Resume, Contact],
  template: `
    <app-data-scene />
    <a class="skip-link" href="#main">Skip to content</a>
    <app-site-header />
    <main id="main" class="main">
      <app-hero />
      <app-journey />
      <app-stack />
      <app-work />
      <app-resume />
      <app-contact />
    </main>
    <app-site-footer />
    <app-pipeline-rail />
  `,
  styles: `
    .main { position: relative; z-index: 1; }
    app-site-footer { position: relative; z-index: 1; display: block; }
  `,
})
export class App {
  constructor() {
    const sections = inject(ActiveSectionService);
    afterNextRender(() => sections.observe());
  }
}
