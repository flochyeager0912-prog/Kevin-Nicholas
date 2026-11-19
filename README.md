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
| Experience & education (chronological; `station` = 3D label) | `TIMELINE` |
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
    core/services/             Active section, reduced motion, shared 3D selection state
    shared/                    Icon set, section heading, reveal directive, pipeline stepper, keyboard helpers
    layout/                    Header, footer, pipeline-stage rail
    sections/                  Hero, Journey, Data Stack, Work, Resume, Contact
    scene/                     Interactive 3D world: Angular host + framework-free three.js engine
```

## The interactive 3D experience

The site is one continuous 3D world (`src/app/scene/data-scene.engine.ts`). Each page chapter has
its own exhibit, and the camera flies between them as you scroll. It holds still while you read a
chapter, and only moves near chapter boundaries.

| Chapter | Pipeline stage | 3D exhibit | Interaction |
|---|---|---|---|
| Hero | Source | Database core fed by orbiting source tables via ETL particle streams | Drag to orbit |
| Journey | Ingest | Pipeline track with one station per milestone; the current role pulses | Click a station |
| Data Stack | Store | The database opened up: one platter per layer, foundation at the bottom | Click a platter |
| Work | Transform | The selected project's steps as pipeline nodes, over a schema graph | Click a node |
| Resume | Model | 3D scatter plot with k-means centroids | Click to re-cluster |
| Contact | Serve | Wide shot of the whole platform | Drag to orbit |

How it fits together:
- **Single source of truth.** Exhibits are built from `profile.data.ts`, so stations, layers and
  project steps always match the text.
- **Two-way sync.** `SceneStateService` holds the selected station, layer, project and step.
  Clicking in 3D updates the page, and selecting in the page updates the 3D.
- **Crisp text.** Labels in the 3D scene are real HTML elements positioned from projected 3D points.
  Nothing is rendered as WebGL text.
- **Layout.** At 1100px and wider, text sits on the left and the exhibit on the right
  (camera view offset). Below that, the 3D becomes a backdrop and the page lists drive selection.
- **Performance.** three.js is lazy-loaded after first render (initial bundle about 55 kB gzipped).
  There is no per-frame allocation. The pixel ratio is capped, particle counts drop on small screens,
  and rendering pauses when the tab is hidden.
- **Accessibility.** Every 3D interaction has a keyboard-operable HTML equivalent (ARIA tabs with
  arrow keys). With `prefers-reduced-motion`, animation freezes but interaction still works.
  Without WebGL, the page still works completely.

## Privacy

`.gitignore` excludes the private source documents in the project root (the personal profile PDF
contains government ID numbers). Only `public/Kevin_Nicholas_CV.pdf` is published.
