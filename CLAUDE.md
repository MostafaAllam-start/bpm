# CLAUDE.md

Guidance for working in this repo. Keep it current as conventions evolve.

## Commit style

Do NOT add a `Co-Authored-By` trailer to commit messages.

## What this is

A BPM studio (React 19 + TypeScript + Vite + Zustand + react-router + i18next):

- **`src/BpmnModeler/`** — a BPMN process modeler on `@xyflow/react` (React Flow): nodes/edges,
  token simulation, BPMN 2.0 XML import/export, actor assignment, validation.
- **`src/FormBuilder/`** — an in-house form engine + visual designer (a Figma-like absolute-position
  canvas using interact.js). No third-party form library — this is deliberate.
- App shell, `auth/`, `i18n/`, `theme/` at the root.

## Commands

```
npm run dev         # Vite dev server (HTTPS via basic-ssl; /api + /__cors dev proxies)
npm run build       # tsc -b && vite build
npm run typecheck   # tsc -b
npm run lint        # eslint . (type-checked; warnings allowed, errors block)
npm test            # vitest run
npm run test:watch  # vitest (watch)
```

Installs use the public npm registry — no `--registry` flag needed.

## Module convention (follow for all new/edited components)

A **component module** is a folder named in PascalCase after its main component:

```
PropertyPanel/
  index.ts            // public surface ONLY: export { default } from './PropertyPanel'
  PropertyPanel.tsx   // the main component
  PropertyPanel.css   // colocated styles
  editors/            // private subcomponents — NOT exported from index.ts
  useXxx.ts           // module-private hooks
```

Rules:
- `index.ts` re-exports only the module's public API (the main component + its public types).
  Subcomponents stay private to the folder.
- Import the **folder**, not internals: `import PropertyPanel from "@FormBuilder/designer/PropertyPanel"`
  (resolves `index.ts`). Don't deep-import another module's private files.
- Each feature has a top barrel — `@FormBuilder`, `@bpmn`, `@shared` — exposing its public surface.
  Cross-feature imports go through these (e.g. BpmnModeler consumes forms via `@FormBuilder`).
- Pure-logic libs (`conditions.ts`, `units.ts`, …) and cohesive non-component groups
  (`flow/services`, `flow/utils`, `flow/store`) stay as files with a group `index.ts` barrel —
  they do **not** each explode into folders. Folder-per-module is for components.

## Naming

- Feature roots are lowercase and match their alias: `forms/`, `bpmn/`, `shared/`, `components/`, `auth/`.
- Component module folders + their main file are PascalCase matching the export.
- Avoid generic names (`index.tsx` for a real component) — name files for what they are; barrels
  are the only literal `index.ts`.

## Path aliases

Defined once in `aliases.ts`, consumed by `vite.config.ts` and `vitest.config.ts`, and mirrored in
`tsconfig.app.json` `paths`. **Keep the explicit `.ts`/`.tsx` extension in import specifiers** — an
alias rewrites only the prefix (`@FormBuilder/types.ts` resolves like the relative form).

| Alias        | Target            |
|--------------|-------------------|
| `@/*`        | `src/*`           |
| `@FormBuilder/*`   | `src/FormBuilder/*`     |
| `@bpmn/*`    | `src/BpmnModeler/*` (→ `src/bpmn/*` after the rename) |
| `@shared/*`  | `src/shared/*`    |
| `@components/*` | `src/components/*` |

## Testing

- Vitest, config in `vitest.config.ts` (no app Vite plugins — esbuild transforms TS/TSX). Default
  env is `node`; a suite that needs the DOM adds a `// @vitest-environment jsdom` docblock at the
  top (e.g. anything using `DOMParser`).
- Characterization suites live next to their module as `<module>.test.ts`. They pin current
  behavior so refactors are provably non-breaking — extend them rather than weaken them.

## Lint burn-down (staged `warn`s to promote back to `error`)

Type-checked ESLint is on (`recommendedTypeChecked`). To keep the gate green over a pre-existing
backlog, these rules are temporarily `warn` in `eslint.config.js`. Burn down per file, then promote
each back to `error`. **Priority order:**

1. `@typescript-eslint/no-floating-promises`, `no-misused-promises` — real unhandled-rejection bugs.
2. `@typescript-eslint/no-unsafe-*`, `restrict-template-expressions`, `no-base-to-string` — `unknown`/JSON flows.
3. `no-unnecessary-type-assertion`, `no-redundant-type-constituents` — auto-fixable (`eslint --fix`).
4. `react-hooks/set-state-in-effect`, `react-hooks/refs`, `react-refresh/only-export-components`.
