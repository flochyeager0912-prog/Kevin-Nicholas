# Kevin Steve Nicholas M — Profile

Personal profile site built with **Angular 22** (standalone components, signals, zoneless change detection)
and **three.js** for an interactive, scroll-driven 3D data-pipeline scene. Published on GitHub Pages.

## Requirements

- Node.js **22** (see `.nvmrc`; Angular 22 does not support Node 20). With nvm: `nvm install && nvm use`.

## Run locally

```bash
npm ci
npm start            # http://localhost:4200
npm run build        # production build → dist/kevin-nicholas-profile/browser
```

## Publish to GitHub Pages

1. Push this folder to a GitHub repository (branch `main`).
2. In the repository: **Settings → Pages → Source → GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`, which builds and deploys the site.
   The site appears at `https://<username>.github.io/<repository>/`.

The build uses a relative base href (`npm run build:pages`), so it works under any repository name.

## Editing content

All text lives in **one file**: `src/app/core/data/profile.data.ts`, typed by
`src/app/core/models/profile.model.ts`. Templates never contain profile facts, so content
changes never need template edits.

| What | Where in `profile.data.ts` |
|---|---|
| Name, role, summary, email, phone, links | `IDENTITY` |
| About text | `ABOUT` |
| Experience & education timeline | `TIMELINE` |
| Data-stack layers and skills | `STACK_LAYERS` |
| Projects (steps, highlights, tech, repo) | `PROJECTS` |
| Languages | `LANGUAGES` |
| Contact cards | `CONTACT_CHANNELS` |
| Navigation + pipeline stage per section | `SECTIONS` |

To update the downloadable CV, replace `public/Kevin_Nicholas_CV.pdf` (keep the file name,
or change `IDENTITY.cv`).

## Project structure

```
src/
  styles/_tokens.scss          Colours, type, spacing, motion (single source of design tokens)
  styles/_base.scss            Reset, typography, cards, buttons, tags, reveal animation
  app/
    core/models/               Content interfaces
    core/data/                 All profile content
    core/services/             Active-section tracking, reduced-motion preference
    shared/                    Icon set, section heading, reveal directive, pipeline stepper
    layout/                    Header, footer, pipeline-stage rail
    sections/                  Hero, Journey, Data Stack, Work, Resume, Contact
    scene/                     3D backdrop: Angular host + framework-free three.js engine
```

## The 3D scene

`src/app/scene/data-scene.engine.ts` renders one zone per page section, and the camera glides
between them as you scroll:

| Section | Stage | Scene zone |
|---|---|---|
| Hero | Source | Source tables orbiting a database core |
| Journey | Ingest | ETL particle streams flowing into the database |
| Data Stack | Store | A live bar-chart "data surface" |
| Work | Transform | Schema / ER graph with signals along relationships |
| Resume | Model | 3D scatter plot of clusters with k-means centroids |
| Contact | Serve | Wide shot of the whole pipeline |

Performance and accessibility:
- three.js is lazy-loaded after first render (initial bundle ≈ 54 kB gzipped).
- The animation pauses when the tab is hidden.
- Pixel ratio is capped, and particle counts drop on small screens.
- With `prefers-reduced-motion`, the scene renders as a still image.
- Without WebGL, the page falls back to a CSS gradient.

## Privacy

`.gitignore` excludes the private source documents in the project root (the personal profile PDF
contains government ID numbers). Only `public/Kevin_Nicholas_CV.pdf` is published.
