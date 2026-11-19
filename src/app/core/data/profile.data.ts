import {
  About,
  ContactChannel,
  Identity,
  Project,
  SectionCopy,
  SectionMeta,
  StackLayer,
  TimelineEntry,
} from '../models/profile.model';

/**
 * Single source of truth for all profile content.
 *
 * Sources: Kevin_Nicholas_CV.pdf (current CV) and the ARK repository README.
 * Facts were taken verbatim or condensed from those sources — nothing is inferred.
 * Research interests are intentionally excluded.
 */

export const SECTIONS: readonly SectionMeta[] = [
  { id: 'hero', stage: 'Source' },
  { id: 'journey', nav: 'Journey', stage: 'Ingest' },
  { id: 'stack', nav: 'Data Stack', stage: 'Store' },
  { id: 'work', nav: 'Work', stage: 'Transform' },
  { id: 'resume', nav: 'Resume', stage: 'Model' },
  { id: 'contact', nav: 'Contact', stage: 'Serve' },
];

export const IDENTITY: Identity = {
  name: 'Kevin Steve Nicholas M',
  brand: 'Kevin Steve Nicholas',
  displayName: 'Kevin Steve Nicholas',
  role: 'Product Engineer',
  eyebrow: ['Product Engineer', 'Databases & Data Migration'],
  tagline: 'Intellect Design Arena · iGTB Wholesale Banking',
  summary:
    'I work on enterprise PostgreSQL and Oracle databases in financial technology — data migration, SQL development, validation and database metadata systems.',
  location: 'Chennai, India',
  email: 'rkevinsteve182@gmail.com',
  phone: '+91 78453 21082',
  phoneHref: 'tel:+917845321082',
  github: {
    label: 'GitHub',
    handle: 'flochyeager0912-prog',
    href: 'https://github.com/flochyeager0912-prog',
  },
  linkedin: {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/kevin-nicholas-1aa911417',
  },
  cv: { href: 'Kevin_Nicholas_CV.pdf', fileName: 'Kevin_Nicholas_CV.pdf' },
};

export const ABOUT: About = {
  eyebrow: 'About',
  heading: 'I started with SQL. I grew into the systems around it.',
  paragraphs: [
    'Over two years at Intellect Design Arena in FinTech — from a data-analyst internship to product engineering on wholesale-banking platforms.',
    'My work sits where databases meet delivery: migrations, schema metadata, validation, and the tooling that makes large databases understandable.',
  ],
};

/** Chronological — the journey reads left to right, ending at the current role. */
export const TIMELINE: readonly TimelineEntry[] = [
  {
    kind: 'education',
    station: 'BCA',
    org: 'SRM Institute of Science and Technology',
    unit: 'Kattankulathur',
    location: 'Chennai, India',
    title: 'Bachelor of Computer Applications',
    period: '2019 — 2023',
    points: [],
  },
  {
    kind: 'work',
    station: 'Data Analyst Intern',
    org: 'Intellect Design Arena Ltd.',
    unit: 'Intellect AI · Wealth',
    location: 'Chennai, India',
    title: 'Data Analyst Intern',
    period: 'Dec 2023 — Mar 2024',
    points: [
      'Oracle SQL and PL/SQL for relational querying, procedural database programming, data analysis and reporting.',
    ],
  },
  {
    kind: 'work',
    station: 'Product Engineer',
    org: 'Intellect Design Arena Ltd.',
    unit: 'iGTB · Wholesale Banking',
    location: 'Chennai, India',
    title: 'Product Engineer',
    period: 'Oct 2024 — Present',
    current: true,
    progression: [
      { title: 'Systems Trainee', period: 'Oct 2024' },
      { title: 'Systems Engineer', period: 'Apr 2025' },
      { title: 'Product Engineer', period: 'Current' },
    ],
    points: [
      'Oracle-to-PostgreSQL and Oracle-to-Oracle migration for Barclays India across Cash Digi applications — IDC, CS, CIM, CBXBO and PSH.',
      'Review staging-table structures, column definitions and incoming data formats; Oracle SQL and PL/SQL procedures and functions for data handling.',
      'PostgreSQL operations and catalog-level schema work for CBXBO and CIM — schema changes, execution-plan analysis, predicates and indexing.',
      'Data dictionaries covering views, functions, triggers, indexes, constraints and permissions; classified and validated PII and date columns against client specifications.',
      'Automation, unit testing, JAR versioning and OSS fix rollouts, in collaboration with database administrators and developers.',
    ],
  },
];

export const STACK_COPY: SectionCopy = {
  eyebrow: 'Data stack',
  heading: 'Data moves through layers. So does my toolkit.',
  lead: 'Select a layer to see what I use there.',
};

export const STACK_LAYERS: readonly StackLayer[] = [
  {
    id: 'engines',
    name: 'Engines',
    summary: 'Relational databases I work on in enterprise environments.',
    items: ['PostgreSQL 12–18', 'Oracle'],
  },
  {
    id: 'query',
    name: 'Query & procedural',
    summary: 'Languages for querying data and programming inside the database.',
    items: ['SQL', 'PL/SQL', 'PL/pgSQL'],
  },
  {
    id: 'engineering',
    name: 'Database engineering',
    summary: 'Working with the structure and performance of a database, not just its rows.',
    items: ['System catalogs', 'Indexing', 'Query optimization', 'Constraints', 'Schema documentation'],
  },
  {
    id: 'languages',
    name: 'Languages',
    summary: 'General-purpose languages for services and tools around the data.',
    items: ['Python', 'Java', 'TypeScript'],
  },
  {
    id: 'frameworks',
    name: 'Frameworks',
    summary: 'Backend and frontend frameworks for building data applications.',
    items: ['FastAPI', 'Pydantic', 'asyncpg', 'Spring Boot', 'React'],
  },
  {
    id: 'clients',
    name: 'Database clients',
    summary: 'Day-to-day tools for exploring and administering databases.',
    items: ['Oracle SQL Developer', 'pgAdmin', 'DBeaver'],
  },
  {
    id: 'delivery',
    name: 'Delivery',
    summary: 'Packaging, versioning and shipping software reliably.',
    items: ['Docker / Compose', 'Git', 'JFrog', 'Ubuntu / Linux', 'CI & testing', 'Release support'],
  },
];

export const WORK_COPY: SectionCopy = {
  eyebrow: 'Work',
  heading: 'Systems, not screenshots.',
  lead: 'What each project does, step by step — and what it is built with.',
};

export const PROJECTS: readonly Project[] = [
  {
    id: 'pg-metadata-exporter',
    kicker: 'Featured · Database tooling',
    name: 'PG Metadata Exporter',
    period: 'June 2026 — Present',
    summary:
      'A read-only PostgreSQL metadata workspace with data dictionary exploration, interactive entity-relationship diagrams and multi-format exports.',
    flowTitle: 'From connection to documentation',
    flow: [
      { label: 'Connect', detail: 'Opens a read-only workspace against a PostgreSQL 12–18 database.' },
      {
        label: 'Read catalogs',
        detail: 'Set-based system-catalog reads with version-aware catalog access across PostgreSQL 12–18.',
      },
      {
        label: 'Classify',
        detail: 'Name- and type-based potential-PII classification — without reading application-table values.',
      },
      { label: 'Explore', detail: 'Data dictionary exploration and interactive entity-relationship diagrams.' },
      { label: 'Export', detail: 'Exports to XLSX, CSV, Markdown, PDF, DOCX and PNG.' },
    ],
    highlights: [
      { label: 'Deployment', text: 'Versioned container deployment artifacts.' },
      {
        label: 'Compatibility',
        text: 'Compatibility claims are kept distinct from the versions covered by automated CI tests.',
      },
    ],
    tech: ['Python', 'FastAPI', 'asyncpg', 'React', 'TypeScript', 'Docker', 'PostgreSQL 12–18'],
    repo: {
      label: 'flochyeager0912-prog/pg-metadata-exporter',
      href: 'https://github.com/flochyeager0912-prog/pg-metadata-exporter',
    },
  },
  {
    id: 'ark',
    kicker: 'Full-stack · Installable web app',
    name: 'The Ark Victory Church — Website & App',
    period: '2026',
    summary:
      'Public website, installable web app (PWA) and staff admin for The Ark Victory Church, Sembakkam, Chennai — replacing its WordPress site with full content parity.',
    flowTitle: 'Event registration, end to end',
    flow: [
      { label: 'Register', detail: 'Visitors register for events from the public site or the installed app.' },
      {
        label: 'Capacity',
        detail:
          'Capacity limits are enforced and never shown publicly. An integration test fires 30 simultaneous bookings against PostgreSQL — never overbooked.',
      },
      { label: 'Waitlist', detail: 'Automatic waitlist when an event is full, with a self-service manage/cancel link.' },
      { label: 'Ticket', detail: 'QR ticket, email confirmation and an .ics calendar file.' },
      { label: 'Check-in', detail: 'Staff check attendees in by QR or reference, and export registrations as CSV.' },
    ],
    highlights: [
      {
        label: 'Staff admin',
        text: 'Events, enquiry and prayer inboxes, volunteer review, a no-code page editor with version history, ADMIN / EDITOR roles and an audit log.',
      },
      {
        label: 'SEO',
        text: 'Sitemap, JSON-LD, Open Graph and 301 redirects from every old WordPress URL.',
      },
      {
        label: 'Quality',
        text: 'CI runs lint, typecheck, unit and integration tests, a production build and a Docker build on every push and pull request.',
      },
    ],
    tech: ['Next.js 16', 'React 19', 'TypeScript', 'Tailwind CSS 4', 'PostgreSQL 16', 'Prisma 6', 'Zod', 'Docker'],
    repo: { label: 'flochyeager0912-prog/ARK', href: 'https://github.com/flochyeager0912-prog/ARK' },
    live: { label: 'flochyeager0912-prog.github.io/ARK', href: 'https://flochyeager0912-prog.github.io/ARK/' },
  },
];

export const RESUME_COPY: SectionCopy = {
  eyebrow: 'Resume',
  heading: 'The full record, in one PDF.',
  lead: 'Experience, projects, technical skills and education — formatted for sharing and printing.',
};

export const LANGUAGES: readonly string[] = ['English', 'Tamil', 'French — studied in formal education'];

export const CONTACT_COPY: SectionCopy = {
  eyebrow: 'Contact',
  heading: 'Let’s talk data.',
  lead: 'Database engineering, data migration and backend tooling conversations are always welcome.',
};

export const CONTACT_CHANNELS: readonly ContactChannel[] = [
  { label: 'Email', value: IDENTITY.email, href: `mailto:${IDENTITY.email}`, external: false, copyable: true },
  { label: 'Phone', value: IDENTITY.phone, href: IDENTITY.phoneHref, external: false },
  { label: 'LinkedIn', value: 'Connect', href: IDENTITY.linkedin.href, external: true },
  { label: 'GitHub', value: `@${IDENTITY.github.handle}`, href: IDENTITY.github.href, external: true },
];
