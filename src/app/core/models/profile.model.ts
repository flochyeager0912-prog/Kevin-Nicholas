/**
 * Typed content model for the profile site.
 * Every piece of visible information is declared in `core/data/profile.data.ts`
 * against these interfaces, so content changes never require template edits.
 */

export type SectionId = 'hero' | 'journey' | 'stack' | 'work' | 'resume' | 'contact';

export interface SectionMeta {
  readonly id: SectionId;
  /** Label in the top navigation. Omitted for sections that are not linked (hero). */
  readonly nav?: string;
  /** Data-pipeline stage shown in the side rail while this section is in view. */
  readonly stage: string;
}

export interface ExternalLink {
  readonly label: string;
  readonly href: string;
}

export interface Identity {
  readonly name: string;
  readonly shortName: string;
  readonly role: string;
  readonly eyebrow: readonly string[];
  readonly tagline: string;
  readonly summary: string;
  readonly location: string;
  readonly email: string;
  readonly phone: string;
  readonly phoneHref: string;
  readonly github: ExternalLink & { readonly handle: string };
  readonly linkedin: ExternalLink;
  readonly cv: { readonly href: string; readonly fileName: string };
}

export interface RoleStep {
  readonly title: string;
  readonly period: string;
}

export interface TimelineEntry {
  readonly kind: 'work' | 'education';
  readonly org: string;
  readonly unit?: string;
  readonly location: string;
  readonly title: string;
  readonly period: string;
  readonly current?: boolean;
  readonly progression?: readonly RoleStep[];
  readonly facts?: readonly string[];
  readonly points: readonly string[];
}

export interface About {
  readonly eyebrow: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export interface StackLayer {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly items: readonly string[];
}

export interface FlowStep {
  readonly label: string;
  readonly detail: string;
}

export interface Project {
  readonly id: string;
  readonly kicker: string;
  readonly name: string;
  readonly period: string;
  readonly summary: string;
  readonly flowTitle: string;
  readonly flow: readonly FlowStep[];
  readonly highlights: readonly { readonly label: string; readonly text: string }[];
  readonly tech: readonly string[];
  readonly repo: ExternalLink;
  readonly note?: string;
}

export interface SectionCopy {
  readonly eyebrow: string;
  readonly heading: string;
  readonly lead: string;
}

export interface ContactChannel {
  readonly label: string;
  readonly value: string;
  readonly href: string;
  readonly external: boolean;
  readonly copyable?: boolean;
}
