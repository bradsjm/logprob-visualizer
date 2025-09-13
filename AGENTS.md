# Repository Guidelines

## Project Structure & Module Organization
- `src/` – application code
  - `components/` (PascalCase React components, one file per component)
  - `hooks/` (custom hooks, `useX.ts`)
  - `pages/` (route-level views or screens)
  - `lib/` (pure utilities, no React)
  - `types/` (shared TypeScript types)
  - `App.tsx`, `main.tsx`, `index.css`
- `public/` – static assets.
- Tooling: `vite.config.ts`, `tailwind.config.ts`, `eslint.config.js`, `tsconfig*.json`.

## Build, Test, and Development Commands
- `npm run dev` – start Vite dev server (hot reload).
- `npm run build` – production build to `dist/`.
- `npm run build:dev` – development-optimized build.
- `npm run preview` – serve the built app locally.
- `npm run lint` – run ESLint.

Notes: Prefer `npm`. If using Bun/PNPM, keep lockfiles consistent (do not commit multiple lockfiles).

## Coding Style & Naming Conventions
- Language: TypeScript (strict). No `any` in public APIs.
- Components: PascalCase (`TokenTooltip.tsx`), hooks: `useCamelCase.ts`.
- Files: colocate styles and tests with the module when added.
- Indentation: 2 spaces. Avoid inline styles; use Tailwind tokens and shadcn/ui variants.
- Imports: absolute from `src/` when configured; otherwise relative kept shallow.
- Linting: ESLint; format via IDE settings consistent with ESLint rules.

## Testing Guidelines
- No test runner is wired yet. Recommended: Vitest + React Testing Library.
- Proposed scripts (when added):
  - `test`: `vitest run --coverage`
  - `test:watch`: `vitest`
- Test files: `*.test.ts` / `*.test.tsx` colocated with code.

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits (e.g., `feat: add TokenTooltip`, `fix: clamp top_logprobs`).
- Keep commits focused and atomic; include rationale in the body when changing behavior.
- PRs must include:
  - Clear summary, scope, and screenshots for UI changes.
  - Linked issue (if applicable) and acceptance criteria.
  - Checklists: `build` passes, `lint` clean.

## Security & Configuration Tips
- Environment variables: expose only `VITE_`-prefixed vars to the client; never commit secrets.
- API keys and server-side logic belong in backend routes/services (not in the browser).
- Validate and clamp user-controlled parameters at boundaries before network calls.

## Architecture Notes
- UI uses shadcn/ui, Tailwind, and Recharts. Favor small, pure components and typed props.
- Keep `lib/` framework-free and testable; avoid side effects in utilities.
- Prioritize accessibility (keyboard focus, ARIA labels) and WCAG AA contrast.

